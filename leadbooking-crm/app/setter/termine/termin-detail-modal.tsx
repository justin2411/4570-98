'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Lead, Profile } from '@/types'
import {
  renderEmail, renderWhatsapp, applicableWhatsappTemplates, applicableEmailTemplates,
  buildWhatsappUrl, buildMailtoUrl, WHATSAPP_TEMPLATES, EMAIL_TEMPLATES
} from '@/lib/message-templates'
import { X, Calendar, Clock, Phone, Mail, MessageSquare, Edit2, Trash2, Send } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  lead: Lead
  setter: Profile
  onClose: () => void
  onUpdate: (lead: Lead) => void
  onDelete?: () => void
}

type View = 'main' | 'reschedule' | 'cancel' | 'whatsapp_picker' | 'email_picker'

export function TerminDetailModal({ lead, setter, onClose, onUpdate, onDelete }: Props) {
  const supabase = createClient()
  const [view, setView] = useState<View>('main')
  const [saving, setSaving] = useState(false)

  const date = lead.appointment_date ? new Date(lead.appointment_date) : null
  const dateStr = date?.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) || '—'
  const timeStr = date?.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) || '—'

  // Mail-Picker öffnen statt direkt
  // (renderEmail wird im EmailPicker pro Template aufgerufen)

  async function rescheduleTo(newDate: string) {
    setSaving(true)
    const { error } = await supabase
      .from('leads')
      .update({ appointment_date: newDate })
      .eq('id', lead.id)
    if (error) { toast.error('Fehler: ' + error.message); setSaving(false); return }
    await supabase.from('activity_log').insert({
      lead_id: lead.id,
      setter_id: setter.id,
      old_status: 'termin_gelegt',
      new_status: 'termin_gelegt',
      note: `Termin verschoben auf ${new Date(newDate).toLocaleString('de-DE')}`,
    })
    toast.success('Termin verschoben ✓')
    onUpdate({ ...lead, appointment_date: newDate })
    setSaving(false)
    setView('main')
  }

  async function cancelTermin(newStatus: 'wiedervorlage' | 'kein_interesse', note?: string) {
    setSaving(true)
    const updates: any = {
      status: newStatus,
      appointment_date: null,
    }
    if (newStatus === 'wiedervorlage') {
      // Wiedervorlage in 7 Tagen
      const recall = new Date()
      recall.setDate(recall.getDate() + 7)
      updates.recall_date = recall.toISOString()
    }
    const { error } = await supabase.from('leads').update(updates).eq('id', lead.id)
    if (error) { toast.error('Fehler: ' + error.message); setSaving(false); return }
    await supabase.from('activity_log').insert({
      lead_id: lead.id,
      setter_id: setter.id,
      old_status: 'termin_gelegt',
      new_status: newStatus,
      note: note || 'Termin abgesagt',
    })
    toast.success('Termin entfernt')
    if (onDelete) onDelete()
    setSaving(false)
    onClose()
  }

  // Verfügbare Templates (alle die zur lead-Situation passen)
  const allWaTemplates = WHATSAPP_TEMPLATES.filter(t => t.condition(lead))
  const allEmailTemplates = EMAIL_TEMPLATES.filter(t => t.condition(lead))

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-3 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl my-4 max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
          <h2 className="text-base font-bold text-[#1E3A5F]">
            {view === 'main' && '📅 Termin-Details'}
            {view === 'reschedule' && '🔄 Termin verschieben'}
            {view === 'cancel' && '🚫 Termin entfernen'}
            {view === 'whatsapp_picker' && '💬 WhatsApp-Nachricht'}
            {view === 'email_picker' && '📧 E-Mail-Nachricht'}
          </h2>
          <button onClick={view === 'main' ? onClose : () => setView('main')} className="p-1 -mr-1 text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — scrollbar */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* MAIN VIEW */}
          {view === 'main' && (
            <div className="space-y-4">
              {/* Lead-Info */}
              <div className="text-center">
                <h3 className="text-xl font-bold text-[#1E3A5F]">{lead.name}</h3>
                <div className="mt-1 text-sm text-gray-600">{lead.state || '—'} · Hebamme</div>
              </div>

              {/* Termin-Card */}
              {date ? (
                <div className={"border-2 rounded-xl p-4 space-y-2 " + (date < new Date() ? "bg-gray-50 border-gray-300" : "bg-yellow-50 border-yellow-200")}>
                  <div className="flex items-center gap-3">
                    <Calendar className={"w-4 h-4 shrink-0 " + (date < new Date() ? "text-gray-500" : "text-yellow-700")} />
                    <span className="text-sm font-semibold text-gray-900">{dateStr}</span>
                    {date < new Date() && <span className="ml-auto text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded font-bold">VERGANGEN</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className={"w-4 h-4 shrink-0 " + (date < new Date() ? "text-gray-500" : "text-yellow-700")} />
                    <span className="text-sm font-semibold text-gray-900">{timeStr} Uhr · 60 Min</span>
                  </div>
                  {lead.teams_link && (
                    <div className="flex items-center gap-3">
                      <span className="w-4 text-sm shrink-0">💻</span>
                      <a href={lead.teams_link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate">
                        Microsoft Teams öffnen
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">⚠️</span>
                    <span className="text-sm font-bold text-orange-900">Kein Datum eingetragen</span>
                  </div>
                  <p className="text-xs text-orange-800 mb-3">
                    Bei diesem Termin fehlt das Datum. Trag es jetzt nach, damit die Bestätigungs-Mail rausgeht und der Termin im Kalender erscheint.
                  </p>
                  <button
                    onClick={() => setView('reschedule')}
                    className="w-full py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm"
                  >
                    📅 Datum jetzt eintragen
                  </button>
                </div>
              )}

              {/* Contact-Info */}
              <div className="space-y-2 text-sm">
                {lead.phone && (
                  <a href={`tel:${lead.phone}`} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-800">{lead.phone}</span>
                  </a>
                )}
                {lead.email && (
                  <div className="flex items-center gap-3 p-2.5">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-800 truncate">{lead.email}</span>
                  </div>
                )}
              </div>

              {/* Notizen */}
              {lead.notes && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Notizen</div>
                  <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-700 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                    {lead.notes}
                  </div>
                </div>
              )}

              {/* Aktionen */}
              <div className="border-t border-gray-200 pt-4 space-y-2">
                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">📬 Nachfass-Nachricht senden</div>

                <button
                  onClick={() => setView('email_picker')}
                  disabled={!lead.email || allEmailTemplates.length === 0}
                  className="w-full p-3 rounded-xl border-2 border-gray-200 hover:border-[#2E75B6] hover:bg-blue-50 flex items-center gap-3 disabled:opacity-50 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#2E75B6] text-white flex items-center justify-center text-sm shrink-0">📧</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900">E-Mail Nachfassen</div>
                    <div className="text-xs text-gray-500">{allEmailTemplates.length} Vorlagen verfügbar</div>
                  </div>
                  <span className="text-gray-400">›</span>
                </button>

                <button
                  onClick={() => setView('whatsapp_picker')}
                  disabled={allWaTemplates.length === 0}
                  className="w-full p-3 rounded-xl border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 flex items-center gap-3 disabled:opacity-50 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-green-500 text-white flex items-center justify-center text-sm shrink-0">💬</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900">WhatsApp Nachfassen</div>
                    <div className="text-xs text-gray-500">{allWaTemplates.length} Vorlagen verfügbar</div>
                  </div>
                  <span className="text-gray-400">›</span>
                </button>
              </div>

              {/* Termin-Aktionen */}
              <div className="border-t border-gray-200 pt-4 space-y-2">
                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">⚙️ Termin bearbeiten</div>

                <button
                  onClick={() => setView('reschedule')}
                  className="w-full p-3 rounded-xl border-2 border-blue-200 hover:bg-blue-50 flex items-center gap-3 text-left"
                >
                  <Edit2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-sm text-blue-900">Termin verschieben</div>
                    <div className="text-xs text-blue-600">Neues Datum / Uhrzeit wählen</div>
                  </div>
                </button>

                <button
                  onClick={() => setView('cancel')}
                  className="w-full p-3 rounded-xl border-2 border-red-200 hover:bg-red-50 flex items-center gap-3 text-left"
                >
                  <Trash2 className="w-4 h-4 text-red-600 shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-sm text-red-900">Termin entfernen</div>
                    <div className="text-xs text-red-600">Termin absagen oder canceln</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* RESCHEDULE VIEW */}
          {view === 'reschedule' && (
            <RescheduleView
              currentDate={lead.appointment_date || ''}
              saving={saving}
              onSave={rescheduleTo}
              onBack={() => setView('main')}
            />
          )}

          {/* CANCEL VIEW */}
          {view === 'cancel' && (
            <CancelView
              saving={saving}
              onCancel={cancelTermin}
              onBack={() => setView('main')}
            />
          )}

          {/* WHATSAPP PICKER */}
          {view === 'whatsapp_picker' && (
            <WhatsappPicker
              lead={lead}
              setter={setter}
              templates={allWaTemplates}
              onBack={() => setView('main')}
            />
          )}

          {/* EMAIL PICKER */}
          {view === 'email_picker' && (
            <EmailPicker
              lead={lead}
              setter={setter}
              templates={allEmailTemplates}
              onBack={() => setView('main')}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ============== RESCHEDULE ==============

function RescheduleView({ currentDate, saving, onSave, onBack }: {
  currentDate: string
  saving: boolean
  onSave: (newDate: string) => void
  onBack: () => void
}) {
  // Default: existierendes Datum, oder wenn keins → übermorgen 10:00
  const initial = useMemo(() => {
    if (currentDate) {
      const d = new Date(currentDate)
      if (d >= new Date()) return d.toISOString().slice(0, 16)
    }
    const d = new Date()
    d.setDate(d.getDate() + 2)
    d.setHours(10, 0, 0, 0)
    return d.toISOString().slice(0, 16)
  }, [currentDate])
  const [newDate, setNewDate] = useState(initial)

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Neues Datum & Uhrzeit für den Termin wählen:</p>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Datum & Uhrzeit</label>
        <input
          type="datetime-local"
          value={newDate}
          onChange={e => setNewDate(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
        />
      </div>
      <div className="flex gap-2">
        <button onClick={onBack} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium">
          Zurück
        </button>
        <button
          onClick={() => onSave(new Date(newDate).toISOString())}
          disabled={saving || !newDate}
          className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50"
        >
          {saving ? 'Speichern...' : '✓ Verschieben'}
        </button>
      </div>
    </div>
  )
}

// ============== CANCEL ==============

function CancelView({ saving, onCancel, onBack }: {
  saving: boolean
  onCancel: (status: 'wiedervorlage' | 'kein_interesse', note?: string) => void
  onBack: () => void
}) {
  const [note, setNote] = useState('')

  return (
    <div className="space-y-4">
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900">
        ⚠️ Was passiert mit dem Lead nach dem Absagen?
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Notiz (optional)</label>
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Grund / Notiz"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
        />
      </div>

      <div className="space-y-2">
        <button
          onClick={() => onCancel('wiedervorlage', note ? `Termin abgesagt — ${note}` : 'Termin abgesagt, will neuen Termin')}
          disabled={saving}
          className="w-full p-3 rounded-xl bg-purple-100 hover:bg-purple-200 border-2 border-purple-300 text-left disabled:opacity-50"
        >
          <div className="font-medium text-purple-900 text-sm">⏰ Absagen, aber Lead behalten</div>
          <div className="text-xs text-purple-700 mt-0.5">Wiedervorlage in 7 Tagen → später nochmal anrufen</div>
        </button>

        <button
          onClick={() => onCancel('kein_interesse', note ? `Termin abgesagt — ${note}` : 'Termin abgesagt, kein Interesse mehr')}
          disabled={saving}
          className="w-full p-3 rounded-xl bg-red-100 hover:bg-red-200 border-2 border-red-300 text-left disabled:opacity-50"
        >
          <div className="font-medium text-red-900 text-sm">🚫 Absagen, kein Interesse mehr</div>
          <div className="text-xs text-red-700 mt-0.5">Lead wird auf „Kein Interesse" gesetzt</div>
        </button>
      </div>

      <button onClick={onBack} className="w-full py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium">
        Zurück
      </button>
    </div>
  )
}

// ============== WHATSAPP-PICKER ==============

function WhatsappPicker({ lead, setter, templates, onBack }: {
  lead: Lead
  setter: Profile
  templates: any[]
  onBack: () => void
}) {
  function send(templateId: string) {
    const text = renderWhatsapp(templateId, lead, setter)
    window.open(buildWhatsappUrl(lead.phone, text), '_blank')
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">Welche Nachricht senden?</p>
      <div className="space-y-2">
        {templates.map(t => (
          <button
            key={t.id}
            onClick={() => send(t.id)}
            className="w-full p-3 rounded-xl border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-100 text-green-700 flex items-center justify-center text-sm shrink-0">{t.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900">{t.label}</div>
                <div className="text-xs text-gray-500">{t.description}</div>
              </div>
              <Send className="w-4 h-4 text-gray-400" />
            </div>
          </button>
        ))}
      </div>
      <button onClick={onBack} className="w-full py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium">
        Zurück
      </button>
    </div>
  )
}

// ============== EMAIL-PICKER ==============

function EmailPicker({ lead, setter, templates, onBack }: {
  lead: Lead
  setter: Profile
  templates: any[]
  onBack: () => void
}) {
  function send(templateId: string) {
    const { subject, body } = renderEmail(templateId, lead, setter)
    window.location.href = buildMailtoUrl(lead.email || '', subject, body)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">Welche E-Mail senden?</p>
      <div className="space-y-2">
        {templates.map(t => (
          <button
            key={t.id}
            onClick={() => send(t.id)}
            className="w-full p-3 rounded-xl border-2 border-gray-200 hover:border-[#2E75B6] hover:bg-blue-50 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-sm shrink-0">{t.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900">{t.label}</div>
                <div className="text-xs text-gray-500">{t.description}</div>
              </div>
              <Send className="w-4 h-4 text-gray-400" />
            </div>
          </button>
        ))}
      </div>
      <button onClick={onBack} className="w-full py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium">
        Zurück
      </button>
    </div>
  )
}
