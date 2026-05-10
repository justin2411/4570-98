'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export function AdminTerminActions({
  appointmentId,
  currentStatus: _currentStatus,
}: {
  appointmentId: string
  currentStatus?: string
}) {
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleDelete() {
    setLoading(true)
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', appointmentId)

    if (error) {
      toast.error('Fehler beim Löschen: ' + error.message)
    } else {
      toast.success('Termin gelöscht.')
      router.refresh()
    }
    setLoading(false)
    setConfirm(false)
  }

  if (confirm) {
    return (
      <div className="flex gap-1">
        <Button size="sm" variant="danger" loading={loading} onClick={handleDelete}>
          Ja
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
          Nein
        </Button>
      </div>
    )
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => setConfirm(true)}
      className="text-red-500 hover:text-red-700 hover:bg-red-50"
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  )
}
