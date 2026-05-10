'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/avatar'
import { calcShowRate } from '@/lib/utils'
import { Trophy } from 'lucide-react'

interface Entry {
  setter_id: string
  full_name: string
  avatar_color: string
  appointments_set: number
  appointments_done: number
  points: number
}

const MEDAL = ['🥇', '🥈', '🥉']

export function SetterLeaderboard({ currentSetterId }: { currentSetterId: string }) {
  const supabase = createClient()
  const [entries, setEntries] = useState<Entry[]>([])

  async function load() {
    const start = new Date()
    start.setDate(start.getDate() - start.getDay() + 1)
    const { data } = await supabase
      .from('leaderboard_cache')
      .select('setter_id, appointments_set, appointments_done, points, profiles(full_name, avatar_color)')
      .gte('date', start.toISOString().split('T')[0])

    if (!data) return

    const map = new Map<string, Entry>()
    for (const row of data) {
      const p = row.profiles as unknown as { full_name: string; avatar_color: string } | null
      const existing = map.get(row.setter_id)
      if (existing) {
        existing.appointments_set += row.appointments_set
        existing.appointments_done += row.appointments_done
        existing.points += row.points
      } else {
        map.set(row.setter_id, {
          setter_id: row.setter_id,
          full_name: p?.full_name ?? '?',
          avatar_color: p?.avatar_color ?? '#2E75B6',
          appointments_set: row.appointments_set,
          appointments_done: row.appointments_done,
          points: row.points,
        })
      }
    }
    setEntries(Array.from(map.values()).sort((a, b) => b.points - a.points))
  }

  useEffect(() => {
    load()
    const ch = supabase.channel('lb').on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard_cache' }, load).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-5 h-5 text-yellow-500" />
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Rangliste diese Woche</h2>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {entries.length === 0 ? (
          <p className="p-6 text-center text-gray-400 text-sm">Noch keine Einträge diese Woche</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Rang</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Name</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Gelegt</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Stattgef.</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Show-Rate</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Punkte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((e, i) => (
                <tr key={e.setter_id} className={e.setter_id === currentSetterId ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                  <td className="px-4 py-3 font-bold text-lg">{MEDAL[i] ?? `#${i + 1}`}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={e.full_name} color={e.avatar_color} size="sm" />
                      <span className="font-medium">{e.full_name}{e.setter_id === currentSetterId && ' (Du)'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">{e.appointments_set}</td>
                  <td className="px-4 py-3 text-center">{e.appointments_done}</td>
                  <td className="px-4 py-3 text-center">{calcShowRate(e.appointments_set, e.appointments_done)}%</td>
                  <td className="px-4 py-3 text-center font-bold text-[#2E75B6]">{e.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
