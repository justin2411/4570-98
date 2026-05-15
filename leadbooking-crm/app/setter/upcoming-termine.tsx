'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Clock, ChevronRight } from 'lucide-react'
import type { Lead } from '@/types'

interface Props {
  setterId: string
}

export function UpcomingTermine({ setterId }: Props) {
  const supabase = createClient()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const now = new Date()
    const in7days = new Date()
    in7days.setDate(in7days.getDate() + 7)

    supabase
      .from('leads')
      .select('*')
      .eq('assigned_to', setterId)
      .eq('status', 'termin_gelegt')
      .gte('appointment_date', now.toISOString())
      .lte('appointment_date', in7days.toISOString())
      .order('appointment_date', { ascending: true })
      .limit(5)
      .then(({ data }) => {
        setLeads((data as Lead[]) || [])
        setLoading(false)
      })
  }, [setterId, supabase])

  function formatBucket(date: Date): string {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dayAfter = new Date(today)
    dayAfter.setDate(dayAfter.getDate() + 2)

    if (date < tomorrow) return 'Heute'
    if (date < dayAfter) return 'Morgen'
    return date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
  }

  if (loading) {
    return (
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Anstehende Termine
        </h2>
        <div className="text-sm text-gray-400">Lade...</div>
      </section>
    )
  }

  if (leads.length === 0) {
    return (
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Anstehende Termine
        </h2>
        <div className="text-center py-4">
          <p className="text-sm text-gray-600">Keine Termine in den nächsten 7 Tagen.</p>
          <Link href="/setter/cockpit" className="inline-block mt-2 text-sm text-[#2E75B6] hover:underline font-medium">
            ⚡ Ins Cockpit →
          </Link>
        </div>
      </section>
    )
  }

  // Hat heute Termine? Show alert-style banner
  const heuteTermine = leads.filter(l => {
    if (!l.appointment_date) return false
    const d = new Date(l.appointment_date)
    const today = new Date()
    return d.toDateString() === today.toDateString()
  })

  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Anstehende Termine
        </h2>
        <Link href="/setter/termine" className="text-xs text-[#2E75B6] hover:underline font-medium">
          Alle ansehen →
        </Link>
      </div>

      {heuteTermine.length > 0 && (
        <div className="px-5 py-3 bg-yellow-50 border-b border-yellow-200">
          <p className="text-sm font-semibold text-yellow-900">
            ⏰ Heute {heuteTermine.length} Termin{heuteTermine.length > 1 ? 'e' : ''}!
          </p>
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {leads.map(lead => {
          const d = lead.appointment_date ? new Date(lead.appointment_date) : null
          const timeStr = d?.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) || '—'
          const bucket = d ? formatBucket(d) : '—'
          const isToday = d && d.toDateString() === new Date().toDateString()

          return (
            <Link
              key={lead.id}
              href="/setter/termine"
              className="block px-5 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={"shrink-0 px-2.5 py-1 rounded-lg text-center text-xs font-semibold " +
                  (isToday ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-700")}>
                  {bucket}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#1E3A5F] truncate">{lead.name}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {timeStr} Uhr
                    <span className="text-gray-300">·</span>
                    {lead.state || '—'}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
