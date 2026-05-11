export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TermineClient } from './client'

export default async function SetterTerminePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('assigned_to', user.id)
    .in('status', ['termin_gelegt', 'termin_stattgefunden'])
    .order('appointment_date', { ascending: true })

  return <TermineClient leads={leads ?? []} />
}
