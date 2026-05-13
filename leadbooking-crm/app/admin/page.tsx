export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, FileText, Phone, CheckCircle, Clock } from 'lucide-react'
import { StatCard } from '@/components/ui/stat-card'
import { LeaderboardTable } from '@/components/leaderboard/table'
import { formatDate } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = {
  angerufen: 'Angerufen', nicht_erreicht: 'Nicht erreicht',
  wiedervorlage: 'Wiedervorlage',
  termin_gelegt: 'Termin gelegt', termin_stattgefunden: 'Termin stattgefunden', kein_interesse: 'Kein Interesse',
}
const STATUS_COLORS: Record<string, string> = {
  angerufen: 'bg-blue-100 text-blue-700',
  nicht_erreicht: 'bg-orange-100 text-orange-700',
  wiedervorlage: 'bg-purple-100 text-purple-700',
  termin_gelegt: 'bg-yellow-100 text-yellow-800',
  termin_stattgefunden: 'bg-green-100 text-green-700',
  kein_interesse: 'bg-red-100 text-red-700',
}

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

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
      .select('setter_id, new_status, created_at, profiles(full_name), leads(name)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('status', 'wiedervorlage')
      .gte('recall_date', today)
      .lt('recall_date', tomorrowStr),
  ])

  // Unique leads angerufen heute (inkl. wiedervorlage)
  const callsToday = new Set((todayLog ?? []).filter(x => ['angerufen','nicht_erreicht','wiedervorlage','termin_gelegt','termin_stattgefunden'].includes(x.new_status)).map(x => x.lead_id)).size
  // Unique leads termin stattgefunden
  const terminToday = new Set((todayLog ?? []).filter(x => x.new_status === 'termin_stattgefunden').map(x => x.lead_id)).size

  // Pro Lead nur den neuesten Eintrag, dann nach Setter gruppieren
  const seenLeads = new Set<string>()
  const filtered = (recentActivity ?? []).filter(log => {
    const key = `${log.setter_id}-${(log.leads as unknown as { name: string } | null)?.name}`
    if (seenLeads.has(key)) return false
    seenLeads.add(key)
    return true
  })

  const bySetterMap = new Map<string, { setter: string; entries: typeof filtered }>()
  for (const log of filtered) {
    const setterName = (log.profiles as { full_name: string } | null)?.full_name ?? '?'
    if (!bySetterMap.has(setterName)) bySetterMap.set(setterName, { setter: setterName, entries: [] })
    bySetterMap.get(setterName)!.entries.push(log)
  }
  const bySetter = Array.from(bySetterMap.values())

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
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Live-Aktivitäten</h2>
        <div className="space-y-3">
          {bySetter.length > 0 ? bySetter.map(({ setter, entries }) => (
            <div key={setter} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                <span className="font-semibold text-gray-900 text-sm">{setter}</span>
                <span className="ml-2 text-xs text-gray-500">{entries.length} Leads</span>
              </div>
              <div className="divide-y divide-gray-100">
                {entries.map((log, i) => {
                  const l = log.leads as { name: string } | null
                  return (
                    <div key={i} className="px-4 py-3 flex items-center gap-3 text-sm">
                      <div className="flex-1 font-medium text-gray-900">{l?.name ?? '?'}</div>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[log.new_status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABELS[log.new_status] ?? log.new_status}
                      </span>
                      <span className="text-xs text-gray-900">{formatDate(log.created_at)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )) : (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-900 text-sm">
              Noch keine Aktivitäten
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
