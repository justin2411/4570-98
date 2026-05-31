'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

interface Setter { id: string; full_name: string }

export function DistributeLeadsButton({
  setters,
  listNames,
}: {
  setters: Setter[]
  listNames: string[]
}) {
  const [open, setOpen] = useState(false)
  const [selectedSetters, setSelectedSetters] = useState<string[]>([])
  const [listFilter, setListFilter] = useState<string>('')
  const [limit, setLimit] = useState<string>('')
  const [balanceByBeruf, setBalanceByBeruf] = useState(true)
  const [running, setRunning] = useState(false)

  function toggleSetter(id: string) {
    setSelectedSetters(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  async function distribute() {
    if (selectedSetters.length === 0) { toast.error('Bitte mindestens einen Setter wählen'); return }
    setRunning(true)
    try {
      const res = await fetch('/api/admin/distribute-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setterIds: selectedSetters,
          listName: listFilter || undefined,
          perSetterLimit: limit ? Number(limit) : undefined,
          balanceByBeruf,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Unbekannter Fehler')
      const counts: Record<string, number> = data.assigned || {}
      const summary = Object.entries(counts)
        .map(([sid, n]) => `${setters.find(x => x.id === sid)?.full_name ?? sid}: ${n}`)
        .join(' · ')
      toast.success(`✅ ${data.total} Leads verteilt${summary ? ' — ' + summary : ''}`)
      setTimeout(() => location.reload(), 1200)
    } catch (e: unknown) {
      toast.error('Fehler: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setRunning(false)
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-lg bg-[#2E75B6] hover:bg-[#1E3A5F] text-white font-semibold text-sm">
        📤 Leads verteilen
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !running && setOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="font-bold text-lg text-[#1E3A5F]">Leads verteilen</h3>
              <p className="text-xs text-gray-500 mt-1">Unzugeordnete Leads werden nach Qualität sortiert und reihum auf die gewählten Setter verteilt — jeder bekommt einen ähnlichen Mix aus Top- und Standard-Leads.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Setter ({selectedSetters.length} gewählt)</label>
              <div className="space-y-1 max-h-44 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {setters.length === 0 && <p className="text-xs text-gray-400 text-center py-2">Keine aktiven Setter</p>}
                {setters.map(s => (
                  <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer px-1 py-1 hover:bg-gray-50 rounded">
                    <input type="checkbox" checked={selectedSetters.includes(s.id)} onChange={() => toggleSetter(s.id)} />
                    <span className="text-gray-900">{s.full_name}</span>
                  </label>
                ))}
              </div>
              {setters.length > 0 && (
                <div className="mt-1 flex gap-2 text-[11px]">
                  <button type="button" onClick={() => setSelectedSetters(setters.map(s => s.id))} className="text-[#2E75B6] hover:underline">Alle</button>
                  <button type="button" onClick={() => setSelectedSetters([])} className="text-gray-500 hover:underline">Keine</button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nur aus Liste (optional)</label>
              <select value={listFilter} onChange={e => setListFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                <option value="">Alle Listen</option>
                {listNames.map(ln => <option key={ln} value={ln}>{ln}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Max. pro Setter (optional)</label>
              <input type="number" min={1} value={limit} onChange={e => setLimit(e.target.value)}
                placeholder="z.B. 50 — leer = alle aufteilen"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>

            <label className="flex items-start gap-2 text-sm cursor-pointer bg-blue-50/60 border border-blue-100 rounded-lg px-3 py-2.5">
              <input type="checkbox" checked={balanceByBeruf} onChange={e => setBalanceByBeruf(e.target.checked)} className="mt-0.5" />
              <span className="text-gray-800">
                <span className="font-semibold">Pro Beruf gleichmäßig verteilen</span>
                <span className="block text-xs text-gray-500">Jeder Setter bekommt denselben Mix aller Berufe (z. B. Psychotherapeuten + Heilpraktiker), nicht nur global reihum. Hebammen sind ausgenommen (Freeze).</span>
              </span>
            </label>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setOpen(false)} disabled={running}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium disabled:opacity-50">
                Abbrechen
              </button>
              <button onClick={distribute} disabled={running || selectedSetters.length === 0}
                className="flex-1 py-2.5 rounded-lg bg-[#2E75B6] hover:bg-[#1E3A5F] text-white font-semibold disabled:opacity-50">
                {running ? 'Verteile…' : '📤 Verteilen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
