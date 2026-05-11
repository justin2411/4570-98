'use client'

import { useState } from 'react'
import { Lead } from '@/types'

function formatDT(dt: string | null) {
  if (!dt) return 'Kein Datum'
  const d = new Date(dt)
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) + ', ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr'
}

const STATUS_COLORS: Record<string, string> = {
  termin_gelegt: 'bg-yellow-100 text-yellow-800',
  termin_stattgefunden: 'bg-green-100 text-green-700',
}
const STATUS_LABELS: Record<string, string> = {
  termin_gelegt: 'Termin gelegt',
  termin_stattgefunden: 'Termin stattgefunden',
}

export function TermineClient({ leads }: { leads: Lead[] }) {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const now = new Date()

  const upcoming = leads
    .filter(l => l.status === 'termin_gelegt' || (l.appointment_date && new Date(l.appointment_date) >= now))
    .sort((a, b) => {
      if (!a.appointment_date) return 1
      if (!b.appointment_date) return -1
      return new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime()
    })

  const past = leads
    .filter(l => l.appointment_date && new Date(l.appointment_date) < now)
    .sort((a, b) => {
      if (!a.appointment_date) return 1
      if (!b.appointment_date) return -1
      return new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime()
    })

  const shown = tab === 'upcoming' ? upcoming : past

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Meine Termine</h1>
        <p className="text-gray-700 text-sm mt-1">{leads.length} Termine gesamt</p>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab('upcoming')}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${tab === 'upcoming' ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'}`}>
          Bevorstehend ({upcoming.length})
        </button>
        <button onClick={() => setTab('past')}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${tab === 'past' ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'}`}>
          Vergangen ({past.length})
        </button>
      </div>

      <div className="space-y-3">
        {shown.map(lead => (
          <div key={lead.id} className="bg-white border border-gray-200 rounded-2xl px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-gray-900 text-[15px]">{lead.name}</span>
                  <span className="text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full">Hebamme</span>
                </div>
                <p className="text-sm font-semibold text-[#1E3A5F] mb-1">{formatDT(lead.appointment_date)}</p>
                <p className="text-sm text-gray-700">+{lead.phone.replace(/^\+/, '')} · {lead.state}</p>
                {lead.notes && <p className="text-sm text-gray-600 mt-1 italic">{lead.notes}</p>}
              </div>
              <span className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[lead.status] ?? 'bg-gray-100 text-gray-700'}`}>
                {STATUS_LABELS[lead.status] ?? lead.status}
              </span>
            </div>
          </div>
        ))}
        {shown.length === 0 && (
          <p className="text-center text-gray-500 py-12">
            {tab === 'upcoming' ? 'Keine bevorstehenden Termine' : 'Keine vergangenen Termine'}
          </p>
        )}
      </div>
    </div>
  )
}
