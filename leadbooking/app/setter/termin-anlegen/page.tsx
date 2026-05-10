import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TerminAnlegenForm } from './form'

export default async function TerminAnlegenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Neuen Termin anlegen</h1>
        <p className="text-gray-500 mt-1">
          Alle Felder ausfüllen. Der Preis ist immer 100 €.
        </p>
      </div>
      <TerminAnlegenForm setterId={user.id} />
    </div>
  )
}
