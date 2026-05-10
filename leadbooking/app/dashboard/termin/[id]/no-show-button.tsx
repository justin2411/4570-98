'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

export function NoShowButton({ appointmentId }: { appointmentId: string }) {
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleNoShow() {
    setLoading(true)
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'no_show' })
      .eq('id', appointmentId)

    if (error) {
      toast.error('Fehler beim Melden: ' + error.message)
    } else {
      toast.success('No-Show wurde gemeldet.')
      router.refresh()
    }
    setLoading(false)
    setConfirmed(false)
  }

  if (!confirmed) {
    return (
      <button
        onClick={() => setConfirmed(true)}
        className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 transition-colors"
      >
        <AlertTriangle className="w-4 h-4" />
        No-Show melden
      </button>
    )
  }

  return (
    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
      <p className="text-sm text-red-800 mb-3">
        Wirklich No-Show melden? Das kann nicht rückgängig gemacht werden.
      </p>
      <div className="flex gap-2">
        <Button variant="danger" size="sm" loading={loading} onClick={handleNoShow}>
          Ja, No-Show melden
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirmed(false)}>
          Abbrechen
        </Button>
      </div>
    </div>
  )
}
