import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

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
      // Dynamic import for pdf-parse
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse')
      const data = await pdfParse(buffer)
      textContent = data.text
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

    // Use Claude to extract questions from the document
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: `Tu es un expert en analyse de cahiers des charges et appels d'offres.

Analyse le document suivant et extrait TOUTES les questions, exigences, critères ou points qui nécessitent une réponse de la part du soumissionnaire.

Pour chaque élément extrait, détermine sa catégorie parmi : technique, juridique, financier, commercial, references, admin, other

Réponds UNIQUEMENT avec un JSON valide (pas de markdown, pas de texte avant ou après) dans ce format:
{
  "questions": [
    {"text": "La question ou exigence exacte", "tag": "technique"},
    {"text": "Une autre question", "tag": "juridique"}
  ]
}

DOCUMENT À ANALYSER:
${textContent.slice(0, 30000)}`,
          },
        ],
      }),
    })

    if (!claudeResponse.ok) {
      const error = await claudeResponse.text()
      console.error('Claude API error:', error)
      return NextResponse.json({ error: 'Failed to analyze document with AI' }, { status: 500 })
    }

    const claudeData = await claudeResponse.json()
    const aiContent = claudeData.content?.[0]?.text || ''

    // Parse the JSON response
    let questions: { text: string; tag: string }[] = []
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        questions = parsed.questions || []
      }
    } catch (e) {
      console.error('Failed to parse AI response:', e)
      // Fallback: split by lines and treat each as a question
      const lines = textContent.split('\n').filter((line: string) => {
        const trimmed = line.trim()
        return trimmed.length > 20 && (trimmed.includes('?') || /^\d+[\.\)]/.test(trimmed))
      })
      questions = lines.slice(0, 50).map((line: string) => ({ text: line.trim(), tag: 'other' }))
    }

    if (questions.length === 0) {
      return NextResponse.json({ error: 'No questions found in document' }, { status: 400 })
    }

    // Insert bricks into database
    const bricks = questions.map((q, index) => ({
      project_id: projectId,
      order_index: index,
      original_text: q.text,
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
      bricksCount: questions.length,
      questions: questions.slice(0, 5) // Preview
    })

  } catch (error) {
    console.error('Parse error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
