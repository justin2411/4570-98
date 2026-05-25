'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Lead, LeadStatus } from '@/types'
import { LeadSlideOver } from './lead-slide-over'
import { Search, X, Phone } from 'lucide-react'
import { formatPhoneForCall } from '@/lib/phone'

const STATUS_LABELS: Record<LeadStatus, string> = {
  neu: 'Neu', angerufen: 'Angerufen', nicht_erreicht: 'Nicht erreicht',
  wiedervorlage: 'Wiedervorlage',
  termin_gelegt: 'Termin gelegt', termin_stattgefunden: 'Termin stattgefunden', kein_interesse: 'Kein Interesse',
}
const STATUS_COLORS: Record<LeadStatus, string> = {
  neu: 'bg-indigo-100 text-indigo-700', angerufen: 'bg-blue-100 text-blue-700',
  nicht_erreicht: 'bg-orange-100 text-orange-700',
  wiedervorlage: 'bg-purple-100 text-purple-700',
  termin_gelegt: 'bg-yellow-100 text-yellow-800',
  termin_stattgefunden: 'bg-green-100 text-green-700', kein_interesse: 'bg-red-100 text-red-700',
}
const ALL_STATUSES: LeadStatus[] = ['neu','angerufen','nicht_erreicht','wiedervorlage','termin_gelegt','termin_stattgefunden','kein_interesse']

function matchesSearch(lead: Lead, q: string): boolean {
  const qt = q.trim().toLowerCase()
  if (!qt) return true
  if (lead.name?.toLowerCase().includes(qt)) return true
  if (lead.email?.toLowerCase().includes(qt)) return true
  const phoneDigits = (lead.phone ?? '').replace(/\D/g, '')
  const qDigits = qt.replace(/\D/g, '')
  if (qDigits && phoneDigits.includes(qDigits)) return true
  return false
}

export function LeadList({ initialLeads, userId }: { initialLeads: Lead[]; userId: string }) {
  const supabase = createClient()
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'alle'>('alle')
  const [search, setSearch] = useState('')
  const [navList, setNavList] = useState<string[]>([])
  const [navIdx, setNavIdx] = useState<number | null>(null)

  useEffect(() => {
    const ch = supabase.channel('leads').on('postgres_changes',
      { event: '*', schema: 'public', table: 'leads', filter: `assigned_to=eq.${userId}` },
      payload => {
        if (payload.eventType === 'UPDATE') {
          setLeads(prev => prev.map(l => l.id === payload.new.id ? payload.new as Lead : l))
        } else if (payload.eventType === 'INSERT') {
          setLeads(prev => [payload.new as Lead, ...prev])
        }
      }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [userId])

  const searched = useMemo(() => leads.filter(l => matchesSearch(l, search)), [leads, search])
  const filtered = useMemo(
    () => statusFilter === 'alle' ? searched : searched.filter(l => l.status === statusFilter),
    [searched, statusFilter]
  )

  function openLead(idx: number) {
    setNavList(filtered.map(l => l.id))
    setNavIdx(idx)
  }
  function closeSlideOver() { setNavIdx(null); setNavList([]) }
  function goNext() {
    if (navIdx === null) return
    if (navIdx + 1 >= navList.length) { closeSlideOver(); return }
    setNavIdx(navIdx + 1)
  }
  function goPrev() {
    if (navIdx === null) return
    if (navIdx - 1 < 0) return
    setNavIdx(navIdx - 1)
  }

  const currentLeadId = navIdx !== null ? navList[navIdx] : null
  const currentLead = currentLeadId ? leads.find(l => l.id === currentLeadId) ?? null : null

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Suche nach Name oder Telefonnummer..."
          className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#2E75B6] focus:border-[#2E75B6] focus:outline-none" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full" aria-label="Suche löschen">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      {search && (
        <p className="text-xs text-gray-600">
          {searched.length === 0 ? 'Keine Treffer' : searched.length === 1 ? '1 Treffer' : `${searched.length} Treffer`} für „<span className="font-semibold">{search}</span>"
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setStatusFilter('alle')} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${statusFilter === 'alle' ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'}`}>Alle ({searched.length})</button>
        {ALL_STATUSES.map(s => {
          const count = searched.filter(l => l.status === s).length
          if (count === 0) return null
          return <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${statusFilter === s ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'}`}>{STATUS_LABELS[s]} ({count})</button>
        })}
      </div>

      <div className="space-y-2">
        {filtered.map((lead, idx) => (
          <button key={lead.id} onClick={() => openLead(idx)}
            className="w-full text-left bg-white border border-gray-200 rounded-2xl px-5 py-4 hover:border-[#2E75B6] hover:shadow-md active:scale-[0.99] transition-all">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-bold text-gray-900 text-[15px] truncate">{lead.name}</span>
                {((lead as any).beruf || '').trim() && <span className="shrink-0 text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full">{(lead as any).beruf}</span>}
                {(lead.call_attempts ?? 0) > 0 && (
                  <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200 px-1.5 py-0.5 rounded-full" title="Anrufversuche">
                    <Phone className="w-2.5 h-2.5" />
                    {lead.call_attempts}×
                  </span>
                )}
              </div>
              <span className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[lead.status]}`}>{STATUS_LABELS[lead.status]}</span>
            </div>
            <div className="flex items-center gap-3 text-sm mb-1">
              <span className="font-semibold text-gray-900">{formatPhoneForCall(lead.phone)}</span>
              {lead.age_indicator && <span className="text-gray-500 text-xs">{(lead.age_indicator || "").replace(/[^a-zA-ZäöüÄÖÜß0-9 .,()-]/g, "").trim()}</span>}
              {lead.state && <span className="text-gray-500 text-xs">{lead.state}</span>}
            </div>
            {lead.email && <div className="text-xs text-gray-500 truncate">{lead.email}</div>}
            {lead.status === 'wiedervorlage' && lead.recall_date && (
              <div className="text-xs text-purple-700 font-semibold mt-1">⏰ Wiedervorlage: {new Date(lead.recall_date).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} Uhr</div>
            )}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-gray-500 py-12">
            {search ? 'Kein Lead passt zu deiner Suche' : 'Keine Leads gefunden'}
          </p>
        )}
      </div>

      {currentLead && navIdx !== null && (
        <LeadSlideOver
          lead={currentLead}
          userId={userId}
          onClose={closeSlideOver}
          onUpdate={updated => setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))}
          onNext={navIdx < navList.length - 1 ? goNext : undefined}
          onPrev={navIdx > 0 ? goPrev : undefined}
          position={{ current: navIdx + 1, total: navList.length }}
        />
      )}
    </div>
  )
}
