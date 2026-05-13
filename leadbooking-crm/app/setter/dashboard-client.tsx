'use client'

import { useState } from 'react'
import { Phone, Calendar, CheckCircle, TrendingUp, Flame } from 'lucide-react'
import { StatCard } from '@/components/ui/stat-card'
import { LeaderboardTable } from '@/components/leaderboard/table'

interface Stats { calls: number; set: number }

interface Props {
  fullName: string
  totalDone: number
  totalSet: number
  streak: number
  stats: { today: Stats; week: Stats; month: Stats; year: Stats }
  currentSetterId: string
}

type Tab = 'today' | 'week' | 'month' | 'year'

const TABS: { value: Tab; label: string }[] = [
  { value: 'today', label: 'Heute' },
  { value: 'week', label: 'Woche' },
  { value: 'month', label: 'Monat' },
  { value: 'year', label: 'Jahr' },
]

export function DashboardClient({ fullName, totalDone, totalSet, streak, stats, currentSetterId }: Props) {
  const [tab, setTab] = useState<Tab>('today')
  const current = stats[tab]
  const showRate = totalSet > 0 ? Math.round(totalDone / totalSet * 100) + '%' : '0%'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Hallo, {fullName} 👋</h1>
        <p className="text-gray-700 text-sm mt-1">Dein Überblick</p>
      </div>

      <div className="flex gap-2">
        {TABS.map(t => (
          <button key={t.value} onClick={() => setTab(t.value)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${tab === t.value ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Anrufe" value={current.calls} icon={<Phone className="w-5 h-5" />} />
        <StatCard label="Termine gelegt" value={current.set} icon={<Calendar className="w-5 h-5" />} color="text-yellow-600" />
        <StatCard label="Stattgefunden" value={totalDone} icon={<CheckCircle className="w-5 h-5" />} color="text-green-600" />
        <StatCard label="Show-Rate" value={showRate} icon={<TrendingUp className="w-5 h-5" />} color="text-purple-600" />
      </div>

      {streak > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
          <Flame className="w-6 h-6 text-orange-500" />
          <div>
            <p className="font-semibold text-orange-700">{streak} Tage Streak! 🔥</p>
            <p className="text-sm text-orange-600">Du hast {streak} Tage in Folge mindestens ein stattgefundenes Termin!</p>
          </div>
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          🏆 Rangliste
        </h2>
        <LeaderboardTable highlightId={currentSetterId} />
      </section>
    </div>
  )
}
