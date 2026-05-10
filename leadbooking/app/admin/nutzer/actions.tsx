'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

interface UserActionsCellProps {
  userId: string
  isActive: boolean
  role: string
  currentAdminId: string
}

export function UserActionsCell({ userId, isActive, role, currentAdminId }: UserActionsCellProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  if (userId === currentAdminId || role === 'admin') {
    return <span className="text-xs text-gray-400">—</span>
  }

  async function toggleActive() {
    setLoading(true)
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !isActive })
      .eq('id', userId)

    if (error) {
      toast.error('Fehler: ' + error.message)
    } else {
      toast.success(isActive ? 'Nutzer deaktiviert.' : 'Nutzer freigeschaltet.')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <Button
      size="sm"
      variant={isActive ? 'danger' : 'primary'}
      loading={loading}
      onClick={toggleActive}
    >
      {isActive ? 'Sperren' : 'Freischalten'}
    </Button>
  )
}
