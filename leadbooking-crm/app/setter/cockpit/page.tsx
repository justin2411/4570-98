export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CockpitClient } from './cockpit-client'
import type { Lead, Profile } from '@/types'
import { leadQualityScore } from '@/lib/lead-quality'

export default async function CockpitPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date().toISOString()

  // Alle Lade-Queries parallel (statt nacheinander) → schnellerer Cockpit-Start.
  const [
    { data: profile },
    { data: clusterContent },
    { data: wiedervorlagen },
    { data: neueLeads },
    { data: nichtErreicht },
  ] = await Promise.all([
    // Setter-Profil
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    // Cluster-Content (Skript/Branding/Templates pro Liste)
    supabase.from('cluster_content').select('*'),
    // 1) Fällige Wiedervorlagen
    supabase.from('leads').select('*')
      .eq('assigned_to', user.id)
      .eq('status', 'wiedervorlage')
      .lte('recall_date', now)
      .order('recall_date', { ascending: true })
      .limit(100),
    // 2) Frische Leads (neu + angerufen) — nie angerufene zuerst, dann nach Score
    supabase.from('leads').select('*')
      .eq('assigned_to', user.id)
      .in('status', ['neu', 'angerufen'])
      .order('call_attempts', { ascending: true, nullsFirst: true })
      .order('score', { ascending: false })
      .limit(100),
    // 3) Nicht erreicht — nur wenn Wartezeit abgelaufen
    supabase.from('leads').select('*')
      .eq('assigned_to', user.id)
      .eq('status', 'nicht_erreicht')
      .or(`recall_date.is.null,recall_date.lte.${now}`)
      .order('call_attempts', { ascending: true, nullsFirst: true })
      .order('last_call_attempt', { ascending: true, nullsFirst: true })
      .limit(100),
  ])

  if (!profile) {
    return (
      <div className="p-8 text-center text-red-600">
        Profil nicht gefunden. Bitte neu anmelden.
      </div>
    )
  }

  // Frische Leads zusätzlich nach Qualität sortieren:
  // 1) call_attempts asc (nie angerufene zuerst),
  // 2) Qualitäts-Score desc (Handy/Personenname/weiblich/persönliche Mail),
  // 3) score desc (vorhandener Lead-Score als Feintiebreaker).
  const neueLeadsSorted = ((neueLeads as Lead[] | null) ?? []).slice().sort((a, b) => {
    const aCalls = (a as any).call_attempts || 0
    const bCalls = (b as any).call_attempts || 0
    if (aCalls !== bCalls) return aCalls - bCalls
    const aQ = leadQualityScore(a)
    const bQ = leadQualityScore(b)
    if (aQ !== bQ) return bQ - aQ
    return ((b as any).score || 0) - ((a as any).score || 0)
  })

  const seen = new Set<string>()
  const deck: Lead[] = []
  for (const list of [wiedervorlagen, neueLeadsSorted, nichtErreicht]) {
    for (const lead of list || []) {
      if (!seen.has(lead.id)) {
        seen.add(lead.id)
        deck.push(lead as Lead)
      }
    }
  }

  return <CockpitClient initialDeck={deck} setter={profile as Profile} clusterContent={(clusterContent ?? []) as never[]} />
}
