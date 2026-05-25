'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Closer, Lead } from '@/types'
import { Headphones, Send, Check } from 'lucide-react'
import { buildCloserMailto } from '@/lib/closer-mailto'
import toast from 'react-hot-toast'

interface Props {
  lead: Lead
  setterName: string
  teamsLink?: string | null
  onCloserSet?: (closerId: string) => void
}

/**
 * Closer-Benachrichtigung im "Termin gespeichert"-Modal.
 * Farblich harmonisch zum hellen Modal-Stil.
 */
export function CloserNotify({ lead, setterName, teamsLink, onCloserSet }: Props) {
  const supabase = createClient()
  const [closers, setClosers] = useState<Closer[]>([])
  const [selectedId, setSelectedId] = useState<string>(lead.closer_id ?? '')
  const [loading, setLoading] = useState(true)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('closers')
        .select('*')
        .eq('is_active', true)
        .order('name')
      if (!cancelled) {
        setClosers((data ?? []) as Closer[])
        if ((data?.length ?? 0) === 1 && !selectedId) {
          setSelectedId((data as Closer[])[0].id)
        }
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSend() {
    if (!selectedId) {
      toast.error('Bitte Closer auswählen')
      return
    }
    if (!lead.appointment_date) {
      toast.error('Termin-Datum fehlt')
      return
    }
    const closer = closers.find(c => c.id === selectedId)
    if (!closer) {
      toast.error('Closer nicht gefunden')
      return
    }

    const { error } = await supabase
      .from('leads')
      .update({ closer_id: selectedId })
      .eq('id', lead.id)
    if (error) {
      toast.error('Fehler: ' + error.message)
      return
    }

    onCloserSet?.(selectedId)

    const url = buildCloserMailto({
      closerName: closer.name,
      closerEmail: closer.email,
      leadId: lead.id,
      leadName: lead.name,
      leadBeruf: (lead as any).beruf,
      leadPhone: lead.phone,
      leadEmail: lead.email,
      leadState: lead.state,
      leadNotes: lead.notes,
      appointmentDate: new Date(lead.appointment_date),
      setterName,
      teamsLink,
    })

    window.location.href = url
    setSent(true)
    toast.success('Mail an ' + closer.name + ' wird geöffnet')
  }

  if (loading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center text-sm text-gray-500">
        Lade Closer...
      </div>
    )
  }

  if (closers.length === 0) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
        <p className="text-sm text-orange-800 font-semibold mb-1">
          ⚠️ Noch keine Closer im System
        </p>
        <p className="text-xs text-orange-700">
          Admin muss zuerst unter <strong>Admin → Closer</strong> Beraterinnen anlegen.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
        <Headphones className="w-3.5 h-3.5" />
        Closer benachrichtigen
      </h3>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-3">
        <select
          value={selectedId}
          onChange={e => { setSelectedId(e.target.value); setSent(false) }}
          className="w-full px-3 py-2.5 rounded-lg text-sm bg-white border border-gray-300 text-gray-900 focus:ring-2 focus:ring-[#2E75B6] focus:border-[#2E75B6] focus:outline-none"
        >
          <option value="">– Closer auswählen –</option>
          {closers.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <button
          onClick={handleSend}
          disabled={!selectedId}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${
            sent
              ? 'bg-green-500 text-white'
              : 'bg-[#2E75B6] hover:bg-[#1E3A5F] text-white active:scale-[0.98]'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {sent ? (
            <>
              <Check className="w-4 h-4" />
              Mail wurde geöffnet
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Termin-Einladung senden
            </>
          )}
        </button>

        {sent && (
          <p className="text-[11px] text-gray-600 text-center">
            Drücke in Apple Mail jetzt auf <strong className="text-[#2E75B6]">Senden</strong>.
          </p>
        )}
      </div>
    </div>
  )
}
