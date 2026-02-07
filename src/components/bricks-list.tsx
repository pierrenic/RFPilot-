'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

const statusIcons: Record<string, { icon: string; color: string }> = {
  draft: { icon: '○', color: 'text-slate-400' },
  writing: { icon: '◐', color: 'text-blue-500' },
  review: { icon: '◑', color: 'text-amber-500' },
  validated: { icon: '●', color: 'text-green-500' },
}

export function BricksList({ bricks, projectId }: { bricks: Brick[]; projectId: string }) {
  const [selectedBrick, setSelectedBrick] = useState<Brick | null>(null)
  const [filter, setFilter] = useState<string>('all')

  const sortedBricks = [...bricks].sort((a, b) => a.order_index - b.order_index)
  const filteredBricks = filter === 'all' 
    ? sortedBricks 
    : sortedBricks.filter(b => b.tag === filter || b.status === filter)

  const tags = [...new Set(bricks.map(b => b.tag))]

  return (
    <div className="flex gap-6">
      {/* Bricks list */}
      <div className="flex-1 space-y-3">
        {/* Filters */}
        <div className="flex gap-2 mb-4">
          <Button 
            variant={filter === 'all' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setFilter('all')}
          >
            Tous ({bricks.length})
          </Button>
          {tags.map(tag => (
            <Button
              key={tag}
              variant={filter === tag ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(tag)}
            >
              {tagLabels[tag]} ({bricks.filter(b => b.tag === tag).length})
            </Button>
          ))}
        </div>

        {/* List */}
        {filteredBricks.map((brick, index) => (
          <Card 
            key={brick.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedBrick?.id === brick.id ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => setSelectedBrick(brick)}
          >
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <span className={`text-lg ${statusIcons[brick.status].color}`}>
                  {statusIcons[brick.status].icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-slate-500">
                      Q{brick.order_index + 1}
                    </span>
                    <Badge className={tagColors[brick.tag]} variant="secondary">
                      {tagLabels[brick.tag]}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-900 line-clamp-2">
                    {brick.title || brick.original_text}
                  </p>
                  {brick.response_text && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                      ✓ Réponse rédigée
                    </p>
                  )}
                </div>
                <ChevronRightIcon className="h-5 w-5 text-slate-300 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Editor panel */}
      {selectedBrick && (
        <div className="w-[500px] flex-shrink-0">
          <BrickEditor 
            brick={selectedBrick} 
            projectId={projectId}
            onClose={() => setSelectedBrick(null)}
            onUpdate={(updated) => {
              // Update brick in list
              setSelectedBrick(updated)
            }}
          />
        </div>
      )}
    </div>
  )
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}
