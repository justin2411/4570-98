'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/avatar'
import { calcShowRate } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface Entry {
  setter_id: string
  full_name: string
  avatar_color: string
  appointments_set: number
  appointments_done: number
  points: number
  trend?: number
}

type Period = 'today' | 'week' | 'month' | 'all'

const MEDAL = ['🥇', '🥈', '🥉']
const CROWN = ['👑', '', '']

interface Props {
  _showDetails?: boolean
  highlightId?: string
}

export function LeaderboardTable({ highlightId }: Props) {
  const supabase = createClient()
  const [entries, setEntries] = useState<Entry[]>([])
  const [period, setPeriod] = useState<Period>('week')
  const [yesterdayEntries, setYesterdayEntries] = useState<Map<string, number>>(new Map())

  async function load(p: Period) {
    let from: string | null = null
    const now = new Date()
    if (p === 'today') from = now.toISOString().split('T')[0]
    else if (p === 'week') {
      const d = new Date(now); d.setDate(d.getDate() - d.getDay() + 1); from = d.toISOString().split('T')[0]
    } else if (p === 'month') {
      from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    }

    let query = supabase.from('leaderboard_cache').select('setter_id, appointments_set, appointments_done, points, profiles(full_name, avatar_color)')
    if (from) query = query.gte('date', from)

    const { data } = await query

    // Yesterday for trend
    const yest = new Date(now); yest.setDate(yest.getDate() - 1)
    const yStr = yest.toISOString().split('T')[0]
    const { data: yData } = await supabase.from('leaderboard_cache').select('setter_id, points').eq('date', yStr)
    const yMap = new Map<string, number>()
    for (const r of yData ?? []) {
      yMap.set(r.setter_id, (yMap.get(r.setter_id) ?? 0) + r.points)
    }
    setYesterdayEntries(yMap)

    if (!data) return
    const map = new Map<string, Entry>()
    for (const row of data) {
      const pr = row.profiles as unknown as { full_name: string; avatar_color: string } | null
      const e = map.get(row.setter_id)
      if (e) {
        e.appointments_set += row.appointments_set
        e.appointments_done += row.appointments_done
        e.points += row.points
      } else {
        map.set(row.setter_id, {
          setter_id: row.setter_id, full_name: pr?.full_name ?? '?',
          avatar_color: pr?.avatar_color ?? '#2E75B6',
          appointments_set: row.appointments_set,
          appointments_done: row.appointments_done, points: row.points,
        })
      }
    }
    setEntries(Array.from(map.values()).sort((a, b) => b.points - a.points))
  }

  useEffect(() => {
    load(period)
    const ch = supabase.channel('lb-public').on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard_cache' }, () => load(period)).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [period])

  const PERIODS: { value: Period; label: string }[] = [
    { value: 'today', label: 'Heute' },
    { value: 'week', label: 'Diese Woche' },
    { value: 'month', label: 'Dieser Monat' },
    { value: 'all', label: 'Gesamt' },
  ]

  return (
    <div className="space-y-4">
      {/* Period filter */}
      <div className="flex gap-2 flex-wrap">
        {PERIODS.map(p => (
          <button key={p.value} onClick={() => setPeriod(p.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${period === p.value ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Top 3 cards */}
      {entries.length >= 1 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {entries.slice(0, 3).map((e, i) => (
            <div key={e.setter_id} className={`bg-white rounded-2xl border-2 p-5 text-center relative ${i === 0 ? 'border-yellow-400 shadow-lg shadow-yellow-100' : i === 1 ? 'border-gray-300' : 'border-orange-300'}`}>
              {CROWN[i] && <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-2xl">{CROWN[i]}</div>}
              <div className="flex justify-center mb-2 mt-2">
                <Avatar name={e.full_name} color={e.avatar_color} size="xl" />
              </div>
              <div className="text-2xl mb-1">{MEDAL[i]}</div>
              <p className="font-bold text-[#1E3A5F]">{e.full_name}</p>
              <p className="text-3xl font-bold text-[#2E75B6] mt-2">{e.points}</p>
              <p className="text-xs text-gray-400">Punkte</p>
              <div className="mt-3 text-xs text-gray-500 space-y-0.5">
                <p>{e.appointments_set} gelegt · {e.appointments_done} stattgef.</p>
                <p>Show-Rate: {calcShowRate(e.appointments_set, e.appointments_done)}%</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full table */}
      {entries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-12">Rang</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Name</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Gelegt</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Stattgef.</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Show-Rate</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Punkte</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((e, i) => {
                const yPoints = yesterdayEntries.get(e.setter_id) ?? 0
                const trend = e.points - yPoints
                const isMe = e.setter_id === highlightId
                return (
                  <tr key={e.setter_id} className={isMe ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3 font-bold text-lg">{MEDAL[i] ?? `#${i + 1}`}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={e.full_name} color={e.avatar_color} size="sm" />
                        <span className="font-medium">{e.full_name}{isMe && ' (Du)'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">{e.appointments_set}</td>
                    <td className="px-4 py-3 text-center">{e.appointments_done}</td>
                    <td className="px-4 py-3 text-center">{calcShowRate(e.appointments_set, e.appointments_done)}%</td>
                    <td className="px-4 py-3 text-center font-bold text-[#2E75B6] text-base">{e.points}</td>
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
        </div>
      )}

      {entries.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🏆</p>
          <p>Noch keine Einträge für diesen Zeitraum</p>
        </div>
      )}
    </div>
  )
}
