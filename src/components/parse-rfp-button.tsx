'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function ParseRFPButton({ projectId, fileUrl, onComplete }: { projectId: string; fileUrl?: string | null; onComplete?: () => void }) {
  const [parsing, setParsing] = useState(false)
  const router = useRouter()

  const handleParse = async () => {
    setParsing(true)
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, fileUrl }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Parsing failed')
      }

      const data = await res.json()
      toast.success(`${data.bricksCount} questions extraites !`)
      if (onComplete) onComplete()
      router.refresh()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Erreur lors de l\'analyse')
    } finally {
      setParsing(false)
    }
  }

  return (
    <Button onClick={handleParse} disabled={parsing}>
      <SparklesIcon className="h-4 w-4 mr-2" />
      {parsing ? 'Analyse en cours...' : 'Analyser le cahier des charges'}
    </Button>
  )
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  )
}
