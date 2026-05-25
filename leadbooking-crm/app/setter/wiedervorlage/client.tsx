'use client'

import { useState } from 'react'
import { Lead } from '@/types'
import { Clock, Phone } from 'lucide-react'
import { LeadSlideOver } from '../leads/lead-slide-over'

type Tab = 'heute' | 'woche' | 'alle'

function isToday(dt: string | null) {
  if (!dt) return false
  const d = new Date(dt)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function isThisWeek(dt: string | null) {
  if (!dt) return false
  const d = new Date(dt)
  const now = new Date()
  const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); weekStart.setHours(0,0,0,0)
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7)
  return d >= weekStart && d < weekEnd
}

function isOverdue(dt: string | null) {
  if (!dt) return false
  return new Date(dt) < new Date()
}

function formatDT(dt: string | null) {
  if (!dt) return '–'
  const d = new Date(dt)
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }) + ', ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr'
}

export function WiedervorlageClient({ leads: initialLeads, userId }: { leads: Lead[]; userId: string }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [selected, setSelected] = useState<Lead | null>(null)
  const [tab, setTab] = useState<Tab>('heute')

  const heute = leads.filter(l => isToday(l.recall_date))
  const woche = leads.filter(l => isThisWeek(l.recall_date))
  const overdueCount = leads.filter(l => isOverdue(l.recall_date)).length

  const shown = tab === 'heute' ? heute : tab === 'woche' ? woche : leads

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Meine Wiedervorlagen</h1>
        <p className="text-gray-700 text-sm mt-1">
          {leads.length} {leads.length === 1 ? 'Wiedervorlage' : 'Wiedervorlagen'} insgesamt
          {overdueCount > 0 && <span className="ml-2 text-red-600 font-semibold">· {overdueCount} überfällig</span>}
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setTab('heute')} className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${tab === 'heute' ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'}`}>
          Heute fällig ({heute.length})
        </button>
        <button onClick={() => setTab('woche')} className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${tab === 'woche' ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'}`}>
          Diese Woche ({woche.length})
        </button>
        <button onClick={() => setTab('alle')} className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${tab === 'alle' ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'}`}>
          Alle ({leads.length})
        </button>
      </div>

      <div className="space-y-2">
        {shown.map(lead => {
          const overdue = isOverdue(lead.recall_date)
          return (
            <button key={lead.id} onClick={() => setSelected(lead)}
              className={`w-full text-left bg-white border rounded-2xl px-5 py-4 hover:shadow-md transition-all ${overdue ? 'border-red-300 hover:border-red-500' : 'border-gray-200 hover:border-purple-500'}`}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-gray-900 text-[15px] truncate">{lead.name}</span>
                  {((lead as any).beruf || '').trim() && <span className="shrink-0 text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full">{(lead as any).beruf}</span>}
                </div>
                {overdue && (
                  <span className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700">Überfällig</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm mb-1.5">
                <span className="font-semibold text-gray-900 flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> +{lead.phone.replace(/^\+/, '')}</span>
                {lead.state && <span className="text-gray-500 text-xs">{lead.state}</span>}
              </div>
              <div className={`text-sm font-semibold flex items-center gap-1.5 ${overdue ? 'text-red-700' : 'text-purple-700'}`}>
                <Clock className="w-4 h-4" />
                {formatDT(lead.recall_date)}
              </div>
              {lead.notes && <p className="text-xs text-gray-600 mt-1.5 italic line-clamp-2">{lead.notes}</p>}
            </button>
          )
        })}
        {shown.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              {tab === 'heute' ? 'Keine Wiedervorlagen für heute geplant' : tab === 'woche' ? 'Keine Wiedervorlagen für diese Woche' : 'Noch keine Wiedervorlagen geplant'}
            </p>
          </div>
        )}
      </div>

      {selected && (
        <LeadSlideOver
          lead={selected}
          userId={userId}
          onClose={() => setSelected(null)}
          onUpdate={updated => {
            setLeads(prev => updated.status === 'wiedervorlage'
              ? prev.map(l => l.id === updated.id ? updated : l)
              : prev.filter(l => l.id !== updated.id)
            )
            setSelected(updated.status === 'wiedervorlage' ? updated : null)
          }}
        />
      )}
    </div>
  )
}
