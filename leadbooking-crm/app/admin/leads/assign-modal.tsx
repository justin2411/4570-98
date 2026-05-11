'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Lead } from '@/types'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'

interface Setter { id: string; full_name: string }
interface Props {
  leadIds: string[]
  allLeads?: Lead[]
  setters: Setter[]
  adminId?: string
  adminName?: string
  onClose: () => void
  onAssigned: (leadIds: string[], setterId: string) => void
}

const LIMITS = [
  { label: '100 Leads', value: 100 },
  { label: '200 Leads', value: 200 },
  { label: '400 Leads', value: 400 },
  { label: 'Alle ausgewählten', value: 0 },
]

export function AssignModal({ leadIds, allLeads, setters, adminId, adminName, onClose, onAssigned }: Props) {
  const supabase = createClient()
  const [setterId, setSetterId] = useState('')
  const [limit, setLimit] = useState(0)
  const [byState, setByState] = useState(false)
  const [loading, setLoading] = useState(false)

  const states = allLeads
    ? Array.from(new Set(allLeads.filter(l => leadIds.includes(l.id)).map(l => l.state).filter(Boolean))).sort()
    : []
  const [selectedState, setSelectedState] = useState('')

  function getEffectiveIds() {
    let ids = leadIds
    if (byState && selectedState && allLeads) {
      ids = allLeads.filter(l => leadIds.includes(l.id) && l.state === selectedState).map(l => l.id)
    }
    if (limit > 0) ids = ids.slice(0, limit)
    return ids
  }

  async function handleAssign() {
    if (!setterId) { toast.error('Bitte Setter wählen'); return }
    const ids = getEffectiveIds()
    if (ids.length === 0) { toast.error('Keine Leads ausgewählt'); return }
    setLoading(true)
    const BATCH = 500
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH)
      const { error } = await supabase.from('leads').update({ assigned_to: setterId }).in('id', batch)
      if (error) { toast.error(error.message); setLoading(false); return }
    }
    toast.success(`${ids.length} Lead(s) zugewiesen!`)
    onAssigned(ids, setterId)
  }

  const effectiveCount = getEffectiveIds().length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg text-[#1E3A5F]">{leadIds.length} Lead(s) zuweisen</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Setter</p>
          <select value={setterId} onChange={e => setSetterId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900">
            <option value="">Setter wählen...</option>
            {adminId && <option value={adminId}>👤 {adminName ?? 'Admin'} (ich)</option>}
            {setters.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Anzahl</p>
          <div className="grid grid-cols-2 gap-2">
            {LIMITS.map(l => (
              <button key={l.value} onClick={() => setLimit(l.value)}
                className={`px-3 py-2 rounded-xl border-2 text-sm font-semibold transition-colors ${limit === l.value ? 'border-[#2E75B6] bg-blue-50 text-[#2E75B6]' : 'border-gray-200 text-gray-900 hover:border-[#2E75B6]'}`}>
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {states.length > 1 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <input type="checkbox" checked={byState} onChange={e => setByState(e.target.checked)} id="bystate" />
              <label htmlFor="bystate" className="text-xs font-semibold text-gray-700 uppercase tracking-wide cursor-pointer">Nach Bundesland filtern</label>
            </div>
            {byState && (
              <select value={selectedState} onChange={e => setSelectedState(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900">
                <option value="">Alle Bundesländer</option>
                {states.map(s => (
                  <option key={s} value={s}>{s} ({allLeads?.filter(l => leadIds.includes(l.id) && l.state === s).length})</option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900">
          <span className="font-semibold">{effectiveCount}</span> Leads werden zugewiesen
        </div>

        <div className="flex gap-2">
          <Button onClick={handleAssign} loading={loading} className="flex-1">Zuweisen</Button>
          <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
        </div>
      </div>
    </div>
  )
}
