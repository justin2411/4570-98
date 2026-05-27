export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CockpitClient } from './cockpit-client'
import type { Lead, Profile } from '@/types'
import { getLeadProbabilityScorer } from '@/lib/lead-probability'
import { filterBlacklistedLeads } from '@/lib/blacklist'

export default async function CockpitPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date().toISOString()

  // Alle Lade-Queries parallel (statt nacheinander) → schnellerer Cockpit-Start.
  // "kein_interesse" und "nicht_erreicht" werden BEWUSST NICHT geladen
  // (Setter-Entscheidung: einmal abgelehnt/nicht-erreicht = endgültig aus dem Cockpit).
  // Wer explizit nochmal versuchen will, nutzt "Wiedervorlage".
  const [
    { data: profile },
    { data: clusterContent },
    { data: wiedervorlagen },
    { data: neueLeads },
  ] = await Promise.all([
    // Setter-Profil
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    // Cluster-Content (Skript/Branding/Templates pro Liste)
    supabase.from('cluster_content').select('*'),
    // 1) Fällige Wiedervorlagen (explizit vom Setter geplant)
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
  ])

  if (!profile) {
    return (
      <div className="p-8 text-center text-red-600">
        Profil nicht gefunden. Bitte neu anmelden.
      </div>
    )
  }

  // Frische Leads zusätzlich nach Wahrscheinlichkeit sortieren:
  // 1) call_attempts asc (nie angerufene zuerst),
  // 2) Probability-Score desc (gelernt aus termin_gelegt-Historie, Fallback Quality),
  // 3) score desc (vorhandener Lead-Score als Feintiebreaker).
  const probScore = await getLeadProbabilityScorer()
  const neueLeadsSorted = ((neueLeads as Lead[] | null) ?? []).slice().sort((a, b) => {
    const aCalls = (a as any).call_attempts || 0
    const bCalls = (b as any).call_attempts || 0
    if (aCalls !== bCalls) return aCalls - bCalls
    const aQ = probScore(a)
    const bQ = probScore(b)
    if (aQ !== bQ) return bQ - aQ
    return ((b as any).score || 0) - ((a as any).score || 0)
  })

  const seen = new Set<string>()
  const rawDeck: Lead[] = []
  for (const list of [wiedervorlagen, neueLeadsSorted]) {
    for (const lead of list || []) {
      if (!seen.has(lead.id)) {
        seen.add(lead.id)
        rawDeck.push(lead as Lead)
      }
    }
  }
  // Defense in Depth: Telefonnummern, die in der Blacklist stehen
  // (kein_interesse-Historie), werden hart rausgefiltert — selbst falls
  // ein re-importierter Lead irgendwie als neu/angerufen ins Deck rutscht.
  const deck = await filterBlacklistedLeads(rawDeck)

  return <CockpitClient initialDeck={deck} setter={profile as Profile} clusterContent={(clusterContent ?? []) as never[]} />
}
