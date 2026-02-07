'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

interface Brick {
  id: string
  order_index: number
  original_text: string
  title: string | null
  tag: string
  status: string
  response_text: string | null
  ai_response_text: string | null
  ai_sources?: string[]
}

const tagLabels: Record<string, string> = {
  technique: 'Technique',
  juridique: 'Juridique',
  financier: 'Financier',
  commercial: 'Commercial',
  references: 'Références',
  admin: 'Admin',
  other: 'Autre',
}

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  writing: 'Rédaction',
  review: 'Relecture',
  validated: 'Validé',
}

export function BrickEditor({ 
  brick, 
  projectId,
  onClose, 
  onUpdate 
}: { 
  brick: Brick
  projectId: string
  onClose: () => void
  onUpdate: (brick: Brick) => void
}) {
  const [status, setStatus] = useState(brick.status)
  const [tag, setTag] = useState(brick.tag)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [sources, setSources] = useState<string[]>(brick.ai_sources || [])

  const editor = useEditor({
    extensions: [StarterKit],
    content: brick.response_text || brick.ai_response_text || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[200px] p-3 focus:outline-none',
      },
    },
  })

  // Update editor content when brick changes
  useEffect(() => {
    if (editor && brick) {
      const newContent = brick.response_text || brick.ai_response_text || ''
      if (editor.getHTML() !== newContent) {
        editor.commands.setContent(newContent)
      }
      setStatus(brick.status)
      setTag(brick.tag)
      setSources(brick.ai_sources || [])
    }
  }, [brick, editor])

  const handleSave = async () => {
    setSaving(true)
    try {
      const supabase = createClient()
      const response = editor?.getHTML() || ''
      const { error } = await supabase
        .from('bricks')
        .update({
          response_text: response,
          status,
          tag,
        })
        .eq('id', brick.id)

      if (error) throw error

      toast.success('Réponse enregistrée')
      onUpdate({ ...brick, response_text: response, status, tag })
    } catch (error) {
      console.error(error)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          brickId: brick.id,
          question: brick.original_text,
        }),
      })

      if (!res.ok) throw new Error('Generation failed')

      const data = await res.json()
      editor?.commands.setContent(data.response)
      setSources(data.sources || [])
      
      if (data.usedRAG && data.sources?.length > 0) {
        toast.success(`Réponse générée avec ${data.sources.length} source(s)`)
      } else {
        toast.success('Réponse générée par l\'IA')
      }
    } catch (error) {
      console.error(error)
      toast.error('Erreur lors de la génération')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Card className="sticky top-8">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Question {brick.order_index + 1}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Original question */}
        <div className="p-3 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-700">{brick.original_text}</p>
        </div>

        {/* Tag & Status */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-slate-500 mb-1 block">Catégorie</label>
            <Select value={tag} onValueChange={setTag}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(tagLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-slate-500 mb-1 block">Statut</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Response with Tiptap editor */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-500">Réponse</label>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleGenerate}
              disabled={generating}
            >
              <SparklesIcon className="h-4 w-4 mr-1" />
              {generating ? 'Génération...' : 'Générer avec l\'IA'}
            </Button>
          </div>
          
          {/* Toolbar */}
          {editor && (
            <div className="flex gap-1 p-1 border-b bg-slate-50 rounded-t-lg">
              <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-1.5 rounded hover:bg-slate-200 ${editor.isActive('bold') ? 'bg-slate-200' : ''}`}
                title="Gras"
              >
                <BoldIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-1.5 rounded hover:bg-slate-200 ${editor.isActive('italic') ? 'bg-slate-200' : ''}`}
                title="Italique"
              >
                <ItalicIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-1.5 rounded hover:bg-slate-200 ${editor.isActive('bulletList') ? 'bg-slate-200' : ''}`}
                title="Liste"
              >
                <ListIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-1.5 rounded hover:bg-slate-200 ${editor.isActive('orderedList') ? 'bg-slate-200' : ''}`}
                title="Liste numérotée"
              >
                <OrderedListIcon className="h-4 w-4" />
              </button>
            </div>
          )}
          
          <div className="border rounded-b-lg min-h-[200px]">
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* RAG Sources */}
        {sources.length > 0 && (
          <div className="p-3 bg-green-50 rounded-lg border border-green-100">
            <div className="flex items-center gap-1 text-xs font-medium text-green-600 mb-2">
              <BookIcon className="h-3 w-3" />
              Sources utilisées
            </div>
            <div className="flex flex-wrap gap-1">
              {sources.map((source, i) => (
                <Badge key={i} variant="secondary" className="bg-green-100 text-green-700 text-xs">
                  {source}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
          <Button variant="outline" onClick={() => setStatus('review')}>
            Soumettre en relecture
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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

function BoldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
    </svg>
  )
}

function ItalicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 4h4m-2 0l-4 16m0 0h4" />
    </svg>
  )
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  )
}

function OrderedListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h10M7 16h10M3 8h.01M3 12h.01M3 16h.01" />
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
