'use client'

import { useState, useMemo } from 'react'
import { Lead, Profile } from '@/types'
import { TerminDetailModal } from './termin-detail-modal'
import { Clock, ChevronRight, Phone, AlertCircle } from 'lucide-react'

interface Props {
  initialLeads: Lead[]
  setter: Profile
}

// Gruppiert Leads nach Datum-Buckets — inkl. "ohne Datum" und "Vergangen"
function groupByBucket(leads: Lead[]): Array<{ key: string; label: string; leads: Lead[]; warn?: boolean }> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dayAfter = new Date(today)
  dayAfter.setDate(dayAfter.getDate() + 2)
  const weekEnd = new Date(today)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const buckets: Record<string, Lead[]> = {
    ohne_datum: [],
    vergangen: [],
    heute: [],
    morgen: [],
    diese_woche: [],
    spaeter: [],
  }

  for (const lead of leads) {
    if (!lead.appointment_date) {
      buckets.ohne_datum.push(lead)
      continue
    }
    const d = new Date(lead.appointment_date)
    if (d < today) buckets.vergangen.push(lead)
    else if (d < tomorrow) buckets.heute.push(lead)
    else if (d < dayAfter) buckets.morgen.push(lead)
    else if (d < weekEnd) buckets.diese_woche.push(lead)
    else buckets.spaeter.push(lead)
  }

  return [
    { key: 'ohne_datum', label: '⚠️ Ohne Datum', leads: buckets.ohne_datum, warn: true },
    { key: 'vergangen', label: '🕒 Vergangene Termine', leads: buckets.vergangen, warn: true },
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
  const totalCount = leads.length
  const incompleteCount = groups.find(g => g.key === 'ohne_datum')?.leads.length || 0
  const pastCount = groups.find(g => g.key === 'vergangen')?.leads.length || 0

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
          {totalCount === 0 ? 'Keine Termine' : `${totalCount} gelegte Termine`}
        </p>
      </div>

      {/* Warnungs-Banner */}
      {(incompleteCount > 0 || pastCount > 0) && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
          <div className="text-sm text-orange-900">
            {incompleteCount > 0 && (
              <p><strong>{incompleteCount} Termin{incompleteCount > 1 ? 'e' : ''} ohne Datum.</strong> Klick drauf um Datum nachzutragen.</p>
            )}
            {pastCount > 0 && (
              <p className={incompleteCount > 0 ? 'mt-1' : ''}>
                <strong>{pastCount} vergangene Termin{pastCount > 1 ? 'e' : ''}.</strong> Bitte Status aktualisieren („Stattgefunden" / „Nicht erschienen").
              </p>
            )}
          </div>
        </div>
      )}

      {totalCount === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-gray-600">Aktuell keine Termine.</p>
          <p className="text-sm text-gray-500 mt-1">Geh ins Cockpit und leg welche!</p>
        </div>
      ) : (
        groups.map(group => (
          <section key={group.key}>
            <h2 className={"text-xs font-bold uppercase tracking-wide mb-2 px-1 " +
              (group.warn ? "text-orange-700" : "text-gray-500")}>
              {group.label} <span className="text-gray-400">· {group.leads.length}</span>
            </h2>
            <div className="space-y-2">
              {group.leads.map(lead => (
                <TerminCard
                  key={lead.id}
                  lead={lead}
                  warn={group.warn}
                  onClick={() => setSelectedLead(lead)}
                />
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

function TerminCard({ lead, warn, onClick }: { lead: Lead; warn?: boolean; onClick: () => void }) {
  const d = lead.appointment_date ? new Date(lead.appointment_date) : null
  const hasDate = !!d
  const isPast = d ? d < new Date() : false

  const timeStr = d?.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) || '—'
  const dateStr = d?.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) || '—'
  const weekday = d?.toLocaleDateString('de-DE', { weekday: 'short' }) || ''

  return (
    <button
      onClick={onClick}
      className={"w-full bg-white rounded-xl border hover:shadow-md active:scale-[0.99] transition-all p-4 text-left flex items-center gap-3 " +
        (warn
          ? "border-orange-300 hover:border-orange-400"
          : "border-gray-200 hover:border-[#2E75B6]")}
    >
      {/* Date Block */}
      {hasDate ? (
        <div className={"shrink-0 w-14 text-center border rounded-lg py-1.5 " +
          (isPast
            ? "bg-gray-50 border-gray-200 opacity-70"
            : "bg-yellow-50 border-yellow-200")}>
          <div className={"text-[10px] font-bold uppercase " +
            (isPast ? "text-gray-500" : "text-yellow-700")}>{weekday}</div>
          <div className={"text-base font-bold leading-tight " +
            (isPast ? "text-gray-700" : "text-yellow-900")}>{dateStr}</div>
        </div>
      ) : (
        <div className="shrink-0 w-14 text-center bg-orange-100 border border-orange-300 rounded-lg py-1.5">
          <div className="text-[10px] font-bold text-orange-700 uppercase">Kein</div>
          <div className="text-xs font-bold text-orange-900">Datum</div>
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-[#1E3A5F] truncate">{lead.name}</div>
        <div className="flex items-center gap-2 text-xs text-gray-600 mt-0.5">
          {hasDate ? (
            <>
              <Clock className="w-3 h-3" />
              <span className={isPast ? 'text-gray-500' : ''}>{timeStr} Uhr</span>
              <span className="text-gray-300">·</span>
              <span>{lead.state || '—'}</span>
            </>
          ) : (
            <span className="text-orange-700 font-medium">⚠️ Datum eintragen — Tap zum Bearbeiten</span>
          )}
        </div>
        {lead.phone && hasDate && (
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
