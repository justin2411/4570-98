import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppointmentCard } from '@/components/appointments/appointment-card'
import { Appointment } from '@/types'
import { EmptyState } from '@/components/ui/empty-state'
import { Calendar } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function MeineTerminePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: appointments } = await supabase
    .from('appointments')
    .select('*')
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Meine Termine</h1>
        <p className="text-gray-500 mt-1">
          {appointments?.length ?? 0} {(appointments?.length ?? 0) === 1 ? 'Termin' : 'Termine'} gekauft
        </p>
      </div>

      {appointments && appointments.length > 0 ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {appointments.map((a) => (
            <AppointmentCard
              key={a.id}
              appointment={a as Appointment}
              showBuyButton={false}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Calendar}
          title="Noch keine Termine gekauft"
          description="Besuchen Sie den Marktplatz und kaufen Sie Ihren ersten Termin."
          action={
            <Link href="/dashboard/marktplatz">
              <Button>Zum Marktplatz</Button>
            </Link>
          }
        />
      )}
    </div>
  )
}
