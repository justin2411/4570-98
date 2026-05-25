export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminLeadsClient } from './client'

export default async function AdminLeadsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Alle Leads in Batches laden
  let allLeads: Record<string, unknown>[] = []
  let from = 0
  const batchSize = 1000
  while (true) {
    const { data: batch } = await supabase
      .from('leads')
      .select('*, profiles!leads_assigned_to_fkey(full_name, avatar_color)')
      .order('created_at', { ascending: false })
      .range(from, from + batchSize - 1)
    if (!batch || batch.length === 0) break
    allLeads = [...allLeads, ...batch]
    if (batch.length < batchSize) break
    from += batchSize
  }

  const { data: setters } = await supabase
    .from('profiles').select('id, full_name, avatar_color').eq('role', 'setter').eq('is_active', true).order('full_name')

  // Welche Cluster sind "fertig"? = cluster_content mit Branding (firma) UND Skript gefüllt
  const { data: cc } = await supabase.from('cluster_content').select('list_name, firma, script')
  const readyClusters = (cc ?? [])
    .filter((c: { firma?: string; script?: string }) => (c.firma || '').trim() !== '' && (c.script || '').trim() !== '')
    .map((c: { list_name: string }) => c.list_name)

  return <AdminLeadsClient initialLeads={allLeads as never[]} setters={setters ?? []} adminId={user.id} readyClusters={readyClusters} />
}
