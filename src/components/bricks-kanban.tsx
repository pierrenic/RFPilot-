'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BrickEditor } from '@/components/brick-editor'
import { createClient } from '@/lib/supabase/client'
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

const tagColors: Record<string, string> = {
  technique: 'bg-purple-100 text-purple-700',
  juridique: 'bg-red-100 text-red-700',
  financier: 'bg-green-100 text-green-700',
  commercial: 'bg-blue-100 text-blue-700',
  references: 'bg-orange-100 text-orange-700',
  admin: 'bg-slate-100 text-slate-700',
  other: 'bg-gray-100 text-gray-700',
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

const statusConfig = {
  draft: { label: 'Brouillon', color: 'bg-slate-100', headerColor: 'bg-slate-200' },
  writing: { label: 'Rédaction', color: 'bg-blue-100', headerColor: 'bg-blue-200' },
  review: { label: 'Relecture', color: 'bg-amber-100', headerColor: 'bg-amber-200' },
  validated: { label: 'Validé', color: 'bg-green-100', headerColor: 'bg-green-200' },
}

export function BricksKanban({ bricks, projectId, onRefresh }: { 
  bricks: Brick[]
  projectId: string
  onRefresh?: () => void 
}) {
  const [selectedBrick, setSelectedBrick] = useState<Brick | null>(null)
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [draggingBrick, setDraggingBrick] = useState<string | null>(null)

  const statuses = ['draft', 'writing', 'review', 'validated'] as const

  const filteredBricks = tagFilter === 'all' 
    ? bricks 
    : bricks.filter(b => b.tag === tagFilter)

  const bricksByStatus = statuses.reduce((acc, status) => {
    acc[status] = filteredBricks
      .filter(b => b.status === status)
      .sort((a, b) => a.order_index - b.order_index)
    return acc
  }, {} as Record<string, Brick[]>)

  const tags = [...new Set(bricks.map(b => b.tag))]

  const handleDrop = async (brickId: string, newStatus: string) => {
    if (!brickId) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('bricks')
        .update({ status: newStatus })
        .eq('id', brickId)

      if (error) throw error

      toast.success('Statut mis à jour')
      onRefresh?.()
    } catch (error) {
      toast.error('Erreur lors de la mise à jour')
    }
  }

  return (
    <div>
      {/* Tag filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <Button 
          variant={tagFilter === 'all' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setTagFilter('all')}
        >
          Tous ({bricks.length})
        </Button>
        {tags.map(tag => (
          <Button
            key={tag}
            variant={tagFilter === tag ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTagFilter(tag)}
          >
            {tagLabels[tag]} ({bricks.filter(b => b.tag === tag).length})
          </Button>
        ))}
      </div>

      <div className="flex gap-4">
        {/* Kanban columns */}
        <div className="flex gap-4 flex-1 overflow-x-auto pb-4">
          {statuses.map((status) => (
            <div
              key={status}
              className="flex-shrink-0 w-72"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (draggingBrick) {
                  handleDrop(draggingBrick, status)
                  setDraggingBrick(null)
                }
              }}
            >
              <div className={`rounded-t-lg px-3 py-2 ${statusConfig[status].headerColor}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">
                    {statusConfig[status].label}
                  </span>
                  <Badge variant="secondary" className="bg-white/50">
                    {bricksByStatus[status].length}
                  </Badge>
                </div>
              </div>
              <div className={`rounded-b-lg min-h-[400px] p-2 space-y-2 ${statusConfig[status].color}`}>
                {bricksByStatus[status].map((brick) => (
                  <Card
                    key={brick.id}
                    draggable
                    onDragStart={() => setDraggingBrick(brick.id)}
                    onDragEnd={() => setDraggingBrick(null)}
                    className={`cursor-pointer hover:shadow-md transition-all ${
                      selectedBrick?.id === brick.id ? 'ring-2 ring-blue-500' : ''
                    } ${draggingBrick === brick.id ? 'opacity-50' : ''}`}
                    onClick={() => setSelectedBrick(brick)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2 mb-2">
                        <span className="text-xs font-medium text-slate-400">
                          #{brick.order_index + 1}
                        </span>
                        <Badge className={`${tagColors[brick.tag]} text-xs`} variant="secondary">
                          {tagLabels[brick.tag]}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-900 line-clamp-3">
                        {brick.title || brick.original_text}
                      </p>
                      {(brick.response_text || brick.ai_response_text) && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
                          <CheckIcon className="h-3 w-3" />
                          Réponse rédigée
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {bricksByStatus[status].length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    Aucune question
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Editor panel */}
        {selectedBrick && (
          <div className="w-[450px] flex-shrink-0">
            <BrickEditor 
              brick={selectedBrick} 
              projectId={projectId}
              onClose={() => setSelectedBrick(null)}
              onUpdate={(updated) => {
                setSelectedBrick(updated)
                onRefresh?.()
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}
