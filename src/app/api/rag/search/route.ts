import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Simple embedding for search query (same as in document processing)
function generateSimpleEmbedding(text: string): number[] {
  const embedding: number[] = new Array(1536).fill(0)
  
  for (let i = 0; i < text.length && i < 1536; i++) {
    const charCode = text.charCodeAt(i)
    embedding[i % 1536] += charCode / 255
  }
  
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude
    }
  }
  
  return embedding
}

// POST: Search for relevant chunks
export async function POST(request: NextRequest) {
  try {
    const { query, corpusIds, projectId, limit = 5 } = await request.json()

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    let targetCorpusIds: string[] = corpusIds || []

    // If projectId provided, get linked corpus
    if (projectId && targetCorpusIds.length === 0) {
      const { data: projectCorpus } = await supabase
        .from('project_corpus')
        .select('corpus_id')
        .eq('project_id', projectId)
      
      if (projectCorpus) {
        targetCorpusIds = projectCorpus.map(pc => pc.corpus_id)
      }
    }

    // If still no corpus, get all corpus for the org
    if (targetCorpusIds.length === 0) {
      const { data: allCorpus } = await supabase
        .from('corpus')
        .select('id')
        .eq('org_id', '86934efc-fa20-467a-8a8d-abbfc4af79ef')
      
      if (allCorpus) {
        targetCorpusIds = allCorpus.map(c => c.id)
      }
    }

    if (targetCorpusIds.length === 0) {
      return NextResponse.json({ chunks: [], message: 'No corpus found' })
    }

    // Generate embedding for search query
    const queryEmbedding = generateSimpleEmbedding(query)

    // Search using pgvector cosine similarity
    // Note: This requires the pgvector extension and proper index
    const { data: chunks, error } = await supabase.rpc('search_document_chunks', {
      query_embedding: queryEmbedding,
      corpus_ids: targetCorpusIds,
      match_count: limit
    })

    if (error) {
      console.error('Search error:', error)
      // Fallback: simple text search
      const { data: fallbackChunks } = await supabase
        .from('document_chunks')
        .select(`
          id,
          content,
          position,
          corpus_documents!inner (
            id,
            name,
            corpus_id
          )
        `)
        .in('corpus_documents.corpus_id', targetCorpusIds)
        .textSearch('content', query.split(' ').join(' | '))
        .limit(limit)

      return NextResponse.json({ 
        chunks: fallbackChunks || [],
        method: 'text_search'
      })
    }

    return NextResponse.json({ 
      chunks: chunks || [],
      method: 'vector_search'
    })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
