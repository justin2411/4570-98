'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Lead, LeadStatus, STATUS_CONFIG } from '@/types'
import { StatusBadge } from '@/components/leads/status-badge'
import { ExcelUpload } from './excel-upload'
import { AssignModal } from './assign-modal'
import { FixStatesModal } from './fix-states-modal'
import { Button } from '@/components/ui/button'
import { Upload, Search, X, Wand2, RefreshCw, Archive, ArchiveRestore } from 'lucide-react'

interface Setter { id: string; full_name: string; avatar_color: string }
interface Props { initialLeads: Lead[]; setters: Setter[]; adminId: string }

const VALID_STATUSES = new Set<LeadStatus>([
  'neu', 'angerufen', 'nicht_erreicht', 'wiedervorlage',
  'termin_gelegt', 'termin_stattgefunden', 'kein_interesse',
])

// Defensiv: archived-Feld lesen, auch wenn der Lead-Type es (noch) nicht kennt
function isArchived(l: Lead): boolean {
  return (l as any).archived === true
}

function matchesSearch(lead: Lead, q: string): boolean {
  const qt = q.trim().toLowerCase()
  if (!qt) return true
  if (lead.name?.toLowerCase().includes(qt)) return true
  if (lead.email?.toLowerCase().includes(qt)) return true
  const phoneDigits = (lead.phone ?? '').replace(/\D/g, '')
  const qDigits = qt.replace(/\D/g, '')
  if (qDigits && phoneDigits.includes(qDigits)) return true
  return false
}

