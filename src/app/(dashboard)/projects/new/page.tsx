'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

// TEST MODE
const TEST_MODE = true
const TEST_ORG_ID = 'test-org-001'
const TEST_USER_ID = 'test-user-001'

export default function NewProjectPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [testProjects, setTestProjects] = useState<any[]>([])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    try {
      const formData = new FormData(e.currentTarget)
      const name = formData.get('name') as string
      const description = formData.get('description') as string
      const deadline = formData.get('deadline') as string

      if (TEST_MODE) {
        // In test mode, create a mock project locally
        const mockProject = {
          id: `test-project-${Date.now()}`,
          name,
          description,
          deadline,
          org_id: TEST_ORG_ID,
          created_by: TEST_USER_ID,
          status: 'draft',
          source_file_name: file?.name || null
        }
        toast.success('Projet créé (mode test) !')
        // Store in localStorage for test persistence
        const existing = JSON.parse(localStorage.getItem('test_projects') || '[]')
        existing.push(mockProject)
        localStorage.setItem('test_projects', JSON.stringify(existing))
        router.push(`/projects/${mockProject.id}`)
        return
      }

      const supabase = createClient()
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non authentifié')

      // Get user's first org
      const { data: membership } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id)
        .single()

      if (!membership) {
        toast.error('Vous devez appartenir à une organisation')
        return
      }

      // Upload file if provided
      let fileUrl = null
      let fileName = null
      if (file) {
        const fileExt = file.name.split('.').pop()
        const filePath = `${membership.org_id}/${Date.now()}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('rfp-documents')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('rfp-documents')
          .getPublicUrl(filePath)

        fileUrl = urlData.publicUrl
        fileName = file.name
      }

      // Create project
      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          name,
          description: description || null,
          deadline: deadline || null,
          org_id: membership.org_id,
          created_by: user.id,
          source_file_url: fileUrl,
          source_file_name: fileName,
          status: 'draft',
        })
        .select()
        .single()

      if (error) throw error

      toast.success('Projet créé !')
      router.push(`/projects/${project.id}`)
    } catch (error) {
      console.error(error)
      toast.error('Erreur lors de la création du projet')
    } finally {
      setLoading(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Nouveau projet</h1>
        <p className="text-slate-600">Créez un nouveau projet de réponse à appel d&apos;offres</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Informations du projet</CardTitle>
            <CardDescription>
              Renseignez les détails de votre appel d&apos;offres
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Nom du projet *
              </label>
              <Input
                id="name"
                name="name"
                placeholder="Ex: AO Ministère de la Culture 2026"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description
              </label>
              <Textarea
                id="description"
                name="description"
                placeholder="Décrivez brièvement le projet..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="deadline" className="text-sm font-medium">
                Date limite
              </label>
              <Input
                id="deadline"
                name="deadline"
                type="date"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Cahier des charges (PDF, Word)
              </label>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileIcon className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <XIcon className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <UploadIcon className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-600 mb-1">
                      Glissez-déposez votre fichier ici
                    </p>
                    <p className="text-xs text-slate-400 mb-3">ou</p>
                    <label className="cursor-pointer">
                      <span className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                        Parcourir les fichiers
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Annuler
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Création...' : 'Créer le projet'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
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

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
