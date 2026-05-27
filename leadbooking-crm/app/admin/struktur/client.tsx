'use client'

import { useState, useMemo } from 'react'
import { Folder, FolderPlus, Pencil, Trash2, Power, X, Search, Tag } from 'lucide-react'
import toast from 'react-hot-toast'

interface ListeRow {
  list_name: string
  display_name: string | null
  firma: string | null
  web: string | null
  kontakt_email: string | null
  tagline: string | null
  is_active: boolean | null
  lead_count: number
}

interface BerufRow {
  name: string
  plural_form: string
  is_active: boolean
  lead_count: number
}

type Modal =
  | { kind: 'liste-new' }
  | { kind: 'liste-edit', row: ListeRow }
  | { kind: 'liste-delete', row: ListeRow }
  | { kind: 'beruf-new' }
  | { kind: 'beruf-edit', row: BerufRow }
  | { kind: 'beruf-delete', row: BerufRow }
  | null

export function StrukturClient({ initialListen, initialBerufe }: { initialListen: ListeRow[]; initialBerufe: BerufRow[] }) {
  const [listen, setListen] = useState(initialListen)
  const [berufe, setBerufe] = useState(initialBerufe)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<Modal>(null)
  const [busy, setBusy] = useState(false)

  const filteredListen = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return listen
    return listen.filter(l => l.list_name.toLowerCase().includes(q) || (l.display_name || '').toLowerCase().includes(q))
  }, [listen, search])
  const filteredBerufe = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return berufe
    return berufe.filter(b => b.name.toLowerCase().includes(q) || b.plural_form.toLowerCase().includes(q))
  }, [berufe, search])

  async function refresh() {
    const [lRes, bRes] = await Promise.all([
      fetch('/api/admin/listen').then(r => r.json()),
      fetch('/api/admin/berufe').then(r => r.json()),
    ])
    if (lRes.listen) setListen(lRes.listen)
    if (bRes.berufe) setBerufe(bRes.berufe)
  }

  async function apiCall(method: string, url: string, body?: unknown): Promise<{ ok: boolean; data: any }> {
    setBusy(true)
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || `${method} fehlgeschlagen (${res.status})`)
        return { ok: false, data }
      }
      return { ok: true, data }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Liste oder Beruf suchen..."
          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl text-sm placeholder-gray-400 focus:ring-2 focus:ring-[#2E75B6] focus:border-[#2E75B6] focus:outline-none"
        />
      </div>

      {/* ── Listen ────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-[#1E3A5F] flex items-center gap-2"><Folder className="w-5 h-5" />Listen</h2>
            <p className="text-xs text-gray-500">{filteredListen.length} Ordner — Branding, Templates und Lead-Zuordnung</p>
          </div>
          <button onClick={() => setModal({ kind: 'liste-new' })} className="bg-[#2E75B6] hover:bg-[#1E3A5F] text-white px-3 py-2 rounded-xl text-sm font-semibold flex items-center gap-2">
            <FolderPlus className="w-4 h-4" />Neue Liste
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredListen.map(l => <ListeCard key={l.list_name} row={l} onEdit={() => setModal({ kind: 'liste-edit', row: l })} onDelete={() => setModal({ kind: 'liste-delete', row: l })} />)}
          {filteredListen.length === 0 && <div className="col-span-full text-center text-gray-400 text-sm py-8">Keine Listen.</div>}
        </div>
      </section>

      {/* ── Berufe ────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-[#1E3A5F] flex items-center gap-2"><Tag className="w-5 h-5" />Berufe</h2>
            <p className="text-xs text-gray-500">{filteredBerufe.length} Berufe — Master-Liste mit Plural-Form für Skript / Vorlagen</p>
          </div>
          <button onClick={() => setModal({ kind: 'beruf-new' })} className="bg-[#2E75B6] hover:bg-[#1E3A5F] text-white px-3 py-2 rounded-xl text-sm font-semibold flex items-center gap-2">
            <FolderPlus className="w-4 h-4" />Neuer Beruf
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredBerufe.map(b => <BerufCard key={b.name} row={b} onEdit={() => setModal({ kind: 'beruf-edit', row: b })} onDelete={() => setModal({ kind: 'beruf-delete', row: b })} />)}
          {filteredBerufe.length === 0 && <div className="col-span-full text-center text-gray-400 text-sm py-8">Keine Berufe.</div>}
        </div>
      </section>

      {modal && (
        <ModalWrapper onClose={() => setModal(null)}>
          {modal.kind === 'liste-new' && <ListeForm title="Neue Liste anlegen" onCancel={() => setModal(null)} onSubmit={async payload => {
            const { ok } = await apiCall('POST', '/api/admin/listen', payload)
            if (ok) { toast.success('Liste angelegt'); setModal(null); await refresh() }
          }} busy={busy} />}
          {modal.kind === 'liste-edit' && <ListeForm title={`„${modal.row.list_name}" bearbeiten`} initial={modal.row} onCancel={() => setModal(null)} onSubmit={async payload => {
            const url = `/api/admin/listen/${encodeURIComponent(modal.row.list_name)}`
            const body: Record<string, unknown> = {}
            if (payload.list_name && payload.list_name !== modal.row.list_name) body.rename = payload.list_name
            for (const k of ['display_name', 'firma', 'web', 'kontakt_email', 'tagline', 'is_active'] as const) {
              if ((payload as any)[k] !== undefined) body[k] = (payload as any)[k]
            }
            const { ok } = await apiCall('PATCH', url, body)
            if (ok) { toast.success('Gespeichert'); setModal(null); await refresh() }
          }} busy={busy} />}
          {modal.kind === 'liste-delete' && <DeleteConfirm
            title={`Liste „${modal.row.list_name}" löschen?`}
            subtitle={`${modal.row.lead_count} Leads sind dieser Liste zugeordnet.`}
            warning="Branding/Templates der Liste werden entfernt. Optional: zugeordnete Leads bekommen list_name = NULL (sonst bleiben sie mit dem Namen erhalten und können wieder angelegt werden)."
            allowClearLeads
            onCancel={() => setModal(null)}
            onConfirm={async clearLeads => {
              const url = `/api/admin/listen/${encodeURIComponent(modal.row.list_name)}${clearLeads ? '?clearLeads=true' : ''}`
              const { ok } = await apiCall('DELETE', url)
              if (ok) { toast.success('Liste gelöscht'); setModal(null); await refresh() }
            }} busy={busy} />}

          {modal.kind === 'beruf-new' && <BerufForm title="Neuer Beruf" onCancel={() => setModal(null)} onSubmit={async payload => {
            const { ok } = await apiCall('POST', '/api/admin/berufe', payload)
            if (ok) { toast.success('Beruf angelegt'); setModal(null); await refresh() }
          }} busy={busy} />}
          {modal.kind === 'beruf-edit' && <BerufForm title={`„${modal.row.name}" bearbeiten`} initial={modal.row} onCancel={() => setModal(null)} onSubmit={async payload => {
            const url = `/api/admin/berufe/${encodeURIComponent(modal.row.name)}`
            const body: Record<string, unknown> = {}
            if (payload.name && payload.name !== modal.row.name) body.rename = payload.name
            if (payload.plural_form !== undefined) body.plural_form = payload.plural_form
            if (payload.is_active !== undefined) body.is_active = payload.is_active
            const { ok } = await apiCall('PATCH', url, body)
            if (ok) { toast.success('Gespeichert'); setModal(null); await refresh() }
          }} busy={busy} />}
          {modal.kind === 'beruf-delete' && <DeleteConfirm
            title={`Beruf „${modal.row.name}" löschen?`}
            subtitle={`${modal.row.lead_count} Leads tragen diesen Beruf.`}
            warning="Optional: zugeordnete Leads bekommen beruf = NULL (sonst bleibt der Wert auf den Leads und kommt beim nächsten Insert über den DB-Trigger wieder in die Master-Liste)."
            allowClearLeads
            onCancel={() => setModal(null)}
            onConfirm={async clearLeads => {
              const url = `/api/admin/berufe/${encodeURIComponent(modal.row.name)}${clearLeads ? '?clearLeads=true' : ''}`
              const { ok } = await apiCall('DELETE', url)
              if (ok) { toast.success('Beruf gelöscht'); setModal(null); await refresh() }
            }} busy={busy} />}
        </ModalWrapper>
      )}
    </div>
  )
}

// ── Sub-Components ──────────────────────────────────────────────

function ListeCard({ row, onEdit, onDelete }: { row: ListeRow; onEdit: () => void; onDelete: () => void }) {
  const dim = row.is_active === false
  return (
    <div className={`bg-white border ${dim ? 'border-gray-200 opacity-60' : 'border-gray-200 hover:border-[#2E75B6]'} rounded-2xl p-4 transition-colors`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <Folder className="w-5 h-5 text-[#2E75B6] flex-shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-[#1E3A5F] truncate">{row.display_name || row.list_name}</div>
            {row.display_name && <div className="text-xs text-gray-400 truncate">{row.list_name}</div>}
          </div>
        </div>
        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full whitespace-nowrap">{row.lead_count} Leads</span>
      </div>
      {row.firma && <div className="text-xs text-gray-600 mt-1 truncate">{row.firma}</div>}
      {row.is_active === null && <div className="text-[10px] text-orange-700 mt-1">Stub (kein cluster_content)</div>}
      <div className="flex gap-1 mt-3">
        <button onClick={onEdit} className="flex-1 text-xs flex items-center justify-center gap-1 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700">
          <Pencil className="w-3 h-3" />Bearbeiten
        </button>
        <button onClick={onDelete} className="text-xs flex items-center gap-1 px-2 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

function BerufCard({ row, onEdit, onDelete }: { row: BerufRow; onEdit: () => void; onDelete: () => void }) {
  const dim = !row.is_active
  return (
    <div className={`bg-white border ${dim ? 'border-gray-200 opacity-60' : 'border-gray-200 hover:border-[#2E75B6]'} rounded-2xl p-4 transition-colors`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <Tag className="w-5 h-5 text-[#2E75B6] flex-shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-[#1E3A5F] truncate">{row.name}</div>
            <div className="text-xs text-gray-400 truncate">Plural: {row.plural_form || '–'}</div>
          </div>
        </div>
        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full whitespace-nowrap">{row.lead_count} Leads</span>
      </div>
      <div className="flex gap-1 mt-3">
        <button onClick={onEdit} className="flex-1 text-xs flex items-center justify-center gap-1 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700">
          <Pencil className="w-3 h-3" />Bearbeiten
        </button>
        <button onClick={onDelete} className="text-xs flex items-center gap-1 px-2 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

function ModalWrapper({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg p-5 shadow-2xl mt-12 sm:mt-0" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="float-right p-1 hover:bg-gray-100 rounded-full" aria-label="Schließen">
          <X className="w-5 h-5 text-gray-500" />
        </button>
        {children}
      </div>
    </div>
  )
}

function ListeForm({ title, initial, onCancel, onSubmit, busy }: {
  title: string
  initial?: ListeRow
  onCancel: () => void
  onSubmit: (payload: { list_name: string; display_name: string; firma: string; web: string; kontakt_email: string; tagline: string; is_active: boolean }) => Promise<void>
  busy: boolean
}) {
  const [list_name, setListName] = useState(initial?.list_name || '')
  const [display_name, setDisplayName] = useState(initial?.display_name || '')
  const [firma, setFirma] = useState(initial?.firma || '')
  const [web, setWeb] = useState(initial?.web || '')
  const [kontakt_email, setKontakt] = useState(initial?.kontakt_email || '')
  const [tagline, setTagline] = useState(initial?.tagline || '')
  const [is_active, setActive] = useState(initial?.is_active !== false)
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold text-[#1E3A5F]">{title}</h3>
      <Field label="Listenname (Key)*"><input value={list_name} onChange={e => setListName(e.target.value)} className={inp} /></Field>
      <Field label="Anzeigename"><input value={display_name} onChange={e => setDisplayName(e.target.value)} className={inp} placeholder="optional" /></Field>
      <Field label="Firma"><input value={firma} onChange={e => setFirma(e.target.value)} className={inp} placeholder="z.B. Heilpraktiker-Vorsorge" /></Field>
      <Field label="Website"><input value={web} onChange={e => setWeb(e.target.value)} className={inp} /></Field>
      <Field label="Kontakt-E-Mail"><input value={kontakt_email} onChange={e => setKontakt(e.target.value)} className={inp} /></Field>
      <Field label="Tagline"><input value={tagline} onChange={e => setTagline(e.target.value)} className={inp} /></Field>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={is_active} onChange={e => setActive(e.target.checked)} />
        Aktiv
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} disabled={busy} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl">Abbrechen</button>
        <button onClick={() => onSubmit({ list_name: list_name.trim(), display_name: display_name.trim(), firma: firma.trim(), web: web.trim(), kontakt_email: kontakt_email.trim(), tagline: tagline.trim(), is_active })}
          disabled={busy || !list_name.trim()}
          className="px-4 py-2 text-sm bg-[#2E75B6] hover:bg-[#1E3A5F] text-white rounded-xl disabled:opacity-50">{busy ? '…' : 'Speichern'}</button>
      </div>
    </div>
  )
}

function BerufForm({ title, initial, onCancel, onSubmit, busy }: {
  title: string
  initial?: BerufRow
  onCancel: () => void
  onSubmit: (payload: { name: string; plural_form: string; is_active: boolean }) => Promise<void>
  busy: boolean
}) {
  const [name, setName] = useState(initial?.name || '')
  const [plural_form, setPlural] = useState(initial?.plural_form || '')
  const [is_active, setActive] = useState(initial?.is_active !== false)
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold text-[#1E3A5F]">{title}</h3>
      <Field label="Name (Singular)*"><input value={name} onChange={e => setName(e.target.value)} className={inp} placeholder="z.B. Heilpraktiker" /></Field>
      <Field label="Plural-Form"><input value={plural_form} onChange={e => setPlural(e.target.value)} className={inp} placeholder="z.B. Heilpraktiker (für {beruf_plural})" /></Field>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={is_active} onChange={e => setActive(e.target.checked)} />
        Aktiv
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} disabled={busy} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl">Abbrechen</button>
        <button onClick={() => onSubmit({ name: name.trim(), plural_form: plural_form.trim(), is_active })}
          disabled={busy || !name.trim()}
          className="px-4 py-2 text-sm bg-[#2E75B6] hover:bg-[#1E3A5F] text-white rounded-xl disabled:opacity-50">{busy ? '…' : 'Speichern'}</button>
      </div>
    </div>
  )
}

function DeleteConfirm({ title, subtitle, warning, allowClearLeads, onCancel, onConfirm, busy }: {
  title: string
  subtitle: string
  warning: string
  allowClearLeads?: boolean
  onCancel: () => void
  onConfirm: (clearLeads: boolean) => Promise<void>
  busy: boolean
}) {
  const [clearLeads, setClearLeads] = useState(false)
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold text-red-700">{title}</h3>
      <p className="text-sm text-gray-700">{subtitle}</p>
      <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">{warning}</p>
      {allowClearLeads && (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={clearLeads} onChange={e => setClearLeads(e.target.checked)} />
          Zugeordnete Leads auf NULL setzen
        </label>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} disabled={busy} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl">Abbrechen</button>
        <button onClick={() => onConfirm(clearLeads)} disabled={busy} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-xl disabled:opacity-50">{busy ? '…' : 'Löschen'}</button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-600 mb-1 block">{label}</span>
      {children}
    </label>
  )
}

const inp = 'w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#2E75B6] focus:border-[#2E75B6] focus:outline-none'
