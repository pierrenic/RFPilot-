import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

// Chunk text into ~500 token segments (roughly 2000 chars)
function chunkText(text: string, chunkSize: number = 2000, overlap: number = 200): string[] {
  const chunks: string[] = []
  const sentences = text.split(/(?<=[.!?])\s+/)
  
  let currentChunk = ''
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      // Keep last part for overlap
      const words = currentChunk.split(' ')
      const overlapWords = words.slice(-Math.floor(overlap / 5)).join(' ')
      currentChunk = overlapWords + ' ' + sentence
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }
  
  return chunks
}

// Generate embeddings using Claude (via sentence analysis)
// Note: For production, use OpenAI embeddings or a dedicated embedding model
async function generateSimpleEmbedding(text: string): Promise<number[]> {
  // Simple approach: create a deterministic pseudo-embedding based on text features
  // This is a placeholder - in production, use OpenAI embeddings API
  const embedding: number[] = new Array(1536).fill(0)
  
  // Create a simple hash-based embedding
  for (let i = 0; i < text.length && i < 1536; i++) {
    const charCode = text.charCodeAt(i)
    embedding[i % 1536] += charCode / 255
  }
  
  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude
    }
  }
  
  return embedding
}

// POST: Upload and process a document
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: corpusId } = await params
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const fileName = file.name
    const fileType = fileName.split('.').pop()?.toLowerCase() || 'txt'
    const buffer = Buffer.from(await file.arrayBuffer())

    // Store file in Supabase Storage
    const storagePath = `corpus/${corpusId}/${Date.now()}-${fileName}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('corpus-documents')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false
      })

    let fileUrl = ''
    if (!uploadError && uploadData) {
      const { data: urlData } = supabase.storage
        .from('corpus-documents')
        .getPublicUrl(storagePath)
      fileUrl = urlData.publicUrl
    } else {
      console.warn('Storage upload failed, using base64 fallback:', uploadError)
      // Fallback: store as data URL (not ideal for production)
      fileUrl = `data:${file.type};base64,${buffer.toString('base64').slice(0, 100)}...`
    }

    // Create document record
    const { data: doc, error: docError } = await supabase
      .from('corpus_documents')
      .insert({
        corpus_id: corpusId,
        name: fileName,
        file_url: fileUrl,
        file_type: fileType,
        status: 'processing'
      })
      .select()
      .single()

    if (docError) {
      console.error('Document insert error:', docError)
      return NextResponse.json({ error: 'Failed to create document' }, { status: 500 })
    }

    // Extract text from document
    let textContent = ''
    
    if (fileType === 'pdf') {
      try {
        const { extractText } = await import('unpdf')
        const result = await extractText(buffer)
        textContent = result.text
      } catch (pdfErr) {
        console.error('PDF parse error:', pdfErr)
        textContent = buffer.toString('utf-8')
      }
    } else if (fileType === 'docx' || fileType === 'doc') {
      try {
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ buffer })
        textContent = result.value
      } catch (docErr) {
        console.error('DOCX parse error:', docErr)
        textContent = buffer.toString('utf-8')
      }
    } else {
      textContent = buffer.toString('utf-8')
    }

    if (!textContent || textContent.trim().length < 10) {
      await supabase
        .from('corpus_documents')
        .update({ status: 'error' })
        .eq('id', doc.id)
      return NextResponse.json({ error: 'Could not extract text from document' }, { status: 400 })
    }

    // Chunk the text
    const chunks = chunkText(textContent)
    console.log(`Created ${chunks.length} chunks from ${fileName}`)

    // Create chunk records with embeddings
    const chunkRecords = []
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await generateSimpleEmbedding(chunks[i])
      chunkRecords.push({
        corpus_document_id: doc.id,
        content: chunks[i],
        embedding: embedding,
        position: i,
        page_number: null // Could be extracted for PDFs
      })
    }

    // Insert chunks in batches
    const batchSize = 50
    for (let i = 0; i < chunkRecords.length; i += batchSize) {
      const batch = chunkRecords.slice(i, i + batchSize)
      const { error: chunkError } = await supabase
        .from('document_chunks')
        .insert(batch)
      
      if (chunkError) {
        console.error('Chunk insert error:', chunkError)
      }
    }

    // Update document status
    await supabase
      .from('corpus_documents')
      .update({ 
        status: 'ready',
        chunk_count: chunks.length
      })
      .eq('id', doc.id)

    return NextResponse.json({ 
      success: true,
      document: {
        id: doc.id,
        name: fileName,
        chunkCount: chunks.length,
        textLength: textContent.length
      }
    })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Remove a document from corpus
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: corpusId } = await params
    const { documentId } = await request.json()

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 })
    }

    // Delete document (chunks will cascade)
    const { error } = await supabase
      .from('corpus_documents')
      .delete()
      .eq('id', documentId)
      .eq('corpus_id', corpusId)

    if (error) {
      console.error('Delete error:', error)
      return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
