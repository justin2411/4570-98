export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Lead } from '@/types'
import { WiedervorlageClient } from './client'

export default async function WiedervorlagePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('assigned_to', user.id)
    .eq('status', 'wiedervorlage')
    .order('recall_date', { ascending: true })

  return <WiedervorlageClient leads={(leads ?? []) as Lead[]} userId={user.id} />
}
