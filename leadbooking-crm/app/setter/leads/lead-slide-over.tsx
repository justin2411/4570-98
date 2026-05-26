'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Lead, LeadStatus, STATUS_CONFIG } from '@/types'
import { X, Phone, Clock, ChevronLeft, ChevronRight, SkipForward, MessageCircle, Globe, Pencil, Plus } from 'lucide-react'
import { WHATSAPP_TEMPLATES, EMAIL_TEMPLATES, buildWhatsappUrl } from '@/lib/message-templates'
import { resolveBeruf, resolveFirma } from '@/lib/script-template'
import { cleanLeadName } from '@/lib/clean-name'
import { CloserNotify } from '@/components/closer-notify'
import { formatPhoneForCall, isRealWebsite, websiteHref, websiteLabel } from '@/lib/phone'
import toast from 'react-hot-toast'

interface Props {
  lead: Lead
  userId: string
  onClose: () => void
  onUpdate: (updated: Lead) => void
  onNext?: () => void
  onPrev?: () => void
  position?: { current: number; total: number }
}

interface ClusterContent {
  list_name: string
  firma: string
  web: string
  kontakt_email: string
  tagline: string
  script: string
  templates: Record<string, { text?: string; subject?: string; body?: string }>
}

type SetterLite = {
  full_name: string
  role_title: string | null
  teams_room_url: string | null
  phone_direct: string | null
  custom_signature: string | null
  use_custom_signature: boolean
}

const STATUS_ORDER: LeadStatus[] = ['angerufen', 'nicht_erreicht', 'wiedervorlage', 'termin_gelegt', 'termin_stattgefunden', 'kein_interesse']

function getBeruf(lead: Lead): string { return ((lead as any).beruf || '').trim() }
function getOrt(lead: Lead): string { return ((lead as any).ort || '').trim() }
function getWebsite(lead: Lead): string { return ((lead as any).website || '').trim() }
function getListName(lead: Lead): string { return ((lead as any).list_name || '').trim() }

function renderClusterText(text: string, lead: Lead, setter: SetterLite | null, cluster: ClusterContent | null): string {
  const setterFull = setter?.full_name || 'Ihr Berater'
  const setterFirst = setterFull.split(' ')[0] || 'Ihr Berater'
  const kundeVoll = cleanLeadName(lead.name, getBeruf(lead))
  const nameParts = kundeVoll.split(/\s+/).filter(Boolean)
  const kundeNachname = nameParts.length ? nameParts[nameParts.length - 1] : kundeVoll
  const kundeVorname = nameParts[0] || kundeVoll
  let terminDatum = '[Datum]', terminKurz = '[Datum]', terminUhrzeit = '[Uhrzeit]'
  if (lead.appointment_date) {
    const d = new Date(lead.appointment_date)
    terminDatum = d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    terminKurz = d.toLocaleDateString('de-DE')
    terminUhrzeit = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  }
  const firma = resolveFirma(lead, cluster?.firma)
  const { beruf, berufPlural } = resolveBeruf(lead)
  const ort = getOrt(lead) || lead.state || ''
  return (text || '')
    .replaceAll('{berater_voll}', setterFull)
    .replaceAll('{berater}', setterFirst)
    .replaceAll('{kunde_voll}', kundeVoll)
    .replaceAll('{kunde_nachname}', kundeNachname)
    .replaceAll('{kunde}', kundeVorname)
    .replaceAll('{bundesland}', lead.state || '[Bundesland]')
    .replaceAll('{ort}', ort || '[Ort]')
    .replaceAll('{beruf}', beruf)
    .replaceAll('{beruf_plural}', berufPlural)
    .replaceAll('{email}', lead.email || '[E-Mail]')
    .replaceAll('{termin_datum}', terminDatum)
    .replaceAll('{termin_kurzdatum}', terminKurz)
    .replaceAll('{termin_uhrzeit}', terminUhrzeit)
    .replaceAll('{teams_link}', lead.teams_link || '[Teams-Link]')
    .replaceAll('{firma}', firma)
    .replaceAll('{web}', cluster?.web || '')
}

