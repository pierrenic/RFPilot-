import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

// Split text into chunks for processing large documents
function splitTextIntoChunks(text: string, maxChunkSize: number = 25000): string[] {
  const chunks: string[] = []
  const paragraphs = text.split(/\n\n+/)
  let currentChunk = ''
  
  for (const para of paragraphs) {
    if ((currentChunk + para).length > maxChunkSize) {
      if (currentChunk) chunks.push(currentChunk.trim())
      currentChunk = para
    } else {
      currentChunk += '\n\n' + para
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim())
  return chunks
}

async function extractQuestionsFromChunk(textChunk: string, chunkIndex: number): Promise<{ text: string; tag: string; title?: string }[]> {
  const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Tu es un expert en analyse de cahiers des charges et appels d'offres.

Analyse ce fragment de document (partie ${chunkIndex + 1}) et extrait TOUTES les questions, exigences, critères ou points qui nécessitent une réponse de la part du soumissionnaire.

IMPORTANT: 
- Extrait CHAQUE exigence individuellement, même les sous-points
- Inclus les critères d'évaluation, les prérequis techniques, les certifications demandées
- Ne regroupe pas plusieurs questions en une seule
- Génère un titre court (max 8 mots) pour chaque question

Pour chaque élément, détermine sa catégorie:
- technique: spécifications techniques, architecture, performances, sécurité
- juridique: aspects légaux, conformité, RGPD, contrats
- financier: prix, budget, conditions de paiement
- commercial: délais, SLA, support, formation
- references: expériences similaires, cas clients, portfolio
- admin: documents administratifs, attestations, formulaires
- other: autres

Réponds UNIQUEMENT avec un JSON valide:
{
  "questions": [
    {"text": "Question complète", "title": "Titre court", "tag": "technique"}
  ]
}

DOCUMENT:
${textChunk}`,
        },
      ],
    }),
  })

  if (!claudeResponse.ok) {
    console.error('Claude API error:', await claudeResponse.text())
    return []
  }

  const claudeData = await claudeResponse.json()
  const aiContent = claudeData.content?.[0]?.text || ''

  try {
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return parsed.questions || []
    }
  } catch (e) {
    console.error('Failed to parse AI response:', e)
  }
  return []
}

export async function POST(request: NextRequest) {
  try {
    const { projectId, fileUrl, fileName } = await request.json()

    if (!projectId || !fileUrl) {
      return NextResponse.json({ error: 'Missing projectId or fileUrl' }, { status: 400 })
    }

    // Fetch the file
    const fileResponse = await fetch(fileUrl)
    if (!fileResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch file' }, { status: 500 })
    }

    const fileBuffer = await fileResponse.arrayBuffer()
    const buffer = Buffer.from(fileBuffer)
    let textContent = ''

    // Parse based on file type
    const ext = fileName?.toLowerCase().split('.').pop() || ''
    
    if (ext === 'pdf') {
      // Use unpdf for serverless-compatible PDF parsing
      const { extractText } = await import('unpdf')
      const result = await extractText(buffer)
      textContent = result.text.join('\n')
    } else if (ext === 'docx' || ext === 'doc') {
      // Dynamic import for mammoth
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      textContent = result.value
    } else {
      // Try as plain text
      textContent = buffer.toString('utf-8')
    }

    if (!textContent || textContent.trim().length < 50) {
      return NextResponse.json({ error: 'Could not extract text from document' }, { status: 400 })
    }

    console.log(`Extracted ${textContent.length} characters from document`)

    // Split into chunks and process each
    const chunks = splitTextIntoChunks(textContent)
    console.log(`Processing ${chunks.length} chunks`)

    let allQuestions: { text: string; tag: string; title?: string }[] = []
    
    // Process chunks sequentially to avoid rate limits
    for (let i = 0; i < chunks.length; i++) {
      console.log(`Processing chunk ${i + 1}/${chunks.length}`)
      const questions = await extractQuestionsFromChunk(chunks[i], i)
      allQuestions = allQuestions.concat(questions)
      
      // Small delay between chunks to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    // Deduplicate questions by text similarity
    const seen = new Set<string>()
    const uniqueQuestions = allQuestions.filter(q => {
      const key = q.text.toLowerCase().slice(0, 100)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    console.log(`Found ${uniqueQuestions.length} unique questions`)

    if (uniqueQuestions.length === 0) {
      // Fallback: extract from text directly
      const lines = textContent.split('\n').filter((line: string) => {
        const trimmed = line.trim()
        return trimmed.length > 20 && (
          trimmed.includes('?') || 
          /^\d+[\.\)]\s/.test(trimmed) ||
          /^[-•]\s/.test(trimmed) ||
          trimmed.toLowerCase().includes('fournir') ||
          trimmed.toLowerCase().includes('décrire') ||
          trimmed.toLowerCase().includes('préciser')
        )
      })
      uniqueQuestions.push(...lines.slice(0, 100).map((line: string) => ({ 
        text: line.trim(), 
        tag: 'other',
        title: line.trim().slice(0, 50)
      })))
    }

    if (uniqueQuestions.length === 0) {
      return NextResponse.json({ error: 'No questions found in document' }, { status: 400 })
    }

    // Insert bricks into database
    const bricks = uniqueQuestions.map((q, index) => ({
      project_id: projectId,
      order_index: index,
      original_text: q.text,
      title: q.title || null,
      tag: q.tag || 'other',
      status: 'draft',
    }))

    const { error: insertError } = await supabase
      .from('bricks')
      .insert(bricks)

    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save questions' }, { status: 500 })
    }

    // Update project status
    await supabase
      .from('projects')
      .update({ status: 'in_progress' })
      .eq('id', projectId)

    return NextResponse.json({ 
      success: true, 
      bricksCount: uniqueQuestions.length,
      documentLength: textContent.length,
      chunksProcessed: chunks.length,
      questions: uniqueQuestions.slice(0, 10) // Preview
    })

  } catch (error) {
    console.error('Parse error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
