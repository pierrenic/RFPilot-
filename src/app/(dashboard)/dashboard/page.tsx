import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

// TEST MODE
const TEST_MODE = true

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  review: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
}

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  in_progress: 'En cours',
  review: 'Relecture',
  completed: 'Terminé',
}

export default async function DashboardPage() {
  let projects: any[] = []
  
  if (!TEST_MODE) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Get user's projects through org membership
    const { data } = await supabase
      .from('projects')
      .select(`
        *,
        organizations(name),
        bricks(count)
      `)
      .order('updated_at', { ascending: false })
    
    projects = data || []
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projets</h1>
          <p className="text-slate-600">Gérez vos réponses aux appels d&apos;offres</p>
        </div>
        <Link href="/projects/new">
          <Button>
            <PlusIcon className="h-4 w-4 mr-2" />
            Nouveau projet
          </Button>
        </Link>
      </div>

      {projects && projects.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg font-semibold line-clamp-1">
                      {project.name}
                    </CardTitle>
                    <Badge className={statusColors[project.status]}>
                      {statusLabels[project.status]}
                    </Badge>
                  </div>
                  {project.organizations && (
                    <CardDescription className="text-xs">
                      {project.organizations.name}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {project.description && (
                    <p className="text-sm text-slate-600 line-clamp-2 mb-3">
                      {project.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {project.bricks?.[0]?.count || 0} questions
                    </span>
                    {project.deadline && (
                      <span>
                        Échéance: {new Date(project.deadline).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <FolderIcon className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">Aucun projet</h3>
            <p className="text-sm text-slate-500 mb-4">
              Commencez par créer votre premier projet
            </p>
            <Link href="/projects/new">
              <Button>
                <PlusIcon className="h-4 w-4 mr-2" />
                Nouveau projet
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  )
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  )
}
