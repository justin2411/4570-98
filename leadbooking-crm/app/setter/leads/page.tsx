export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LeadList } from './lead-list'
import { getLeadProbabilityScorer } from '@/lib/lead-probability'
import type { Lead } from '@/types'

export default async function SetterLeadsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: leadsRaw } = await supabase
    .from('leads')
    .select('*')
    .eq('assigned_to', user.id)

  // Wahrscheinlichkeit nach vorne: nie angerufene zuerst, dann nach
  // Probability-Score (gelernt aus termin_gelegt-Historie), dann Lead-Score.
  const probScore = await getLeadProbabilityScorer()
  const leads = ((leadsRaw as Lead[] | null) ?? []).slice().sort((a, b) => {
    const aCalls = (a as any).call_attempts || 0
    const bCalls = (b as any).call_attempts || 0
    if (aCalls !== bCalls) return aCalls - bCalls
    const aQ = probScore(a)
    const bQ = probScore(b)
    if (aQ !== bQ) return bQ - aQ
    return ((b as any).score || 0) - ((a as any).score || 0)
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Meine Leads</h1>
        <p className="text-gray-500 text-sm mt-1">{leads.length} Leads zugewiesen</p>
      </div>
      <LeadList initialLeads={leads} userId={user.id} />
    </div>
  )
}
