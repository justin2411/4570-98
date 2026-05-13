'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { X, CheckCircle, AlertTriangle, Wand2 } from 'lucide-react'
import { normalizeState, classifyState, VALID_STATES } from '@/lib/normalize-state'
import toast from 'react-hot-toast'

interface LeadRow { id: string; name: string; state: string | null }
interface Change { id: string; name: string; before: string; after: string }

interface Props {
  onClose: () => void
  onApplied: () => void
}

export function FixStatesModal({ onClose, onApplied }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [changes, setChanges] = useState<Change[]>([])
  const [unknown, setUnknown] = useState<LeadRow[]>([])
  const [valid, setValid] = useState<number>(0)
  const [empty, setEmpty] = useState<number>(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      // Alle Leads in Batches laden (Supabase liefert max 1000 pro Call)
      let all: LeadRow[] = []
      let from = 0
      const BATCH = 1000
      while (true) {
        const { data, error } = await supabase
          .from('leads')
          .select('id, name, state')
          .order('created_at', { ascending: false })
          .range(from, from + BATCH - 1)
        if (error) { toast.error('Fehler beim Laden: ' + error.message); break }
        if (!data || data.length === 0) break
        all = all.concat(data as LeadRow[])
        if (data.length < BATCH) break
        from += BATCH
      }

      if (cancelled) return

      const ch: Change[] = []
      const unk: LeadRow[] = []
      let validCount = 0
      let emptyCount = 0

      for (const lead of all) {
        const raw = lead.state ?? ''
        if (!raw.trim()) { emptyCount++; continue }
        const c = classifyState(raw)
        if (c.status === 'valid') { validCount++; continue }
        if (c.status === 'needs_fix' && c.normalized) {
          ch.push({ id: lead.id, name: lead.name, before: raw, after: c.normalized })
        } else {
          unk.push(lead)
        }
      }
      setChanges(ch); setUnknown(unk); setValid(validCount); setEmpty(emptyCount)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function applyChanges() {
    if (changes.length === 0) return
    setApplying(true)
    const BATCH = 100
    let done = 0
    for (let i = 0; i < changes.length; i += BATCH) {
      const batch = changes.slice(i, i + BATCH)
      // Pro Bundesland gruppieren für effiziente Updates
      const byState = new Map<string, string[]>()
      for (const c of batch) {
        if (!byState.has(c.after)) byState.set(c.after, [])
        byState.get(c.after)!.push(c.id)
      }
      for (const [state, ids] of byState) {
        const { error } = await supabase.from('leads').update({ state }).in('id', ids)
        if (error) {
          toast.error('Fehler: ' + error.message)
          setApplying(false)
          return
        }
        done += ids.length
      }
    }
    toast.success(`${done} Leads aktualisiert ✓`)
    setApplying(false)
    onApplied()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-[#2E75B6]" />
            <h2 className="font-bold text-lg text-[#1E3A5F]">Bundesländer reparieren</h2>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              <div className="animate-pulse">Analysiere alle Leads...</div>
            </div>
          ) : (
            <>
              {/* Übersicht */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-green-700">{valid}</div>
                  <div className="text-xs text-green-700 mt-0.5">Bereits korrekt</div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-purple-700">{changes.length}</div>
                  <div className="text-xs text-purple-700 mt-0.5">Werden korrigiert</div>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-orange-700">{unknown.length}</div>
                  <div className="text-xs text-orange-700 mt-0.5">Unbekannt (prüfen)</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-gray-700">{empty}</div>
                  <div className="text-xs text-gray-700 mt-0.5">Leer</div>
                </div>
              </div>

              {/* Liste der Änderungen */}
              {changes.length > 0 && (
                <div className="border border-purple-200 rounded-xl overflow-hidden">
                  <div className="bg-purple-50 px-4 py-2.5 border-b border-purple-200">
                    <p className="text-sm font-semibold text-purple-800 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Diese {changes.length} Leads werden korrigiert:
                    </p>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Lead</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Aktuell</th>
                          <th className="px-3 py-2 text-left font-semibold text-purple-700">→ Wird zu</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {changes.slice(0, 100).map(c => (
                          <tr key={c.id}>
                            <td className="px-3 py-2 font-medium text-gray-900">{c.name}</td>
                            <td className="px-3 py-2 text-gray-500 line-through">{c.before}</td>
                            <td className="px-3 py-2 font-semibold text-purple-700">{c.after}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {changes.length > 100 && (
                      <p className="text-center text-xs text-gray-400 py-2 bg-gray-50">
                        ... und {changes.length - 100} weitere (werden mit korrigiert)
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Unbekannte Werte (zur manuellen Prüfung) */}
              {unknown.length > 0 && (
                <div className="border border-orange-200 rounded-xl overflow-hidden">
                  <div className="bg-orange-50 px-4 py-2.5 border-b border-orange-200">
                    <p className="text-sm font-semibold text-orange-800 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      {unknown.length} Leads mit unklarem Bundesland — bitte manuell prüfen
                    </p>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Lead</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Eintrag</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {unknown.slice(0, 50).map(l => (
                          <tr key={l.id}>
                            <td className="px-3 py-2 font-medium text-gray-900">{l.name}</td>
                            <td className="px-3 py-2 text-gray-700 italic">„{l.state}"</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {unknown.length > 50 && (
                      <p className="text-center text-xs text-gray-400 py-2 bg-gray-50">
                        ... und {unknown.length - 50} weitere
                      </p>
                    )}
                  </div>
                </div>
              )}

              {changes.length === 0 && unknown.length === 0 && (
                <div className="text-center py-8 text-green-700">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                  <p className="font-semibold">Alle Bundesländer sind sauber!</p>
                  <p className="text-sm text-gray-700 mt-1">Keine Korrekturen notwendig.</p>
                </div>
              )}

              <p className="text-xs text-gray-500 italic">
                Nur das Feld <code className="bg-gray-100 px-1 rounded">state</code> wird geändert. Setter-Zuweisungen, Status, Notizen und alle anderen Felder bleiben unangetastet.
              </p>
            </>
          )}
        </div>

        <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={applying}>Abbrechen</Button>
          <Button onClick={applyChanges} loading={applying} disabled={loading || changes.length === 0}>
            {changes.length > 0 ? `${changes.length} Korrekturen anwenden` : 'Nichts zu tun'}
          </Button>
        </div>
      </div>
    </div>
  )
}
