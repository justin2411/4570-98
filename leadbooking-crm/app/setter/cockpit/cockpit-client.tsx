'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Lead, Profile } from '@/types'
import { X, Phone, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, BookOpen, MessageCircle, FileText, Mic, MicOff, Moon, Sun, Search, Pencil, Plus, Globe } from 'lucide-react'
import { playSuccessSound, formatRelativeTime, calculateStreak } from '@/lib/cockpit-helpers'
import { formatPhoneForCall, isRealWebsite, websiteHref, websiteLabel } from '@/lib/phone'
import { SCRIPT_SECTIONS, OBJECTIONS, resolveBeruf, resolveFirma } from '@/lib/script-template'
import { cleanLeadName } from '@/lib/clean-name'
import { EMAIL_TEMPLATES, WHATSAPP_TEMPLATES, applicableWhatsappTemplates, buildWhatsappUrl, buildMailtoUrl } from '@/lib/message-templates'
import { CloserNotify } from '@/components/closer-notify'
import toast from 'react-hot-toast'

interface ClusterContent {
  list_name: string
  firma: string
  web: string
  kontakt_email: string
  tagline: string
  script: string
  templates: Record<string, { text?: string; subject?: string; body?: string }>
}

interface Props {
  initialDeck: Lead[]
  setter: Profile
  clusterContent?: ClusterContent[]
}

type DrawerView = 'closed' | 'script' | 'objections' | 'notes'
type ActionType = 'termin' | 'wiedervorlage' | 'kein_interesse' | 'termin_done' | null

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
function normalizePhone(phone: string): string { return (phone || '').replace(/\D/g, '') }

function isValidEmail(email: string): boolean {
  const trimmed = email.trim()
  if (!trimmed) return false
  const atIdx = trimmed.indexOf('@')
  if (atIdx < 1) return false
  const afterAt = trimmed.slice(atIdx + 1)
  return afterAt.includes('.') && afterAt.length >= 3
}

function getBeruf(lead: Lead): string { return ((lead as any).beruf || '').trim() }
function getOrt(lead: Lead): string { return ((lead as any).ort || '').trim() }
function getWebsite(lead: Lead): string { return ((lead as any).website || '').trim() }
function getListName(lead: Lead): string { return ((lead as any).list_name || '').trim() }

// Zentrales Standard-Skript als durchgehender Text mit ##-Überschriften (gilt für alle Cluster)
const SCRIPT_TEXT = SCRIPT_SECTIONS.map(s => `## ${s.title}\n${s.content}`).join('\n\n')

