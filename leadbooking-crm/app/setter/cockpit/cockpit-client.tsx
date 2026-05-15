'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Lead, Profile } from '@/types'
import { X, Phone, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, BookOpen, MessageCircle, FileText } from 'lucide-react'
import { SCRIPT_SECTIONS, OBJECTIONS, renderTemplate } from '@/lib/script-template'
import { renderEmail, renderWhatsapp, applicableWhatsappTemplates, buildWhatsappUrl, buildMailtoUrl } from '@/lib/message-templates'
import toast from 'react-hot-toast'

interface Props {
  initialDeck: Lead[]
  setter: Profile
}

type DrawerView = 'closed' | 'script' | 'objections' | 'notes'
type ActionType = 'termin' | 'wiedervorlage' | 'kein_interesse' | 'termin_done' | null

export function CockpitClient({ initialDeck, setter }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [deck, setDeck] = useState<Lead[]>(initialDeck)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [drawer, setDrawer] = useState<DrawerView>('closed')
  const [actionModal, setActionModal] = useState<ActionType>(null)
  const [savingAction, setSavingAction] = useState(false)
  const [todayDone, setTodayDone] = useState(0)

  // Swipe state
  const cardRef = useRef<HTMLDivElement>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const startPos = useRef({ x: 0, y: 0 })

  const currentLead = deck[currentIdx]

  // Lade heutige erledigte (für Daily-Goal)
  useEffect(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    supabase
      .from('activity_log')
      .select('id', { count: 'exact', head: true })
      .eq('setter_id', setter.id)
      .gte('created_at', today.toISOString())
      .then(({ count }) => setTodayDone(count || 0))
  }, [setter.id, supabase])

  function advanceCard() {
    setDragOffset({ x: 0, y: 0 })
    setDragging(false)
    setDrawer('closed')
    if (currentIdx + 1 >= deck.length) {
      toast.success('🎉 Alle Leads abgearbeitet!')
      router.push('/setter')
    } else {
      setCurrentIdx(i => i + 1)
    }
  }

  async function logActivity(leadId: string, newStatus: string, note?: string) {
    await supabase.from('activity_log').insert({
      lead_id: leadId,
      setter_id: setter.id,
      old_status: currentLead?.status || '',
      new_status: newStatus,
      note: note || null,
    })
  }

  // Action handlers (called from swipe or buttons)
  async function handleSwipeUp() {
    // Termin gelegt → Modal
    setActionModal('termin')
  }

  async function handleSwipeDown() {
    // Wiedervorlage → Modal
    setActionModal('wiedervorlage')
  }

  async function handleSwipeRight() {
    // Nicht erreicht → auto +2h Wiedervorlage
    if (!currentLead || savingAction) return
    setSavingAction(true)
    const recall = new Date(Date.now() + 2 * 60 * 60 * 1000)
    const { error } = await supabase
      .from('leads')
      .update({
        status: 'nicht_erreicht',
        recall_date: recall.toISOString(),
        call_attempts: (currentLead.call_attempts || 0) + 1,
        last_call_attempt: new Date().toISOString(),
      })
      .eq('id', currentLead.id)
    if (error) {
      toast.error('Fehler: ' + error.message)
    } else {
      await logActivity(currentLead.id, 'nicht_erreicht', 'Nicht erreicht — Wiedervorlage in 2h')
      toast.success('🔁 Wiedervorlage in 2h')
      advanceCard()
    }
    setSavingAction(false)
  }

  async function handleSwipeLeft() {
    // Kein Interesse → direkt speichern (kein Modal für jetzt)
    if (!currentLead || savingAction) return
    setSavingAction(true)
    const { error } = await supabase
      .from('leads')
      .update({ status: 'kein_interesse' })
      .eq('id', currentLead.id)
    if (error) {
      toast.error('Fehler: ' + error.message)
    } else {
      await logActivity(currentLead.id, 'kein_interesse')
      toast.success('🚫 Kein Interesse')
      advanceCard()
    }
    setSavingAction(false)
  }

  // Touch / mouse handlers
  function onPointerDown(e: React.PointerEvent) {
    if (savingAction || actionModal) return
    startPos.current = { x: e.clientX, y: e.clientY }
    setDragging(true)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return
    setDragOffset({
      x: e.clientX - startPos.current.x,
      y: e.clientY - startPos.current.y,
    })
  }

  function onPointerUp() {
    if (!dragging) return
    const { x, y } = dragOffset
    const threshold = 110
    const absX = Math.abs(x)
    const absY = Math.abs(y)

    // Dominanteste Richtung wählen
    if (absX > threshold && absX > absY) {
      if (x > 0) handleSwipeRight()
      else handleSwipeLeft()
    } else if (absY > threshold && absY > absX) {
      if (y < 0) handleSwipeUp()
      else handleSwipeDown()
    } else {
      // Zurück zur Mitte
      setDragOffset({ x: 0, y: 0 })
    }
    setDragging(false)
  }

  // Empty deck
  if (!currentLead) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-[#1E3A5F] to-[#2E75B6]">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-white mb-2">Alle Leads abgearbeitet!</h1>
        <p className="text-white/80 mb-6">Top Leistung. Komm später wieder, wenn neue Leads da sind.</p>
        <button
          onClick={() => router.push('/setter')}
          className="px-6 py-3 rounded-xl bg-white text-[#1E3A5F] font-semibold"
        >
          ← Zurück zum Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E3A5F] to-[#2E75B6]" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white">
        <button
          onClick={() => router.push('/setter')}
          className="p-2 -ml-2 rounded-lg active:bg-white/10"
          aria-label="Cockpit schließen"
        >
          <X className="w-6 h-6" />
        </button>
        <div className="text-center">
          <div className="text-xs text-white/70">Lead</div>
          <div className="text-sm font-bold">{currentIdx + 1} / {deck.length}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/70">Heute</div>
          <div className="text-sm font-bold">{todayDone} ✓</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/20 mx-4 rounded-full overflow-hidden">
        <div
          className="h-full bg-yellow-400 transition-all"
          style={{ width: `${((currentIdx + 1) / deck.length) * 100}%` }}
        />
      </div>

      {/* Lead-Karte mit Swipe */}
      <div className="p-4 pt-6">
        <div
          ref={cardRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(${dragOffset.x * 0.05}deg)`,
            transition: dragging ? 'none' : 'transform 0.3s ease',
            touchAction: 'none',
          }}
          className="bg-white rounded-2xl shadow-2xl p-6 cursor-grab active:cursor-grabbing select-none"
        >
          <SwipeHints offset={dragOffset} />

          <div className="text-center">
            <h1 className="text-2xl font-bold text-[#1E3A5F]">{currentLead.name}</h1>
            <div className="mt-2 text-sm text-gray-600">
              <div className="flex items-center justify-center gap-2">
                <span>📍 {currentLead.state || '—'}</span>
                <span className="text-gray-300">·</span>
                <span>Hebamme</span>
              </div>
              {currentLead.email && (
                <div className="mt-1.5 text-xs text-gray-500 truncate flex items-center justify-center gap-1">
                  <span>📧</span>
                  <span>{currentLead.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Big Phone Button */}
          <a
            href={`tel:${currentLead.phone}`}
            onClick={() => {
              // Call attempts hochzählen (fire-and-forget)
              supabase
                .from('leads')
                .update({
                  call_attempts: (currentLead.call_attempts || 0) + 1,
                  last_call_attempt: new Date().toISOString(),
                })
                .eq('id', currentLead.id)
                .then(() => {})
            }}
            className="mt-6 flex items-center justify-center gap-3 w-full py-4 rounded-xl bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold text-lg shadow-lg"
          >
            <Phone className="w-6 h-6" />
            {currentLead.phone}
          </a>

          {/* Notes preview */}
          {currentLead.notes && (
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-xs text-gray-700 max-h-20 overflow-y-auto whitespace-pre-wrap">
              {currentLead.notes}
            </div>
          )}

          {/* Drawer triggers */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <DrawerButton icon={BookOpen} label="Skript" onClick={() => setDrawer('script')} />
            <DrawerButton icon={MessageCircle} label="Einwände" onClick={() => setDrawer('objections')} />
            <DrawerButton icon={FileText} label="Notizen" onClick={() => setDrawer('notes')} />
          </div>
        </div>
      </div>

      {/* Action Buttons (für die die nicht swipen wollen) */}
      <div className="px-4 mt-2 grid grid-cols-4 gap-2">
        <ActionButton color="red" icon={ChevronLeft} label="Kein Int." onClick={handleSwipeLeft} disabled={savingAction} />
        <ActionButton color="purple" icon={ChevronDown} label="Wiederv." onClick={handleSwipeDown} disabled={savingAction} />
        <ActionButton color="orange" icon={ChevronRight} label="Nicht err." onClick={handleSwipeRight} disabled={savingAction} />
        <ActionButton color="green" icon={ChevronUp} label="Termin" onClick={handleSwipeUp} disabled={savingAction} />
      </div>

      <div className="mt-3 text-center text-xs text-white/60 px-4 pb-4">
        💡 Tipp: Karte ziehen ←/↑/→/↓ — oder Buttons benutzen
      </div>

      {/* Drawer */}
      {drawer !== 'closed' && (
        <Drawer
          view={drawer}
          lead={currentLead}
          setter={setter}
          onClose={() => setDrawer('closed')}
          supabase={supabase}
          onNotesUpdate={(notes) => {
            // Update lokal
            setDeck(d => d.map((l, i) => i === currentIdx ? { ...l, notes } : l))
          }}
        />
      )}

      {/* Termin Modal */}
      {actionModal === 'termin' && (
        <TerminModal
          lead={currentLead}
          setter={setter}
          onClose={() => setActionModal(null)}
          onDone={async (date, teamsLink) => {
            const { error } = await supabase
              .from('leads')
              .update({
                status: 'termin_gelegt',
                appointment_date: date,
                teams_link: teamsLink || null,
              })
              .eq('id', currentLead.id)
            if (error) { toast.error('Fehler: ' + error.message); return }
            await logActivity(currentLead.id, 'termin_gelegt', `Termin am ${new Date(date).toLocaleString('de-DE')}`)
            toast.success('🟡 Termin gelegt!')
            // Aktualisiere Lead lokal mit appointment_date + teams_link
            setDeck(d => d.map((l, i) => i === currentIdx ? {
              ...l,
              status: 'termin_gelegt' as const,
              appointment_date: date,
              teams_link: teamsLink || null,
            } : l))
            // Wechsle zu Post-Termin-Modal (Mail + WhatsApp anbieten)
            setActionModal('termin_done')
          }}
        />
      )}

      {/* Post-Termin Modal: Mail + WhatsApp + Weiter */}
      {actionModal === 'termin_done' && (
        <PostTerminModal
          lead={currentLead}
          setter={setter}
          onContinue={() => {
            setActionModal(null)
            advanceCard()
          }}
        />
      )}

      {/* Wiedervorlage Modal */}
      {actionModal === 'wiedervorlage' && (
        <WiedervorlageModal
          onClose={() => setActionModal(null)}
          onDone={async (date) => {
            const { error } = await supabase
              .from('leads')
              .update({
                status: 'wiedervorlage',
                recall_date: date,
                call_attempts: (currentLead.call_attempts || 0) + 1,
                last_call_attempt: new Date().toISOString(),
              })
              .eq('id', currentLead.id)
            if (error) { toast.error('Fehler: ' + error.message); return }
            await logActivity(currentLead.id, 'wiedervorlage', `Wiedervorlage am ${new Date(date).toLocaleString('de-DE')}`)
            toast.success('⏰ Wiedervorlage gespeichert')
            setActionModal(null)
            advanceCard()
          }}
        />
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
      {x > 30 && (
        <div className="absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-orange-500 text-white font-bold text-sm rotate-[-12deg]" style={{ opacity: opacity(x) }}>
          🔁 NICHT ERREICHT
        </div>
      )}
      {x < -30 && (
        <div className="absolute top-4 right-4 px-3 py-1.5 rounded-lg bg-red-500 text-white font-bold text-sm rotate-[12deg]" style={{ opacity: opacity(x) }}>
          🚫 KEIN INTERESSE
        </div>
      )}
      {y < -30 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-green-500 text-white font-bold text-sm" style={{ opacity: opacity(y) }}>
          🟡 TERMIN ↑
        </div>
      )}
      {y > 30 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-purple-500 text-white font-bold text-sm" style={{ opacity: opacity(y) }}>
          ⏰ WIEDERVORLAGE ↓
        </div>
      )}
    </>
  )
}

function DrawerButton({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 text-xs font-medium"
    >
      <Icon className="w-4 h-4" />
      {label}
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
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-0.5 py-3 rounded-xl text-white font-semibold text-xs shadow-lg disabled:opacity-50 ${colors[color]}`}
    >
      <Icon className="w-5 h-5" />
      {label}
    </button>
  )
}

