import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const migrationSQL = `
-- Function for vector similarity search on document chunks
CREATE OR REPLACE FUNCTION search_document_chunks(
  query_embedding vector(1536),
  corpus_ids uuid[],
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  position int,
  similarity float,
  document_id uuid,
  document_name text,
  corpus_id uuid
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id,
    dc.content,
    dc.position,
    1 - (dc.embedding <=> query_embedding) as similarity,
    cd.id as document_id,
    cd.name as document_name,
    cd.corpus_id
  FROM document_chunks dc
  JOIN corpus_documents cd ON dc.corpus_document_id = cd.id
  WHERE cd.corpus_id = ANY(corpus_ids)
    AND cd.status = 'ready'
    AND dc.embedding IS NOT NULL
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
`

async function runMigration() {
  console.log('Running vector search migration...')

  const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL })

  if (error) {
    // Try direct approach via REST
    console.log('Direct RPC failed, the function may need manual creation')
    console.log('SQL to run manually:')
    console.log(migrationSQL)
  } else {
    console.log('✓ Migration complete')
  }
}

runMigration().catch(console.error)
