'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Lead, LeadStatus, STATUS_CONFIG } from '@/types'
import { StatusBadge } from '@/components/leads/status-badge'
import { ScoreBadge } from '@/components/leads/score-badge'
import { Button } from '@/components/ui/button'
import { X, Phone } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  lead: Lead
  userId: string
  onClose: () => void
  onUpdate: (updated: Lead) => void
}

const STATUS_ORDER: LeadStatus[] = ['neu', 'angerufen', 'nicht_erreicht', 'termin_gelegt', 'termin_stattgefunden', 'kein_interesse']

export function LeadSlideOver({ lead, userId, onClose, onUpdate }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [newStatus, setNewStatus] = useState<LeadStatus | null>(null)
  const [note, setNote] = useState('')
  const [appointmentDate, setAppointmentDate] = useState('')
  const [appointmentTime, setAppointmentTime] = useState('')

  async function handleStatusChange(status: LeadStatus) {
    if (status === 'termin_gelegt') {
      setNewStatus(status)
      return
    }
    await saveStatus(status)
  }

  async function saveStatus(status: LeadStatus) {
    setLoading(true)
    const updates: Partial<Lead> = { status }
    if (status === 'termin_gelegt' && appointmentDate && appointmentTime) {
      updates.appointment_date = new Date(`${appointmentDate}T${appointmentTime}`).toISOString()
    }
    if (note) updates.notes = note

    const { data, error } = await supabase.from('leads').update(updates).eq('id', lead.id).select().single()
    if (error) { toast.error('Fehler: ' + error.message); setLoading(false); return }

    await supabase.from('activity_log').insert({
      lead_id: lead.id, setter_id: userId,
      old_status: lead.status, new_status: status, note: note || null,
    })

    toast.success('Status aktualisiert!')
    onUpdate(data as Lead)
    setNewStatus(null)
    setNote('')
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-xl flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 flex items-start justify-between">
          <div>
            <h2 className="font-bold text-lg text-[#1E3A5F]">{lead.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <ScoreBadge score={lead.score} />
              <StatusBadge status={lead.status} />
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {/* Details */}
        <div className="p-5 space-y-3 border-b border-gray-100">
          <a href={`tel:${lead.phone}`} className="flex items-center gap-3 p-3 bg-[#1E3A5F] text-white rounded-xl hover:bg-[#2E75B6] transition-colors font-medium">
            <Phone className="w-5 h-5" />
            {lead.phone}
          </a>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Bundesland</span><p className="font-medium">{lead.state}</p></div>
            <div><span className="text-gray-500">Lead-Qualität</span><p className="font-medium">{lead.lead_quality}</p></div>
            <div><span className="text-gray-500">Alter</span><p className="font-medium">{lead.age_indicator}</p></div>
            {lead.email && <div><span className="text-gray-500">E-Mail</span><p className="font-medium truncate">{lead.email}</p></div>}
          </div>
          {lead.signals && (
            <div className="text-sm">
              <span className="text-gray-500 block mb-1">Signale</span>
              <p className="text-gray-700">{lead.signals}</p>
            </div>
          )}
          {lead.notes && (
            <div className="text-sm">
              <span className="text-gray-500 block mb-1">Notiz</span>
              <p className="text-gray-700">{lead.notes}</p>
            </div>
          )}
        </div>

        {/* Status-Buttons */}
        <div className="p-5 flex-1">
          <p className="text-sm font-semibold text-gray-500 mb-3">Status ändern:</p>
          <div className="space-y-2">
            {STATUS_ORDER.map(s => {
              const cfg = STATUS_CONFIG[s]
              const isCurrent = lead.status === s
              return (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={isCurrent || loading}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all font-medium text-sm ${isCurrent ? 'border-[#2E75B6] bg-blue-50 text-[#2E75B6] cursor-default' : 'border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50'}`}
                >
                  {cfg.emoji} {cfg.label} {isCurrent && '← aktuell'}
                </button>
              )
            })}
          </div>

          {/* Termin-gelegt form */}
          {newStatus === 'termin_gelegt' && (
            <div className="mt-4 p-4 bg-yellow-50 rounded-xl border border-yellow-200 space-y-3">
              <p className="font-semibold text-yellow-800">📅 Termindetails</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Datum *</label>
                  <input type="date" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Uhrzeit *</label>
                  <input type="time" value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notiz (optional)</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Besonderheiten, Rückrufzeit..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 focus:outline-none resize-none" />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => { if (!appointmentDate || !appointmentTime) { toast.error('Datum und Uhrzeit sind Pflicht!'); return } saveStatus('termin_gelegt') }} loading={loading} size="sm">Speichern</Button>
                <Button variant="secondary" onClick={() => setNewStatus(null)} size="sm">Abbrechen</Button>
              </div>
            </div>
          )}

          {newStatus && newStatus !== 'termin_gelegt' && (
            <div className="mt-4 space-y-3">
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Notiz (optional)" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#2E75B6] focus:outline-none resize-none" />
              <div className="flex gap-2">
                <Button onClick={() => saveStatus(newStatus)} loading={loading} size="sm">Speichern</Button>
                <Button variant="secondary" onClick={() => setNewStatus(null)} size="sm">Abbrechen</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
