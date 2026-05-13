'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Lead, LeadStatus } from '@/types'
import { X, Phone, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  lead: Lead
  userId: string
  onClose: () => void
  onUpdate: (updated: Lead) => void
}

const STATUS_ORDER: LeadStatus[] = ['angerufen', 'nicht_erreicht', 'wiedervorlage', 'termin_gelegt', 'termin_stattgefunden', 'kein_interesse']
const STATUS_LABELS: Record<LeadStatus, string> = {
  neu: 'Neu', angerufen: 'Angerufen', nicht_erreicht: 'Nicht erreicht',
  wiedervorlage: 'Wiedervorlage',
  termin_gelegt: 'Termin gelegt', termin_stattgefunden: 'Termin stattgefunden', kein_interesse: 'Kein Interesse',
}

// Default-Vorschlag: Morgen 10:00 Uhr
function defaultRecallDate() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export function LeadSlideOver({ lead, userId, onClose, onUpdate }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState<LeadStatus | null>(null)
  const [savingNote, setSavingNote] = useState(false)
  const [savingDate, setSavingDate] = useState(false)
  const [notizText, setNotizText] = useState(lead.notes || '')
  const existing = lead.appointment_date ? new Date(lead.appointment_date) : null
  const [apptDate, setApptDate] = useState(existing ? existing.toISOString().split('T')[0] : '')
  const [apptTime, setApptTime] = useState(existing ? existing.toTimeString().slice(0,5) : '')

  // Wiedervorlage-Dialog State
  const existingRecall = lead.recall_date ? new Date(lead.recall_date) : null
  const [showRecallDialog, setShowRecallDialog] = useState(false)
  const [recallDate, setRecallDate] = useState(existingRecall ? existingRecall.toISOString().split('T')[0] : defaultRecallDate())
  const [recallTime, setRecallTime] = useState(existingRecall ? existingRecall.toTimeString().slice(0,5) : '10:00')
  const [savingRecall, setSavingRecall] = useState(false)

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
      toast.success('Status: ' + STATUS_LABELS[status])
      onUpdate(data as Lead)
    } catch (e) { toast.error('Fehler') }
    setLoading(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-2xl flex flex-col overflow-y-auto">

        <div className="px-6 py-5 border-b border-gray-200 flex items-start justify-between bg-[#1E3A5F]">
          <div>
            <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-1">Hebamme</p>
            <h2 className="font-bold text-2xl text-white">{lead.name}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg mt-1">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-gray-100">
          <a href={`tel:${lead.phone}`} className="flex items-center justify-center gap-3 w-full p-3.5 bg-[#2E75B6] text-white rounded-xl hover:bg-[#1E3A5F] transition-colors font-semibold text-lg">
            <Phone className="w-5 h-5" />
            +{lead.phone.replace(/^\+/, '')}
          </a>
        </div>

        <div className="px-6 py-4 border-b border-gray-100 grid grid-cols-2 gap-x-6 gap-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Bundesland</p>
            <p className="text-sm font-semibold text-gray-900">{lead.state || '–'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Alter</p>
            <p className="text-sm font-semibold text-gray-900">{(lead.age_indicator || '–').replace(/[^a-zA-ZäöüÄÖÜß0-9 .,()-]/g, '').trim()}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">E-Mail</p>
            <p className="text-sm font-semibold text-gray-900 break-all">{lead.email || '–'}</p>
          </div>
        </div>

        {lead.recall_date && lead.status === 'wiedervorlage' && (
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-700" />
              <div>
                <p className="text-xs font-bold text-purple-700">Wiedervorlage geplant</p>
                <p className="text-xs text-purple-600">{new Date(lead.recall_date).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr</p>
              </div>
            </div>
          </div>
        )}

        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Terminzeit</p>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Datum</label>
              <input type="date" value={apptDate} onChange={e => setApptDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-[#2E75B6] focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Uhrzeit</label>
              <input type="time" value={apptTime} onChange={e => setApptTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-[#2E75B6] focus:outline-none" />
            </div>
          </div>
          <button onClick={saveAppointment} disabled={savingDate}
            className="w-full py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-900 transition-colors disabled:opacity-50">
            {savingDate ? 'Speichern...' : 'Termin speichern'}
          </button>
        </div>

        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notiz</p>
          <textarea value={notizText} onChange={e => setNotizText(e.target.value)} rows={3}
            placeholder="Notizen zu diesem Lead..."
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-[#2E75B6] focus:outline-none resize-none" />
          <button onClick={saveNote} disabled={savingNote}
            className="mt-2 w-full py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-900 transition-colors disabled:opacity-50">
            {savingNote ? 'Speichern...' : 'Notiz speichern'}
          </button>
        </div>

        <div className="px-6 py-4 flex-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Status ändern</p>
          <div className="space-y-2">
            {STATUS_ORDER.map(s => {
              const isCurrent = lead.status === s
              const isLoading = loading === s
              const isRecall = s === 'wiedervorlage'
              return (
                <button key={s} onClick={() => saveStatus(s)} disabled={loading !== null}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all font-semibold text-sm flex items-center gap-2 ${
                    isCurrent
                      ? (isRecall ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-[#2E75B6] bg-blue-50 text-[#2E75B6]')
                      : (isRecall ? 'border-purple-200 hover:border-purple-500 text-purple-700 hover:bg-purple-50' : 'border-gray-200 hover:border-[#2E75B6] text-gray-900 hover:bg-blue-50')
                  } disabled:opacity-50`}>
                  {isRecall && <Clock className="w-4 h-4" />}
                  <span className="flex-1">{isLoading ? 'Wird gespeichert...' : STATUS_LABELS[s]}{isCurrent && ' — aktuell'}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {showRecallDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-600" />
              <h3 className="font-bold text-lg text-[#1E3A5F]">Wiedervorlage planen</h3>
            </div>
            <p className="text-sm text-gray-700">Wann soll diese Hebamme erneut angerufen werden?</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Datum</label>
                <input type="date" value={recallDate} onChange={e => setRecallDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-purple-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Uhrzeit</label>
                <input type="time" value={recallTime} onChange={e => setRecallTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-purple-500 focus:outline-none" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveRecall} disabled={savingRecall}
                className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-purple-700 disabled:opacity-50">
                {savingRecall ? 'Speichern...' : '⏰ Wiedervorlage planen'}
              </button>
              <button onClick={() => setShowRecallDialog(false)} disabled={savingRecall}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 disabled:opacity-50">
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
