'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Lead, LeadStatus, STATUS_CONFIG } from '@/types'
import { X, Phone, Clock, ChevronLeft, ChevronRight, SkipForward } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  lead: Lead
  userId: string
  onClose: () => void
  onUpdate: (updated: Lead) => void
  // Navigation (optional)
  onNext?: () => void
  onPrev?: () => void
  position?: { current: number; total: number }
}

const STATUS_ORDER: LeadStatus[] = ['angerufen', 'nicht_erreicht', 'wiedervorlage', 'termin_gelegt', 'termin_stattgefunden', 'kein_interesse']

function defaultRecallDate() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export function LeadSlideOver({ lead, userId, onClose, onUpdate, onNext, onPrev, position }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState<LeadStatus | null>(null)
  const [savingNote, setSavingNote] = useState(false)
  const [savingDate, setSavingDate] = useState(false)
  const [notizText, setNotizText] = useState(lead.notes || '')
  const existing = lead.appointment_date ? new Date(lead.appointment_date) : null
  const [apptDate, setApptDate] = useState(existing ? existing.toISOString().split('T')[0] : '')
  const [apptTime, setApptTime] = useState(existing ? existing.toTimeString().slice(0,5) : '')

  const existingRecall = lead.recall_date ? new Date(lead.recall_date) : null
  const [showRecallDialog, setShowRecallDialog] = useState(false)
  const [recallDate, setRecallDate] = useState(existingRecall ? existingRecall.toISOString().split('T')[0] : defaultRecallDate())
  const [recallTime, setRecallTime] = useState(existingRecall ? existingRecall.toTimeString().slice(0,5) : '10:00')
  const [savingRecall, setSavingRecall] = useState(false)

  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Wenn der Lead wechselt (nach Next/Prev): Felder neu befüllen
  useEffect(() => {
    setNotizText(lead.notes || '')
    const e = lead.appointment_date ? new Date(lead.appointment_date) : null
    setApptDate(e ? e.toISOString().split('T')[0] : '')
    setApptTime(e ? e.toTimeString().slice(0,5) : '')
    const r = lead.recall_date ? new Date(lead.recall_date) : null
    setRecallDate(r ? r.toISOString().split('T')[0] : defaultRecallDate())
    setRecallTime(r ? r.toTimeString().slice(0,5) : '10:00')
    setShowRecallDialog(false)
    setLoading(null)
  }, [lead.id])

  // Tastatur-Shortcuts: Esc=schließen, ←/→ = Navigieren
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (showRecallDialog) return // Im Dialog keine Shortcuts
      const target = e.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return // Nicht beim Tippen
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && onNext) onNext()
      if (e.key === 'ArrowLeft' && onPrev) onPrev()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, onNext, onPrev, showRecallDialog])

  useEffect(() => () => { if (advanceTimer.current) clearTimeout(advanceTimer.current) }, [])

  function advanceOrClose() {
    advanceTimer.current = setTimeout(() => {
      if (onNext) onNext()
      else onClose()
    }, 250)
  }

  async function saveNote() {
    setSavingNote(true)
    const { data, error } = await supabase.from('leads').update({ notes: notizText }).eq('id', lead.id).select().single()
    if (error) { toast.error('Fehler'); setSavingNote(false); return }
    toast.success('Notiz gespeichert')
    onUpdate(data as Lead)
    setSavingNote(false)
  }

  async function saveAppointment() {
    if (!apptDate) { toast.error('Bitte Datum eingeben'); return }
    setSavingDate(true)
    const dt = apptTime ? new Date(`${apptDate}T${apptTime}`).toISOString() : new Date(`${apptDate}T00:00`).toISOString()
    const { data, error } = await supabase.from('leads').update({ appointment_date: dt }).eq('id', lead.id).select().single()
    if (error) { toast.error('Fehler'); setSavingDate(false); return }
    toast.success('Termin gespeichert')
    onUpdate(data as Lead)
    setSavingDate(false)
  }

  async function clearAppointment() {
    setSavingDate(true)
    const { data, error } = await supabase.from('leads').update({ appointment_date: null }).eq('id', lead.id).select().single()
    if (error) { toast.error('Fehler'); setSavingDate(false); return }
    toast.success('Termin entfernt')
    setApptDate(''); setApptTime('')
    onUpdate(data as Lead)
    setSavingDate(false)
  }

  async function clearRecall() {
    setSavingRecall(true)
    const { data, error } = await supabase.from('leads')
      .update({ recall_date: null }).eq('id', lead.id).select().single()
    if (error) { toast.error('Fehler'); setSavingRecall(false); return }
    toast.success('Wiedervorlage entfernt')
    onUpdate(data as Lead)
    setShowRecallDialog(false)
    setSavingRecall(false)
  }

  async function saveRecall() {
    if (!recallDate) { toast.error('Bitte Datum eingeben'); return }
    setSavingRecall(true)
    const dt = new Date(`${recallDate}T${recallTime || '10:00'}`).toISOString()
    const { data, error } = await supabase.from('leads').update({
      status: 'wiedervorlage',
      recall_date: dt,
    }).eq('id', lead.id).select().single()
    if (error) { toast.error('Fehler: ' + error.message); setSavingRecall(false); return }
    try {
      await supabase.from('activity_log').insert({
        lead_id: lead.id, setter_id: userId, old_status: lead.status, new_status: 'wiedervorlage',
        note: `Wiedervorlage am ${new Date(dt).toLocaleString('de-DE')}`,
      })
    } catch (_) {}
    toast.success('Wiedervorlage geplant ⏰')
    onUpdate(data as Lead)
    setShowRecallDialog(false)
    setSavingRecall(false)
    advanceOrClose()
  }

  async function saveStatus(status: LeadStatus) {
    if (loading) return
    if (status === 'wiedervorlage') { setShowRecallDialog(true); return }
    setLoading(status)
    try {
      const { data, error } = await supabase.from('leads').update({ status }).eq('id', lead.id).select().single()
      if (error) { toast.error('Fehler: ' + error.message); setLoading(null); return }
      try {
        await supabase.from('activity_log').insert({
          lead_id: lead.id, setter_id: userId, old_status: lead.status, new_status: status, note: null,
        })
      } catch (_) {}
      toast.success('✓ ' + STATUS_CONFIG[status].label)
      onUpdate(data as Lead)
      advanceOrClose()
    } catch (e) { toast.error('Fehler'); setLoading(null) }
  }

  const hasAppointment = !!(apptDate || lead.appointment_date)

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop nur auf Desktop sichtbar */}
      <div className="hidden md:block flex-1 bg-black/40" onClick={onClose} />

      {/* Panel: Mobile = Vollbild, Desktop = Slide-over rechts */}
      <div className="w-full md:max-w-md bg-white shadow-2xl flex flex-col overflow-y-auto"
           style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>

        {/* HEADER */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2 bg-[#1E3A5F] sticky top-0 z-10"
             style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
          {onPrev && (
            <button onClick={onPrev} className="p-2 hover:bg-white/10 rounded-lg active:bg-white/20 transition-colors" aria-label="Vorheriger Lead">
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-blue-200 uppercase tracking-widest">
              Hebamme{position ? ` · ${position.current} / ${position.total}` : ''}
            </p>
            <h2 className="font-bold text-xl text-white truncate">{lead.name}</h2>
          </div>
          {onNext && (
            <button onClick={onNext} className="p-2 hover:bg-white/10 rounded-lg active:bg-white/20 transition-colors" aria-label="Nächster Lead">
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          )}
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg active:bg-white/20 transition-colors" aria-label="Schließen">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* ANRUFEN */}
        <div className="px-5 py-3 border-b border-gray-100">
          <a href={`tel:${lead.phone}`}
             className="flex items-center justify-center gap-3 w-full min-h-[52px] p-3.5 bg-[#2E75B6] text-white rounded-xl hover:bg-[#1E3A5F] active:scale-[0.98] transition-all font-semibold text-lg shadow-sm">
            <Phone className="w-5 h-5" />
            <span className="tracking-wide">+{lead.phone.replace(/^\+/, '')}</span>
          </a>
        </div>

        {/* INFO-GRID */}
        <div className="px-5 py-3 border-b border-gray-100 grid grid-cols-2 gap-x-4 gap-y-2">
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Bundesland</p>
            <p className="text-sm font-semibold text-gray-900 truncate">{lead.state || '–'}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Alter</p>
            <p className="text-sm font-semibold text-gray-900 truncate">{(lead.age_indicator || '–').replace(/[^a-zA-ZäöüÄÖÜß0-9 .,()-]/g, '').trim()}</p>
          </div>
          <div className="col-span-2">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">E-Mail</p>
            <p className="text-sm font-semibold text-gray-900 break-all">{lead.email || '–'}</p>
          </div>
        </div>

        {/* WIEDERVORLAGE BANNER */}
        {lead.recall_date && lead.status === 'wiedervorlage' && (
          <div className="px-5 py-3 border-b border-gray-100">
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-700 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-purple-700">Wiedervorlage geplant</p>
                <p className="text-xs text-purple-600 truncate">{new Date(lead.recall_date).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr</p>
              </div>
            </div>
          </div>
        )}

        {/* TERMIN */}
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Terminzeit</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-[11px] font-medium text-gray-700 mb-1">Datum</label>
              <input type="date" value={apptDate} onChange={e => setApptDate(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-[#2E75B6] focus:outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-700 mb-1">Uhrzeit</label>
              <input type="time" value={apptTime} onChange={e => setApptTime(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-[#2E75B6] focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={saveAppointment} disabled={savingDate}
              className="flex-1 min-h-[44px] py-2 rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-sm font-semibold text-gray-900 transition-colors disabled:opacity-50">
              {savingDate ? 'Speichern...' : 'Termin speichern'}
            </button>
            {hasAppointment && (
              <button onClick={clearAppointment} disabled={savingDate}
                className="min-h-[44px] px-3 rounded-xl bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-700 transition-colors disabled:opacity-50"
                aria-label="Termin entfernen" title="Termin entfernen">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* NOTIZ */}
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Notiz</p>
          <textarea value={notizText} onChange={e => setNotizText(e.target.value)} rows={3}
            placeholder="Notizen zu diesem Lead..."
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-[#2E75B6] focus:outline-none resize-none" />
          <button onClick={saveNote} disabled={savingNote}
            className="mt-2 w-full min-h-[44px] py-2 rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-sm font-semibold text-gray-900 transition-colors disabled:opacity-50">
            {savingNote ? 'Speichern...' : 'Notiz speichern'}
          </button>
        </div>

        {/* STATUS */}
        <div className="px-5 py-3 flex-1">
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status setzen</p>
            {onNext && <p className="text-[10px] text-gray-400 italic">Auto → nächster Lead</p>}
          </div>
          <div className="space-y-2">
            {STATUS_ORDER.map(s => {
              const cfg = STATUS_CONFIG[s]
              const isCurrent = lead.status === s
              const isLoading = loading === s
              return (
                <button key={s} onClick={() => saveStatus(s)} disabled={loading !== null}
                  className={`w-full min-h-[52px] text-left px-4 py-3 rounded-xl border-2 transition-all font-semibold text-sm flex items-center gap-3 active:scale-[0.98] ${
                    isCurrent
                      ? `${cfg.bg} border-current`
                      : 'bg-white border-gray-200 hover:border-[#2E75B6] text-gray-900 hover:bg-blue-50'
                  } disabled:opacity-50`}>
                  <span className="text-xl shrink-0">{cfg.emoji}</span>
                  <span className="flex-1">{isLoading ? 'Wird gespeichert...' : cfg.label}</span>
                  {isCurrent && <span className="text-xs opacity-70">aktuell</span>}
                </button>
              )
            })}
          </div>

          {/* Überspringen (ohne Statuswechsel weiterspringen) */}
          {onNext && (
            <button onClick={onNext}
              className="mt-3 w-full min-h-[44px] py-2.5 rounded-xl bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100 text-sm font-medium text-gray-600 transition-colors flex items-center justify-center gap-2">
              <SkipForward className="w-4 h-4" />
              Überspringen (→ nächster Lead)
            </button>
          )}
        </div>
      </div>

      {/* WIEDERVORLAGE-DIALOG */}
      {showRecallDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-600" />
              <h3 className="font-bold text-lg text-[#1E3A5F]">Wiedervorlage planen</h3>
            </div>
            <p className="text-sm text-gray-700">Wann soll diese Hebamme erneut angerufen werden?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-gray-700 mb-1">Datum</label>
                <input type="date" value={recallDate} onChange={e => setRecallDate(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-purple-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-700 mb-1">Uhrzeit</label>
                <input type="time" value={recallTime} onChange={e => setRecallTime(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-purple-500 focus:outline-none" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveRecall} disabled={savingRecall}
                className="flex-1 min-h-[44px] bg-purple-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50">
                {savingRecall ? 'Speichern...' : '⏰ Wiedervorlage planen'}
              </button>
              <button onClick={() => setShowRecallDialog(false)} disabled={savingRecall}
                className="min-h-[44px] px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 active:bg-gray-300 disabled:opacity-50">
                Abbrechen
              </button>
            </div>
            {lead.recall_date && (
              <button onClick={clearRecall} disabled={savingRecall}
                className="w-full text-xs text-red-600 hover:text-red-800 hover:underline disabled:opacity-50 mt-1">
                Bestehende Wiedervorlage entfernen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
