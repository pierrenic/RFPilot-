'use client'

import { useEffect, useState, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import Link from 'next/link'
import { BrickEditor } from '@/components/brick-editor'

interface Brick {
  id: string
  order_index: number
  original_text: string
  title: string | null
  tag: string
  status: string
  response_text: string | null
  ai_response_text: string | null
}

interface Project {
  id: string
  name: string
  description: string | null
  status: string
  deadline: string | null
  source_file_url: string | null
  source_file_name: string | null
  created_at: string
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  writing: 'bg-blue-100 text-blue-700',
  review: 'bg-amber-100 text-amber-700',
  validated: 'bg-green-100 text-green-700',
}

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  writing: 'Rédaction',
  review: 'Relecture',
  validated: 'Validé',
}

const tagColors: Record<string, string> = {
  technique: 'bg-purple-100 text-purple-700',
  juridique: 'bg-red-100 text-red-700',
  financier: 'bg-green-100 text-green-700',
  commercial: 'bg-blue-100 text-blue-700',
  references: 'bg-orange-100 text-orange-700',
  admin: 'bg-slate-100 text-slate-700',
  other: 'bg-gray-100 text-gray-700',
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const [project, setProject] = useState<Project | null>(null)
  const [bricks, setBricks] = useState<Brick[]>([])
  const [loading, setLoading] = useState(true)
  const [parsing, setParsing] = useState(false)
  const [selectedBrick, setSelectedBrick] = useState<Brick | null>(null)
  const [generatingAll, setGeneratingAll] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    loadProject()
  }, [projectId])

  async function loadProject() {
    setLoading(true)
    try {
      const { data: proj, error: projError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (projError) throw projError
      setProject(proj)

      const { data: bricksData, error: bricksError } = await supabase
        .from('bricks')
        .select('*')
        .eq('project_id', projectId)
        .order('order_index')

      if (bricksError) throw bricksError
      setBricks(bricksData || [])
    } catch (error) {
      console.error(error)
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  async function parseDocument() {
    if (!project?.source_file_url) {
      toast.error('Aucun fichier uploadé')
      return
    }

    setParsing(true)
    try {
      const response = await fetch('/api/parse-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          fileUrl: project.source_file_url,
          fileName: project.source_file_name,
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error)

      toast.success(`${result.bricksCount} questions extraites !`)
      loadProject()
    } catch (error) {
      console.error(error)
      toast.error('Erreur lors du parsing')
    } finally {
      setParsing(false)
    }
  }

  async function generateAllResponses() {
    const draftBricks = bricks.filter(b => b.status === 'draft' && !b.ai_response_text)
    if (draftBricks.length === 0) {
      toast.info('Aucune question sans réponse IA')
      return
    }

    setGeneratingAll(true)
    let generated = 0

    for (const brick of draftBricks) {
      try {
        const response = await fetch('/api/generate-response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brickId: brick.id,
            question: brick.original_text,
            projectContext: project?.description || '',
          }),
        })

        if (response.ok) {
          generated++
        }
      } catch (e) {
        console.error(e)
      }
    }

    toast.success(`${generated} réponses générées !`)
    loadProject()
    setGeneratingAll(false)
  }

  async function updateBrickStatus(brickId: string, newStatus: string) {
    try {
      const { error } = await supabase
        .from('bricks')
        .update({ status: newStatus })
        .eq('id', brickId)

      if (error) throw error
      setBricks(bricks.map(b => b.id === brickId ? { ...b, status: newStatus } : b))
      toast.success('Statut mis à jour')
    } catch (error) {
      console.error(error)
      toast.error('Erreur')
    }
  }

  async function saveBrickResponse(brickId: string, responseText: string) {
    try {
      const { error } = await supabase
        .from('bricks')
        .update({ response_text: responseText })
        .eq('id', brickId)

      if (error) throw error
      setBricks(bricks.map(b => b.id === brickId ? { ...b, response_text: responseText } : b))
      toast.success('Réponse sauvegardée')
    } catch (error) {
      console.error(error)
      toast.error('Erreur de sauvegarde')
    }
  }

  function exportResponses() {
    const validatedBricks = bricks.filter(b => b.status === 'validated' || b.response_text)
    if (validatedBricks.length === 0) {
      toast.error('Aucune réponse à exporter')
      return
    }

    const content = validatedBricks.map((b, i) => {
      return `## Question ${i + 1}\n\n${b.original_text}\n\n### Réponse\n\n${b.response_text || b.ai_response_text || '(pas de réponse)'}\n\n---\n`
    }).join('\n')

    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project?.name || 'export'}-reponses.md`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Export téléchargé !')
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-8">
        <p className="text-slate-600">Projet non trouvé</p>
        <Link href="/dashboard">
          <Button variant="outline" className="mt-4">Retour</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/dashboard" className="text-slate-400 hover:text-slate-600">
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
          </div>
          {project.description && (
            <p className="text-slate-600 ml-7">{project.description}</p>
          )}
          {project.deadline && (
            <p className="text-sm text-slate-500 ml-7 mt-1">
              Échéance: {new Date(project.deadline).toLocaleDateString('fr-FR')}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportResponses}>
            <DownloadIcon className="h-4 w-4 mr-2" />
            Exporter
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{bricks.length}</div>
            <div className="text-sm text-slate-500">Questions</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-600">
              {bricks.filter(b => b.status === 'draft').length}
            </div>
            <div className="text-sm text-slate-500">Brouillons</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600">
              {bricks.filter(b => b.status === 'review').length}
            </div>
            <div className="text-sm text-slate-500">En relecture</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">
              {bricks.filter(b => b.status === 'validated').length}
            </div>
            <div className="text-sm text-slate-500">Validées</div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      {project.source_file_url && bricks.length === 0 && (
        <Card className="mb-6 border-dashed">
          <CardContent className="py-6 text-center">
            <p className="text-slate-600 mb-4">
              Fichier uploadé: <strong>{project.source_file_name}</strong>
            </p>
            <Button onClick={parseDocument} disabled={parsing}>
              {parsing ? (
                <>
                  <SpinnerIcon className="h-4 w-4 mr-2 animate-spin" />
                  Analyse en cours...
                </>
              ) : (
                <>
                  <WandIcon className="h-4 w-4 mr-2" />
                  Extraire les questions
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {bricks.length > 0 && (
        <div className="mb-6 flex gap-2">
          <Button variant="outline" onClick={generateAllResponses} disabled={generatingAll}>
            {generatingAll ? (
              <>
                <SpinnerIcon className="h-4 w-4 mr-2 animate-spin" />
                Génération...
              </>
            ) : (
              <>
                <SparklesIcon className="h-4 w-4 mr-2" />
                Générer toutes les réponses IA
              </>
            )}
          </Button>
        </div>
      )}

      {/* Bricks list */}
      {selectedBrick ? (
        <BrickEditor
          brick={selectedBrick}
          onClose={() => setSelectedBrick(null)}
          onSave={saveBrickResponse}
          onStatusChange={updateBrickStatus}
          onReload={loadProject}
        />
      ) : (
        <div className="space-y-3">
          {bricks.map((brick) => (
            <Card
              key={brick.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedBrick(brick)}
            >
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-slate-400">
                        #{brick.order_index + 1}
                      </span>
                      <Badge className={tagColors[brick.tag]}>{brick.tag}</Badge>
                      <Badge className={statusColors[brick.status]}>
                        {statusLabels[brick.status]}
                      </Badge>
                      {brick.ai_response_text && (
                        <Badge className="bg-violet-100 text-violet-700">
                          <SparklesIcon className="h-3 w-3 mr-1" />
                          IA
                        </Badge>
                      )}
                    </div>
                    <p className="text-slate-900 line-clamp-2">{brick.original_text}</p>
                    {brick.response_text && (
                      <p className="text-sm text-slate-500 mt-2 line-clamp-1">
                        ✓ Réponse rédigée
                      </p>
                    )}
                  </div>
                  <ChevronRightIcon className="h-5 w-5 text-slate-400 flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}

          {bricks.length === 0 && !project.source_file_url && (
            <Card className="text-center py-12">
              <CardContent>
                <p className="text-slate-500 mb-4">
                  Aucune question. Uploadez un cahier des charges pour commencer.
                </p>
                <Link href={`/projects/new`}>
                  <Button variant="outline">Modifier le projet</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

// Icons
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

function WandIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  )
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  )
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}
