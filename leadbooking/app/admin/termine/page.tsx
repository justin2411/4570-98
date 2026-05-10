import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { AppointmentTypeBadge, StatusBadge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { Calendar } from 'lucide-react'
import { AdminTerminActions } from './actions'

interface SearchParams {
  type?: string
  status?: string
}

export default async function AdminTerminePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams

  let query = supabase
    .from('appointments')
    .select('*, setter:setter_id(full_name, email), buyer:buyer_id(full_name, email)')
    .order('created_at', { ascending: false })

  if (params.type) query = query.eq('type', params.type)
  if (params.status) query = query.eq('status', params.status)

  const { data: appointments } = await query

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Alle Termine</h1>
        <p className="text-gray-500 mt-1">{appointments?.length ?? 0} Termine insgesamt</p>
      </div>

      {/* Filter */}
      <div className="flex gap-3 flex-wrap">
        <a
          href="/admin/termine"
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!params.type && !params.status ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          Alle
        </a>
        {[
          { label: '🟡 Geplant', type: 'planned', status: undefined },
          { label: '🟢 Stattgefunden', type: 'completed', status: undefined },
          { label: 'Verfügbar', type: undefined, status: 'available' },
          { label: 'Verkauft', type: undefined, status: 'sold' },
        ].map(({ label, type, status }) => {
          const url = new URLSearchParams()
          if (type) url.set('type', type)
          if (status) url.set('status', status)
          const isActive =
            (type ? params.type === type : !params.type) &&
            (status ? params.status === status : !params.status) &&
            (type || status)
          return (
            <a
              key={label}
              href={`/admin/termine?${url.toString()}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {label}
            </a>
          )
        })}
      </div>

      {appointments && appointments.length > 0 ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Typ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Beruf</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Region</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Setter</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Käufer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Angelegt</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {appointments.map((a: any) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><AppointmentTypeBadge type={a.type} /></td>
                    <td className="px-4 py-3 font-medium text-gray-900">{a.profession}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{a.region}, {a.state}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{a.setter?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{a.buyer?.full_name ?? '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(a.created_at)}</td>
                    <td className="px-4 py-3">
                      <AdminTerminActions appointmentId={a.id} currentStatus={a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState icon={Calendar} title="Keine Termine gefunden" />
      )}
    </div>
  )
}
