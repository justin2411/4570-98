export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LeadList } from './lead-list'
import { getLeadProbabilityScorer } from '@/lib/lead-probability'
import { isHandyLead } from '@/lib/handy-check'
import type { Lead } from '@/types'

export default async function SetterLeadsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: leadsRaw } = await supabase
    .from('leads')
    .select('*')
    .eq('assigned_to', user.id)

  // Sortierung: nie angerufene zuerst, dann Handynummern, dann Probability-Score,
  // dann Lead-Score. Handys nach vorne ist Setter-Wunsch.
  const probScore = await getLeadProbabilityScorer()
  const leads = ((leadsRaw as Lead[] | null) ?? []).slice().sort((a, b) => {
    const aCalls = (a as any).call_attempts || 0
    const bCalls = (b as any).call_attempts || 0
    if (aCalls !== bCalls) return aCalls - bCalls
    const aH = isHandyLead(a) ? 1 : 0
    const bH = isHandyLead(b) ? 1 : 0
    if (aH !== bH) return bH - aH
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
