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

  // Lade alle Termine ab heute
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('assigned_to', user.id)
    .eq('status', 'termin_gelegt')
    .gte('appointment_date', now.toISOString())
    .order('appointment_date', { ascending: true })

  return (
    <TermineClient
      initialLeads={(leads as Lead[]) || []}
      setter={profile as Profile}
    />
  )
}