export function AdminLeadsClient({ initialLeads, setters, adminId }: Props) {
  const supabase = createClient()
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [showUpload, setShowUpload] = useState(false)
  const [showFixStates, setShowFixStates] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [assignTarget, setAssignTarget] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<string>('unassigned')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'alle'>('alle')
  const [search, setSearch] = useState('')
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  // NEU: Aktiv- vs. Archiv-Ansicht
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active')
  const [busy, setBusy] = useState(false)

  // Realtime: Lead-Änderungen sofort übernehmen, damit Filter aktuelle Status zeigt
  useEffect(() => {
    const ch = supabase.channel('admin-leads-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, (payload) => {
        const updated = payload.new as Lead
        setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))
        setLastUpdate(new Date())
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, (payload) => {
        const newLead = payload.new as Lead
        setLeads(prev => [newLead, ...prev])
        setLastUpdate(new Date())
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'leads' }, (payload) => {
        const oldLead = payload.old as Partial<Lead>
        if (oldLead.id) {
          setLeads(prev => prev.filter(l => l.id !== oldLead.id))
          setLastUpdate(new Date())
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Anzahl insgesamt für die Umschalter-Badges
  const activeCount = leads.filter(l => !isArchived(l)).length
  const archivedCount = leads.filter(l => isArchived(l)).length

  // Erst nach Aktiv/Archiv filtern, dann läuft alles andere darauf
  const scopedLeads = leads.filter(l => viewMode === 'archived' ? isArchived(l) : !isArchived(l))

  const unassigned = scopedLeads.filter(l => !l.assigned_to)
  const adminLeads = scopedLeads.filter(l => l.assigned_to === adminId)
  const tabs = [
    { id: 'unassigned', label: 'Nicht zugeteilt', count: unassigned.length },
    { id: adminId, label: 'Admin (meine)', count: adminLeads.length },
    ...setters.map(s => ({ id: s.id, label: s.full_name, count: scopedLeads.filter(l => l.assigned_to === s.id).length })),
  ]

  const tabLeads = activeTab === 'unassigned' ? unassigned : scopedLeads.filter(l => l.assigned_to === activeTab)
  const searched = useMemo(() => tabLeads.filter(l => matchesSearch(l, search)), [tabLeads, search])

  const filtered = useMemo(() => {
    if (statusFilter === 'alle') return searched
    if (!VALID_STATUSES.has(statusFilter)) {
      console.warn('[AdminLeadsClient] Unbekannter statusFilter:', statusFilter)
      return searched
    }
    return searched.filter(l => l.status === statusFilter)
  }, [searched, statusFilter])

  function selectAllInFiltered() { setSelected(new Set(filtered.map(l => l.id))) }
  function toggleSelect(id: string) {
    setSelected(prev => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s })
  }

  async function refreshLeads() {
    const { data } = await supabase
      .from('leads')
      .select('*, profiles!leads_assigned_to_fkey(full_name, avatar_color)')
      .order('created_at', { ascending: false })
    if (data) {
      setLeads(data as never as Lead[])
      setLastUpdate(new Date())
    }
  }

  // ─── Archivieren / Reaktivieren ──────────────────────────────
  async function setArchived(ids: string[], archived: boolean) {
    if (ids.length === 0 || busy) return
    const verb = archived ? 'archivieren' : 'reaktivieren'
    if (ids.length > 1) {
      const ok = window.confirm(`${ids.length} Leads ${verb}?`)
      if (!ok) return
    }
    setBusy(true)
    const { error } = await supabase
      .from('leads')
      .update({ archived } as any)
      .in('id', ids)
    setBusy(false)
    if (error) {
      window.alert('Fehler beim ' + verb + ': ' + error.message)
      return
    }
    setLeads(prev => prev.map(l => ids.includes(l.id) ? ({ ...l, archived } as any) : l))
    setSelected(new Set())
  }

  const selectedArr = Array.from(selected)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">Leads verwalten</h1>
          <p className="text-gray-700 text-sm mt-1">
            {activeCount} aktiv · {archivedCount} archiviert
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button onClick={refreshLeads} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-xs text-gray-700 hover:bg-gray-50">
            <RefreshCw className="w-3.5 h-3.5" />
            {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </button>
          <button onClick={selectAllInFiltered} className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 hover:bg-gray-50">Alle sichtbaren ({filtered.length})</button>

          {/* Bulk-Aktionen je nach Modus */}
          {selected.size > 0 && viewMode === 'active' && (
            <>
              <Button variant="secondary" onClick={() => setAssignTarget(selectedArr)}>
                {selected.size} zuweisen
              </Button>
              <button
                onClick={() => setArchived(selectedArr, true)}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-800 text-sm font-semibold disabled:opacity-50"
              >
                <Archive className="w-4 h-4" />
                {selected.size} archivieren
              </button>
            </>
          )}
          {selected.size > 0 && viewMode === 'archived' && (
            <button
              onClick={() => setArchived(selectedArr, false)}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-100 hover:bg-green-200 text-green-800 text-sm font-semibold disabled:opacity-50"
            >
              <ArchiveRestore className="w-4 h-4" />
              {selected.size} reaktivieren
            </button>
          )}

          <Button variant="secondary" onClick={() => setShowFixStates(true)}>
            <Wand2 className="w-4 h-4" />Bundesländer reparieren
          </Button>
          <Button onClick={() => setShowUpload(true)}><Upload className="w-4 h-4" />Excel hochladen</Button>
        </div>
      </div>

      {/* Aktiv / Archiv Umschalter */}
      <div className="flex gap-2">
        <button
          onClick={() => { setViewMode('active'); setActiveTab('unassigned'); setSelected(new Set()); setStatusFilter('alle') }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${viewMode === 'active' ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
        >
          Aktive Leads
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${viewMode === 'active' ? 'bg-white/20' : 'bg-gray-100 text-gray-700'}`}>{activeCount}</span>
        </button>
        <button
          onClick={() => { setViewMode('archived'); setActiveTab('unassigned'); setSelected(new Set()); setStatusFilter('alle') }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${viewMode === 'archived' ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
        >
          <Archive className="w-4 h-4" />
          Archiv
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${viewMode === 'archived' ? 'bg-white/20' : 'bg-gray-100 text-gray-700'}`}>{archivedCount}</span>
        </button>
      </div>

      {viewMode === 'archived' && (
        <div className="px-4 py-3 rounded-xl bg-orange-50 border border-orange-200 text-sm text-orange-800">
          📦 <strong>Archiv-Ansicht.</strong> Diese Leads sind für Setter unsichtbar — alle Infos (Status, Notizen, Anrufversuche) bleiben erhalten. Mit „Reaktivieren" kommen sie zurück ins Setter-Cockpit.
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Suche nach Name, Telefonnummer oder E-Mail..."
          className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#2E75B6] focus:border-[#2E75B6] focus:outline-none"
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Suche löschen">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      {search && (
        <p className="text-xs text-gray-600">
          {searched.length === 0 ? 'Keine Treffer' : searched.length === 1 ? '1 Treffer' : `${searched.length} Treffer`} für „<span className="font-semibold">{search}</span>" im aktuellen Tab
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); setSelected(new Set()); setStatusFilter('alle') }}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === t.id ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'}`}>
            {t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === t.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}>{t.count}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 p-4 bg-white rounded-xl border border-gray-200">
        <button onClick={() => setStatusFilter('alle')} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${statusFilter === 'alle' ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'}`}>
          Alle ({searched.length})
        </button>
        {(Object.keys(STATUS_CONFIG) as LeadStatus[]).map(s => {
          const count = searched.filter(l => l.status === s).length
          if (count === 0) return null
          return (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${statusFilter === s ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'}`}>
              {STATUS_CONFIG[s].label} ({count})
            </button>
          )
        })}
      </div>

      {statusFilter !== 'alle' && (
        <p className="text-xs text-gray-500 italic">
          Filter aktiv: <span className="font-semibold">{STATUS_CONFIG[statusFilter as LeadStatus]?.label ?? statusFilter}</span> · {filtered.length} {filtered.length === 1 ? 'Lead' : 'Leads'}
        </p>
      )}

      <div className="space-y-2">
        {filtered.map(lead => (
          <div key={lead.id} className={`bg-white border rounded-2xl px-5 py-4 hover:shadow-sm transition-all ${viewMode === 'archived' ? 'border-orange-200 bg-orange-50/30' : 'border-gray-200 hover:border-[#2E75B6]'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 mb-1">
                <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleSelect(lead.id)} className="mr-1" />
                <span className="font-bold text-gray-900 text-[15px]">{lead.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={lead.status} />
                {viewMode === 'active' ? (
                  <>
                    <button onClick={() => setAssignTarget([lead.id])} className="text-xs text-[#2E75B6] hover:underline font-medium">Zuweisen</button>
                    <button onClick={() => setArchived([lead.id], true)} disabled={busy} className="flex items-center gap-1 text-xs text-orange-600 hover:underline font-medium disabled:opacity-50">
                      <Archive className="w-3 h-3" />Archivieren
                    </button>
                  </>
                ) : (
                  <button onClick={() => setArchived([lead.id], false)} disabled={busy} className="flex items-center gap-1 text-xs text-green-600 hover:underline font-medium disabled:opacity-50">
                    <ArchiveRestore className="w-3 h-3" />Reaktivieren
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm mt-1 ml-6">
              <span className="font-semibold text-gray-900">+{lead.phone.replace(/^\+/, '')}</span>
              {lead.email && <span className="text-gray-500 text-xs truncate">{lead.email}</span>}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 ml-6">
              {lead.age_indicator && <span>{lead.age_indicator.replace(/[^a-zA-ZäöüÄÖÜß0-9 .,()-]/g, '').trim()}</span>}
              {lead.state && <span>· {lead.state}</span>}
              {lead.lead_quality && <span>· {lead.lead_quality}</span>}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center py-10 text-gray-700">
            {search ? 'Kein Lead passt zu deiner Suche' : viewMode === 'archived' ? 'Keine archivierten Leads' : 'Keine Leads'}
          </p>
        )}
      </div>

      {showUpload && <ExcelUpload adminId={adminId} setters={setters} onClose={() => setShowUpload(false)} onImported={newLeads => { setLeads(prev => [...newLeads, ...prev]); setShowUpload(false) }} />}
      {showFixStates && <FixStatesModal onClose={() => setShowFixStates(false)} onApplied={() => { setShowFixStates(false); window.location.reload() }} />}
      {assignTarget.length > 0 && <AssignModal leadIds={assignTarget} allLeads={leads} setters={setters} adminId={adminId} adminName="Admin" onClose={() => setAssignTarget([])} onAssigned={(leadIds, setterId) => { setLeads(prev => prev.map(l => leadIds.includes(l.id) ? { ...l, assigned_to: setterId } : l)); setAssignTarget([]); setSelected(new Set()) }} />}
    </div>
  )
}
