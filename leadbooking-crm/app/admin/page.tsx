export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, FileText, Calendar, CheckCircle } from 'lucide-react'
import { StatCard } from '@/components/ui/stat-card'
import { formatDate } from '@/lib/utils'

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  const [
    { count: setterCount },
    { count: leadCount },
    { count: callsToday },
    { count: terminToday },
    { data: recentActivity },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'setter').eq('is_active', true),
    supabase.from('leads').select('*', { count: 'exact', head: true }),
    supabase.from('activity_log').select('*', { count: 'exact', head: true })
      .gte('created_at', today)
      .in('new_status', ['angerufen', 'nicht_erreicht', 'termin_gelegt', 'termin_stattgefunden']),
    supabase.from('activity_log').select('*', { count: 'exact', head: true })
      .gte('created_at', today)
      .eq('new_status', 'termin_gelegt'),
    supabase.from('activity_log')
      .select('*, profiles(full_name), leads(name)')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const STATUS_DE: Record<string, string> = {
    neu: '⚪ Neu', angerufen: '📞 Angerufen', nicht_erreicht: '🔁 Nicht erreicht',
    termin_gelegt: '🟡 Termin gelegt', termin_stattgefunden: '🟢 Stattgefunden', kein_interesse: '🚫 Kein Interesse',
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#1E3A5F]">Admin Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Aktive Setter" value={setterCount ?? 0} icon={<Users className="w-5 h-5" />} />
        <StatCard label="Leads gesamt" value={leadCount ?? 0} icon={<FileText className="w-5 h-5" />} />
        <StatCard label="Anrufe heute" value={callsToday ?? 0} icon={<Calendar className="w-5 h-5" />} color="text-yellow-600" />
        <StatCard label="Termine heute" value={terminToday ?? 0} icon={<CheckCircle className="w-5 h-5" />} color="text-green-600" />
      </div>

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Live-Aktivitäten</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {recentActivity && recentActivity.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {recentActivity.map((log) => {
                const p = log.profiles as { full_name: string } | null
                const l = log.leads as { name: string } | null
                return (
                  <div key={log.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                    <div className="flex-1">
                      <span className="font-medium">{p?.full_name ?? '?'}</span>
                      <span className="text-gray-500"> → {l?.name ?? '?'}</span>
                    </div>
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{STATUS_DE[log.new_status] ?? log.new_status}</span>
                    <span className="text-xs text-gray-400">{formatDate(log.created_at)}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="p-6 text-center text-gray-400 text-sm">Noch keine Aktivitäten</p>
          )}
        </div>
      </section>
    </div>
  )
}
