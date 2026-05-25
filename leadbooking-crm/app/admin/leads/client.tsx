'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Lead, LeadStatus, STATUS_CONFIG } from '@/types'
import { formatPhoneForCall } from '@/lib/phone'
import { StatusBadge } from '@/components/leads/status-badge'
import { ExcelUpload } from './excel-upload'
import { AssignModal } from './assign-modal'
import { FixStatesModal } from './fix-states-modal'
import { Button } from '@/components/ui/button'
import { Upload, Search, X, Wand2, RefreshCw, Archive, ArchiveRestore, FolderOpen, Briefcase, Tag, AlertTriangle } from 'lucide-react'

interface Setter { id: string; full_name: string; avatar_color: string }
interface Props { initialLeads: Lead[]; setters: Setter[]; adminId: string; readyClusters?: string[] }

const VALID_STATUSES = new Set<LeadStatus>([
  'neu', 'angerufen', 'nicht_erreicht', 'wiedervorlage',
  'termin_gelegt', 'termin_stattgefunden', 'kein_interesse',
])

function isArchived(l: Lead): boolean { return (l as any).archived === true }
function getListName(l: Lead): string { return ((l as any).list_name || '').trim() }
function getBeruf(l: Lead): string { return ((l as any).beruf || '').trim() }
function isPrioA(l: Lead): boolean { return (l as any).prio_a === true }

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

