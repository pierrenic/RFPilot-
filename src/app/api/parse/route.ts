import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// Use service role key to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Dynamic import for pdf-parse v2.x (uses PDFParse class)
async function parsePDF(buffer: Buffer): Promise<string> {
  // @ts-expect-error - pdf-parse types issue
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: buffer })
  const result = await parser.getText()
  return result.text
}

export async function POST(request: Request) {
  try {
    const { projectId, fileUrl } = await request.json()

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
    }

    // Verify project exists
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get file content
    let documentText = ''
    
    if (fileUrl) {
      try {
        // Download the PDF
        const response = await fetch(fileUrl)
        if (!response.ok) {
          throw new Error('Failed to download file')
        }
        
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        
        // Parse PDF
        documentText = await parsePDF(buffer)
        console.log(`Extracted ${documentText.length} chars from PDF`)
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError)
        // Continue without PDF content
      }
    }

    // If no document text, use project name as context
    if (!documentText) {
      documentText = `Appel d'offres: ${project.name}\n${project.description || ''}`
    }

    // Split into chunks if too long (Claude has context limits)
    const maxChars = 100000
    const textForAnalysis = documentText.length > maxChars 
      ? documentText.substring(0, maxChars) + '\n[Document tronqué...]'
      : documentText

    const prompt = `Tu es un expert en analyse d'appels d'offres.

Voici le contenu d'un cahier des charges. Analyse-le et extrait TOUTES les questions, exigences, critères et points auxquels le soumissionnaire doit répondre.

DOCUMENT:
"""
${textForAnalysis}
"""

INSTRUCTIONS:
- Extrais CHAQUE question, exigence, critère ou point qui nécessite une réponse
- Ne limite pas le nombre - extrais TOUT ce qui est pertinent
- Pour chaque élément, fournis:
  1. "text": le texte exact ou reformulé de la question/exigence
  2. "title": un titre court (max 10 mots)
  3. "tag": une catégorie parmi: technique, juridique, financier, commercial, references, admin, other

Réponds UNIQUEMENT en JSON valide avec ce format:
{
  "questions": [
    {"text": "...", "title": "...", "tag": "..."}
  ]
}`

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4096,
      messages: [
        { role: 'user', content: prompt }
      ],
    })

    // Extract JSON from response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    
    if (!jsonMatch) {
      console.error('No JSON found in response:', responseText.substring(0, 500))
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    let parsed
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      return NextResponse.json({ error: 'Invalid JSON in AI response' }, { status: 500 })
    }
    
    const questions = parsed.questions || []

    if (questions.length === 0) {
      return NextResponse.json({ error: 'No questions found in document' }, { status: 400 })
    }

    // Insert bricks into database
    const bricks = questions.map((q: any, index: number) => ({
      project_id: projectId,
      order_index: index,
      original_text: q.text,
      title: q.title,
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
      bricksCount: bricks.length,
      documentLength: documentText.length,
      message: `${bricks.length} questions extraites avec succès`
    })

  } catch (error: any) {
    console.error('Parse error:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
