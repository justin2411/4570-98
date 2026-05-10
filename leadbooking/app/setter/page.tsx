import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PlusCircle, List, TrendingUp, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { AppointmentTypeBadge, StatusBadge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

export default async function SetterDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: appointments } = await supabase
    .from('appointments')
    .select('*')
    .eq('setter_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const { count: totalCount } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('setter_id', user.id)

  const { count: soldCount } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('setter_id', user.id)
    .eq('status', 'sold')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">
          Willkommen, {profile?.full_name?.split(' ')[0]}!
        </h1>
        <p className="text-gray-500 mt-1">Setter-Portal</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 pt-5">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <List className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalCount ?? 0}</p>
              <p className="text-sm text-gray-500">Termine angelegt</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-5">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{soldCount ?? 0}</p>
              <p className="text-sm text-gray-500">Verkauft</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-5">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {((soldCount ?? 0) * 100).toLocaleString('de-DE')} €
              </p>
              <p className="text-sm text-gray-500">Umsatz generiert</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schnellaktionen */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Link href="/setter/termin-anlegen">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-2 border-dashed border-[#2E75B6]/30 hover:border-[#2E75B6]">
            <CardContent className="flex items-center gap-4 pt-5 pb-5">
              <div className="w-12 h-12 rounded-xl bg-[#1E3A5F] flex items-center justify-center flex-shrink-0">
                <PlusCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-semibold text-[#1E3A5F]">Neuen Termin anlegen</p>
                <p className="text-sm text-gray-500">Geplant oder stattgefunden</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 ml-auto" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/setter/termine">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-4 pt-5 pb-5">
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <List className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Meine Termine</p>
                <p className="text-sm text-gray-500">Alle angelegten Termine</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 ml-auto" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Letzte Termine */}
      {appointments && appointments.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Letzte Termine</h2>
            <Link href="/setter/termine" className="text-sm text-[#2E75B6] hover:underline">
              Alle ansehen
            </Link>
          </div>
          <Card>
            <div className="divide-y divide-gray-100">
              {appointments.map((a) => (
                <div key={a.id} className="px-6 py-4 flex items-center gap-4">
                  <AppointmentTypeBadge type={a.type} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{a.profession}</p>
                    <p className="text-sm text-gray-500 truncate">{a.region}, {a.state}</p>
                  </div>
                  <StatusBadge status={a.status} />
                  <span className="text-xs text-gray-400 hidden sm:block">
                    {formatDate(a.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