export function AdminLeadsClient({ initialLeads, setters, adminId, readyClusters = [] }: Props) {
  const supabase = createClient()
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [showUpload, setShowUpload] = useState(false)
  const [showFixStates, setShowFixStates] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [assignTarget, setAssignTarget] = useState<string[]>([])
  const [listTarget, setListTarget] = useState<string[]>([])
  const [assignWarn, setAssignWarn] = useState<{ ids: string[]; missing: { name: string; count: number }[] } | null>(null)
  const [activeTab, setActiveTab] = useState<string>('unassigned')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'alle'>('alle')
  const [search, setSearch] = useState('')
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active')
  const [busy, setBusy] = useState(false)
  const [listFilter, setListFilter] = useState<string>('alle')
  const [berufFilter, setBerufFilter] = useState<string>('alle')
  const [prioFilter, setPrioFilter] = useState(false)

  const readySet = useMemo(() => new Set(readyClusters), [readyClusters])

  useEffect(() => {
    const ch = supabase.channel('admin-leads-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, (payload) => {
        const updated = payload.new as Lead
        setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))
        setLastUpdate(new Date())
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, (payload) => {
        setLeads(prev => [payload.new as Lead, ...prev]); setLastUpdate(new Date())
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'leads' }, (payload) => {
        const oldLead = payload.old as Partial<Lead>
        if (oldLead.id) { setLeads(prev => prev.filter(l => l.id !== oldLead.id)); setLastUpdate(new Date()) }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const allLists = useMemo(() => {
    const set = new Set<string>()
    leads.forEach(l => { const ln = getListName(l); if (ln) set.add(ln) })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'de'))
  }, [leads])
  const hasUnlisted = useMemo(() => leads.some(l => !getListName(l)), [leads])

  const listScopedLeads = useMemo(() => {
    if (listFilter === 'alle') return leads
    if (listFilter === '__none__') return leads.filter(l => !getListName(l))
    return leads.filter(l => getListName(l) === listFilter)
  }, [leads, listFilter])

  const activeCount = listScopedLeads.filter(l => !isArchived(l)).length
  const archivedCount = listScopedLeads.filter(l => isArchived(l)).length
  const viewScopedLeads = listScopedLeads.filter(l => viewMode === 'archived' ? isArchived(l) : !isArchived(l))

  const allBerufe = useMemo(() => {
    const map = new Map<string, number>()
    viewScopedLeads.forEach(l => { const b = getBeruf(l); if (b) map.set(b, (map.get(b) || 0) + 1) })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [viewScopedLeads])
  const hasNoBeruf = useMemo(() => viewScopedLeads.some(l => !getBeruf(l)), [viewScopedLeads])

  const berufScopedLeads = useMemo(() => {
    if (berufFilter === 'alle') return viewScopedLeads
    if (berufFilter === '__none__') return viewScopedLeads.filter(l => !getBeruf(l))
    return viewScopedLeads.filter(l => getBeruf(l) === berufFilter)
  }, [viewScopedLeads, berufFilter])

  const prioScopedLeads = prioFilter ? berufScopedLeads.filter(isPrioA) : berufScopedLeads
  const unassigned = prioScopedLeads.filter(l => !l.assigned_to)
  const adminLeads = prioScopedLeads.filter(l => l.assigned_to === adminId)
  const tabs = [
    { id: 'unassigned', label: 'Nicht zugeteilt', count: unassigned.length },
    { id: adminId, label: 'Admin (meine)', count: adminLeads.length },
    ...setters.map(s => ({ id: s.id, label: s.full_name, count: prioScopedLeads.filter(l => l.assigned_to === s.id).length })),
  ]

  const tabLeads = activeTab === 'unassigned' ? unassigned : prioScopedLeads.filter(l => l.assigned_to === activeTab)
  const searched = useMemo(() => tabLeads.filter(l => matchesSearch(l, search)), [tabLeads, search])

  const filtered = useMemo(() => {
    if (statusFilter === 'alle') return searched
    if (!VALID_STATUSES.has(statusFilter)) return searched
    return searched.filter(l => l.status === statusFilter)
  }, [searched, statusFilter])

  function selectAllInFiltered() { setSelected(new Set(filtered.map(l => l.id))) }
  function toggleSelect(id: string) {
    setSelected(prev => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s })
  }
  function resetLower() { setActiveTab('unassigned'); setSelected(new Set()); setStatusFilter('alle') }

  async function refreshLeads() {
    const { data } = await supabase.from('leads').select('*, profiles!leads_assigned_to_fkey(full_name, avatar_color)').order('created_at', { ascending: false })
    if (data) { setLeads(data as never as Lead[]); setLastUpdate(new Date()) }
  }

  async function setArchived(ids: string[], archived: boolean) {
    if (ids.length === 0 || busy) return
    const verb = archived ? 'archivieren' : 'reaktivieren'
    if (ids.length > 1 && !window.confirm(`${ids.length} Leads ${verb}?`)) return
    setBusy(true)
    const { error } = await supabase.from('leads').update({ archived } as any).in('id', ids)
    setBusy(false)
    if (error) { window.alert('Fehler beim ' + verb + ': ' + error.message); return }
    setLeads(prev => prev.map(l => ids.includes(l.id) ? ({ ...l, archived } as any) : l))
    setSelected(new Set())
  }

  async function assignToList(ids: string[], listName: string) {
    if (ids.length === 0 || busy) return
    const clean = listName.trim()
    setBusy(true)
    const { error } = await supabase.from('leads').update({ list_name: clean } as any).in('id', ids)
    setBusy(false)
    if (error) { window.alert('Fehler: ' + error.message); return }
    setLeads(prev => prev.map(l => ids.includes(l.id) ? ({ ...l, list_name: clean } as any) : l))
    setSelected(new Set()); setListTarget([])
  }

  // ── Sicherheitsprüfung beim Zuweisen ──────────────────────
  function requestAssign(ids: string[]) {
    const counts = new Map<string, number>()
    ids.forEach(id => {
      const lead = leads.find(l => l.id === id)
      const c = lead ? getListName(lead) : ''
      counts.set(c, (counts.get(c) || 0) + 1)
    })
    const missing = Array.from(counts.entries())
      .filter(([c]) => !readySet.has(c))
      .map(([name, count]) => ({ name, count }))
    if (missing.length > 0) setAssignWarn({ ids, missing })
    else setAssignTarget(ids)
  }

  const selectedArr = Array.from(selected)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">Leads verwalten</h1>
          <p className="text-gray-700 text-sm mt-1">
            {activeCount} aktiv · {archivedCount} archiviert
            {listFilter !== 'alle' && <span className="text-gray-400"> · Liste „{listFilter === '__none__' ? 'Ohne Liste' : listFilter}"</span>}
            {berufFilter !== 'alle' && <span className="text-gray-400"> · {berufFilter === '__none__' ? 'Ohne Beruf' : berufFilter}</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button onClick={refreshLeads} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-xs text-gray-700 hover:bg-gray-50">
            <RefreshCw className="w-3.5 h-3.5" />
            {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </button>
          <button onClick={selectAllInFiltered} className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 hover:bg-gray-50">Alle sichtbaren ({filtered.length})</button>

          {selected.size > 0 && (
            <>
              <button onClick={() => setListTarget(selectedArr)} disabled={busy}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-800 text-sm font-semibold disabled:opacity-50">
                <Tag className="w-4 h-4" />{selected.size} zu Liste
              </button>
              {viewMode === 'active' && (
                <>
                  <Button variant="secondary" onClick={() => requestAssign(selectedArr)}>{selected.size} zuweisen</Button>
                  <button onClick={() => setArchived(selectedArr, true)} disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-800 text-sm font-semibold disabled:opacity-50">
                    <Archive className="w-4 h-4" />{selected.size} archivieren
                  </button>
                </>
              )}
              {viewMode === 'archived' && (
                <button onClick={() => setArchived(selectedArr, false)} disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-100 hover:bg-green-200 text-green-800 text-sm font-semibold disabled:opacity-50">
                  <ArchiveRestore className="w-4 h-4" />{selected.size} reaktivieren
                </button>
              )}
            </>
          )}

          <Button variant="secondary" onClick={() => setShowFixStates(true)}><Wand2 className="w-4 h-4" />Bundesländer reparieren</Button>
          <Button onClick={() => setShowUpload(true)}><Upload className="w-4 h-4" />Hochladen</Button>
        </div>
      </div>

      {(allLists.length > 0 || hasUnlisted) && (
        <div className="flex flex-wrap gap-2 p-3 bg-gradient-to-r from-blue-50 to-slate-50 rounded-xl border border-blue-100">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E3A5F] uppercase tracking-wide px-1 self-center">
            <FolderOpen className="w-4 h-4" /> Listen
          </div>
          <button onClick={() => { setListFilter('alle'); setBerufFilter('alle'); resetLower() }}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${listFilter === 'alle' ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'}`}>
            Alle Listen ({leads.length})
          </button>
          {allLists.map(name => (
            <button key={name} onClick={() => { setListFilter(name); setBerufFilter('alle'); resetLower() }}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors flex items-center gap-1.5 ${listFilter === name ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'}`}>
              {name} ({leads.filter(l => getListName(l) === name).length})
              {!readySet.has(name) && <span title="Kein Skript hinterlegt" className={listFilter === name ? 'text-amber-300' : 'text-amber-500'}>⚠</span>}
            </button>
          ))}
          {hasUnlisted && (
            <button onClick={() => { setListFilter('__none__'); setBerufFilter('alle'); resetLower() }}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${listFilter === '__none__' ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              Ohne Liste ({leads.filter(l => !getListName(l)).length})
            </button>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={() => { setViewMode('active'); setBerufFilter('alle'); resetLower() }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${viewMode === 'active' ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
          Aktive Leads<span className={`text-xs px-1.5 py-0.5 rounded-full ${viewMode === 'active' ? 'bg-white/20' : 'bg-gray-100 text-gray-700'}`}>{activeCount}</span>
        </button>
        <button onClick={() => { setViewMode('archived'); setBerufFilter('alle'); resetLower() }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${viewMode === 'archived' ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
          <Archive className="w-4 h-4" />Archiv<span className={`text-xs px-1.5 py-0.5 rounded-full ${viewMode === 'archived' ? 'bg-white/20' : 'bg-gray-100 text-gray-700'}`}>{archivedCount}</span>
        </button>
      </div>

      {viewMode === 'archived' && (
        <div className="px-4 py-3 rounded-xl bg-orange-50 border border-orange-200 text-sm text-orange-800">
          📦 <strong>Archiv-Ansicht.</strong> Diese Leads sind für Setter unsichtbar — alle Infos bleiben erhalten. Mit „Reaktivieren" kommen sie zurück.
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <button onClick={() => setPrioFilter(p => !p)}
          className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors flex items-center gap-1.5 ${prioFilter ? 'bg-amber-500 text-white' : 'bg-white border border-amber-300 text-amber-700 hover:bg-amber-50'}`}>
          ⭐ Nur A-Leads{prioFilter ? ' (aktiv)' : ''}
        </button>
        {prioFilter && <span className="text-xs text-gray-500 self-center">Quer über alle Cluster · nur für dich (Admin) sichtbar</span>}
      </div>

      {allBerufe.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl border border-teal-100">
          <div className="flex items-center gap-1.5 text-xs font-bold text-teal-800 uppercase tracking-wide px-1 self-center">
            <Briefcase className="w-4 h-4" /> Berufe
          </div>
          <button onClick={() => { setBerufFilter('alle'); resetLower() }}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${berufFilter === 'alle' ? 'bg-teal-700 text-white' : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'}`}>
            Alle ({viewScopedLeads.length})
          </button>
          {allBerufe.map(([name, count]) => (
            <button key={name} onClick={() => { setBerufFilter(name); resetLower() }}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${berufFilter === name ? 'bg-teal-700 text-white' : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'}`}>
              {name} ({count})
            </button>
          ))}
          {hasNoBeruf && (
            <button onClick={() => { setBerufFilter('__none__'); resetLower() }}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${berufFilter === '__none__' ? 'bg-teal-700 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              Ohne Beruf ({viewScopedLeads.filter(l => !getBeruf(l)).length})
            </button>
          )}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Suche nach Name, Telefonnummer oder E-Mail..."
          className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#2E75B6] focus:border-[#2E75B6] focus:outline-none" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full" aria-label="Suche löschen">
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
            {t.label}<span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === t.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}>{t.count}</span>
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

      <div className="space-y-2">
        {filtered.map(lead => (
          <div key={lead.id} className={`bg-white border rounded-2xl px-5 py-4 hover:shadow-sm transition-all ${viewMode === 'archived' ? 'border-orange-200 bg-orange-50/30' : 'border-gray-200 hover:border-[#2E75B6]'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleSelect(lead.id)} className="mr-1" />
                <span className="font-bold text-gray-900 text-[15px]">{lead.name}</span>
                {getBeruf(lead) && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium">{getBeruf(lead)}</span>}
                {getListName(lead) && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{getListName(lead)}</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={lead.status} />
                {viewMode === 'active' ? (
                  <>
                    <button onClick={() => requestAssign([lead.id])} className="text-xs text-[#2E75B6] hover:underline font-medium">Zuweisen</button>
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
              <span className="font-semibold text-gray-900">{formatPhoneForCall(lead.phone)}</span>
              {lead.email && <span className="text-gray-500 text-xs truncate">{lead.email}</span>}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 ml-6">
              {(lead as any).ort && <span>{(lead as any).ort}</span>}
              {lead.state && <span>· {lead.state}</span>}
              {(lead as any).website && (
                <a href={(lead as any).website.startsWith('http') ? (lead as any).website : `https://${(lead as any).website}`}
                   target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                   className="text-[#2E75B6] hover:underline">🌐 Website</a>
              )}
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
      {listTarget.length > 0 && <AssignListModal count={listTarget.length} existingLists={allLists} busy={busy} onClose={() => setListTarget([])} onAssign={(name) => assignToList(listTarget, name)} />}
      {assignWarn && <AssignWarningModal missing={assignWarn.missing} onClose={() => setAssignWarn(null)} onConfirm={() => { const ids = assignWarn.ids; setAssignWarn(null); setAssignTarget(ids) }} />}
    </div>
  )
}

// ============== LISTEN-ZUWEISUNGS-MODAL ==============
function AssignListModal({ count, existingLists, busy, onClose, onAssign }: {
  count: number; existingLists: string[]; busy: boolean; onClose: () => void; onAssign: (listName: string) => void
}) {
  const [newName, setNewName] = useState('')
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#1E3A5F]">📋 {count} Leads zu Liste</h2>
          <button onClick={onClose} className="text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Neue Liste erstellen</label>
        <div className="flex gap-2 mb-4">
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="z.B. Gesundheit"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#2E75B6] focus:outline-none" autoFocus />
          <button onClick={() => newName.trim() && onAssign(newName)} disabled={busy || !newName.trim()}
            className="px-4 py-2 rounded-lg bg-[#2E75B6] hover:bg-[#246299] text-white text-sm font-semibold disabled:opacity-50">Hinzufügen</button>
        </div>
        {existingLists.length > 0 && (
          <>
            <label className="block text-xs font-semibold text-gray-700 mb-2">Oder bestehende Liste wählen</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {existingLists.map(name => (
                <button key={name} onClick={() => onAssign(name)} disabled={busy}
                  className="px-3 py-1.5 rounded-full text-sm font-medium bg-blue-50 border border-blue-200 text-blue-800 hover:bg-blue-100 disabled:opacity-50">{name}</button>
              ))}
            </div>
          </>
        )}
        <div className="border-t border-gray-100 pt-3">
          <button onClick={() => onAssign('')} disabled={busy} className="text-xs text-gray-500 hover:text-red-600 hover:underline disabled:opacity-50">
            Aus Liste entfernen (ohne Liste)
          </button>
        </div>
      </div>
    </div>
  )
}

// ============== ZUWEISUNGS-WARNUNG (fehlendes Skript) ==============
function AssignWarningModal({ missing, onClose, onConfirm }: {
  missing: { name: string; count: number }[]; onClose: () => void; onConfirm: () => void
}) {
  const [confirmText, setConfirmText] = useState('')
  const ok = confirmText.trim().toUpperCase() === 'BESTÄTIGEN'
  const totalMissing = missing.reduce((s, m) => s + m.count, 0)

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <h2 className="text-lg font-bold text-[#1E3A5F]">Achtung — fehlendes Skript</h2>
        </div>

        <p className="text-sm text-gray-700 mb-3">
          {totalMissing} der ausgewählten Leads gehören zu Clustern, für die noch <strong>kein Branding + Skript</strong> hinterlegt ist. Die Setter hätten dann keinen Gesprächsleitfaden:
        </p>

        <ul className="mb-4 space-y-1.5">
          {missing.map(m => (
            <li key={m.name} className="flex items-center justify-between text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <span className="font-semibold text-amber-900">{m.name || 'Ohne Cluster/Liste'}</span>
              <span className="text-amber-700 text-xs">{m.count} {m.count === 1 ? 'Lead' : 'Leads'}</span>
            </li>
          ))}
        </ul>

        <a href="/admin/inhalte" className="block w-full text-center py-2.5 mb-4 rounded-lg bg-[#2E75B6] hover:bg-[#246299] text-white text-sm font-semibold">
          → Jetzt Skript anlegen (Inhalte)
        </a>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-600 mb-2">
            Oder tippe <strong className="text-gray-900">BESTÄTIGEN</strong>, um trotzdem zuzuweisen:
          </p>
          <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="BESTÄTIGEN"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-amber-400 focus:outline-none mb-3" autoFocus />
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium">Abbrechen</button>
            <button onClick={onConfirm} disabled={!ok}
              className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-40">
              Trotzdem zuweisen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
