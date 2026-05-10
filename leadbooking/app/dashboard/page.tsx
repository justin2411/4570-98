import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ShoppingBag, Calendar, TrendingUp, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { AppointmentCard } from '@/components/appointments/appointment-card'
import { Appointment } from '@/types'

export default async function AdvisorDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Letzte gekaufte Termine
  const { data: myAppointments } = await supabase
    .from('appointments')
    .select('*')
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(3)

  // Neue verfügbare Termine
  const { data: availableAppointments } = await supabase
    .from('appointments')
    .select('*')
    .eq('status', 'available')
    .order('created_at', { ascending: false })
    .limit(3)

  const { count: totalAvailable } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'available')

  const { count: totalPurchased } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('buyer_id', user.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">
          Guten Tag, {profile?.full_name?.split(' ')[0]}!
        </h1>
        <p className="text-gray-500 mt-1">Hier ist Ihre Übersicht</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 pt-5">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <ShoppingBag className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalAvailable ?? 0}</p>
              <p className="text-sm text-gray-500">Verfügbare Termine</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-5">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalPurchased ?? 0}</p>
              <p className="text-sm text-gray-500">Meine Termine</p>
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
                {((totalPurchased ?? 0) * 100).toLocaleString('de-DE')} €
              </p>
              <p className="text-sm text-gray-500">Investiert gesamt</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Neue Termine */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Neue Termine im Marktplatz</h2>
          <Link
            href="/dashboard/marktplatz"
            className="flex items-center gap-1 text-sm text-[#2E75B6] hover:underline"
          >
            Alle ansehen <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        {availableAppointments && availableAppointments.length > 0 ? (
          <div className="grid md:grid-cols-3 gap-4">
            {availableAppointments.map((a) => (
              <AppointmentCard key={a.id} appointment={a as Appointment} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              Aktuell keine neuen Termine verfügbar.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Meine letzten Termine */}
      {myAppointments && myAppointments.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Zuletzt gekaufte Termine</h2>
            <Link
              href="/dashboard/meine-termine"
              className="flex items-center gap-1 text-sm text-[#2E75B6] hover:underline"
            >
              Alle ansehen <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {myAppointments.map((a) => (
              <AppointmentCard key={a.id} appointment={a as Appointment} showBuyButton={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