// ============== DRAWER ==============

function Drawer({ view, lead, setter, onClose, supabase, onNotesUpdate }: {
  view: DrawerView
  lead: Lead
  setter: Profile
  onClose: () => void
  supabase: any
  onNotesUpdate: (notes: string) => void
}) {
  // Active tab innerhalb des Drawers (initial = view aus Parent)
  const [tab, setTab] = useState<Exclude<DrawerView, 'closed'>>(view === 'closed' ? 'script' : view)
  // Wenn Einwand aus Skript-Quickbar getappt wird, springen wir mit highlight
  const [jumpToObjection, setJumpToObjection] = useState<string | null>(null)

  function quickJumpObjection(id: string) {
    setTab('objections')
    setJumpToObjection(id)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={onClose}>
      <div
        className="bg-white w-full rounded-t-3xl max-h-[90vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header mit Tabs + Close */}
        <div className="border-b border-gray-200 px-2 pt-2 flex items-center gap-1">
          <TabButton active={tab === 'script'} onClick={() => setTab('script')} icon="📖" label="Skript" />
          <TabButton active={tab === 'objections'} onClick={() => setTab('objections')} icon="🛡" label="Einwände" />
          <TabButton active={tab === 'notes'} onClick={() => setTab('notes')} icon="📝" label="Notizen" />
          <button
            onClick={onClose}
            className="ml-auto p-2 text-gray-400 hover:text-gray-700"
            aria-label="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollbarer Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {tab === 'script' && <ScriptView lead={lead} setter={setter} />}
          {tab === 'objections' && <ObjectionsView lead={lead} setter={setter} jumpToId={jumpToObjection} onJumped={() => setJumpToObjection(null)} />}
          {tab === 'notes' && <NotesView lead={lead} setter={setter} supabase={supabase} onNotesUpdate={onNotesUpdate} />}
        </div>

        {/* Sticky Einwand-Quickbar — NUR auf Skript-Tab */}
        {tab === 'script' && (
          <div className="border-t border-gray-200 bg-gradient-to-r from-red-50 to-orange-50 px-2 py-2">
            <div className="text-[10px] font-semibold text-gray-600 px-1 mb-1.5 uppercase tracking-wide">
              🛡 Schnellzugriff Einwände
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
              {OBJECTIONS.map(obj => (
                <button
                  key={obj.id}
                  onClick={() => quickJumpObjection(obj.id)}
                  className="shrink-0 px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-red-400 hover:bg-red-50 active:bg-red-100 text-xs font-medium text-gray-700 whitespace-nowrap shadow-sm"
                >
                  {obj.emoji} {obj.title}
                </button>
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
    <button
      onClick={onClick}
      className={
        'flex-1 px-3 py-2.5 rounded-t-lg text-sm font-semibold transition-colors ' +
        (active
          ? 'bg-[#1E3A5F] text-white'
          : 'text-gray-600 hover:bg-gray-100')
      }
    >
      <span className="mr-1">{icon}</span>
      {label}
    </button>
  )
}

function ScriptView({ lead, setter }: { lead: Lead; setter: Profile }) {
  // Alle Sections per Default OFFEN. closedIds-Set speichert zugeklappte.
  const [closedIds, setClosedIds] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setClosedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-500">Alle Sektionen ausgeklappt. Tippe zum Zuklappen.</p>
        <button
          onClick={() => setClosedIds(closedIds.size === 0 ? new Set(SCRIPT_SECTIONS.map(s => s.id)) : new Set())}
          className="text-xs text-[#2E75B6] font-medium hover:underline"
        >
          {closedIds.size === 0 ? 'Alle zu' : 'Alle auf'}
        </button>
      </div>
      {SCRIPT_SECTIONS.map(section => {
        const isOpen = !closedIds.has(section.id)
        return (
          <div key={section.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggle(section.id)}
              className="w-full px-3 py-2.5 flex items-center justify-between bg-gray-50 hover:bg-gray-100 text-left"
            >
              <span className="font-semibold text-sm text-[#1E3A5F]">
                {section.emoji} {section.title}
              </span>
              {isOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </button>
            {isOpen && (
              <div className="px-3 py-3 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed bg-white">
                {renderTemplate(section.content, lead, setter)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ObjectionsView({ lead, setter, jumpToId, onJumped }: {
  lead: Lead
  setter: Profile
  jumpToId?: string | null
  onJumped?: () => void
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const refs = useRef<Record<string, HTMLDivElement | null>>({})

  // Wenn von außen ein Einwand gefordert wird (Quickbar im Skript), öffne ihn + scrolle hin
  useEffect(() => {
    if (jumpToId) {
      setOpenId(jumpToId)
      // Kurz warten bis DOM gerendert, dann scrollen
      setTimeout(() => {
        const el = refs.current[jumpToId]
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        onJumped?.()
      }, 50)
    }
  }, [jumpToId, onJumped])

  return (
    <div className="grid grid-cols-2 gap-2">
      {OBJECTIONS.map(obj => {
        const isOpen = openId === obj.id
        return (
          <div
            key={obj.id}
            ref={(el) => { refs.current[obj.id] = el }}
            className={isOpen ? 'col-span-2 scroll-mt-2' : ''}
          >
            <button
              onClick={() => setOpenId(isOpen ? null : obj.id)}
              className={`w-full p-3 rounded-lg text-left transition-colors ${
                isOpen ? 'bg-[#1E3A5F] text-white ring-2 ring-yellow-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
              }`}
            >
              <div className="text-xs font-semibold">{obj.emoji} {obj.title}</div>
            </button>
            {isOpen && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {renderTemplate(obj.answer, lead, setter)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function NotesView({ lead, setter, supabase, onNotesUpdate }: { lead: Lead; setter: Profile; supabase: any; onNotesUpdate: (notes: string) => void }) {
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function appendNote() {
    if (!newNote.trim()) return
    setSaving(true)
    const timestamp = new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const entry = `[${timestamp} — ${setter.full_name}]\n${newNote.trim()}`
    const updated = lead.notes ? `${lead.notes}\n\n${entry}` : entry
    const { error } = await supabase.from('leads').update({ notes: updated }).eq('id', lead.id)
    if (error) {
      toast.error('Fehler: ' + error.message)
    } else {
      onNotesUpdate(updated)
      setNewNote('')
      toast.success('Notiz gespeichert ✓')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-3">
      <textarea
        value={newNote}
        onChange={e => setNewNote(e.target.value)}
        placeholder="Neue Notiz hier eintippen..."
        rows={4}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#2E75B6] focus:border-[#2E75B6] focus:outline-none"
      />
      <button
        onClick={appendNote}
        disabled={saving || !newNote.trim()}
        className="w-full px-4 py-2.5 rounded-lg bg-[#2E75B6] text-white font-medium disabled:opacity-50"
      >
        {saving ? 'Speichern...' : '+ Notiz hinzufügen'}
      </button>

      {lead.notes && (
        <div className="mt-4">
          <div className="text-xs font-semibold text-gray-500 mb-2">VORHERIGE NOTIZEN</div>
          <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto border border-gray-200">
            {lead.notes}
          </div>
        </div>
      )}
    </div>
  )
}

// ============== MODALS ==============

function TerminModal({ lead, setter, onClose, onDone }: {
  lead: Lead
  setter: Profile
  onClose: () => void
  onDone: (date: string, teamsLink: string) => void
}) {
  const tomorrow = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(14, 0, 0, 0)
    return d.toISOString().slice(0, 16)
  }, [])
  const [datetime, setDatetime] = useState(tomorrow)
  const [teamsLink, setTeamsLink] = useState(setter.teams_room_url || '')
  const [saving, setSaving] = useState(false)

  function save() {
    if (!datetime) return
    setSaving(true)
    onDone(new Date(datetime).toISOString(), teamsLink)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#1E3A5F]">🟡 Termin gelegt</h2>
          <button onClick={onClose} className="text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Termin für <strong>{lead.name}</strong>
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Datum & Uhrzeit</label>
            <input
              type="datetime-local"
              value={datetime}
              onChange={e => setDatetime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Teams-Link</label>
            <input
              type="url"
              value={teamsLink}
              onChange={e => setTeamsLink(e.target.value)}
              placeholder="https://teams.microsoft.com/..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
            />
            {setter.teams_room_url && <p className="mt-1 text-xs text-gray-500">Auto-eingefügt aus deinem Profil</p>}
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium">Abbrechen</button>
          <button
            onClick={save}
            disabled={saving || !datetime}
            className="flex-1 py-2.5 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold disabled:opacity-50"
          >
            {saving ? 'Speichern...' : '✓ Termin speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

function WiedervorlageModal({ onClose, onDone }: { onClose: () => void; onDone: (date: string) => void }) {
  // Quick-Options
  const quickOptions = [
    { label: 'In 2h', hours: 2 },
    { label: 'Heute Abend', hours: 0, time: 'evening' as const },
    { label: 'Morgen früh', hours: 0, time: 'tomorrow-morning' as const },
    { label: 'Übermorgen', hours: 0, time: 'day-after' as const },
    { label: 'Nächste Woche', hours: 0, time: 'next-week' as const },
  ]

  function compute(opt: typeof quickOptions[0]): string {
    const d = new Date()
    if (opt.hours) {
      d.setHours(d.getHours() + opt.hours)
    } else if (opt.time === 'evening') {
      d.setHours(18, 0, 0, 0)
    } else if (opt.time === 'tomorrow-morning') {
      d.setDate(d.getDate() + 1)
      d.setHours(9, 0, 0, 0)
    } else if (opt.time === 'day-after') {
      d.setDate(d.getDate() + 2)
      d.setHours(10, 0, 0, 0)
    } else if (opt.time === 'next-week') {
      d.setDate(d.getDate() + 7)
      d.setHours(10, 0, 0, 0)
    }
    return d.toISOString()
  }

  const tomorrow10 = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(10, 0, 0, 0)
    return d.toISOString().slice(0, 16)
  }, [])
  const [datetime, setDatetime] = useState(tomorrow10)
  const [saving, setSaving] = useState(false)

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#1E3A5F]">⏰ Wiedervorlage</h2>
          <button onClick={onClose} className="text-gray-400"><X className="w-5 h-5" /></button>
        </div>

        <p className="text-xs font-medium text-gray-700 mb-2">Schnellauswahl:</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {quickOptions.map(opt => (
            <button
              key={opt.label}
              onClick={() => { setSaving(true); onDone(compute(opt)) }}
              disabled={saving}
              className="px-3 py-2 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-800 text-sm font-medium disabled:opacity-50"
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="border-t border-gray-200 pt-4">
          <label className="block text-xs font-medium text-gray-700 mb-1">Oder eigenes Datum:</label>
          <input
            type="datetime-local"
            value={datetime}
            onChange={e => setDatetime(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
          />
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium">Abbrechen</button>
          <button
            onClick={() => { setSaving(true); onDone(new Date(datetime).toISOString()) }}
            disabled={saving || !datetime}
            className="flex-1 py-2.5 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-semibold disabled:opacity-50"
          >
            {saving ? 'Speichern...' : '✓ Wiedervorlage speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============== POST-TERMIN MODAL (Mail + WhatsApp) ==============

function PostTerminModal({ lead, setter, onContinue }: {
  lead: Lead
  setter: Profile
  onContinue: () => void
}) {
  // Mail rendern (nutzt custom_templates aus Setter-Profil falls vorhanden)
  function openMail() {
    if (!lead.appointment_date || !lead.email) {
      toast.error('Termin oder E-Mail fehlt')
      return
    }
    const { subject, body } = renderEmail(lead, setter)
    window.location.href = buildMailtoUrl(lead.email, subject, body)
  }

  // WhatsApp-Bestätigung rendern (custom oder default)
  const applicableTpls = applicableWhatsappTemplates(lead)
  const confirmTpl = applicableTpls.find(t => t.id === 'wa_confirmation') || applicableTpls[0]

  function openWhatsapp() {
    if (!confirmTpl) return
    const text = renderWhatsapp(confirmTpl.id, lead, setter)
    window.open(buildWhatsappUrl(lead.phone, text), '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl">
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">🟡</div>
          <h2 className="text-lg font-bold text-[#1E3A5F]">Termin gespeichert!</h2>
          <p className="text-sm text-gray-600 mt-1">
            Jetzt noch die Bestätigung an <strong>{lead.name}</strong> raus:
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={openMail}
            disabled={!lead.email}
            className="w-full py-3 rounded-xl bg-[#2E75B6] hover:bg-[#1E3A5F] text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            📧 Bestätigung per E-Mail senden
          </button>
          {!lead.email && <p className="text-xs text-red-600 text-center">Lead hat keine E-Mail-Adresse</p>}

          <button
            onClick={openWhatsapp}
            disabled={!confirmTemplate}
            className="w-full py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            💬 Bestätigung per WhatsApp senden
          </button>
        </div>

        <button
          onClick={onContinue}
          className="w-full mt-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
        >
          → Zum nächsten Lead
        </button>

        <p className="text-xs text-gray-500 text-center mt-3">
          💡 Tipp: Beide senden — Hebamme bekommt's auf beiden Kanälen.
        </p>
      </div>
    </div>
  )
}
