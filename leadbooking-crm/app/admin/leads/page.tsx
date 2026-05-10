export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminLeadsClient } from './client'

export default async function AdminLeadsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: leads }, { data: setters }] = await Promise.all([
    supabase.from('leads').select('*, profiles!leads_assigned_to_fkey(full_name, avatar_color)').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, avatar_color').eq('role', 'setter').eq('is_active', true).order('full_name'),
  ])

  return <AdminLeadsClient initialLeads={leads ?? []} setters={setters ?? []} adminId={user.id} />
}
