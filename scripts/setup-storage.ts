import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function setupStorage() {
  console.log('Setting up Supabase storage buckets...')

  // Create rfp-documents bucket
  const { data: rfpBucket, error: rfpError } = await supabase.storage.createBucket('rfp-documents', {
    public: true,
    fileSizeLimit: 52428800, // 50MB
    allowedMimeTypes: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
  })

  if (rfpError && !rfpError.message.includes('already exists')) {
    console.error('Error creating rfp-documents bucket:', rfpError)
  } else {
    console.log('✓ rfp-documents bucket ready')
  }

  // Create corpus-documents bucket
  const { data: corpusBucket, error: corpusError } = await supabase.storage.createBucket('corpus-documents', {
    public: true,
    fileSizeLimit: 52428800, // 50MB
    allowedMimeTypes: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
  })

  if (corpusError && !corpusError.message.includes('already exists')) {
    console.error('Error creating corpus-documents bucket:', corpusError)
  } else {
    console.log('✓ corpus-documents bucket ready')
  }

  console.log('Storage setup complete!')
}

setupStorage().catch(console.error)
