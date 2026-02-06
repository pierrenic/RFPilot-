import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
