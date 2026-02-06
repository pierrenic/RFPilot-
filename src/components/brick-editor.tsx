'use client'

import { useState, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

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

interface BrickEditorProps {
  brick: Brick
  onClose: () => void
  onSave: (brickId: string, responseText: string) => Promise<void>
  onStatusChange: (brickId: string, status: string) => Promise<void>
  onReload: () => void
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

const statusFlow = ['draft', 'writing', 'review', 'validated']

export function BrickEditor({ brick, onClose, onSave, onStatusChange, onReload }: BrickEditorProps) {
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [currentStatus, setCurrentStatus] = useState(brick.status)

  const editor = useEditor({
    extensions: [StarterKit],
    content: brick.response_text || brick.ai_response_text || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4',
      },
    },
  })

  const handleSave = useCallback(async () => {
    if (!editor) return
    setSaving(true)
    try {
      const html = editor.getHTML()
      await onSave(brick.id, html)
    } finally {
      setSaving(false)
    }
  }, [editor, brick.id, onSave])

  const handleStatusChange = async (newStatus: string) => {
    await onStatusChange(brick.id, newStatus)
    setCurrentStatus(newStatus)
  }

  const generateAIResponse = async () => {
    setGenerating(true)
    try {
      const response = await fetch('/api/generate-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brickId: brick.id,
          question: brick.original_text,
          projectContext: '',
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error)

      // Update editor with AI response
      if (editor && result.response) {
        editor.commands.setContent(result.response)
      }
      toast.success('Réponse IA générée !')
      onReload()
    } catch (error) {
      console.error(error)
      toast.error('Erreur de génération')
    } finally {
      setGenerating(false)
    }
  }

  const useAIResponse = () => {
    if (editor && brick.ai_response_text) {
      editor.commands.setContent(brick.ai_response_text)
      toast.success('Réponse IA copiée dans l\'éditeur')
    }
  }

  const copyToClipboard = () => {
    if (!editor) return
    const text = editor.getText()
    navigator.clipboard.writeText(text)
    toast.success('Copié dans le presse-papiers')
  }

  const currentStatusIndex = statusFlow.indexOf(currentStatus)
  const nextStatus = statusFlow[currentStatusIndex + 1]
  const prevStatus = statusFlow[currentStatusIndex - 1]

  return (
    <Card className="border-2 border-blue-200">
      <CardHeader className="border-b bg-slate-50">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-slate-400">
                Question #{brick.order_index + 1}
              </span>
              <Badge className={statusColors[currentStatus]}>
                {statusLabels[currentStatus]}
              </Badge>
            </div>
            <CardTitle className="text-lg font-normal text-slate-900">
              {brick.original_text}
            </CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <XIcon className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 p-3 border-b bg-white">
          <Button
            variant="outline"
            size="sm"
            onClick={() => editor?.chain().focus().toggleBold().run()}
            className={editor?.isActive('bold') ? 'bg-slate-200' : ''}
          >
            <BoldIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            className={editor?.isActive('italic') ? 'bg-slate-200' : ''}
          >
            <ItalicIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            className={editor?.isActive('bulletList') ? 'bg-slate-200' : ''}
          >
            <ListIcon className="h-4 w-4" />
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={generateAIResponse}
            disabled={generating}
          >
            {generating ? (
              <SpinnerIcon className="h-4 w-4 animate-spin" />
            ) : (
              <SparklesIcon className="h-4 w-4" />
            )}
            <span className="ml-1">Générer IA</span>
          </Button>
          {brick.ai_response_text && (
            <Button variant="outline" size="sm" onClick={useAIResponse}>
              Utiliser IA
            </Button>
          )}
        </div>

        {/* Editor */}
        <div className="border-b">
          <EditorContent editor={editor} />
        </div>

        {/* AI Response Preview */}
        {brick.ai_response_text && (
          <div className="p-4 bg-violet-50 border-b">
            <div className="flex items-center gap-2 mb-2">
              <SparklesIcon className="h-4 w-4 text-violet-600" />
              <span className="text-sm font-medium text-violet-700">Suggestion IA</span>
            </div>
            <div 
              className="text-sm text-violet-900 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: brick.ai_response_text }}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between p-4 bg-slate-50">
          <div className="flex items-center gap-2">
            {/* Workflow buttons */}
            {prevStatus && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange(prevStatus)}
              >
                ← {statusLabels[prevStatus]}
              </Button>
            )}
            {nextStatus && (
              <Button
                size="sm"
                onClick={() => handleStatusChange(nextStatus)}
                className={nextStatus === 'validated' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                {statusLabels[nextStatus]} →
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyToClipboard}>
              <CopyIcon className="h-4 w-4 mr-1" />
              Copier
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Icons
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function BoldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12h8a4 4 0 004-4c0-2.5-2-4-4-4H6v8zm0 0h9a4 4 0 014 4c0 2.5-2 4-4 4H6v-8z" />
    </svg>
  )
}

function ItalicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 4h4m-2 0v16m-4 0h4" transform="skewX(-10)" />
    </svg>
  )
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
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

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
    </svg>
  )
}