// Skript-Fließtext in Abschnitte zerlegen (## Titel = Überschrift)
function parseScriptSections(script: string): { title: string | null; body: string }[] {
  const lines = (script || '').split('\n')
  const sections: { title: string | null; body: string }[] = []
  let current: { title: string | null; body: string } = { title: null, body: '' }
  for (const line of lines) {
    const m = line.match(/^\s*##\s+(.+?)\s*$/)
    if (m) {
      if (current.title !== null || current.body.trim()) sections.push(current)
      current = { title: m[1].trim(), body: '' }
    } else {
      current.body += line + '\n'
    }
  }
  if (current.title !== null || current.body.trim()) sections.push(current)
  return sections
}

// Alle Platzhalter ersetzen — inkl. {beruf}, {ort}, {firma} (aus Cluster)
function renderClusterText(text: string, lead: Lead, setter: Partial<Profile>, cluster: ClusterContent | null): string {
  const setterFull = setter.full_name || 'Ihr Berater'
  const setterFirst = setterFull.split(' ')[0] || 'Ihr Berater'
  const kundeVoll = cleanLeadName(lead.name, getBeruf(lead))
  const nameParts = kundeVoll.split(/\s+/).filter(Boolean)
  const kundeNachname = nameParts.length ? nameParts[nameParts.length - 1] : kundeVoll
  const kundeVorname = nameParts[0] || kundeVoll

  let terminDatum = '[Datum]'
  let terminKurz = '[Datum]'
  let terminUhrzeit = '[Uhrzeit]'
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

// Cluster-spezifische Mail-Signatur (firma/web/kontakt aus Cluster, Fallback Hebammen)
function buildClusterSignature(setter: Partial<Profile>, cluster: ClusterContent | null): string {
  if (setter.use_custom_signature && setter.custom_signature?.trim()) {
    return setter.custom_signature.trim()
  }
  const name = setter.full_name || 'Ihr Berater'
  const role = setter.role_title || `${cluster?.firma || 'Hebammen-Vorsorge'}-Beratungsteam`
  const phone = setter.phone_direct?.trim()
  const firma = (cluster?.firma?.trim() || 'Hebammen-Vorsorge').toUpperCase()
  const web = cluster?.web?.trim() || 'www.hebammen-vorsorge.de'
  const email = cluster?.kontakt_email?.trim() || 'beratung@hebammen-vorsorge.de'
  const tagline = cluster?.tagline?.trim() || 'Altersvorsorge & Vermögensaufbau'

  let sig = `${name}\n${role}`
  if (phone) sig += `\nTel: ${phone}`
  sig += `\n\n\n────────────────────────────────────────\n\n   ${firma}\n   ${tagline}\n\n   E-Mail:   ${email}\n   Web:      ${web}\n\n────────────────────────────────────────`
  return sig
}

// WhatsApp-Text aus Cluster (Fallback global), Platzhalter ersetzt
function renderClusterWhatsapp(templateId: string, lead: Lead, setter: Partial<Profile>, cluster: ClusterContent | null): string {
  const fromCluster = cluster?.templates?.[templateId]?.text
  const def = WHATSAPP_TEMPLATES.find(t => t.id === templateId)?.defaultText || ''
  const text = (fromCluster && fromCluster.trim()) ? fromCluster : def
  return renderClusterText(text, lead, setter, cluster)
}

// E-Mail (Betreff + Body) aus Cluster (Fallback global), Signatur + Platzhalter ersetzt
function renderClusterEmail(templateId: string, lead: Lead, setter: Partial<Profile>, cluster: ClusterContent | null): { subject: string; body: string } {
  const def = EMAIL_TEMPLATES.find(t => t.id === templateId)
  const fromCluster = cluster?.templates?.[templateId]
  const subjT = (fromCluster?.subject && fromCluster.subject.trim()) ? fromCluster.subject : (def?.defaultSubject || '')
  let bodyT = (fromCluster?.body && fromCluster.body.trim()) ? fromCluster.body : (def?.defaultBody || '')
  // Signatur zuerst einsetzen, dann restliche Platzhalter
  bodyT = bodyT.replaceAll('{signature}', buildClusterSignature(setter, cluster))
  return {
    subject: renderClusterText(subjT, lead, setter, cluster),
    body: renderClusterText(bodyT, lead, setter, cluster),
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'neu': return 'bg-blue-100 text-blue-700'
    case 'angerufen': return 'bg-yellow-100 text-yellow-700'
    case 'nicht_erreicht': return 'bg-orange-100 text-orange-700'
    case 'wiedervorlage': return 'bg-purple-100 text-purple-700'
    case 'termin_gelegt': return 'bg-green-100 text-green-700'
    case 'termin_stattgefunden': return 'bg-emerald-100 text-emerald-700'
    case 'kein_interesse': return 'bg-red-100 text-red-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'neu': return 'Neu'
    case 'angerufen': return 'Angerufen'
    case 'nicht_erreicht': return 'Nicht err.'
    case 'wiedervorlage': return 'Wiederv.'
    case 'termin_gelegt': return 'Termin'
    case 'termin_stattgefunden': return 'Termin OK'
    case 'kein_interesse': return 'Kein Int.'
    default: return status
  }
}

export function CockpitClient({ initialDeck, setter, clusterContent = [] }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const clusterMap = useMemo(() => {
    const m: Record<string, ClusterContent> = {}
    clusterContent.forEach(c => { m[c.list_name] = c })
    return m
  }, [clusterContent])

  const [deck, setDeck] = useState<Lead[]>(initialDeck)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [drawer, setDrawer] = useState<DrawerView>('closed')
  const [actionModal, setActionModal] = useState<ActionType>(null)
  const [savingAction, setSavingAction] = useState(false)
  const [todayDone, setTodayDone] = useState(0)
  const [streak, setStreak] = useState(0)
  const [dark, setDark] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Lead[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [editPhoneOpen, setEditPhoneOpen] = useState(false)
  const [editEmailOpen, setEditEmailOpen] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') setDark(window.localStorage.getItem('cockpit-dark') === '1')
  }, [])
  function toggleDark() {
    setDark(d => {
      const next = !d
      if (typeof window !== 'undefined') window.localStorage.setItem('cockpit-dark', next ? '1' : '0')
      return next
    })
  }

  const cardRef = useRef<HTMLDivElement>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const startPos = useRef({ x: 0, y: 0 })

  const currentLead = deck[currentIdx]
  const currentCluster = currentLead ? (clusterMap[getListName(currentLead)] || null) : null

  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    supabase.from('activity_log').select('id', { count: 'exact', head: true })
      .eq('setter_id', setter.id).eq('new_status', 'termin_gelegt').gte('created_at', today.toISOString())
      .then(({ count }) => setTodayDone(count || 0))
    const since = new Date(Date.now() - 30 * 86400000).toISOString()
    supabase.from('activity_log').select('created_at')
      .eq('setter_id', setter.id).eq('new_status', 'termin_gelegt').gte('created_at', since)
      .then(({ data }) => { setStreak(calculateStreak((data || []).map((r: any) => r.created_at))) })
  }, [setter.id, supabase])

  useEffect(() => {
    const query = searchQuery.trim()
    if (query.length < 2) {
      setSearchResults([]); setSearching(false)
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
      return
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    setSearching(true)
    searchTimeoutRef.current = setTimeout(async () => {
      const queryLower = query.toLowerCase()
      const queryDigits = normalizePhone(query)
      const localResults = deck.filter(lead => {
        const nameMatch = lead.name?.toLowerCase().includes(queryLower)
        const phoneMatch = queryDigits.length >= 3 && normalizePhone(lead.phone || '').includes(queryDigits)
        return nameMatch || phoneMatch
      })
      const orClauses: string[] = [`name.ilike.%${query}%`]
      if (queryDigits.length >= 3) orClauses.push(`phone.ilike.%${queryDigits}%`)
      if (query !== queryDigits) orClauses.push(`phone.ilike.%${query}%`)
      const { data } = await supabase.from('leads').select('*').or(orClauses.join(',')).limit(10)
      const localIds = new Set(localResults.map(l => l.id))
      const dbExtra = ((data as any[]) || []).filter((l: any) => !localIds.has(l.id)) as Lead[]
      setSearchResults([...localResults, ...dbExtra])
      setSearching(false)
    }, 250)
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current) }
  }, [searchQuery, deck, supabase])

  function selectSearchResult(lead: Lead) {
    const existingIdx = deck.findIndex(l => l.id === lead.id)
    if (existingIdx === currentIdx) {
      // schon sichtbar
    } else if (existingIdx !== -1) {
      const newDeck = [...deck]
      const [moved] = newDeck.splice(existingIdx, 1)
      const insertAt = existingIdx < currentIdx ? currentIdx - 1 : currentIdx
      newDeck.splice(insertAt, 0, moved)
      setDeck(newDeck); setCurrentIdx(insertAt)
    } else {
      const newDeck = [...deck]
      newDeck.splice(currentIdx, 0, lead)
      setDeck(newDeck)
    }
    setSearchQuery(''); setSearchResults([]); setDrawer('closed'); setDragOffset({ x: 0, y: 0 })
    toast.success(`→ ${lead.name}`)
  }

  function advanceCard() {
    setDragOffset({ x: 0, y: 0 }); setDragging(false); setDrawer('closed')
    if (currentIdx + 1 >= deck.length) {
      toast.success('🎉 Alle Leads abgearbeitet!')
      router.push('/setter')
    } else {
      setCurrentIdx(i => i + 1)
    }
  }

  function goBack() {
    if (currentIdx <= 0) return
    setDragOffset({ x: 0, y: 0 }); setDragging(false); setDrawer('closed'); setActionModal(null)
    setCurrentIdx(i => Math.max(0, i - 1))
  }

  async function logActivity(leadId: string, newStatus: string, note?: string) {
    const { error } = await supabase.from('activity_log').insert({
      lead_id: leadId, setter_id: setter.id, old_status: currentLead?.status || '', new_status: newStatus, note: note || null,
    })
    if (error) { console.error('[activity_log]', error); toast.error('⚠️ Aktivität nicht getrackt: ' + error.message) }
  }

  async function handleSwipeUp() { setActionModal('termin') }
  async function handleSwipeDown() { setActionModal('wiedervorlage') }

  async function handleSwipeRight() {
    if (!currentLead || savingAction) return
    setSavingAction(true)
    const attempts = (currentLead.call_attempts || 0) + 1
    let recall: Date
    let recallLabel: string
    if (attempts === 1) { recall = new Date(Date.now() + 2 * 3600000); recallLabel = '🔁 Wiedervorlage in 2h' }
    else if (attempts === 2) { recall = new Date(Date.now() + 4 * 3600000); recallLabel = '🔁 Wiedervorlage in 4h' }
    else { recall = new Date(); recall.setDate(recall.getDate() + 1); recall.setHours(10, 0, 0, 0); recallLabel = `🔁 ${attempts}. Versuch — morgen 10 Uhr` }
    const { error } = await supabase.from('leads').update({
      status: 'nicht_erreicht', recall_date: recall.toISOString(), call_attempts: attempts, last_call_attempt: new Date().toISOString(),
    }).eq('id', currentLead.id)
    if (error) { toast.error('Fehler: ' + error.message) }
    else { await logActivity(currentLead.id, 'nicht_erreicht', `Nicht erreicht (${attempts}. Versuch) — ${recallLabel}`); toast.success(recallLabel); advanceCard() }
    setSavingAction(false)
  }

  async function handleSwipeLeft() {
    if (!currentLead || savingAction) return
    setSavingAction(true)
    const { error } = await supabase.from('leads').update({ status: 'kein_interesse' }).eq('id', currentLead.id)
    if (error) { toast.error('Fehler: ' + error.message) }
    else { await logActivity(currentLead.id, 'kein_interesse'); toast.success('🚫 Kein Interesse'); advanceCard() }
    setSavingAction(false)
  }

  function onPointerDown(e: React.PointerEvent) {
    if (savingAction || actionModal) return
    startPos.current = { x: e.clientX, y: e.clientY }; setDragging(true)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return
    setDragOffset({ x: e.clientX - startPos.current.x, y: e.clientY - startPos.current.y })
  }
  function onPointerUp() {
    if (!dragging) return
    const { x, y } = dragOffset
    const threshold = 110
    const absX = Math.abs(x), absY = Math.abs(y)
    if (absX > threshold && absX > absY) { if (x > 0) handleSwipeRight(); else handleSwipeLeft() }
    else if (absY > threshold && absY > absX) { if (y < 0) handleSwipeUp(); else handleSwipeDown() }
    else { setDragOffset({ x: 0, y: 0 }) }
    setDragging(false)
  }

  if (!currentLead) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-[#1E3A5F] to-[#2E75B6]">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-white mb-2">Alle Leads abgearbeitet!</h1>
        <p className="text-white/80 mb-6">Top Leistung. Komm später wieder, wenn neue Leads da sind.</p>
        <button onClick={() => router.push('/setter')} className="px-6 py-3 rounded-xl bg-white text-[#1E3A5F] font-semibold">← Zurück zum Dashboard</button>
      </div>
    )
  }

  const formattedPhone = formatPhoneForCall(currentLead.phone)
  const berufLabel = getBeruf(currentLead) || 'Fachkraft'
  const ortLabel = getOrt(currentLead) || currentLead.state || '—'
  const website = getWebsite(currentLead)
  const showWebsite = isRealWebsite(website)

  return (
    <div className={"min-h-screen transition-colors " + (dark ? "bg-gradient-to-br from-gray-900 to-slate-800" : "bg-gradient-to-br from-[#1E3A5F] to-[#2E75B6]")} style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <div className="flex items-center gap-1">
          <button onClick={() => router.push('/setter')} className="p-2 -ml-2 rounded-lg active:bg-white/10" aria-label="Cockpit schließen"><X className="w-6 h-6" /></button>
          <button onClick={goBack} disabled={currentIdx === 0} className="p-2 rounded-lg active:bg-white/10 disabled:opacity-30 disabled:pointer-events-none" aria-label="Vorheriger Lead"><ChevronLeft className="w-6 h-6" /></button>
        </div>
        <div className="text-center text-xs">
          <div className="text-white/70">Lead</div>
          <div className="text-sm font-bold">{currentIdx + 1} / {deck.length}</div>
        </div>
        <button onClick={toggleDark} className="p-2 -mr-2 rounded-lg active:bg-white/10" aria-label="Dark Mode umschalten">{dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>
      </div>

      <div className="px-4 pb-2 relative z-30">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Name oder Telefonnummer suchen…"
            className={"w-full pl-10 pr-9 py-2 rounded-lg text-sm text-white placeholder:text-white/50 border border-white/20 focus:border-white/40 focus:outline-none transition-colors " + (dark ? "bg-white/5" : "bg-white/10")}
            autoComplete="off" spellCheck={false} />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); setSearchResults([]) }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/60 hover:text-white" aria-label="Suche löschen"><X className="w-4 h-4" /></button>
          )}
        </div>
        {searchQuery.trim().length >= 2 && (
          <div className="absolute left-4 right-4 top-full mt-1 bg-white rounded-xl shadow-2xl max-h-80 overflow-y-auto border border-gray-200">
            {searching && <div className="px-3 py-3 text-xs text-gray-500 text-center">Suche läuft…</div>}
            {!searching && searchResults.length === 0 && <div className="px-3 py-3 text-xs text-gray-500 text-center">Keine Treffer für „{searchQuery.trim()}"</div>}
            {!searching && searchResults.map(lead => {
              const isInDeck = deck.some(l => l.id === lead.id)
              return (
                <button key={lead.id} onClick={() => selectSearchResult(lead)} className="w-full text-left px-3 py-2.5 hover:bg-gray-50 active:bg-gray-100 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#1E3A5F] truncate">{cleanLeadName(lead.name, getBeruf(lead))}</div>
                      <div className="text-xs text-gray-500 truncate">{formatPhoneForCall(lead.phone)}{lead.state ? <span className="text-gray-400"> · {lead.state}</span> : null}</div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-0.5">
                      <span className={"text-[10px] px-1.5 py-0.5 rounded-full font-medium " + statusBadgeClass(lead.status)}>{statusLabel(lead.status)}</span>
                      {isInDeck && <span className="text-[9px] text-gray-400">im Deck</span>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="px-4 pb-2">
        <div className={"flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-white text-xs " + (dark ? "bg-white/5" : "bg-white/10")}>
          <div className="flex items-center gap-1.5"><span className="text-base">🔥</span><span><strong>{streak}</strong>-Tage-Streak</span></div>
          <div className="flex-1 mx-2">
            <div className="flex items-center justify-between mb-1"><span className="text-white/70">Heute</span><span><strong>{todayDone}</strong> / {setter.daily_goal || 10}</span></div>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className={"h-full transition-all " + (todayDone >= (setter.daily_goal || 10) ? "bg-green-400" : "bg-yellow-400")} style={{ width: Math.min(100, (todayDone / (setter.daily_goal || 10)) * 100) + '%' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="h-1 bg-white/10 mx-4 rounded-full overflow-hidden">
        <div className="h-full bg-yellow-400 transition-all" style={{ width: `${((currentIdx + 1) / deck.length) * 100}%` }} />
      </div>

      <div className="p-4 pt-6">
        <div ref={cardRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
          style={{ transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(${dragOffset.x * 0.05}deg)`, transition: dragging ? 'none' : 'transform 0.3s ease', touchAction: 'none' }}
          className="bg-white rounded-2xl shadow-2xl p-6 cursor-grab active:cursor-grabbing select-none">
          <SwipeHints offset={dragOffset} />

          {(currentLead.call_attempts || 0) > 0 && (
            <div className="flex justify-center mb-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 border border-orange-200 text-orange-800 text-xs font-medium">
                <span>🔁 {currentLead.call_attempts}× versucht</span>
                {currentLead.last_call_attempt && (<><span className="text-orange-400">·</span><span className="text-orange-700">zuletzt {formatRelativeTime(currentLead.last_call_attempt)}</span></>)}
              </div>
            </div>
          )}

          <div className="text-center">
            <h1 className="text-2xl font-bold text-[#1E3A5F]">{cleanLeadName(currentLead.name, getBeruf(currentLead))}</h1>
            <div className="mt-2 text-sm text-gray-600">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span>📍 {ortLabel}</span>
                <span className="text-gray-300">·</span>
                <span className="font-medium text-teal-700">{berufLabel}</span>
              </div>
              {currentLead.email ? (
                <div className="mt-1.5 text-xs text-gray-500 flex items-center justify-center gap-1">
                  <span>📧</span><span className="truncate max-w-[200px]">{currentLead.email}</span>
                  <button onClick={(e) => { e.stopPropagation(); setEditEmailOpen(true) }} onPointerDown={(e) => e.stopPropagation()} className="ml-0.5 p-0.5 text-gray-400 hover:text-gray-700 active:text-gray-900" aria-label="E-Mail bearbeiten"><Pencil className="w-3 h-3" /></button>
                </div>
              ) : (
                <button onClick={(e) => { e.stopPropagation(); setEditEmailOpen(true) }} onPointerDown={(e) => e.stopPropagation()} className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs text-[#2E75B6] hover:text-[#1E3A5F] hover:bg-blue-50 active:bg-blue-100 transition-colors"><Plus className="w-3 h-3" />E-Mail-Adresse hinzufügen</button>
              )}
            </div>
          </div>

          <a href={`tel:${formattedPhone}`}
            onClick={(e) => {
              if (!formattedPhone) { e.preventDefault(); return }
              supabase.from('leads').update({ call_attempts: (currentLead.call_attempts || 0) + 1, last_call_attempt: new Date().toISOString() }).eq('id', currentLead.id).then(() => {})
            }}
            className="mt-6 flex items-center justify-center gap-3 w-full py-4 rounded-xl bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold text-lg shadow-lg">
            <Phone className="w-6 h-6" />{formattedPhone || 'Keine Nummer'}
          </a>

          {showWebsite && (
            <a href={websiteHref(website)} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
              className="mt-2 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-[#2E75B6] text-sm font-medium transition-colors">
              <Globe className="w-4 h-4" /><span className="truncate max-w-[240px]">{websiteLabel(website)}</span>
            </a>
          )}

          <button onClick={(e) => { e.stopPropagation(); setEditPhoneOpen(true) }} onPointerDown={(e) => e.stopPropagation()}
            className="mt-2 w-full py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors flex items-center justify-center gap-1.5">
            <Pencil className="w-3 h-3" />Telefonnummer ändern
          </button>

          {currentLead.notes && (
            <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-xs text-gray-700 max-h-20 overflow-y-auto whitespace-pre-wrap">{currentLead.notes}</div>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2">
            <DrawerButton icon={BookOpen} label="Skript" onClick={() => setDrawer('script')} />
            <DrawerButton icon={MessageCircle} label="Einwände" onClick={() => setDrawer('objections')} />
            <DrawerButton icon={FileText} label="Notizen" onClick={() => setDrawer('notes')} />
          </div>
        </div>
      </div>

      <div className="px-4 mt-2 grid grid-cols-4 gap-2">
        <ActionButton color="red" icon={ChevronLeft} label="Kein Int." onClick={handleSwipeLeft} disabled={savingAction} />
        <ActionButton color="purple" icon={ChevronDown} label="Wiederv." onClick={handleSwipeDown} disabled={savingAction} />
        <ActionButton color="orange" icon={ChevronRight} label="Nicht err." onClick={handleSwipeRight} disabled={savingAction} />
        <ActionButton color="green" icon={ChevronUp} label="Termin" onClick={handleSwipeUp} disabled={savingAction} />
      </div>

      <div className="mt-3 text-center text-xs text-white/60 px-4 pb-4">💡 Tipp: Karte ziehen ←/↑/→/↓ — oder Buttons benutzen</div>

      {drawer !== 'closed' && (
        <Drawer view={drawer} lead={currentLead} setter={setter} cluster={currentCluster} onClose={() => setDrawer('closed')} supabase={supabase}
          onNotesUpdate={(notes) => { setDeck(d => d.map((l, i) => i === currentIdx ? { ...l, notes } : l)) }} />
      )}

      {editPhoneOpen && (
        <EditPhoneModal lead={currentLead} onClose={() => setEditPhoneOpen(false)}
          onSave={async (newPhone) => {
            const { error } = await supabase.from('leads').update({ phone: newPhone }).eq('id', currentLead.id)
            if (error) { toast.error('Fehler: ' + error.message); return }
            await logActivity(currentLead.id, currentLead.status, `Telefonnummer geändert auf ${newPhone}`)
            setDeck(d => d.map((l, i) => i === currentIdx ? { ...l, phone: newPhone } : l))
            toast.success('✓ Telefonnummer aktualisiert'); setEditPhoneOpen(false)
          }} />
      )}

      {editEmailOpen && (
        <EditEmailModal lead={currentLead} onClose={() => setEditEmailOpen(false)}
          onSave={async (newEmail) => {
            const { error } = await supabase.from('leads').update({ email: newEmail }).eq('id', currentLead.id)
            if (error) { toast.error('Fehler: ' + error.message); return }
            await logActivity(currentLead.id, currentLead.status, currentLead.email ? `E-Mail geändert auf ${newEmail}` : `E-Mail hinzugefügt: ${newEmail}`)
            setDeck(d => d.map((l, i) => i === currentIdx ? { ...l, email: newEmail } : l))
            toast.success('✓ E-Mail gespeichert'); setEditEmailOpen(false)
          }} />
      )}

      {actionModal === 'termin' && (
        <TerminModal lead={currentLead} setter={setter} onClose={() => setActionModal(null)}
          onDone={async (date, teamsLink) => {
            const { error } = await supabase.from('leads').update({ status: 'termin_gelegt', appointment_date: date, teams_link: teamsLink || null }).eq('id', currentLead.id)
            if (error) { toast.error('Fehler: ' + error.message); return }
            await logActivity(currentLead.id, 'termin_gelegt', `Termin am ${new Date(date).toLocaleString('de-DE')}`)
            toast.success('🟡 Termin gelegt!')
            if (setter.sound_enabled !== false) playSuccessSound()
            setTodayDone(n => n + 1)
            setDeck(d => d.map((l, i) => i === currentIdx ? { ...l, status: 'termin_gelegt' as const, appointment_date: date, teams_link: teamsLink || null } : l))
            setActionModal('termin_done')
          }} />
      )}

      {actionModal === 'termin_done' && (
        <PostTerminModal lead={currentLead} setter={setter} cluster={currentCluster} onEditEmail={() => setEditEmailOpen(true)}
          onContinue={() => { setActionModal(null); advanceCard() }} />
      )}

      {actionModal === 'wiedervorlage' && (
        <WiedervorlageModal onClose={() => setActionModal(null)}
          onDone={async (date) => {
            const { error } = await supabase.from('leads').update({ status: 'wiedervorlage', recall_date: date, call_attempts: (currentLead.call_attempts || 0) + 1, last_call_attempt: new Date().toISOString() }).eq('id', currentLead.id)
            if (error) { toast.error('Fehler: ' + error.message); return }
            await logActivity(currentLead.id, 'wiedervorlage', `Wiedervorlage am ${new Date(date).toLocaleString('de-DE')}`)
            toast.success('⏰ Wiedervorlage gespeichert'); setActionModal(null); advanceCard()
          }} />
      )}
    </div>
  )
}

// ============== SUB-COMPONENTS ==============

function SwipeHints({ offset }: { offset: { x: number; y: number } }) {
  const { x, y } = offset
  const opacity = (val: number) => Math.min(Math.abs(val) / 110, 1)
  return (
    <>
      {x > 30 && <div className="absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-orange-500 text-white font-bold text-sm rotate-[-12deg]" style={{ opacity: opacity(x) }}>🔁 NICHT ERREICHT</div>}
      {x < -30 && <div className="absolute top-4 right-4 px-3 py-1.5 rounded-lg bg-red-500 text-white font-bold text-sm rotate-[12deg]" style={{ opacity: opacity(x) }}>🚫 KEIN INTERESSE</div>}
      {y < -30 && <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-green-500 text-white font-bold text-sm" style={{ opacity: opacity(y) }}>🟡 TERMIN ↑</div>}
      {y > 30 && <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-purple-500 text-white font-bold text-sm" style={{ opacity: opacity(y) }}>⏰ WIEDERVORLAGE ↓</div>}
    </>
  )
}

function DrawerButton({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 text-xs font-medium">
      <Icon className="w-4 h-4" />{label}
    </button>
  )
}

function ActionButton({ color, icon: Icon, label, onClick, disabled }: { color: string; icon: any; label: string; onClick: () => void; disabled?: boolean }) {
  const colors: Record<string, string> = {
    red: 'bg-red-500 hover:bg-red-600 active:bg-red-700',
    orange: 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700',
    purple: 'bg-purple-500 hover:bg-purple-600 active:bg-purple-700',
    green: 'bg-green-500 hover:bg-green-600 active:bg-green-700',
  }
  return (
    <button onClick={onClick} disabled={disabled} className={`flex flex-col items-center justify-center gap-0.5 py-3 rounded-xl text-white font-semibold text-xs shadow-lg disabled:opacity-50 ${colors[color]}`}>
      <Icon className="w-5 h-5" />{label}
    </button>
  )
}

// ============== EDIT PHONE MODAL ==============
function EditPhoneModal({ lead, onClose, onSave }: { lead: Lead; onClose: () => void; onSave: (phone: string) => void | Promise<void> }) {
  const [phone, setPhone] = useState(lead.phone || '')
  const [saving, setSaving] = useState(false)
  async function handleSave() {
    const trimmed = phone.trim()
    if (!trimmed) return
    setSaving(true)
    try { await onSave(trimmed) } finally { setSaving(false) }
  }
  const previewPhone = formatPhoneForCall(phone)
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-[#1E3A5F]">📞 Telefonnummer ändern</h2><button onClick={onClose} className="text-gray-400"><X className="w-5 h-5" /></button></div>
        <p className="text-sm text-gray-600 mb-4">Für <strong>{cleanLeadName(lead.name, getBeruf(lead))}</strong></p>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Neue Telefonnummer</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+49 151 12345678" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#2E75B6] focus:border-[#2E75B6] focus:outline-none" autoFocus />
          {previewPhone && previewPhone !== phone.trim() && <p className="mt-1.5 text-xs text-gray-500">Anruf läuft auf: <span className="font-mono text-[#2E75B6]">{previewPhone}</span></p>}
          <p className="mt-2 text-xs text-gray-500">💡 Wird automatisch ins +49-Format gebracht, damit Anrufe & WhatsApp zuverlässig funktionieren.</p>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium">Abbrechen</button>
          <button onClick={handleSave} disabled={saving || !phone.trim()} className="flex-1 py-2.5 rounded-lg bg-[#2E75B6] hover:bg-[#246299] text-white font-semibold disabled:opacity-50">{saving ? 'Speichern…' : '✓ Speichern'}</button>
        </div>
      </div>
    </div>
  )
}

// ============== EDIT EMAIL MODAL ==============
function EditEmailModal({ lead, onClose, onSave }: { lead: Lead; onClose: () => void; onSave: (email: string) => void | Promise<void> }) {
  const [email, setEmail] = useState(lead.email || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function handleSave() {
    const trimmed = email.trim()
    if (!trimmed) return
    if (!isValidEmail(trimmed)) { setError('Bitte eine gültige E-Mail-Adresse eingeben (z.B. name@beispiel.de)'); return }
    setError(null); setSaving(true)
    try { await onSave(trimmed) } finally { setSaving(false) }
  }
  const isExisting = !!lead.email
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-[#1E3A5F]">📧 E-Mail-Adresse {isExisting ? 'ändern' : 'hinzufügen'}</h2><button onClick={onClose} className="text-gray-400"><X className="w-5 h-5" /></button></div>
        <p className="text-sm text-gray-600 mb-4">Für <strong>{cleanLeadName(lead.name, getBeruf(lead))}</strong></p>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">E-Mail-Adresse</label>
          <input type="email" value={email} onChange={e => { setEmail(e.target.value); if (error) setError(null) }} placeholder="name@beispiel.de"
            className={"w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:outline-none " + (error ? "border-red-400 focus:ring-2 focus:ring-red-300" : "border-gray-300 focus:ring-2 focus:ring-[#2E75B6] focus:border-[#2E75B6]")} autoFocus autoComplete="email" spellCheck={false} />
          {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
          <p className="mt-2 text-xs text-gray-500">💡 Nach dem Speichern kannst du die Termin-Bestätigung über den E-Mail-Button verschicken.</p>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium">Abbrechen</button>
          <button onClick={handleSave} disabled={saving || !email.trim()} className="flex-1 py-2.5 rounded-lg bg-[#2E75B6] hover:bg-[#246299] text-white font-semibold disabled:opacity-50">{saving ? 'Speichern…' : '✓ Speichern'}</button>
        </div>
      </div>
    </div>
  )
}

// ============== DRAWER ==============
function Drawer({ view, lead, setter, cluster, onClose, supabase, onNotesUpdate }: {
  view: DrawerView; lead: Lead; setter: Profile; cluster: ClusterContent | null; onClose: () => void; supabase: any; onNotesUpdate: (notes: string) => void
}) {
  const [tab, setTab] = useState<Exclude<DrawerView, 'closed'>>(view === 'closed' ? 'script' : view)
  const [jumpToObjection, setJumpToObjection] = useState<string | null>(null)
  function quickJumpObjection(id: string) { setTab('objections'); setJumpToObjection(id) }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={onClose}>
      <div className="bg-white w-full rounded-t-3xl max-h-[90vh] flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} onClick={e => e.stopPropagation()}>
        <div className="border-b border-gray-200 px-2 pt-2 flex items-center gap-1">
          <TabButton active={tab === 'script'} onClick={() => setTab('script')} icon="📖" label="Skript" />
          <TabButton active={tab === 'objections'} onClick={() => setTab('objections')} icon="🛡" label="Einwände" />
          <TabButton active={tab === 'notes'} onClick={() => setTab('notes')} icon="📝" label="Notizen" />
          <button onClick={onClose} className="ml-auto p-2 text-gray-400 hover:text-gray-700" aria-label="Schließen"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {tab === 'script' && <ScriptView lead={lead} setter={setter} cluster={cluster} />}
          {tab === 'objections' && <ObjectionsView lead={lead} setter={setter} cluster={cluster} jumpToId={jumpToObjection} onJumped={() => setJumpToObjection(null)} />}
          {tab === 'notes' && <NotesView lead={lead} setter={setter} supabase={supabase} onNotesUpdate={onNotesUpdate} />}
        </div>
        {tab === 'script' && (
          <div className="border-t border-gray-200 bg-gradient-to-r from-red-50 to-orange-50 px-2 py-2">
            <div className="text-[10px] font-semibold text-gray-600 px-1 mb-1.5 uppercase tracking-wide">🛡 Schnellzugriff Einwände</div>
            <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
              {OBJECTIONS.map(obj => (
                <button key={obj.id} onClick={() => quickJumpObjection(obj.id)} className="shrink-0 px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-red-400 hover:bg-red-50 active:bg-red-100 text-xs font-medium text-gray-700 whitespace-nowrap shadow-sm">{obj.emoji} {obj.title}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button onClick={onClick} className={'flex-1 px-3 py-2.5 rounded-t-lg text-sm font-semibold transition-colors ' + (active ? 'bg-[#1E3A5F] text-white' : 'text-gray-600 hover:bg-gray-100')}>
      <span className="mr-1">{icon}</span>{label}
    </button>
  )
}

function ScriptView({ lead, setter, cluster }: { lead: Lead; setter: Profile; cluster: ClusterContent | null }) {
  const rendered = renderClusterText(SCRIPT_TEXT, lead, setter, cluster)
  const sections = parseScriptSections(rendered)
  return (
    <div className="space-y-5">
      {sections.map((s, i) => (
        <div key={i}>
          {s.title && <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{s.title}</h4>}
          <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{s.body.trim()}</div>
        </div>
      ))}
    </div>
  )
}

function ObjectionsView({ lead, setter, cluster, jumpToId, onJumped }: { lead: Lead; setter: Profile; cluster: ClusterContent | null; jumpToId?: string | null; onJumped?: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const refs = useRef<Record<string, HTMLDivElement | null>>({})
  useEffect(() => {
    if (jumpToId) {
      setOpenId(jumpToId)
      setTimeout(() => { const el = refs.current[jumpToId]; if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); onJumped?.() }, 50)
    }
  }, [jumpToId, onJumped])
  return (
    <div className="grid grid-cols-2 gap-2">
      {OBJECTIONS.map(obj => {
        const isOpen = openId === obj.id
        return (
          <div key={obj.id} ref={(el) => { refs.current[obj.id] = el }} className={isOpen ? 'col-span-2 scroll-mt-2' : ''}>
            <button onClick={() => setOpenId(isOpen ? null : obj.id)} className={`w-full p-3 rounded-lg text-left transition-colors ${isOpen ? 'bg-[#1E3A5F] text-white ring-2 ring-yellow-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}>
              <div className="text-xs font-semibold">{obj.emoji} {obj.title}</div>
            </button>
            {isOpen && <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{renderClusterText(obj.answer, lead, setter, cluster)}</div>}
          </div>
        )
      })}
    </div>
  )
}

function NotesView({ lead, setter, supabase, onNotesUpdate }: { lead: Lead; setter: Profile; supabase: any; onNotesUpdate: (notes: string) => void }) {
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<any>(null)
  function startDictation() {
    const SR: any = (typeof window !== 'undefined') && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    if (!SR) { toast('🎤 Tipp: Tippe das Mikro auf deiner Tastatur an für iOS-Diktat', { duration: 4000 }); return }
    try {
      const r = new SR(); r.lang = 'de-DE'; r.continuous = true; r.interimResults = false
      r.onresult = (e: any) => { let transcript = ''; for (let i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) transcript += e.results[i][0].transcript + ' ' } if (transcript) setNewNote(prev => (prev + ' ' + transcript).trim()) }
      r.onend = () => setListening(false); r.onerror = () => setListening(false)
      r.start(); recognitionRef.current = r; setListening(true)
    } catch { toast.error('Sprach-Erkennung nicht verfügbar') }
  }
  function stopDictation() { recognitionRef.current?.stop(); setListening(false) }
  async function appendNote() {
    if (!newNote.trim()) return
    setSaving(true)
    const timestamp = new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const entry = `[${timestamp} — ${setter.full_name}]\n${newNote.trim()}`
    const updated = lead.notes ? `${lead.notes}\n\n${entry}` : entry
    const { error } = await supabase.from('leads').update({ notes: updated }).eq('id', lead.id)
    if (error) { toast.error('Fehler: ' + error.message) } else { onNotesUpdate(updated); setNewNote(''); toast.success('Notiz gespeichert ✓') }
    setSaving(false)
  }
  return (
    <div className="space-y-3">
      <div className="relative">
        <textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Neue Notiz hier eintippen oder 🎤 diktieren..." rows={4} className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#2E75B6] focus:border-[#2E75B6] focus:outline-none" />
        <button onClick={listening ? stopDictation : startDictation} type="button" className={"absolute top-2 right-2 p-2 rounded-full transition-colors " + (listening ? "bg-red-500 text-white animate-pulse" : "bg-gray-100 hover:bg-gray-200 text-gray-700")} aria-label={listening ? "Diktat stoppen" : "Diktat starten"}>{listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}</button>
      </div>
      {listening && <div className="text-xs text-red-600 font-medium flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>Aufnahme läuft — sprich deutsch</div>}
      <button onClick={appendNote} disabled={saving || !newNote.trim()} className="w-full px-4 py-2.5 rounded-lg bg-[#2E75B6] text-white font-medium disabled:opacity-50">{saving ? 'Speichern...' : '+ Notiz hinzufügen'}</button>
      {lead.notes && (
        <div className="mt-4">
          <div className="text-xs font-semibold text-gray-500 mb-2">VORHERIGE NOTIZEN</div>
          <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto border border-gray-200">{lead.notes}</div>
        </div>
      )}
    </div>
  )
}

// ============== MODALS ==============
function TerminModal({ lead, setter, onClose, onDone }: { lead: Lead; setter: Profile; onClose: () => void; onDone: (date: string, teamsLink: string) => void }) {
  const tomorrow = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(14, 0, 0, 0); return d.toISOString().slice(0, 16) }, [])
  const [datetime, setDatetime] = useState(tomorrow)
  const [teamsLink, setTeamsLink] = useState(setter.teams_room_url || '')
  const [saving, setSaving] = useState(false)
  function save() { if (!datetime) return; setSaving(true); onDone(new Date(datetime).toISOString(), teamsLink) }
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-[#1E3A5F]">🟡 Termin gelegt</h2><button onClick={onClose} className="text-gray-400"><X className="w-5 h-5" /></button></div>
        <p className="text-sm text-gray-600 mb-4">Termin für <strong>{cleanLeadName(lead.name, getBeruf(lead))}</strong></p>
        <div className="space-y-3">
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Datum & Uhrzeit</label><input type="datetime-local" value={datetime} onChange={e => setDatetime(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" /></div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Teams-Link</label><input type="url" value={teamsLink} onChange={e => setTeamsLink(e.target.value)} placeholder="https://teams.microsoft.com/..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />{setter.teams_room_url && <p className="mt-1 text-xs text-gray-500">Auto-eingefügt aus deinem Profil</p>}</div>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium">Abbrechen</button>
          <button onClick={save} disabled={saving || !datetime} className="flex-1 py-2.5 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold disabled:opacity-50">{saving ? 'Speichern...' : '✓ Termin speichern'}</button>
        </div>
      </div>
    </div>
  )
}

function WiedervorlageModal({ onClose, onDone }: { onClose: () => void; onDone: (date: string) => void }) {
  const quickOptions = [
    { label: 'In 2h', hours: 2 }, { label: 'Heute Abend', hours: 0, time: 'evening' as const },
    { label: 'Morgen früh', hours: 0, time: 'tomorrow-morning' as const }, { label: 'Übermorgen', hours: 0, time: 'day-after' as const },
    { label: 'Nächste Woche', hours: 0, time: 'next-week' as const },
  ]
  function compute(opt: typeof quickOptions[0]): string {
    const d = new Date()
    if (opt.hours) d.setHours(d.getHours() + opt.hours)
    else if (opt.time === 'evening') d.setHours(18, 0, 0, 0)
    else if (opt.time === 'tomorrow-morning') { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0) }
    else if (opt.time === 'day-after') { d.setDate(d.getDate() + 2); d.setHours(10, 0, 0, 0) }
    else if (opt.time === 'next-week') { d.setDate(d.getDate() + 7); d.setHours(10, 0, 0, 0) }
    return d.toISOString()
  }
  const tomorrow10 = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); return d.toISOString().slice(0, 16) }, [])
  const [datetime, setDatetime] = useState(tomorrow10)
  const [saving, setSaving] = useState(false)
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-[#1E3A5F]">⏰ Wiedervorlage</h2><button onClick={onClose} className="text-gray-400"><X className="w-5 h-5" /></button></div>
        <p className="text-xs font-medium text-gray-700 mb-2">Schnellauswahl:</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {quickOptions.map(opt => <button key={opt.label} onClick={() => { setSaving(true); onDone(compute(opt)) }} disabled={saving} className="px-3 py-2 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-800 text-sm font-medium disabled:opacity-50">{opt.label}</button>)}
        </div>
        <div className="border-t border-gray-200 pt-4"><label className="block text-xs font-medium text-gray-700 mb-1">Oder eigenes Datum:</label><input type="datetime-local" value={datetime} onChange={e => setDatetime(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" /></div>
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium">Abbrechen</button>
          <button onClick={() => { setSaving(true); onDone(new Date(datetime).toISOString()) }} disabled={saving || !datetime} className="flex-1 py-2.5 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-semibold disabled:opacity-50">{saving ? 'Speichern...' : '✓ Wiedervorlage speichern'}</button>
        </div>
      </div>
    </div>
  )
}

// ============== POST-TERMIN MODAL (Mail + WhatsApp aus Cluster) ==============
function PostTerminModal({ lead, setter, cluster, onContinue, onEditEmail }: { lead: Lead; setter: Profile; cluster: ClusterContent | null; onContinue: () => void; onEditEmail: () => void }) {
  const [mailSent, setMailSent] = useState(false)
  const [waSent, setWaSent] = useState(false)
  const dateObj = lead.appointment_date ? new Date(lead.appointment_date) : null
  const formattedDate = dateObj?.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) || ''
  const formattedTime = dateObj?.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) || ''
  const applicableTpls = applicableWhatsappTemplates(lead)
  const confirmTpl = applicableTpls.find(t => t.id === 'wa_confirmation') || applicableTpls[0]

  function openMail() {
    if (!lead.appointment_date || !lead.email) { toast.error('Termin oder E-Mail fehlt'); return }
    const { subject, body } = renderClusterEmail('email_confirmation', lead, setter, cluster)
    window.location.href = buildMailtoUrl(lead.email, subject, body); setMailSent(true)
  }
  function openWhatsapp() {
    if (!confirmTpl) { toast.error('Kein WhatsApp-Template verfügbar'); return }
    const text = renderClusterWhatsapp(confirmTpl.id, lead, setter, cluster)
    window.open(buildWhatsappUrl(lead.phone, text), '_blank'); setWaSent(true)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-3 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden my-4">
        <div className="bg-gradient-to-br from-green-500 to-green-600 px-5 py-5 text-white text-center">
          <div className="text-4xl mb-1">🎉</div><h2 className="text-lg font-bold">Termin gespeichert!</h2><p className="text-sm text-white/90 mt-0.5">{cleanLeadName(lead.name, getBeruf(lead))}</p>
        </div>
        <div className="px-5 pt-4">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-3 text-sm"><span className="text-base">📅</span><span className="text-gray-800 font-medium">{formattedDate}</span></div>
            <div className="flex items-center gap-3 text-sm"><span className="text-base">⏰</span><span className="text-gray-800 font-medium">{formattedTime} Uhr · 60 Min</span></div>
            <div className="flex items-center gap-3 text-sm"><span className="text-base">💻</span><span className="text-gray-800 font-medium">Microsoft Teams</span></div>
          </div>
        </div>
        <div className="px-5 pt-5"><CloserNotify lead={lead} setterName={setter.full_name} teamsLink={setter.teams_room_url} /></div>
        <div className="px-5 pt-5 pb-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">📬 Bestätigung jetzt senden</h3>
          <div className="space-y-2">
            {lead.email ? (
              <button onClick={openMail} className={"w-full text-left p-3.5 rounded-xl border-2 transition-all " + (mailSent ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-[#2E75B6] hover:bg-blue-50 active:scale-[0.98]')}>
                <div className="flex items-center gap-3">
                  <div className={"w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 " + (mailSent ? 'bg-green-500 text-white' : 'bg-[#2E75B6] text-white')}>{mailSent ? '✓' : '📧'}</div>
                  <div className="flex-1 min-w-0"><div className="font-semibold text-sm text-gray-900">{mailSent ? 'E-Mail gesendet' : 'E-Mail-Bestätigung'}</div><div className="text-xs text-gray-500 truncate">{lead.email}</div></div>
                  {!mailSent && <span className="text-gray-400 shrink-0">›</span>}
                </div>
              </button>
            ) : (
              <button onClick={onEditEmail} className="w-full text-left p-3.5 rounded-xl border-2 border-dashed border-blue-300 hover:border-[#2E75B6] hover:bg-blue-50 active:scale-[0.98] transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0 bg-blue-100 text-[#2E75B6]">+</div>
                  <div className="flex-1 min-w-0"><div className="font-semibold text-sm text-gray-900">E-Mail-Adresse hinzufügen</div><div className="text-xs text-gray-500">Um die Bestätigung zu verschicken</div></div>
                  <span className="text-gray-400 shrink-0">›</span>
                </div>
              </button>
            )}
            <button onClick={openWhatsapp} disabled={!confirmTpl} className={"w-full text-left p-3.5 rounded-xl border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed " + (waSent ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-green-500 hover:bg-green-50 active:scale-[0.98]')}>
              <div className="flex items-center gap-3">
                <div className={"w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 " + (waSent ? 'bg-green-500 text-white' : 'bg-green-500 text-white')}>{waSent ? '✓' : '💬'}</div>
                <div className="flex-1 min-w-0"><div className="font-semibold text-sm text-gray-900">{waSent ? 'WhatsApp gesendet' : 'WhatsApp-Bestätigung'}</div><div className="text-xs text-gray-500 truncate">{formatPhoneForCall(lead.phone) || 'Keine Telefonnummer'}</div></div>
                {!waSent && confirmTpl && <span className="text-gray-400 shrink-0">›</span>}
              </div>
            </button>
          </div>
          {(mailSent && waSent) && <p className="mt-2 text-xs text-green-700 text-center font-medium">✓ Beide Bestätigungen verschickt</p>}
        </div>
        <div className="px-5 pb-5 border-t border-gray-100 pt-4">
          <button onClick={onContinue} className="w-full py-3 rounded-xl bg-[#1E3A5F] hover:bg-[#162940] text-white font-semibold active:scale-[0.98] transition-all">→ Zum nächsten Lead</button>
        </div>
      </div>
    </div>
  )
}
