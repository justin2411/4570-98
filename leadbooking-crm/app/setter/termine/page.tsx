export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TermineClient } from './client'
import type { Lead, Profile } from '@/types'

export default async function TerminePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Lade ALLE Termine mit Status 'termin_gelegt' — auch ohne Datum oder in der Vergangenheit
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('assigned_to', user.id)
    .eq('status', 'termin_gelegt')
    .order('appointment_date', { ascending: true, nullsFirst: true })

  return (
    <TermineClient
      initialLeads={(leads as Lead[]) || []}
      setter={profile as Profile}
    />
  )
}
