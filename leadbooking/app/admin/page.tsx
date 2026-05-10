import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Users, Calendar, ShoppingBag, Euro } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { AppointmentTypeBadge, StatusBadge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // KPI Queries parallel
  const [
    { count: totalUsers },
    { count: totalAdvisors },
    { count: totalSetters },
    { count: totalAppointments },
    { count: availableCount },
    { count: soldCount },
    { count: plannedCount },
    { count: completedCount },
    { data: recentAppointments },
    { data: payments },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'advisor'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'setter'),
    supabase.from('appointments').select('*', { count: 'exact', head: true }),
    supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'available'),
    supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'sold'),
    supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('type', 'planned'),
    supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('type', 'completed'),
    supabase.from('appointments').select('*').order('created_at', { ascending: false }).limit(5),
    supabase.from('payments').select('amount').eq('status', 'completed'),
  ])

  const totalRevenue = payments?.reduce((sum, p) => sum + Number(p.amount), 0) ?? 0

  const kpis = [
    { icon: Euro, label: 'Umsatz gesamt', value: formatCurrency(totalRevenue), color: 'green' },
    { icon: ShoppingBag, label: 'Termine verkauft', value: String(soldCount ?? 0), color: 'blue' },
    { icon: Calendar, label: 'Verfügbare Termine', value: String(availableCount ?? 0), color: 'yellow' },
    { icon: Users, label: 'Nutzer gesamt', value: String(totalUsers ?? 0), color: 'purple' },
  ]

  const iconColors: Record<string, string> = {
    green: 'bg-green-100 text-green-600',
    blue: 'bg-blue-100 text-blue-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    purple: 'bg-purple-100 text-purple-600',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Admin-Dashboard</h1>
        <p className="text-gray-500 mt-1">Gesamtübersicht aller Aktivitäten</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ icon: Icon, label, value, color }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 pt-5">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColors[color]}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Statistik-Reihe */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-gray-700">Nutzer nach Rolle</h2></CardHeader>
          <CardContent className="space-y-3 pt-3">
            <StatRow label="Finanzberater" value={totalAdvisors ?? 0} color="bg-blue-500" total={totalUsers ?? 1} />
            <StatRow label="Setter" value={totalSetters ?? 0} color="bg-purple-500" total={totalUsers ?? 1} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-gray-700">Termine nach Status</h2></CardHeader>
          <CardContent className="space-y-3 pt-3">
            <StatRow label="Verfügbar" value={availableCount ?? 0} color="bg-blue-500" total={totalAppointments ?? 1} />
            <StatRow label="Verkauft" value={soldCount ?? 0} color="bg-green-500" total={totalAppointments ?? 1} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-gray-700">Termine nach Typ</h2></CardHeader>
          <CardContent className="space-y-3 pt-3">
            <StatRow label="🟡 Geplant" value={plannedCount ?? 0} color="bg-yellow-500" total={totalAppointments ?? 1} />
            <StatRow label="🟢 Stattgefunden" value={completedCount ?? 0} color="bg-green-500" total={totalAppointments ?? 1} />
          </CardContent>
        </Card>
      </div>

      {/* Neueste Termine */}
      {recentAppointments && recentAppointments.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Neueste Termine</h2>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Typ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Beruf</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Region</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Preis</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentAppointments.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3"><AppointmentTypeBadge type={a.type} /></td>
                    <td className="px-6 py-3 font-medium text-gray-900">{a.profession}</td>
                    <td className="px-6 py-3 text-gray-600">{a.region}, {a.state}</td>
                    <td className="px-6 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-6 py-3 font-medium">100 €</td>
                    <td className="px-6 py-3 text-gray-500">{formatDate(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

function StatRow({
  label,
  value,
  total,
  color,
}: {
  label: string
  value: number
  total: number
  color: string
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
