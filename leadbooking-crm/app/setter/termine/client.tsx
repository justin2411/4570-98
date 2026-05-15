'use client'

import { useState, useMemo } from 'react'
import { Lead, Profile } from '@/types'
import { TerminDetailModal } from './termin-detail-modal'
import { Calendar, Clock, ChevronRight, Phone } from 'lucide-react'

interface Props {
  initialLeads: Lead[]
  setter: Profile
}

// Gruppiert Leads nach Datum-Buckets
function groupByBucket(leads: Lead[]): Array<{ key: string; label: string; leads: Lead[] }> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dayAfter = new Date(today)
  dayAfter.setDate(dayAfter.getDate() + 2)
  const weekEnd = new Date(today)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const buckets: Record<string, Lead[]> = {
    heute: [],
    morgen: [],
    diese_woche: [],
    spaeter: [],
  }

  for (const lead of leads) {
    if (!lead.appointment_date) continue
    const d = new Date(lead.appointment_date)
    if (d < tomorrow) buckets.heute.push(lead)
    else if (d < dayAfter) buckets.morgen.push(lead)
    else if (d < weekEnd) buckets.diese_woche.push(lead)
    else buckets.spaeter.push(lead)
  }

  return [
    { key: 'heute', label: '📅 Heute', leads: buckets.heute },
    { key: 'morgen', label: '➡️ Morgen', leads: buckets.morgen },
    { key: 'diese_woche', label: '📆 Diese Woche', leads: buckets.diese_woche },
    { key: 'spaeter', label: '🗓 Später', leads: buckets.spaeter },
  ].filter(b => b.leads.length > 0)
}

export function TermineClient({ initialLeads, setter }: Props) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  const groups = useMemo(() => groupByBucket(leads), [leads])

  function handleUpdate(updated: Lead) {
    setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))
    setSelectedLead(updated)
  }

  function handleDelete() {
    if (!selectedLead) return
    setLeads(prev => prev.filter(l => l.id !== selectedLead.id))
    setSelectedLead(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Meine Termine</h1>
        <p className="text-sm text-gray-600 mt-1">
          {leads.length === 0 ? 'Keine anstehenden Termine' : `${leads.length} anstehende Termine`}
        </p>
      </div>

      {leads.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-gray-600">Aktuell keine Termine.</p>
          <p className="text-sm text-gray-500 mt-1">Geh ins Cockpit und leg welche!</p>
        </div>
      ) : (
        groups.map(group => (
          <section key={group.key}>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 px-1">
              {group.label} <span className="text-gray-400">· {group.leads.length}</span>
            </h2>
            <div className="space-y-2">
              {group.leads.map(lead => (
                <TerminCard key={lead.id} lead={lead} onClick={() => setSelectedLead(lead)} />
              ))}
            </div>
          </section>
        ))
      )}

      {selectedLead && (
        <TerminDetailModal
          lead={selectedLead}
          setter={setter}
          onClose={() => setSelectedLead(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}

function TerminCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const d = lead.appointment_date ? new Date(lead.appointment_date) : null
  const timeStr = d?.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) || '—'
  const dateStr = d?.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) || '—'
  const weekday = d?.toLocaleDateString('de-DE', { weekday: 'short' }) || ''

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-xl border border-gray-200 hover:border-[#2E75B6] hover:shadow-md active:scale-[0.99] transition-all p-4 text-left flex items-center gap-3"
    >
      {/* Date Block */}
      <div className="shrink-0 w-14 text-center bg-yellow-50 border border-yellow-200 rounded-lg py-1.5">
        <div className="text-[10px] font-bold text-yellow-700 uppercase">{weekday}</div>
        <div className="text-base font-bold text-yellow-900 leading-tight">{dateStr}</div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-[#1E3A5F] truncate">{lead.name}</div>
        <div className="flex items-center gap-2 text-xs text-gray-600 mt-0.5">
          <Clock className="w-3 h-3" />
          <span>{timeStr} Uhr</span>
          <span className="text-gray-300">·</span>
          <span>{lead.state || '—'}</span>
        </div>
        {lead.phone && (
          <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
            <Phone className="w-3 h-3" />
            <span>{lead.phone}</span>
          </div>
        )}
      </div>

      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
    </button>
  )
}
