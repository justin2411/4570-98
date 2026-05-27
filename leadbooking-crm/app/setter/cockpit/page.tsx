export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CockpitClient } from './cockpit-client'
import type { Lead, Profile } from '@/types'
import { getLeadProbabilityScorer } from '@/lib/lead-probability'
import { filterBlacklistedLeads } from '@/lib/blacklist'
import { isHandyLead } from '@/lib/handy-check'

export default async function CockpitPage({ searchParams }: { searchParams: Promise<{ beruf?: string; handy?: string; prio?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const berufFilter = (sp.beruf || '').trim()
  const handyOnly = sp.handy === 'true'
  const prioOnly = sp.prio === 'true'

  const now = new Date().toISOString()

  // High-Potential-Tab überschreibt Beruf-Filter — Setter sieht ALLE
  // prio_a-Leads (any beruf) statt Beruf-spezifischer Auswahl.
  function applyScopeFilters<T extends { eq: (col: string, val: any) => any; is: (col: string, val: null) => any; or: (q: string) => any }>(q: T): T {
    if (prioOnly) return q.eq('prio_a', true) as T
    if (!berufFilter) return q
    if (berufFilter === '__none__') return q.or('beruf.is.null,beruf.eq.') as T
    return q.eq('beruf', berufFilter) as T
  }

  const wiedervorlagenQ = supabase.from('leads').select('*')
    .eq('assigned_to', user.id)
    .eq('status', 'wiedervorlage')
    .lte('recall_date', now)
    .order('recall_date', { ascending: true })
    .limit(100)
  const neueQ = supabase.from('leads').select('*')
    .eq('assigned_to', user.id)
    .in('status', ['neu', 'angerufen'])
    .order('call_attempts', { ascending: true, nullsFirst: true })
    .order('score', { ascending: false })
    .limit(100)

  const [
    { data: profile },
    { data: clusterContent },
    { data: wiedervorlagen },
    { data: neueLeads },
    { data: berufAggregate },
    { count: prioCount },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('cluster_content').select('*'),
    applyScopeFilters(wiedervorlagenQ as any),
    applyScopeFilters(neueQ as any),
    // Counts pro Beruf — alle offenen Leads des Setters, unabhängig vom Filter.
    supabase.from('leads').select('beruf')
      .eq('assigned_to', user.id)
      .in('status', ['neu', 'angerufen', 'wiedervorlage']),
    // High-Potential-Count
    supabase.from('leads').select('id', { count: 'exact', head: true })
      .eq('assigned_to', user.id)
      .eq('prio_a', true)
      .in('status', ['neu', 'angerufen', 'wiedervorlage']),
  ])

  if (!profile) {
    return (
      <div className="p-8 text-center text-red-600">
        Profil nicht gefunden. Bitte neu anmelden.
      </div>
    )
  }

  const probScore = await getLeadProbabilityScorer()
  const neueLeadsSorted = ((neueLeads as Lead[] | null) ?? []).slice().sort((a, b) => {
    const aCalls = (a as any).call_attempts || 0
    const bCalls = (b as any).call_attempts || 0
    if (aCalls !== bCalls) return aCalls - bCalls
    // Handynummern immer zuerst — Setter-Wunsch.
    const aH = isHandyLead(a) ? 1 : 0
    const bH = isHandyLead(b) ? 1 : 0
    if (aH !== bH) return bH - aH
    const aQ = probScore(a)
    const bQ = probScore(b)
    if (aQ !== bQ) return bQ - aQ
    return ((b as any).score || 0) - ((a as any).score || 0)
  })

  // Kein Default: ohne expliziten Filter bleibt das Deck leer und der
  // Setter wählt aus der Chip-Reihe oben aktiv eine Zielgruppe oder
  // den High-Potential-Tab.
  const seen = new Set<string>()
  const rawDeck: Lead[] = []
  if (berufFilter || prioOnly) for (const list of [wiedervorlagen, neueLeadsSorted]) {
    for (const lead of list || []) {
      if (!seen.has(lead.id)) {
        seen.add(lead.id)
        rawDeck.push(lead as Lead)
      }
    }
  }
  const deckAfterBlacklist = await filterBlacklistedLeads(rawDeck)
  // Optional: nur Handynummern (+49 15x/16x/17x) anzeigen
  const deck = handyOnly ? deckAfterBlacklist.filter(isHandyLead) : deckAfterBlacklist

  // Available-Berufe für die Switcher-Chip-Reihe
  const berufCounts: Record<string, number> = {}
  let noBerufCount = 0
  for (const row of (berufAggregate || []) as Array<{ beruf: string | null }>) {
    const n = (row.beruf || '').trim()
    if (!n) noBerufCount++
    else berufCounts[n] = (berufCounts[n] || 0) + 1
  }
  const availableBerufe = Object.entries(berufCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))
  const totalOpen = availableBerufe.reduce((s, l) => s + l.count, 0) + noBerufCount

  return (
    <CockpitClient
      // key forciert Remount bei jedem Filter-Wechsel — sonst behält
      // useState(initialDeck) den alten Deck-State und das Switching
      // hätte keinen sichtbaren Effekt.
      key={`${prioOnly ? 'prio' : (berufFilter || '__alle__')}|${handyOnly ? 'h' : 'a'}`}
      initialDeck={deck}
      setter={profile as Profile}
      clusterContent={(clusterContent ?? []) as never[]}
      availableBerufe={availableBerufe}
      noBerufCount={noBerufCount}
      totalOpen={totalOpen}
      activeBeruf={berufFilter}
      handyOnly={handyOnly}
      activePrio={prioOnly}
      prioCount={prioCount ?? 0}
    />
  )
}
