'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/avatar'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface Entry {
  setter_id: string; full_name: string; avatar_color: string
  calls_made: number; appointments_set: number; appointments_done: number; points: number
}
type Period = 'today' | 'week' | 'month' | 'all'
const MEDAL = ['🥇', '🥈', '🥉']
const CROWN = ['👑', '', '']

function showRate(set: number, done: number) {
  if (set === 0) return '–'
  return Math.round((done / set) * 100) + '%'
}

export function LeaderboardTable({ highlightId }: { highlightId?: string }) {
  const supabase = createClient()
  const [entries, setEntries] = useState<Entry[]>([])
  const [period, setPeriod] = useState<Period>('week')
  const [yMap, setYMap] = useState<Map<string, number>>(new Map())

  async function load(p: Period) {
    let from: string | null = null
    const now = new Date()
    if (p === 'today') from = now.toISOString().split('T')[0]
    else if (p === 'week') { const d = new Date(now); d.setDate(d.getDate() - d.getDay() + 1); from = d.toISOString().split('T')[0] }
    else if (p === 'month') { from = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01` }

    const { data: allSetters } = await supabase.from('profiles').select('id, full_name, avatar_color').eq('role','setter').eq('is_active',true)
    let q = supabase.from('leaderboard_cache').select('setter_id, calls_made, appointments_set, appointments_done, points, profiles(full_name, avatar_color)')
    if (from) q = q.gte('date', from)
    const { data } = await q

    const yest = new Date(now); yest.setDate(yest.getDate()-1)
    const { data: yData } = await supabase.from('leaderboard_cache').select('setter_id, appointments_done').eq('date', yest.toISOString().split('T')[0])
    const ym = new Map<string, number>()
    for (const r of yData ?? []) ym.set(r.setter_id, (ym.get(r.setter_id) ?? 0) + r.appointments_done)
    setYMap(ym)

    const map = new Map<string, Entry>()
    for (const s of allSetters ?? []) map.set(s.id, { setter_id: s.id, full_name: s.full_name ?? '?', avatar_color: s.avatar_color ?? '#2E75B6', calls_made: 0, appointments_set: 0, appointments_done: 0, points: 0 })
    for (const row of data ?? []) {
      const pr = row.profiles as unknown as { full_name: string; avatar_color: string } | null
      const e = map.get(row.setter_id)
      if (e) { e.calls_made += row.calls_made; e.appointments_set += row.appointments_set; e.appointments_done += row.appointments_done; e.points += row.points }
      else map.set(row.setter_id, { setter_id: row.setter_id, full_name: pr?.full_name ?? '?', avatar_color: pr?.avatar_color ?? '#2E75B6', calls_made: row.calls_made, appointments_set: row.appointments_set, appointments_done: row.appointments_done, points: row.points })
    }
    setEntries(Array.from(map.values()).sort((a,b) => b.appointments_done - a.appointments_done))
  }

  useEffect(() => {
    load(period)
    const ch = supabase.channel('lb').on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard_cache' }, () => load(period)).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [period])

  const PERIODS = [{ value: 'today', label: 'Heute' }, { value: 'week', label: 'Diese Woche' }, { value: 'month', label: 'Dieser Monat' }, { value: 'all', label: 'Gesamt' }] as { value: Period; label: string }[]

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {PERIODS.map(p => <button key={p.value} onClick={() => setPeriod(p.value)} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${period === p.value ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'}`}>{p.label}</button>)}
      </div>

      {entries.length >= 1 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {entries.slice(0,3).map((e,i) => (
            <div key={e.setter_id} className={`bg-white rounded-2xl border-2 p-5 text-center relative ${i===0?'border-yellow-400 shadow-lg':i===1?'border-gray-300':'border-orange-300'}`}>
              {CROWN[i] && <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-2xl">{CROWN[i]}</div>}
              <div className="flex justify-center mb-2 mt-2"><Avatar name={e.full_name} color={e.avatar_color} size="xl" /></div>
              <div className="text-2xl mb-1">{MEDAL[i]}</div>
              <p className="font-bold text-[#1E3A5F]">{e.full_name}</p>
              <p className="text-3xl font-bold text-[#2E75B6] mt-2">{e.appointments_done}</p>
              <p className="text-xs text-gray-900">Termine stattgefunden</p>
              <div className="mt-3 text-xs text-gray-900 space-y-0.5">
                <p>{e.calls_made} Anrufe · {e.appointments_set} gelegt</p>
                <p>Show-Rate: {showRate(e.appointments_set, e.appointments_done)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {entries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 w-12">Rang</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Name</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-900">Anrufe</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-900">Gelegt</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-900">Stattgef.</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-900">Show-Rate</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-900">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((e,i) => {
                const trend = e.appointments_done - (yMap.get(e.setter_id) ?? 0)
                const isMe = e.setter_id === highlightId
                return (
                  <tr key={e.setter_id} className={isMe ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3 font-bold text-lg">{MEDAL[i] ?? `#${i+1}`}</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><Avatar name={e.full_name} color={e.avatar_color} size="sm" /><span className="font-medium text-gray-900">{e.full_name}{isMe && ' (Du)'}</span></div></td>
                    <td className="px-4 py-3 text-center text-gray-900">{e.calls_made}</td>
                    <td className="px-4 py-3 text-center text-gray-900">{e.appointments_set}</td>
                    <td className="px-4 py-3 text-center font-bold text-[#2E75B6]">{e.appointments_done}</td>
                    <td className="px-4 py-3 text-center text-gray-900">{showRate(e.appointments_set, e.appointments_done)}</td>
                    <td className="px-4 py-3 text-center">{trend > 0 ? <TrendingUp className="w-4 h-4 text-green-500 mx-auto" /> : trend < 0 ? <TrendingDown className="w-4 h-4 text-red-500 mx-auto" /> : <Minus className="w-4 h-4 text-gray-400 mx-auto" />}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {entries.length === 0 && <div className="text-center py-16 text-gray-900"><p className="text-4xl mb-3">🏆</p><p>Noch keine Setter angelegt</p></div>}
    </div>
  )
}
