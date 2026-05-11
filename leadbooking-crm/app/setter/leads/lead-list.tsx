'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Lead, LeadStatus } from '@/types'
import { LeadSlideOver } from './lead-slide-over'

const STATUS_LABELS: Record<LeadStatus, string> = {
  neu: 'Neu', angerufen: 'Angerufen', nicht_erreicht: 'Nicht erreicht',
  termin_gelegt: 'Termin gelegt', termin_stattgefunden: 'Termin stattgefunden', kein_interesse: 'Kein Interesse',
}
const STATUS_COLORS: Record<LeadStatus, string> = {
  neu: 'bg-indigo-100 text-indigo-700', angerufen: 'bg-blue-100 text-blue-700',
  nicht_erreicht: 'bg-orange-100 text-orange-700', termin_gelegt: 'bg-yellow-100 text-yellow-800',
  termin_stattgefunden: 'bg-green-100 text-green-700', kein_interesse: 'bg-red-100 text-red-700',
}
const ALL_STATUSES: LeadStatus[] = ['neu','angerufen','nicht_erreicht','termin_gelegt','termin_stattgefunden','kein_interesse']

export function LeadList({ initialLeads, userId }: { initialLeads: Lead[]; userId: string }) {
  const supabase = createClient()
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [selected, setSelected] = useState<Lead | null>(null)
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'alle'>('alle')

  useEffect(() => {
    const ch = supabase.channel('leads').on('postgres_changes',
      { event: '*', schema: 'public', table: 'leads', filter: `assigned_to=eq.${userId}` },
      payload => {
        if (payload.eventType === 'UPDATE') {
          setLeads(prev => prev.map(l => l.id === payload.new.id ? payload.new as Lead : l))
          setSelected(prev => prev?.id === payload.new.id ? payload.new as Lead : prev)
        }
      }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [userId])

  const filtered = statusFilter === 'alle' ? leads : leads.filter(l => l.status === statusFilter)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setStatusFilter('alle')} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${statusFilter === 'alle' ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'}`}>Alle ({leads.length})</button>
        {ALL_STATUSES.map(s => {
          const count = leads.filter(l => l.status === s).length
          if (count === 0) return null
          return <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${statusFilter === s ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'}`}>{STATUS_LABELS[s]} ({count})</button>
        })}
      </div>
      <div className="space-y-2">
        {filtered.map(lead => (
          <button key={lead.id} onClick={() => setSelected(lead)} className="w-full text-left bg-white border border-gray-200 rounded-2xl px-5 py-4 hover:border-[#2E75B6] hover:shadow-md transition-all">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-bold text-gray-900 text-[15px] truncate">{lead.name}</span>
                <span className="shrink-0 text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full">Hebamme</span>
              </div>
              <span className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[lead.status]}`}>{STATUS_LABELS[lead.status]}</span>
            </div>
            <div className="flex items-center gap-3 text-sm mb-1">
              <span className="font-semibold text-gray-900">+{lead.phone.replace(/^\+/, '')}</span>
              {lead.age_indicator && <span className="text-gray-500 text-xs">{(lead.age_indicator || "").replace(/[^a-zA-ZäöüÄÖÜß0-9 .,()-]/g, "").trim()}</span>}
              {lead.state && <span className="text-gray-500 text-xs">{lead.state}</span>}
            </div>
            {lead.email && <div className="text-xs text-gray-500 truncate">{lead.email}</div>}
          </button>
        ))}
        {filtered.length === 0 && <p className="text-center text-gray-500 py-12">Keine Leads gefunden</p>}
      </div>
      {selected && <LeadSlideOver lead={selected} userId={userId} onClose={() => setSelected(null)} onUpdate={updated => setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))} />}
    </div>
  )
}
