import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { AppointmentTypeBadge, StatusBadge } from '@/components/ui/badge'
import { formatDate, formatDateTime } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { List, PlusCircle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function SetterTerminePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: appointments } = await supabase
    .from('appointments')
    .select('*')
    .eq('setter_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">Meine Termine</h1>
          <p className="text-gray-500 mt-1">
            {appointments?.length ?? 0} {(appointments?.length ?? 0) === 1 ? 'Termin' : 'Termine'} angelegt
          </p>
        </div>
        <Link href="/setter/termin-anlegen">
          <Button className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4" /> Neuer Termin
          </Button>
        </Link>
      </div>

      {appointments && appointments.length > 0 ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Typ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Beruf</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Region</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Datum</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Angelegt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {appointments.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <AppointmentTypeBadge type={a.type} />
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">{a.profession}</td>
                    <td className="px-6 py-4 text-gray-600">{a.region}, {a.state}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {a.type === 'planned' && a.appointment_date
                        ? formatDateTime(a.appointment_date)
                        : a.completed_date
                        ? formatDate(a.completed_date)
                        : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {formatDate(a.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={List}
          title="Noch keine Termine angelegt"
          description="Legen Sie Ihren ersten Termin an, um ihn auf dem Marktplatz anzubieten."
          action={
            <Link href="/setter/termin-anlegen">
              <Button>
                <PlusCircle className="w-4 h-4 mr-2" /> Termin anlegen
              </Button>
            </Link>
          }
        />
      )}
    </div>
  )
}
