import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET: List all corpus for the organization
export async function GET(request: NextRequest) {
  try {
    const orgId = request.nextUrl.searchParams.get('orgId') || '86934efc-fa20-467a-8a8d-abbfc4af79ef'
    
    const { data: corpusList, error } = await supabase
      .from('corpus')
      .select(`
        *,
        corpus_documents (
          id,
          name,
          file_type,
          chunk_count,
          status,
          created_at
        )
      `)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch corpus' }, { status: 500 })
    }

    return NextResponse.json({ corpus: corpusList })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Create a new corpus
export async function POST(request: NextRequest) {
  try {
    const { name, description, orgId } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('corpus')
      .insert({
        org_id: orgId || '86934efc-fa20-467a-8a8d-abbfc4af79ef',
        name,
        description: description || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Insert error:', error)
      return NextResponse.json({ error: 'Failed to create corpus' }, { status: 500 })
    }

    return NextResponse.json({ corpus: data })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
