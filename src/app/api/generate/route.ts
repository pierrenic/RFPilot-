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

// Simple embedding for RAG search
function generateSimpleEmbedding(text: string): number[] {
  const embedding: number[] = new Array(1536).fill(0)
  for (let i = 0; i < text.length && i < 1536; i++) {
    embedding[i % 1536] += text.charCodeAt(i) / 255
  }
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude
    }
  }
  return embedding
}

// Search for relevant chunks in corpus
async function searchRelevantChunks(query: string, projectId: string): Promise<{ content: string; source: string }[]> {
  try {
    // Get corpus linked to project
    const { data: projectCorpus } = await supabase
      .from('project_corpus')
      .select('corpus_id')
      .eq('project_id', projectId)
    
    let corpusIds = projectCorpus?.map(pc => pc.corpus_id) || []
    
    // If no linked corpus, get all org corpus
    if (corpusIds.length === 0) {
      const { data: allCorpus } = await supabase
        .from('corpus')
        .select('id')
        .eq('org_id', '86934efc-fa20-467a-8a8d-abbfc4af79ef')
      corpusIds = allCorpus?.map(c => c.id) || []
    }

    if (corpusIds.length === 0) {
      return []
    }

    // Try vector search first
    const queryEmbedding = generateSimpleEmbedding(query)
    
    const { data: chunks, error } = await supabase.rpc('search_document_chunks', {
      query_embedding: queryEmbedding,
      corpus_ids: corpusIds,
      match_count: 5
    })

    if (!error && chunks && chunks.length > 0) {
      return chunks.map((c: any) => ({
        content: c.content,
        source: c.document_name || 'Document'
      }))
    }

    // Fallback: simple text search
    const searchTerms = query.split(' ')
      .filter(w => w.length > 3)
      .slice(0, 5)
      .join(' | ')

    if (!searchTerms) return []

    const { data: fallbackChunks } = await supabase
      .from('document_chunks')
      .select(`
        content,
        corpus_documents!inner (
          name,
          corpus_id
        )
      `)
      .in('corpus_documents.corpus_id', corpusIds)
      .limit(5)

    return (fallbackChunks || []).map((c: any) => ({
      content: c.content,
      source: c.corpus_documents?.name || 'Document'
    }))

  } catch (error) {
    console.error('RAG search error:', error)
    return []
  }
}

export async function POST(request: Request) {
  try {
    const { projectId, brickId, question } = await request.json()

    if (!projectId || !brickId || !question) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify brick exists
    const { data: brick, error: brickError } = await supabase
      .from('bricks')
      .select('*, projects(*)')
      .eq('id', brickId)
      .single()

    if (brickError || !brick) {
      return NextResponse.json({ error: 'Brick not found' }, { status: 404 })
    }

    // Get project context
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    // RAG: Search relevant chunks from corpus
    const relevantChunks = await searchRelevantChunks(question, projectId)
    const contextFromCorpus = relevantChunks.length > 0
      ? `\n\nINFORMATIONS DE RÉFÉRENCE (extraites de vos documents):\n${relevantChunks.map((c, i) => `[Source: ${c.source}]\n${c.content}`).join('\n\n---\n\n')}`
      : ''

    const sources = relevantChunks.map(c => c.source).filter((v, i, a) => a.indexOf(v) === i)

    const prompt = `Tu es un expert en rédaction de réponses aux appels d'offres pour une entreprise tech.

Contexte du projet: ${project?.name || 'Appel d\'offres'}
${project?.description || ''}
${contextFromCorpus}

Question à répondre:
"${question}"

CONSIGNES:
- Rédige une réponse professionnelle, structurée et convaincante
- Si des informations de référence sont fournies, utilise-les pour personnaliser la réponse
- Sois précis et concret, avec des exemples si pertinent
- Utilise des paragraphes courts et des listes à puces si approprié
- Format: HTML simple (<p>, <ul><li>, <strong>, pas de styles inline)
- La réponse doit être entre 200 et 400 mots

Réponds directement avec le HTML de la réponse, sans préambule.`

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1500,
      messages: [
        { role: 'user', content: prompt }
      ],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Format response if not already HTML
    let formattedResponse = responseText
    if (!formattedResponse.includes('<p>') && !formattedResponse.includes('<ul>')) {
      formattedResponse = responseText
        .split('\n\n')
        .filter(p => p.trim())
        .map(para => {
          const trimmed = para.trim()
          if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
            const items = trimmed.split('\n').map(item => 
              `<li>${item.replace(/^[-•]\s*/, '')}</li>`
            ).join('')
            return `<ul>${items}</ul>`
          }
          return `<p>${trimmed}</p>`
        })
        .join('')
    }

    // Save AI response to brick with sources
    await supabase
      .from('bricks')
      .update({ 
        ai_response_text: formattedResponse,
        ai_sources: sources.length > 0 ? sources : null,
        status: 'writing'
      })
      .eq('id', brickId)

    return NextResponse.json({ 
      success: true, 
      response: formattedResponse,
      sources: sources,
      usedRAG: relevantChunks.length > 0
    })

  } catch (error: any) {
    console.error('Generate error:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
