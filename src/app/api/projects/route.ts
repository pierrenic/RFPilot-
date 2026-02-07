import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Use service role key to bypass RLS for testing
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TEST_ORG_ID = '86934efc-fa20-467a-8a8d-abbfc4af79ef'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, description, deadline, source_file_url, source_file_name } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        name,
        description: description || null,
        deadline: deadline || null,
        org_id: TEST_ORG_ID,
        status: 'draft',
        source_file_url: source_file_url || null,
        source_file_name: source_file_name || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ project })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*, bricks(count)')
      .eq('org_id', TEST_ORG_ID)
      .order('updated_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ projects })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
