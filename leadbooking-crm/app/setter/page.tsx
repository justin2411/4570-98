export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Phone, Calendar, CheckCircle, TrendingUp, Flame } from 'lucide-react'
import { StatCard } from '@/components/ui/stat-card'
import { calcShowRate } from '@/lib/utils'
import { SetterLeaderboard } from './leaderboard'

export default async function SetterDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
  const weekStartStr = weekStart.toISOString().split('T')[0]

  const [{ data: todayLog }, { data: weekLog }, { data: profile }] = await Promise.all([
    supabase.from('activity_log').select('new_status').eq('setter_id', user.id).gte('created_at', today),
    supabase.from('activity_log').select('new_status').eq('setter_id', user.id).gte('created_at', weekStartStr),
    supabase.from('profiles').select('full_name, avatar_color').eq('id', user.id).single(),
  ])

  function calcStats(log: { new_status: string }[] | null) {
    const l = log ?? []
    return {
      calls: l.filter(x => ['angerufen','nicht_erreicht','termin_gelegt','termin_stattgefunden'].includes(x.new_status)).length,
      set: l.filter(x => x.new_status === 'termin_gelegt').length,
      done: l.filter(x => x.new_status === 'termin_stattgefunden').length,
    }
  }

  const today_ = calcStats(todayLog)
  const week_ = calcStats(weekLog)

  // Streak berechnen
  const { data: streakLog } = await supabase
    .from('activity_log')
    .select('created_at')
    .eq('setter_id', user.id)
    .eq('new_status', 'termin_stattgefunden')
    .order('created_at', { ascending: false })

  const streakDays = new Set((streakLog ?? []).map(x => x.created_at.split('T')[0]))
  let streak = 0
  const now = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    if (streakDays.has(d.toISOString().split('T')[0])) streak++
    else break
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">
          Hallo, {profile?.full_name ?? 'Setter'} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">Dein heutiger Überblick</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Heute</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Anrufe" value={today_.calls} icon={<Phone className="w-5 h-5" />} />
          <StatCard label="Termine gelegt" value={today_.set} icon={<Calendar className="w-5 h-5" />} color="text-yellow-600" />
          <StatCard label="Stattgefunden" value={today_.done} icon={<CheckCircle className="w-5 h-5" />} color="text-green-600" />
          <StatCard label="Conversion" value={`${calcShowRate(today_.calls, today_.set)}%`} icon={<TrendingUp className="w-5 h-5" />} color="text-purple-600" />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Diese Woche</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Anrufe" value={week_.calls} icon={<Phone className="w-5 h-5" />} />
          <StatCard label="Termine gelegt" value={week_.set} icon={<Calendar className="w-5 h-5" />} color="text-yellow-600" />
          <StatCard label="Stattgefunden" value={week_.done} icon={<CheckCircle className="w-5 h-5" />} color="text-green-600" />
          <StatCard label="Show-Rate" value={`${calcShowRate(week_.set, week_.done)}%`} icon={<TrendingUp className="w-5 h-5" />} color="text-purple-600" />
        </div>
      </section>

      {streak > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
          <Flame className="w-6 h-6 text-orange-500" />
          <div>
            <p className="font-semibold text-orange-700">{streak} Tage Streak! 🔥</p>
            <p className="text-sm text-orange-600">Du hast {streak} Tage in Folge mindestens ein stattgefundenes Termin!</p>
          </div>
        </div>
      )}

      <SetterLeaderboard currentSetterId={user.id} />
    </div>
  )
}
