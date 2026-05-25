'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/avatar'
import { TrendingUp, TrendingDown, Minus, Crown, Info, RefreshCw } from 'lucide-react'
import { berlinDate, berlinPeriodStart, addDaysStr } from '@/lib/dates'

// ============================================================
// TIER SYSTEM
// Basis: AKTUELLE termin_gelegt + termin_stattgefunden aus leads
// (Wenn Termin entfernt wird, fliegt er raus → fair für alle)
// ============================================================
type Tier = { name: string; emoji: string; min: number; cls: string }
const TIERS: Tier[] = [
  { name: 'VIP',     emoji: '👑', min: 1001, cls: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300' },
  { name: 'Diamant', emoji: '💠', min: 301,  cls: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  { name: 'Platin',  emoji: '💎', min: 101,  cls: 'bg-slate-100 text-slate-700 border-slate-400' },
  { name: 'Gold',    emoji: '🥇', min: 26,   cls: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { name: 'Silber',  emoji: '🥈', min: 6,    cls: 'bg-gray-100 text-gray-700 border-gray-300' },
  { name: 'Bronze',  emoji: '🥉', min: 0,    cls: 'bg-orange-100 text-orange-800 border-orange-300' },
]
function calcTier(lifetimeSet: number): Tier {
  return TIERS.find(t => lifetimeSet >= t.min) ?? TIERS[TIERS.length - 1]
}
const TIERS_ASC = [...TIERS].reverse()
function tierRange(t: Tier): string {
  const next = TIERS.find(x => x.min > t.min)
  return next ? `${t.min}–${next.min - 1}` : `${t.min}+`
}
// ============================================================

interface Entry {
  setter_id: string
  full_name: string
  avatar_color: string
  calls_made: number
  appointments_set: number
  appointments_done: number
  lifetime_set: number
  lifetime_done: number
}

type Period = 'today' | 'week' | 'month' | 'all'
const MEDAL = ['🥇', '🥈', '🥉']

function showRate(set: number, done: number) {
  if (set === 0) return '–'
  return Math.round((done / set) * 100) + '%'
}

export function LeaderboardTable({ highlightId }: { highlightId?: string }) {
  const supabase = createClient()
  const [entries, setEntries] = useState<Entry[]>([])
  const [period, setPeriod] = useState<Period>('week')
  const [yMap, setYMap] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [showLegend, setShowLegend] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function load(p: Period) {
    setLoading(true)
    const from = berlinPeriodStart(p)
    const yestStr = addDaysStr(berlinDate(), -1)

    // Setter laden
    const { data: setters } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_color')
      .eq('role', 'setter')
      .eq('is_active', true)

    // Period-Daten aus leaderboard_cache
    const { data: cacheData } = await supabase
      .from('leaderboard_cache')
      .select('setter_id, date, calls_made, appointments_set, appointments_done')

    // *** NEU: Lifetime aus AKTUELLEN leads berechnen ***
    // → Fair: Wenn Termin entfernt wird, fliegt er aus Lifetime raus
    const { data: currentLeads } = await supabase
      .from('leads')
      .select('assigned_to, status')
      .in('status', ['termin_gelegt', 'termin_stattgefunden'])

    const lifetimeMap = new Map<string, { set: number; done: number }>()
    for (const lead of currentLeads ?? []) {
      if (!lead.assigned_to) continue
      const cur = lifetimeMap.get(lead.assigned_to) ?? { set: 0, done: 0 }
      if (lead.status === 'termin_gelegt' || lead.status === 'termin_stattgefunden') cur.set++
      if (lead.status === 'termin_stattgefunden') cur.done++
      lifetimeMap.set(lead.assigned_to, cur)
    }

    const map = new Map<string, Entry>()
    for (const s of setters ?? []) {
      const lt = lifetimeMap.get(s.id) ?? { set: 0, done: 0 }
      map.set(s.id, {
        setter_id: s.id,
        full_name: s.full_name ?? '?',
        avatar_color: s.avatar_color ?? '#2E75B6',
        calls_made: 0, appointments_set: 0, appointments_done: 0,
        lifetime_set: lt.set,      // ← aus aktuellen leads
        lifetime_done: lt.done,    // ← aus aktuellen leads
      })
    }

    const ym = new Map<string, number>()
    for (const row of cacheData ?? []) {
      const e = map.get(row.setter_id)
      if (!e) continue

      // Period-Werte (Heute/Woche/Monat) weiterhin aus Cache
      if (from === null || row.date >= from) {
        e.calls_made += row.calls_made
        e.appointments_set += row.appointments_set
        e.appointments_done += row.appointments_done
      }

      if (row.date === yestStr) {
        ym.set(row.setter_id, (ym.get(row.setter_id) ?? 0) + row.appointments_done)
      }
    }
    setYMap(ym)

    const arr = Array.from(map.values()).sort((a,b) => {
      if (b.appointments_done !== a.appointments_done) return b.appointments_done - a.appointments_done
      if (b.appointments_set !== a.appointments_set) return b.appointments_set - a.appointments_set
      return a.full_name.localeCompare(b.full_name)
    })
    setEntries(arr)
    setLastUpdate(new Date())
    setLoading(false)
  }

  function triggerReload() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => load(period), 800)
  }

  useEffect(() => {
    load(period)
    const ch = supabase.channel('lb-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard_cache' }, triggerReload)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, triggerReload)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, triggerReload)
      .subscribe()
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(ch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  const PERIODS: { value: Period; label: string }[] = [
    { value: 'today', label: 'Heute' },
    { value: 'week',  label: 'Diese Woche' },
    { value: 'month', label: 'Dieser Monat' },
    { value: 'all',   label: 'Gesamt' },
  ]

  const top3 = entries.slice(0, 3)
  const podium = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3
  const podiumIdx = top3.length === 3 ? [1, 0, 2] : top3.map((_, i) => i)

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        {PERIODS.map(p => (
          <button key={p.value} onClick={() => setPeriod(p.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${period === p.value ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'}`}>
            {p.label}
          </button>
        ))}
        <button onClick={() => load(period)} title="Manuell aktualisieren"
          className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </button>
        <button onClick={() => setShowLegend(v => !v)}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors">
          <Info className="w-3.5 h-3.5" />
          {showLegend ? 'Legende ausblenden' : 'Tier-Legende anzeigen'}
        </button>
      </div>

      {showLegend && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">🏅 Tier-System · Basis: aktuelle gelegte Termine</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {TIERS_ASC.map(t => (
              <div key={t.name} className={`px-3 py-3 rounded-lg border-2 text-center ${t.cls}`}>
                <div className="text-3xl mb-1">{t.emoji}</div>
                <div className="text-sm font-bold">{t.name}</div>
                <div className="text-[11px] mt-0.5 opacity-80 font-medium">{tierRange(t)} aktiv</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 mt-3 italic">
            💡 <strong>Aktiv = noch im Status „Termin gelegt" oder „Stattgefunden"</strong>. Entfernte/abgesagte Termine zählen nicht mehr — fair für alle.
          </p>
        </div>
      )}

      {podium.length >= 1 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {podium.map((e, displayIdx) => {
            const actualRank = podiumIdx[displayIdx]
            const tier = calcTier(e.lifetime_set)
            const isFirst = actualRank === 0
            return (
              <div key={e.setter_id}
                className={`bg-white rounded-2xl border-2 p-5 text-center relative ${
                  isFirst ? 'border-yellow-400 shadow-lg md:scale-105 md:-mt-2' :
                  actualRank === 1 ? 'border-gray-300' : 'border-orange-300'
                }`}>
                {isFirst && <div className="absolute -top-4 left-1/2 -translate-x-1/2"><Crown className="w-7 h-7 text-yellow-500 fill-yellow-400" /></div>}
                <div className={`flex justify-center mb-2 mt-2 ${isFirst ? 'ring-4 ring-yellow-200 rounded-full p-0.5 w-fit mx-auto' : ''}`}>
                  <Avatar name={e.full_name} color={e.avatar_color} size="xl" />
                </div>
                <div className="text-2xl mb-1">{MEDAL[actualRank]}</div>
                <p className="font-bold text-[#1E3A5F]">{e.full_name}</p>
                <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border mt-1.5 ${tier.cls}`}>
                  <span>{tier.emoji}</span><span>{tier.name}</span>
                </div>
                <p className="text-3xl font-bold text-[#2E75B6] mt-3">{e.appointments_done}</p>
                <p className="text-xs text-gray-600">stattgefunden</p>
                <div className="mt-3 text-xs text-gray-700 space-y-0.5 pt-2 border-t border-gray-100">
                  <p>{e.calls_made} Anrufe · {e.appointments_set} gelegt</p>
                  <p>Show-Rate: <span className="font-semibold text-gray-900">{showRate(e.appointments_set, e.appointments_done)}</span></p>
                  <p className="text-gray-400 mt-1">{e.lifetime_set} aktiv im System</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {entries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 w-14">Rang</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Setter</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Tier</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Anrufe</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Gelegt</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#2E75B6]">Stattgef. ⭐</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Show-Rate</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Aktiv</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((e, i) => {
                const tier = calcTier(e.lifetime_set)
                const trend = e.appointments_done - (yMap.get(e.setter_id) ?? 0)
                const isMe = e.setter_id === highlightId
                return (
                  <tr key={e.setter_id} className={isMe ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3 font-bold text-lg">{MEDAL[i] ?? <span className="text-gray-400 text-sm">#{i+1}</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={e.full_name} color={e.avatar_color} size="sm" />
                        <span className="font-medium text-gray-900">{e.full_name}{isMe && ' (Du)'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${tier.cls}`}>
                        <span>{tier.emoji}</span><span>{tier.name}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-900">{e.calls_made}</td>
                    <td className="px-4 py-3 text-center text-gray-900">{e.appointments_set}</td>
                    <td className="px-4 py-3 text-center font-bold text-[#2E75B6] text-base">{e.appointments_done}</td>
                    <td className="px-4 py-3 text-center text-gray-900">{showRate(e.appointments_set, e.appointments_done)}</td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">{e.lifetime_set} / {e.lifetime_done}</td>
                    <td className="px-4 py-3 text-center">
                      {trend > 0 ? <TrendingUp className="w-4 h-4 text-green-500 mx-auto" /> :
                       trend < 0 ? <TrendingDown className="w-4 h-4 text-red-500 mx-auto" /> :
                                   <Minus className="w-4 h-4 text-gray-400 mx-auto" />}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="px-4 py-2 text-[10px] text-gray-400 bg-gray-50 border-t border-gray-100">
            Aktiv = aktuell im Status „Termin gelegt" oder „Stattgefunden" · Entfernte Termine zählen nicht mehr
          </p>
        </div>
      )}

      {entries.length === 0 && !loading && (
        <div className="text-center py-16 text-gray-900">
          <p className="text-4xl mb-3">🏆</p>
          <p>Noch keine aktiven Setter</p>
        </div>
      )}
      {loading && entries.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">Lade Rangliste...</div>
      )}
    </div>
  )
}
