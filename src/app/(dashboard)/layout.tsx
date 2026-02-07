import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'

// TEST MODE - bypass auth for testing
const TEST_MODE = true

const mockUser = {
  id: 'test-user-001',
  email: 'pn@arianee.org',
  user_metadata: { name: 'PN Test' }
}

const mockProfile = {
  id: 'test-user-001',
  email: 'pn@arianee.org',
  name: 'PN Test',
  avatar_url: null
}

const mockOrganizations = [
  { id: '86934efc-fa20-467a-8a8d-abbfc4af79ef', name: 'Arianee', slug: 'arianee', is_test: false }
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (TEST_MODE) {
    return (
      <div className="flex h-screen bg-slate-50">
        <Sidebar 
          user={mockUser as any} 
          profile={mockProfile} 
          organizations={mockOrganizations} 
        />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Get user's organizations
  const { data: memberships } = await supabase
    .from('org_members')
    .select('*, organizations(*)')
    .eq('user_id', user.id)

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar 
        user={user} 
        profile={profile} 
        organizations={memberships?.map(m => m.organizations) || []} 
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
