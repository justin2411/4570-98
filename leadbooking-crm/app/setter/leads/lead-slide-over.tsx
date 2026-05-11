'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Lead, LeadStatus } from '@/types'
import { X, Phone } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  lead: Lead
  userId: string
  onClose: () => void
  onUpdate: (updated: Lead) => void
}

const STATUS_ORDER: LeadStatus[] = ['angerufen', 'nicht_erreicht', 'termin_gelegt', 'termin_stattgefunden', 'kein_interesse']
const STATUS_LABELS: Record<LeadStatus, string> = {
  neu: 'Neu', angerufen: 'Angerufen', nicht_erreicht: 'Nicht erreicht',
  termin_gelegt: 'Termin gelegt', termin_stattgefunden: 'Termin stattgefunden', kein_interesse: 'Kein Interesse',
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
  const [showConsentDialog, setShowConsentDialog] = useState(false)
  const [consentGiven, setConsentGiven] = useState(lead.consent_given ?? false)
  const [pendingStatus, setPendingStatus] = useState<LeadStatus | null>(null)

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

  async function saveConsent() {
    const { error } = await supabase.from('leads').update({
      consent_given: true,
      consent_date: new Date().toISOString(),
      consent_setter_id: userId,
      consent_text: 'Telefonische Einwilligung erteilt beim Erstkontakt'
    }).eq('id', lead.id)
    if (error) { toast.error('Fehler beim Speichern der Einwilligung'); return }
    setConsentGiven(true)
    setShowConsentDialog(false)
    if (pendingStatus) {
      await saveStatus(pendingStatus)
      setPendingStatus(null)
    }
    toast.success('Einwilligung dokumentiert ✅')
  }

  async function saveStatus(status: LeadStatus) {
    if (loading) return
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
              return (
                <button key={s} onClick={() => saveStatus(s)} disabled={isCurrent || loading !== null}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all font-semibold text-sm ${isCurrent ? 'border-[#2E75B6] bg-blue-50 text-[#2E75B6] cursor-default' : 'border-gray-200 hover:border-[#2E75B6] text-gray-900 hover:bg-blue-50 disabled:opacity-50'}`}>
                  {isLoading ? 'Wird gespeichert...' : STATUS_LABELS[s]}{isCurrent && ' — aktuell'}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      {showConsentDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-lg text-[#1E3A5F]">⚖️ Einwilligung dokumentieren</h3>
            <p className="text-sm text-gray-700">Hat die Person der telefonischen Beratung zugestimmt?</p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
              <p className="font-semibold mb-1">Pflichttext nach §7a UWG:</p>
              <p>"Ich rufe an wegen finanzieller Absicherung für Heilberufler. Darf ich kurz erklären worum es geht, oder soll ich Sie aus der Liste nehmen?"</p>
            </div>
            <div className="flex gap-2">
              <button onClick={saveConsent} className="flex-1 bg-green-600 text-white py-2 rounded-xl font-semibold text-sm hover:bg-green-700">
                ✅ Ja, Einwilligung erteilt
              </button>
              <button onClick={() => { setShowConsentDialog(false); setPendingStatus(null) }} className="flex-1 bg-red-100 text-red-700 py-2 rounded-xl font-semibold text-sm hover:bg-red-200">
                ❌ Nein, ablehnt
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center">Datum & Uhrzeit werden automatisch gespeichert</p>
          </div>
        </div>
      )}
    </div>
  )
}
