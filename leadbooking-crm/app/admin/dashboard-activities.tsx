'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'

const STATUS_LABELS: Record<string, string> = {
  neu: 'Neu',
  angerufen: 'Angerufen', nicht_erreicht: 'Nicht erreicht',
  wiedervorlage: 'Wiedervorlage',
  termin_gelegt: 'Termin gelegt', termin_stattgefunden: 'Termin stattgefunden',
  kein_interesse: 'Kein Interesse',
}
const STATUS_COLORS: Record<string, string> = {
  neu: 'bg-indigo-100 text-indigo-700',
  angerufen: 'bg-blue-100 text-blue-700',
  nicht_erreicht: 'bg-orange-100 text-orange-700',
  wiedervorlage: 'bg-purple-100 text-purple-700',
  termin_gelegt: 'bg-yellow-100 text-yellow-800',
  termin_stattgefunden: 'bg-green-100 text-green-700',
  kein_interesse: 'bg-red-100 text-red-700',
}

export interface ActivityItem {
  id: string
  setter_id: string
  setter_name: string
  setter_color: string
  lead_id: string
  lead_name: string
  new_status: string
  created_at: string
}

interface DedupedEntry extends ActivityItem {
  count: number // wie oft Statuswechsel für dieses Lead+Setter
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diff = (now.getTime() - date.getTime()) / 1000
  if (diff < 60) return 'gerade'
  if (diff < 3600) return Math.floor(diff/60) + ' Min'
  if (diff < 86400) return Math.floor(diff/3600) + ' Std'
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ' ' + date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

export function DashboardActivities({ initial }: { initial: ActivityItem[] }) {
  const supabase = createClient()
  const [activities, setActivities] = useState<ActivityItem[]>(initial)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [refreshing, setRefreshing] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function refresh() {
    setRefreshing(true)
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const { data, error } = await supabase
      .from('activity_log')
      .select('id, setter_id, lead_id, new_status, created_at, profiles(full_name, avatar_color), leads(name)')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(5000)
    if (!error && data) {
      const items: ActivityItem[] = data.map((log: Record<string, unknown>) => {
        const p = log.profiles as { full_name?: string; avatar_color?: string } | null
        const l = log.leads as { name?: string } | null
        return {
          id: log.id as string,
          setter_id: log.setter_id as string,
          setter_name: p?.full_name ?? '?',
          setter_color: p?.avatar_color ?? '#2E75B6',
          lead_id: log.lead_id as string,
          lead_name: l?.name ?? '?',
          new_status: log.new_status as string,
          created_at: log.created_at as string,
        }
      })
      setActivities(items)
      setLastUpdate(new Date())
    }
    setRefreshing(false)
  }

  // 1) Realtime auf activity_log
  useEffect(() => {
    const triggerRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(refresh, 600)
    }
    const ch = supabase.channel('admin-activities-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, triggerRefresh)
      .subscribe()
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(ch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 2) Polling-Fallback: alle 30s frischer Daten holen (für den Fall, dass Realtime mal nicht greift)
  useEffect(() => {
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 3) Bei Window-Focus / Tab-Wechsel sofort refreshen
  useEffect(() => {
    const onFocus = () => refresh()
    const onVisibility = () => { if (!document.hidden) refresh() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Gruppieren pro Setter, dann pro (Setter + Lead) DEDUPEN — nur den NEUESTEN Status zeigen,
  // mit Count-Badge wenn mehrfach geändert.
  const bySetter = useMemo(() => {
    type SetterGroup = {
      id: string; name: string; color: string;
      ledger: Map<string, DedupedEntry> // key = lead_id, value = neueste Aktion + Anzahl
    }
    const map = new Map<string, SetterGroup>()

    // Activities sind bereits DESC sortiert → das ERSTE Vorkommen pro lead ist das neueste
    for (const a of activities) {
      if (!map.has(a.setter_id)) {
        map.set(a.setter_id, { id: a.setter_id, name: a.setter_name, color: a.setter_color, ledger: new Map() })
      }
      const g = map.get(a.setter_id)!
      const existing = g.ledger.get(a.lead_id)
      if (existing) {
        existing.count++ // mehr Aktionen für dieses Lead
      } else {
        g.ledger.set(a.lead_id, { ...a, count: 1 })
      }
    }

    return Array.from(map.values()).map(g => ({
      id: g.id, name: g.name, color: g.color,
      entries: Array.from(g.ledger.values()), // schon DESC, weil wir DESC iteriert haben
    })).sort((a, b) => b.entries.length - a.entries.length)
  }, [activities])

  function toggle(id: string) {
    setExpanded(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id); else s.add(id)
      return s
    })
  }

  function expandAll() { setExpanded(new Set(bySetter.map(s => s.id))) }
  function collapseAll() { setExpanded(new Set()) }

  const totalUnique = bySetter.reduce((sum, s) => sum + s.entries.length, 0)

  if (bySetter.length === 0) {
    return <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-500 text-sm">Noch keine Aktivitäten in den letzten 7 Tagen</div>
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button onClick={expandAll} className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium">
          Alle ausklappen
        </button>
        <button onClick={collapseAll} className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium">
          Alle einklappen
        </button>
        <button onClick={refresh} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </button>
        <span className="ml-auto text-gray-500 italic">Letzte 7 Tage · {totalUnique} Leads bearbeitet · {activities.length} Aktionen gesamt</span>
      </div>

      <div className="space-y-2">
        {bySetter.map(s => {
          const isOpen = expanded.has(s.id)
          // Counts pro Status (basierend auf NEUESTEM Status pro Lead, nicht auf allen Aktionen)
          const counts: Record<string, number> = {}
          for (const e of s.entries) counts[e.new_status] = (counts[e.new_status] ?? 0) + 1
          return (
            <div key={s.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button onClick={() => toggle(s.id)} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">
                {isOpen ? <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />}
                <Avatar name={s.name} color={s.color} size="sm" />
                <span className="font-semibold text-gray-900 text-sm flex-1">{s.name}</span>
                <span className="text-xs text-gray-600 shrink-0 font-medium">{s.entries.length} {s.entries.length === 1 ? 'Lead' : 'Leads'}</span>
                <div className="hidden md:flex gap-1 shrink-0">
                  {Object.entries(counts).map(([status, c]) => (
                    <span key={status} className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700'}`}
                      title={`${STATUS_LABELS[status] ?? status}: ${c}`}>
                      {c}
                    </span>
                  ))}
                </div>
              </button>
              {isOpen && (
                <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto bg-gray-50/30">
                  {s.entries.map(log => (
                    <div key={log.lead_id} className="px-4 py-2.5 flex items-center gap-2 text-sm">
                      <div className="flex-1 font-medium text-gray-900 truncate flex items-center gap-2">
                        {log.lead_name}
                        {log.count > 1 && (
                          <span className="text-[10px] font-bold bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-full" title={`${log.count} Statuswechsel`}>
                            {log.count}×
                          </span>
                        )}
                      </div>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[log.new_status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABELS[log.new_status] ?? log.new_status}
                      </span>
                      <span className="text-[11px] text-gray-500 shrink-0 w-24 text-right">{formatRelativeTime(log.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
