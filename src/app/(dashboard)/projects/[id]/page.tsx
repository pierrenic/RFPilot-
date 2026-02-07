'use client'

import { useEffect, useState } from 'react'
import { useParams, notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { BricksList } from '@/components/bricks-list'
import { BricksKanban } from '@/components/bricks-kanban'
import { ParseRFPButton } from '@/components/parse-rfp-button'

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

export default function ProjectPage() {
  const params = useParams()
  const id = params.id as string
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban')

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/projects/${id}`)
      if (!res.ok) {
        throw new Error('Project not found')
      }
      const data = await res.json()
      setProject(data.project)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProject()
  }, [id])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-pulse">Chargement...</div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-bold text-red-600">Projet non trouvé</h1>
        <Link href="/dashboard">
          <Button className="mt-4">Retour au dashboard</Button>
        </Link>
      </div>
    )
  }

  const bricks = project.bricks || []
  const stats = {
    total: bricks.length,
    draft: bricks.filter((b: any) => b.status === 'draft').length,
    writing: bricks.filter((b: any) => b.status === 'writing').length,
    review: bricks.filter((b: any) => b.status === 'review').length,
    validated: bricks.filter((b: any) => b.status === 'validated').length,
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/dashboard" className="text-slate-400 hover:text-slate-600">
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
            <Badge className={statusColors[project.status]}>
              {statusLabels[project.status]}
            </Badge>
          </div>
          {project.description && (
            <p className="text-slate-600 ml-8">{project.description}</p>
          )}
          {project.deadline && (
            <p className="text-sm text-slate-500 ml-8 mt-1">
              Échéance: {new Date(project.deadline).toLocaleDateString('fr-FR')}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {bricks.length === 0 && (
            <ParseRFPButton projectId={project.id} fileUrl={project.source_file_url} onComplete={fetchProject} />
          )}
          <Button variant="outline">
            <DownloadIcon className="h-4 w-4 mr-2" />
            Exporter
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-slate-500">Questions</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-slate-600">{stats.draft}</div>
            <div className="text-sm text-slate-500">Brouillon</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600">{stats.writing}</div>
            <div className="text-sm text-slate-500">Rédaction</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-600">{stats.review}</div>
            <div className="text-sm text-slate-500">Relecture</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{stats.validated}</div>
            <div className="text-sm text-slate-500">Validé</div>
          </CardContent>
        </Card>
      </div>

      {/* Source file */}
      {project.source_file_name && (
        <Card className="mb-6">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileIcon className="h-5 w-5 text-slate-400" />
                <span className="font-medium">{project.source_file_name}</span>
              </div>
              {project.source_file_url && (
                <a href={project.source_file_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm">
                    <ExternalLinkIcon className="h-4 w-4 mr-1" />
                    Voir
                  </Button>
                </a>
              )}
            </div>
          </CardHeader>
        </Card>
      )}

      {/* View mode toggle */}
      {bricks.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-slate-500">Vue:</span>
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm ${viewMode === 'list' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              <ListViewIcon className="h-4 w-4 inline-block mr-1" />
              Liste
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 text-sm ${viewMode === 'kanban' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              <KanbanIcon className="h-4 w-4 inline-block mr-1" />
              Kanban
            </button>
          </div>
        </div>
      )}

      {/* Bricks view */}
      {bricks.length > 0 ? (
        viewMode === 'kanban' ? (
          <BricksKanban bricks={bricks} projectId={project.id} onRefresh={fetchProject} />
        ) : (
          <BricksList bricks={bricks} projectId={project.id} />
        )
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <ListIcon className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">Aucune question</h3>
            <p className="text-sm text-slate-500 mb-4">
              Cliquez sur &quot;Analyser le cahier des charges&quot; pour extraire les questions automatiquement
            </p>
            <ParseRFPButton projectId={project.id} fileUrl={project.source_file_url} onComplete={fetchProject} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  )
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  )
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  )
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  )
}

function ListViewIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function KanbanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
    </svg>
  )
}
