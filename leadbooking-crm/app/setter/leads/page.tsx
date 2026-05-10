export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LeadList } from './lead-list'

export default async function SetterLeadsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('assigned_to', user.id)
    .order('score', { ascending: false })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Meine Leads</h1>
        <p className="text-gray-500 text-sm mt-1">{leads?.length ?? 0} Leads zugewiesen</p>
      </div>
      <LeadList initialLeads={leads ?? []} userId={user.id} />
    </div>
  )
}