function buildClusterSignature(setter: SetterLite | null, _cluster: ClusterContent | null): string {
  if (setter?.use_custom_signature && setter.custom_signature?.trim()) return setter.custom_signature.trim()
  const name = setter?.full_name || 'Ihr Berater'
  const role = setter?.role_title || 'Beratungsteam'
  return `${name}\n${role}`
}

function renderClusterWhatsapp(templateId: string, lead: Lead, setter: SetterLite | null, cluster: ClusterContent | null): string {
  const fromCluster = cluster?.templates?.[templateId]?.text
  const def = WHATSAPP_TEMPLATES.find(t => t.id === templateId)?.defaultText || ''
  const text = (fromCluster && fromCluster.trim()) ? fromCluster : def
  return renderClusterText(text, lead, setter, cluster)
}

function renderClusterEmail(templateId: string, lead: Lead, setter: SetterLite | null, cluster: ClusterContent | null): { subject: string; body: string } {
  const def = EMAIL_TEMPLATES.find(t => t.id === templateId)
  const fromCluster = cluster?.templates?.[templateId]
  const subjT = (fromCluster?.subject && fromCluster.subject.trim()) ? fromCluster.subject : (def?.defaultSubject || '')
  let bodyT = (fromCluster?.body && fromCluster.body.trim()) ? fromCluster.body : (def?.defaultBody || '')
  bodyT = bodyT.replaceAll('{signature}', buildClusterSignature(setter, cluster))
  return { subject: renderClusterText(subjT, lead, setter, cluster), body: renderClusterText(bodyT, lead, setter, cluster) }
}

function defaultRecallDate() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0] }

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso); const now = new Date()
  const diff = (now.getTime() - d.getTime()) / 1000
  if (diff < 60) return 'gerade eben'
  if (diff < 3600) return 'vor ' + Math.floor(diff / 60) + ' Min'
  if (diff < 86400) return 'vor ' + Math.floor(diff / 3600) + ' Std'
  return 'vor ' + Math.floor(diff / 86400) + ' Tagen'
}

