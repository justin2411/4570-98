'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Lead, LeadStatus, STATUS_CONFIG } from '@/types'
import { StatusBadge } from '@/components/leads/status-badge'
import { ScoreBadge } from '@/components/leads/score-badge'
import { LeadSlideOver } from './lead-slide-over'
import { Phone, MapPin } from 'lucide-react'

export function LeadList({ initialLeads, userId }: { initialLeads: Lead[]; userId: string }) {
  const supabase = createClient()
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [selected, setSelected] = useState<Lead | null>(null)
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'alle'>('alle')

  useEffect(() => {
    const ch = supabase.channel('leads').on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'leads', filter: `assigned_to=eq.${userId}` },
      payload => {
        if (payload.eventType === 'UPDATE') {
          setLeads(prev => prev.map(l => l.id === payload.new.id ? payload.new as Lead : l))
          setSelected(prev => prev?.id === payload.new.id ? payload.new as Lead : prev)
        }
      }
    ).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [userId])

  const filtered = statusFilter === 'alle' ? leads : leads.filter(l => l.status === statusFilter)

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setStatusFilter('alle')} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === 'alle' ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
          Alle ({leads.length})
        </button>
        {(Object.keys(STATUS_CONFIG) as LeadStatus[]).map(s => {
          const count = leads.filter(l => l.status === s).length
          if (count === 0) return null
          return (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              {STATUS_CONFIG[s].emoji} {STATUS_CONFIG[s].label} ({count})
            </button>
          )
        })}
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.map(lead => (
          <button key={lead.id} onClick={() => setSelected(lead)} className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-[#2E75B6] hover:shadow-sm transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-[#1E3A5F] truncate">{lead.name}</span>
                  <ScoreBadge score={lead.score} />
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-sm text-gray-500 flex-wrap">
                  <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{lead.phone}</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{lead.state}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {lead.lead_quality && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{lead.lead_quality}</span>}
                  {lead.age_indicator && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{lead.age_indicator}</span>}
                </div>
                {lead.signals && (
                  <p className="text-xs text-gray-400 mt-1 truncate">{lead.signals}</p>
                )}
              </div>
              <StatusBadge status={lead.status} />
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-12">Keine Leads gefunden</p>
        )}
      </div>

      {selected && <LeadSlideOver lead={selected} userId={userId} onClose={() => setSelected(null)} onUpdate={updated => setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))} />}
    </div>
  )
}
