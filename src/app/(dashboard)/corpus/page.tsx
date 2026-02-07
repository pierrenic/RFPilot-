'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface CorpusDocument {
  id: string
  name: string
  file_type: string
  chunk_count: number
  status: string
  created_at: string
}

interface Corpus {
  id: string
  name: string
  description: string | null
  created_at: string
  corpus_documents: CorpusDocument[]
}

export default function CorpusPage() {
  const [corpusList, setCorpusList] = useState<Corpus[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCorpus, setSelectedCorpus] = useState<Corpus | null>(null)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [uploading, setUploading] = useState(false)

  const fetchCorpus = async () => {
    try {
      const res = await fetch('/api/corpus')
      const data = await res.json()
      setCorpusList(data.corpus || [])
    } catch (error) {
      console.error(error)
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCorpus()
  }, [])

  const handleCreateCorpus = async () => {
    if (!newName.trim()) return

    try {
      const res = await fetch('/api/corpus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, description: newDescription })
      })

      if (res.ok) {
        toast.success('Corpus créé')
        setShowNewDialog(false)
        setNewName('')
        setNewDescription('')
        fetchCorpus()
      } else {
        toast.error('Erreur lors de la création')
      }
    } catch (error) {
      toast.error('Erreur lors de la création')
    }
  }

  const handleFileUpload = async (corpusId: string, files: FileList) => {
    setUploading(true)
    
    for (const file of Array.from(files)) {
      try {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch(`/api/corpus/${corpusId}/documents`, {
          method: 'POST',
          body: formData
        })

        if (res.ok) {
          const data = await res.json()
          toast.success(`${file.name}: ${data.document.chunkCount} chunks créés`)
        } else {
          const error = await res.json()
          toast.error(`${file.name}: ${error.error}`)
        }
      } catch (error) {
        toast.error(`Erreur: ${file.name}`)
      }
    }

    setUploading(false)
    fetchCorpus()
  }

  const handleDeleteDocument = async (corpusId: string, documentId: string) => {
    try {
      const res = await fetch(`/api/corpus/${corpusId}/documents`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId })
      })

      if (res.ok) {
        toast.success('Document supprimé')
        fetchCorpus()
      }
    } catch (error) {
      toast.error('Erreur lors de la suppression')
    }
  }

  const handleDeleteCorpus = async (corpusId: string) => {
    if (!confirm('Supprimer ce corpus et tous ses documents ?')) return

    try {
      const res = await fetch(`/api/corpus/${corpusId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Corpus supprimé')
        setSelectedCorpus(null)
        fetchCorpus()
      }
    } catch (error) {
      toast.error('Erreur lors de la suppression')
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-pulse">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Corpus documentaire</h1>
          <p className="text-slate-500 mt-1">
            Gérez vos documents de référence pour enrichir les réponses IA
          </p>
        </div>
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="h-4 w-4 mr-2" />
              Nouveau corpus
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un nouveau corpus</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Nom</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Documentation technique"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Description optionnelle..."
                  rows={3}
                />
              </div>
              <Button onClick={handleCreateCorpus} className="w-full">
                Créer le corpus
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-6">
        {/* Corpus list */}
        <div className="w-80 space-y-3">
          {corpusList.length === 0 ? (
            <Card className="text-center py-8">
              <CardContent>
                <BookIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Aucun corpus</p>
                <p className="text-sm text-slate-400 mt-1">
                  Créez un corpus pour ajouter vos documents
                </p>
              </CardContent>
            </Card>
          ) : (
            corpusList.map((corpus) => (
              <Card
                key={corpus.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedCorpus?.id === corpus.id ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => setSelectedCorpus(corpus)}
              >
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-slate-900">{corpus.name}</h3>
                      {corpus.description && (
                        <p className="text-sm text-slate-500 line-clamp-1">
                          {corpus.description}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary">
                      {corpus.corpus_documents?.length || 0} docs
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Selected corpus detail */}
        {selectedCorpus && (
          <div className="flex-1">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{selectedCorpus.name}</CardTitle>
                    {selectedCorpus.description && (
                      <p className="text-slate-500 mt-1">{selectedCorpus.description}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    onClick={() => handleDeleteCorpus(selectedCorpus.id)}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Upload zone */}
                <div className="mb-6">
                  <label className="block">
                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer">
                      <UploadIcon className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-600">
                        {uploading ? 'Upload en cours...' : 'Cliquez ou glissez des fichiers ici'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">PDF, DOCX, TXT</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      accept=".pdf,.docx,.doc,.txt"
                      onChange={(e) => {
                        if (e.target.files) {
                          handleFileUpload(selectedCorpus.id, e.target.files)
                        }
                      }}
                      disabled={uploading}
                    />
                  </label>
                </div>

                {/* Documents list */}
                <div className="space-y-2">
                  <h4 className="font-medium text-slate-900 mb-3">
                    Documents ({selectedCorpus.corpus_documents?.length || 0})
                  </h4>
                  {selectedCorpus.corpus_documents?.length === 0 ? (
                    <p className="text-sm text-slate-500">Aucun document</p>
                  ) : (
                    selectedCorpus.corpus_documents?.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <FileIcon className="h-5 w-5 text-slate-400" />
                          <div>
                            <p className="text-sm font-medium text-slate-900">{doc.name}</p>
                            <p className="text-xs text-slate-500">
                              {doc.chunk_count} chunks • {doc.file_type.toUpperCase()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={
                              doc.status === 'ready'
                                ? 'bg-green-100 text-green-700'
                                : doc.status === 'error'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-700'
                            }
                          >
                            {doc.status === 'ready' ? 'Prêt' : doc.status === 'error' ? 'Erreur' : 'Traitement...'}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteDocument(selectedCorpus.id, doc.id)}
                          >
                            <TrashIcon className="h-4 w-4 text-slate-400" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
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

function BookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  )
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
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

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}
