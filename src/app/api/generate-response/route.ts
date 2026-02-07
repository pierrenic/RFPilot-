import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

export async function POST(request: NextRequest) {
  try {
    const { brickId, question, projectContext } = await request.json()

    if (!brickId || !question) {
      return NextResponse.json({ error: 'Missing brickId or question' }, { status: 400 })
    }

    // Generate response with Claude
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: `Tu es un expert en rédaction de réponses aux appels d'offres. Tu dois rédiger une réponse professionnelle, structurée et convaincante.

${projectContext ? `CONTEXTE DU PROJET:\n${projectContext}\n\n` : ''}

QUESTION/EXIGENCE À TRAITER:
${question}

CONSIGNES:
- Rédige une réponse claire, professionnelle et structurée
- Utilise des paragraphes courts et des listes à puces si pertinent
- Sois précis et concret
- Adopte un ton confiant mais pas arrogant
- La réponse doit être directement utilisable dans un dossier d'appel d'offres
- Format: HTML simple (paragraphes <p>, listes <ul><li>, pas de styles inline)

RÉPONSE:`,
          },
        ],
      }),
    })

    if (!claudeResponse.ok) {
      const error = await claudeResponse.text()
      console.error('Claude API error:', error)
      return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 })
    }

    const claudeData = await claudeResponse.json()
    const aiResponse = claudeData.content?.[0]?.text || ''

    if (!aiResponse) {
      return NextResponse.json({ error: 'Empty AI response' }, { status: 500 })
    }

    // Format the response as HTML if it's not already
    let formattedResponse = aiResponse
    if (!formattedResponse.includes('<p>') && !formattedResponse.includes('<ul>')) {
      // Convert markdown-like text to basic HTML
      formattedResponse = formattedResponse
        .split('\n\n')
        .map((para: string) => {
          const trimmed = para.trim()
          if (!trimmed) return ''
          if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
            const items = trimmed.split('\n').map((item: string) => 
              `<li>${item.replace(/^[-•]\s*/, '')}</li>`
            ).join('')
            return `<ul>${items}</ul>`
          }
          return `<p>${trimmed}</p>`
        })
        .join('')
    }

    // Save to database
    const { error: updateError } = await supabase
      .from('bricks')
      .update({ 
        ai_response_text: formattedResponse,
        status: 'writing'
      })
      .eq('id', brickId)

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json({ error: 'Failed to save response' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      response: formattedResponse
    })

  } catch (error) {
    console.error('Generate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
