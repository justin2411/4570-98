import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppointmentCard } from '@/components/appointments/appointment-card'
import { MarktplatzFilter } from './filter'
import { Appointment } from '@/types'
import { PROFESSIONS, STATES } from '@/types'
import { EmptyState } from '@/components/ui/empty-state'
import { ShoppingBag } from 'lucide-react'

interface SearchParams {
  type?: string
  profession?: string
  state?: string
  sort?: string
}

export default async function MarktplatzPage({
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
    .select('*')
    .eq('status', 'available')

  if (params.type && (params.type === 'planned' || params.type === 'completed')) {
    query = query.eq('type', params.type)
  }
  if (params.profession) {
    query = query.eq('profession', params.profession)
  }
  if (params.state) {
    query = query.eq('state', params.state)
  }

  if (params.sort === 'oldest') {
    query = query.order('created_at', { ascending: true })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  const { data: appointments } = await query

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Marktplatz</h1>
        <p className="text-gray-500 mt-1">
          {appointments?.length ?? 0} verfügbare{' '}
          {(appointments?.length ?? 0) === 1 ? 'Termin' : 'Termine'}
        </p>
      </div>

      <MarktplatzFilter
        professions={PROFESSIONS as unknown as string[]}
        states={STATES as unknown as string[]}
        currentType={params.type}
        currentProfession={params.profession}
        currentState={params.state}
        currentSort={params.sort}
      />

      {appointments && appointments.length > 0 ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {appointments.map((a) => (
            <AppointmentCard key={a.id} appointment={a as Appointment} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ShoppingBag}
          title="Keine Termine gefunden"
          description="Versuchen Sie andere Filter oder schauen Sie später wieder vorbei."
        />
      )}
    </div>
  )
}