export function LeadSlideOver({ lead, userId, onClose, onUpdate, onNext, onPrev, position }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState<LeadStatus | null>(null)
  const [savingNote, setSavingNote] = useState(false)
  const [savingDate, setSavingDate] = useState(false)
  const [notizText, setNotizText] = useState(lead.notes || '')
  const existing = lead.appointment_date ? new Date(lead.appointment_date) : null
  const [apptDate, setApptDate] = useState(existing ? existing.toISOString().split('T')[0] : '')
  const [apptTime, setApptTime] = useState(existing ? existing.toTimeString().slice(0, 5) : '')
  const [teamsLinkInput, setTeamsLinkInput] = useState(lead.teams_link || '')

  const existingRecall = lead.recall_date ? new Date(lead.recall_date) : null
  const [showRecallDialog, setShowRecallDialog] = useState(false)
  const [recallDate, setRecallDate] = useState(existingRecall ? existingRecall.toISOString().split('T')[0] : defaultRecallDate())
  const [recallTime, setRecallTime] = useState(existingRecall ? existingRecall.toTimeString().slice(0, 5) : '10:00')
  const [savingRecall, setSavingRecall] = useState(false)

  const [setterProfile, setSetterProfile] = useState<SetterLite | null>(null)
  const setterName = setterProfile?.full_name || ''

  const [cluster, setCluster] = useState<ClusterContent | null>(null)

  const [editPhoneOpen, setEditPhoneOpen] = useState(false)
  const [editEmailOpen, setEditEmailOpen] = useState(false)
  const [phoneInput, setPhoneInput] = useState(lead.phone || '')
  const [emailInput, setEmailInput] = useState(lead.email || '')
  const [savingContact, setSavingContact] = useState(false)

  async function savePhone() {
    const v = phoneInput.trim(); if (!v) return
    setSavingContact(true)
    const { data, error } = await supabase.from('leads').update({ phone: v }).eq('id', lead.id).select().single()
    setSavingContact(false)
    if (error) { toast.error('Fehler: ' + error.message); return }
    toast.success('✓ Telefonnummer aktualisiert'); onUpdate(data as Lead); setEditPhoneOpen(false)
  }
  async function saveEmail() {
    const v = emailInput.trim()
    if (v && !(v.includes('@') && v.split('@')[1]?.includes('.'))) { toast.error('Bitte gültige E-Mail'); return }
    setSavingContact(true)
    const { data, error } = await supabase.from('leads').update({ email: v || null }).eq('id', lead.id).select().single()
    setSavingContact(false)
    if (error) { toast.error('Fehler: ' + error.message); return }
    toast.success('✓ E-Mail gespeichert'); onUpdate(data as Lead); setEditEmailOpen(false)
  }


  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!userId) return
    supabase.from('profiles').select('full_name, role_title, teams_room_url, phone_direct, custom_signature, use_custom_signature')
      .eq('id', userId).single().then(({ data }) => { if (data) setSetterProfile(data as any) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Teams-Link automatisch aus Profil vorbefüllen, sobald geladen (wenn Feld leer & Lead noch keinen Link hat)
  useEffect(() => {
    if (!lead.teams_link && setterProfile?.teams_room_url && !teamsLinkInput.trim()) {
      setTeamsLinkInput(setterProfile.teams_room_url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setterProfile, lead.id])

  // Cluster-Inhalte zum Lead laden (anhand list_name)
  useEffect(() => {
    const ln = getListName(lead)
    if (!ln) { setCluster(null); return }
    supabase.from('cluster_content').select('*').eq('list_name', ln).maybeSingle()
      .then(({ data }) => setCluster((data as any) || null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id])

  useEffect(() => {
    setNotizText(lead.notes || '')
    const e = lead.appointment_date ? new Date(lead.appointment_date) : null
    setApptDate(e ? e.toISOString().split('T')[0] : '')
    setApptTime(e ? e.toTimeString().slice(0, 5) : '')
    setTeamsLinkInput(lead.teams_link || setterProfile?.teams_room_url || '')
    const r = lead.recall_date ? new Date(lead.recall_date) : null
    setRecallDate(r ? r.toISOString().split('T')[0] : defaultRecallDate())
    setRecallTime(r ? r.toTimeString().slice(0, 5) : '10:00')
    setShowRecallDialog(false); setLoading(null)
    setPhoneInput(lead.phone || ''); setEmailInput(lead.email || ''); setEditPhoneOpen(false); setEditEmailOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (showRecallDialog) return
      const target = e.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && onNext) onNext()
      if (e.key === 'ArrowLeft' && onPrev) onPrev()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, onNext, onPrev, showRecallDialog])

  useEffect(() => () => { if (advanceTimer.current) clearTimeout(advanceTimer.current) }, [])

  function advanceOrClose() { advanceTimer.current = setTimeout(() => { if (onNext) onNext(); else onClose() }, 250) }

  function handleCallClick() {
    const newCount = (lead.call_attempts ?? 0) + 1
    const now = new Date().toISOString()
    onUpdate({ ...lead, call_attempts: newCount, last_call_attempt: now })
    supabase.rpc('increment_call_attempt', { p_lead_id: lead.id })
      .then(({ data }) => { if (data) onUpdate(data as Lead) }).catch(() => {})
    supabase.from('activity_log').insert({ lead_id: lead.id, setter_id: userId, old_status: lead.status || '', new_status: 'angerufen', note: null }).then(() => {})
  }

  async function saveNote() {
    setSavingNote(true)
    const { data, error } = await supabase.from('leads').update({ notes: notizText }).eq('id', lead.id).select().single()
    if (error) { toast.error('Fehler'); setSavingNote(false); return }
    toast.success('Notiz gespeichert'); onUpdate(data as Lead); setSavingNote(false)
  }

  async function saveAppointment() {
    if (!apptDate) { toast.error('Bitte Datum eingeben'); return }
    setSavingDate(true)
    const dt = apptTime ? new Date(`${apptDate}T${apptTime}`).toISOString() : new Date(`${apptDate}T00:00`).toISOString()
    const { data, error } = await supabase.from('leads').update({ appointment_date: dt, teams_link: teamsLinkInput.trim() || null }).eq('id', lead.id).select().single()
    if (error) { toast.error('Fehler'); setSavingDate(false); return }
    toast.success('Termin gespeichert'); onUpdate(data as Lead); setSavingDate(false)
  }

  function openEmailDraft() {
    if (!lead.email) { toast.error('Lead hat keine E-Mail-Adresse'); return }
    if (!lead.teams_link) { toast.error('Bitte Teams-Link eintragen und Termin speichern'); return }
    if (!lead.appointment_date) { toast.error('Bitte erst Termin speichern'); return }
    const { subject, body } = renderClusterEmail('email_confirmation', lead, setterProfile, cluster)
    window.location.href = `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  async function clearAppointment() {
    setSavingDate(true)
    const { data, error } = await supabase.from('leads').update({ appointment_date: null, teams_link: null }).eq('id', lead.id).select().single()
    if (error) { toast.error('Fehler'); setSavingDate(false); return }
    toast.success('Termin entfernt'); setApptDate(''); setApptTime(''); setTeamsLinkInput(''); onUpdate(data as Lead); setSavingDate(false)
  }

  async function clearRecall() {
    setSavingRecall(true)
    const { data, error } = await supabase.from('leads').update({ recall_date: null }).eq('id', lead.id).select().single()
    if (error) { toast.error('Fehler'); setSavingRecall(false); return }
    toast.success('Wiedervorlage entfernt'); onUpdate(data as Lead); setShowRecallDialog(false); setSavingRecall(false)
  }

  async function saveRecall() {
    if (!recallDate) { toast.error('Bitte Datum eingeben'); return }
    setSavingRecall(true)
    const dt = new Date(`${recallDate}T${recallTime || '10:00'}`).toISOString()
    const { data, error } = await supabase.from('leads').update({ status: 'wiedervorlage', recall_date: dt }).eq('id', lead.id).select().single()
    if (error) { toast.error('Fehler: ' + error.message); setSavingRecall(false); return }
    const { error: actErr } = await supabase.from('activity_log').insert({ lead_id: lead.id, setter_id: userId, old_status: lead.status, new_status: 'wiedervorlage', note: `Wiedervorlage am ${new Date(dt).toLocaleString('de-DE')}` })
    if (actErr) { console.error('[activity_log]', actErr); toast.error('⚠️ Aktivität nicht getrackt: ' + actErr.message) }
    toast.success('Wiedervorlage geplant ⏰'); onUpdate(data as Lead); setShowRecallDialog(false); setSavingRecall(false); advanceOrClose()
  }

  async function saveStatus(status: LeadStatus) {
    if (loading) return
    if (status === 'wiedervorlage') { setShowRecallDialog(true); return }
    setLoading(status)
    try {
      const { data, error } = await supabase.from('leads').update({ status }).eq('id', lead.id).select().single()
      if (error) { toast.error('Fehler: ' + error.message); setLoading(null); return }
      const { error: actErr } = await supabase.from('activity_log').insert({ lead_id: lead.id, setter_id: userId, old_status: lead.status, new_status: status, note: null })
      if (actErr) { console.error('[activity_log]', actErr); toast.error('⚠️ Aktivität nicht getrackt: ' + actErr.message) }
      toast.success('✓ ' + STATUS_CONFIG[status].label); onUpdate(data as Lead); advanceOrClose()
    } catch (_) { toast.error('Fehler'); setLoading(null) }
  }

  const hasAppointment = !!(apptDate || lead.appointment_date)
  const callCount = lead.call_attempts ?? 0
  const berufLabel = getBeruf(lead) || 'Lead'
  const website = getWebsite(lead)
  const showWebsite = isRealWebsite(website)

  const hasAppt = !!lead.appointment_date

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="hidden md:block flex-1 bg-black/40" onClick={onClose} />

      <div className="w-full md:max-w-md bg-white shadow-2xl flex flex-col overflow-y-auto" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>

        {/* HEADER */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2 bg-[#1E3A5F] sticky top-0 z-10" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
          {onPrev && <button onClick={onPrev} className="p-2 hover:bg-white/10 rounded-lg active:bg-white/20 transition-colors" aria-label="Vorheriger Lead"><ChevronLeft className="w-5 h-5 text-white" /></button>}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-blue-200 uppercase tracking-widest">
              {berufLabel}{position ? ` · ${position.current} / ${position.total}` : ''}
            </p>
            <h2 className="font-bold text-xl text-white truncate">{cleanLeadName(lead.name, getBeruf(lead))}</h2>
          </div>
          {onNext && <button onClick={onNext} className="p-2 hover:bg-white/10 rounded-lg active:bg-white/20 transition-colors" aria-label="Nächster Lead"><ChevronRight className="w-5 h-5 text-white" /></button>}
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg active:bg-white/20 transition-colors" aria-label="Schließen"><X className="w-5 h-5 text-white" /></button>
        </div>

        {/* ANRUFEN + COUNTER */}
        <div className="px-5 py-3 border-b border-gray-100">
          <a href={`tel:${formatPhoneForCall(lead.phone)}`} className="flex items-center justify-center gap-3 w-full min-h-[52px] p-3.5 bg-[#2E75B6] text-white rounded-xl hover:bg-[#1E3A5F] active:scale-[0.98] transition-all font-semibold text-lg shadow-sm">
            <Phone className="w-5 h-5" /><span className="tracking-wide">{formatPhoneForCall(lead.phone) || 'Keine Nummer'}</span>
          </a>
          {showWebsite && (
            <a href={websiteHref(website)} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-[#2E75B6] text-sm font-medium transition-colors">
              <Globe className="w-4 h-4" /><span className="truncate max-w-[240px]">{websiteLabel(website)}</span>
            </a>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11px] text-gray-500">
              {callCount > 0 ? (<><span className="font-semibold text-gray-700">{callCount}×</span> angerufen{lead.last_call_attempt && <> · zuletzt {formatRelative(lead.last_call_attempt)}</>}</>) : (<span className="text-gray-400">Noch nicht angerufen</span>)}
            </p>
            <button type="button" onClick={handleCallClick} className="text-[11px] font-medium px-2.5 py-1 bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 rounded-md transition-all whitespace-nowrap">+ Anruf zählen</button>
            <button type="button" onClick={() => { setPhoneInput(lead.phone || ''); setEditPhoneOpen(true) }} className="text-[11px] font-medium px-2.5 py-1 bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 rounded-md transition-all whitespace-nowrap flex items-center gap-1"><Pencil className="w-3 h-3" />Nr.</button>
            <button type="button" onClick={() => { setEmailInput(lead.email || ''); setEditEmailOpen(true) }} className="text-[11px] font-medium px-2.5 py-1 bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 rounded-md transition-all whitespace-nowrap flex items-center gap-1">{lead.email ? <Pencil className="w-3 h-3" /> : <Plus className="w-3 h-3" />}E-Mail</button>
          </div>
        </div>

        {/* TERMIN BESTÄTIGEN (nach gelegtem Termin: Closer-Mail + Mail + WhatsApp) */}
        {hasAppt && (
          <div className="px-5 py-3 border-b border-gray-100 space-y-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">📬 Termin bestätigen</p>

            {/* Closer benachrichtigen */}
            <CloserNotify
              lead={lead}
              setterName={setterProfile?.full_name || ''}
              teamsLink={lead.teams_link}
              onCloserSet={(closerId) => onUpdate({ ...lead, closer_id: closerId } as Lead)}
            />

            {/* Mail-Bestätigung */}
            {lead.email && lead.teams_link ? (
              <button onClick={openEmailDraft}
                className="w-full text-left p-3.5 rounded-xl border-2 border-gray-200 hover:border-[#2E75B6] hover:bg-blue-50 active:scale-[0.98] transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 bg-[#2E75B6] text-white">📧</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-900">E-Mail-Bestätigung</div>
                    <div className="text-xs text-gray-500 truncate">{lead.email}</div>
                  </div>
                  <span className="text-gray-400 shrink-0">›</span>
                </div>
              </button>
            ) : (
              <div className="p-3 rounded-xl border-2 border-dashed border-gray-300 text-xs text-gray-500">
                {!lead.email && '⚠️ Lead hat keine E-Mail-Adresse.'}
                {lead.email && !lead.teams_link && '💡 Teams-Link in „Terminzeit" eintragen und speichern, dann erscheint der E-Mail-Button.'}
              </div>
            )}

            {/* WhatsApp-Bestätigung */}
            <a href={buildWhatsappUrl(lead.phone, renderClusterWhatsapp('wa_confirmation', lead, setterProfile, cluster))} target="_blank" rel="noopener noreferrer"
              className="block w-full text-left p-3.5 rounded-xl border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 active:scale-[0.98] transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 bg-green-500 text-white">💬</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-gray-900">WhatsApp-Bestätigung</div>
                  <div className="text-xs text-gray-500 truncate">{formatPhoneForCall(lead.phone) || 'Keine Telefonnummer'}</div>
                </div>
                <span className="text-gray-400 shrink-0">›</span>
              </div>
            </a>
          </div>
        )}

        {/* INFO-GRID */}
        <div className="px-5 py-3 border-b border-gray-100 grid grid-cols-2 gap-x-4 gap-y-2">
          <div><p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Bundesland</p><p className="text-sm font-semibold text-gray-900 truncate">{lead.state || '–'}</p></div>
          <div><p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Ort</p><p className="text-sm font-semibold text-gray-900 truncate">{getOrt(lead) || '–'}</p></div>
          <div className="col-span-2"><p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">E-Mail</p><p className="text-sm font-semibold text-gray-900 break-all">{lead.email || '–'}</p></div>
        </div>

        {/* WIEDERVORLAGE BANNER */}
        {lead.recall_date && lead.status === 'wiedervorlage' && (
          <div className="px-5 py-3 border-b border-gray-100">
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-700 shrink-0" />
              <div className="flex-1 min-w-0"><p className="text-xs font-bold text-purple-700">Wiedervorlage geplant</p><p className="text-xs text-purple-600 truncate">{new Date(lead.recall_date).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr</p></div>
            </div>
          </div>
        )}

        {/* TERMIN */}
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Terminzeit</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <div><label className="block text-[11px] font-medium text-gray-700 mb-1">Datum</label><input type="date" value={apptDate} onChange={e => setApptDate(e.target.value)} className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-[#2E75B6] focus:outline-none" /></div>
            <div><label className="block text-[11px] font-medium text-gray-700 mb-1">Uhrzeit</label><input type="time" value={apptTime} onChange={e => setApptTime(e.target.value)} className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-[#2E75B6] focus:outline-none" /></div>
          </div>
          <div className="mb-2">
            <label className="block text-[11px] font-medium text-gray-700 mb-1">Microsoft Teams-Link</label>
            <input type="url" inputMode="url" placeholder="https://teams.microsoft.com/l/meetup-join/..." value={teamsLinkInput} onChange={e => setTeamsLinkInput(e.target.value)} className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-[#2E75B6] focus:outline-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={saveAppointment} disabled={savingDate} className="flex-1 min-h-[44px] py-2 rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-sm font-semibold text-gray-900 transition-colors disabled:opacity-50">{savingDate ? 'Speichern...' : 'Termin speichern'}</button>
            {hasAppointment && <button onClick={clearAppointment} disabled={savingDate} className="min-h-[44px] px-3 rounded-xl bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-700 transition-colors disabled:opacity-50" aria-label="Termin entfernen"><X className="w-4 h-4" /></button>}
          </div>
        </div>

        {/* NOTIZ */}
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Notiz</p>
          <textarea value={notizText} onChange={e => setNotizText(e.target.value)} rows={3} placeholder="Notizen zu diesem Lead..." className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-[#2E75B6] focus:outline-none resize-none" />
          <button onClick={saveNote} disabled={savingNote} className="mt-2 w-full min-h-[44px] py-2 rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-sm font-semibold text-gray-900 transition-colors disabled:opacity-50">{savingNote ? 'Speichern...' : 'Notiz speichern'}</button>
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
                <button key={s} onClick={() => saveStatus(s)} disabled={loading !== null} className={`w-full min-h-[52px] text-left px-4 py-3 rounded-xl border-2 transition-all font-semibold text-sm flex items-center gap-3 active:scale-[0.98] ${isCurrent ? `${cfg.bg} border-current` : 'bg-white border-gray-200 hover:border-[#2E75B6] text-gray-900 hover:bg-blue-50'} disabled:opacity-50`}>
                  <span className="text-xl shrink-0">{cfg.emoji}</span>
                  <span className="flex-1">{isLoading ? 'Wird gespeichert...' : cfg.label}</span>
                  {isCurrent && <span className="text-xs opacity-70">aktuell</span>}
                </button>
              )
            })}
          </div>
          {onNext && <button onClick={onNext} className="mt-3 w-full min-h-[44px] py-2.5 rounded-xl bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100 text-sm font-medium text-gray-600 transition-colors flex items-center justify-center gap-2"><SkipForward className="w-4 h-4" />Überspringen (→ nächster Lead)</button>}
        </div>
      </div>

      {editPhoneOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setEditPhoneOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-[#1E3A5F] mb-3">📞 Telefonnummer ändern</h3>
            <input type="tel" value={phoneInput} onChange={e => setPhoneInput(e.target.value)} placeholder="+49 151 12345678" autoFocus className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#2E75B6] focus:outline-none" />
            <p className="mt-1.5 text-[11px] text-gray-500">Wird beim Anrufen automatisch ins +49-Format gebracht.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setEditPhoneOpen(false)} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium">Abbrechen</button>
              <button onClick={savePhone} disabled={savingContact || !phoneInput.trim()} className="flex-1 py-2.5 rounded-lg bg-[#2E75B6] hover:bg-[#246299] text-white font-semibold disabled:opacity-50">{savingContact ? 'Speichern…' : '✓ Speichern'}</button>
            </div>
          </div>
        </div>
      )}

      {editEmailOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setEditEmailOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-[#1E3A5F] mb-3">📧 E-Mail {lead.email ? 'ändern' : 'hinzufügen'}</h3>
            <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="name@beispiel.de" autoFocus autoComplete="email" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#2E75B6] focus:outline-none" />
            <div className="mt-4 flex gap-2">
              <button onClick={() => setEditEmailOpen(false)} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium">Abbrechen</button>
              <button onClick={saveEmail} disabled={savingContact} className="flex-1 py-2.5 rounded-lg bg-[#2E75B6] hover:bg-[#246299] text-white font-semibold disabled:opacity-50">{savingContact ? 'Speichern…' : '✓ Speichern'}</button>
            </div>
          </div>
        </div>
      )}

      {showRecallDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-purple-600" /><h3 className="font-bold text-lg text-[#1E3A5F]">Wiedervorlage planen</h3></div>
            <p className="text-sm text-gray-700">Wann soll dieser Lead erneut angerufen werden?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div><label className="block text-[11px] font-medium text-gray-700 mb-1">Datum</label><input type="date" value={recallDate} onChange={e => setRecallDate(e.target.value)} className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-purple-500 focus:outline-none" /></div>
              <div><label className="block text-[11px] font-medium text-gray-700 mb-1">Uhrzeit</label><input type="time" value={recallTime} onChange={e => setRecallTime(e.target.value)} className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-purple-500 focus:outline-none" /></div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveRecall} disabled={savingRecall} className="flex-1 min-h-[44px] bg-purple-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50">{savingRecall ? 'Speichern...' : '⏰ Wiedervorlage planen'}</button>
              <button onClick={() => setShowRecallDialog(false)} disabled={savingRecall} className="min-h-[44px] px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 active:bg-gray-300 disabled:opacity-50">Abbrechen</button>
            </div>
            {lead.recall_date && <button onClick={clearRecall} disabled={savingRecall} className="w-full text-xs text-red-600 hover:text-red-800 hover:underline disabled:opacity-50 mt-1">Bestehende Wiedervorlage entfernen</button>}
          </div>
        </div>
      )}
    </div>
  )
}
