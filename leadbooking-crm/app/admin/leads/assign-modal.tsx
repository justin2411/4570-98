'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'

interface Setter { id: string; full_name: string }
interface Props {
  leadIds: string[]
  setters: Setter[]
  onClose: () => void
  onAssigned: (leadIds: string[], setterId: string) => void
}

export function AssignModal({ leadIds, setters, onClose, onAssigned }: Props) {
  const supabase = createClient()
  const [setterId, setSetterId] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleAssign() {
    if (!setterId) { toast.error('Bitte Setter wählen'); return }
    setLoading(true)
    const { error } = await supabase.from('leads').update({ assigned_to: setterId }).in('id', leadIds)
    if (error) { toast.error(error.message); setLoading(false); return }
    toast.success(`${leadIds.length} Lead(s) zugewiesen!`)
    onAssigned(leadIds, setterId)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg text-[#1E3A5F]">{leadIds.length} Lead(s) zuweisen</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <select value={setterId} onChange={e => setSetterId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4">
          <option value="">Setter wählen...</option>
          {setters.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
        <div className="flex gap-2">
          <Button onClick={handleAssign} loading={loading} className="flex-1">Zuweisen</Button>
          <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
        </div>
      </div>
    </div>
  )
}
