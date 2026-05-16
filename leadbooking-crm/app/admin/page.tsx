export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, FileText, Phone, CheckCircle, Clock } from 'lucide-react'
import { StatCard } from '@/components/ui/stat-card'
import { LeaderboardTable } from '@/components/leaderboard/table'
import { DashboardActivities, ActivityItem } from './dashboard-activities'

// ============================================================
// Status, die als "Anruf gemacht" gewertet werden
// (alle außer 'neu' — der Setter hat den Lead bearbeitet)
// ============================================================
const CALL_STATUSES = [
  'angerufen',
  'nicht_erreicht',
  'wiedervorlage',
  'termin_gelegt',
  'termin_stattgefunden',
  'kein_interesse',
]

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const [
    { count: setterCount },
    { count: leadCount },
    { data: todayLog },
    { data: recentActivity },
    { count: recallsToday },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'setter').eq('is_active', true),
    supabase.from('leads').select('*', { count: 'exact', head: true }),
    supabase.from('activity_log').select('lead_id, new_status').gte('created_at', today),
    supabase.from('activity_log')
      .select('id, setter_id, lead_id, new_status, created_at, profiles(full_name, avatar_color), leads(name)')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(5000),
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('status', 'wiedervorlage')
      .gte('recall_date', today)
      .lt('recall_date', tomorrowStr),
  ])

  const callsToday = new Set((todayLog ?? []).filter(x => CALL_STATUSES.includes(x.new_status)).map(x => x.lead_id)).size
  const terminToday = new Set((todayLog ?? []).filter(x => x.new_status === 'termin_stattgefunden').map(x => x.lead_id)).size

  const activities: ActivityItem[] = (recentActivity ?? []).map((log: Record<string, unknown>) => {
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

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-[#1E3A5F]">Admin Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Aktive Setter" value={setterCount ?? 0} icon={<Users className="w-5 h-5" />} />
        <StatCard label="Leads gesamt" value={leadCount ?? 0} icon={<FileText className="w-5 h-5" />} />
        <StatCard label="Anrufe heute" value={callsToday} icon={<Phone className="w-5 h-5" />} color="text-yellow-600" />
        <StatCard label="Stattgefunden" value={terminToday} icon={<CheckCircle className="w-5 h-5" />} color="text-green-600" />
        <StatCard label="Wiedervorl. heute" value={recallsToday ?? 0} icon={<Clock className="w-5 h-5" />} color="text-purple-600" />
      </div>

      <section>
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Rangliste</h2>
        <LeaderboardTable />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Aktivitäten pro Setter</h2>
        <DashboardActivities initial={activities} />
      </section>
    </div>
  )
}
