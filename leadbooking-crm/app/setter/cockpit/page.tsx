export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CockpitClient } from './cockpit-client'
import type { Lead, Profile } from '@/types'
import { getLeadProbabilityScorer } from '@/lib/lead-probability'
import { filterBlacklistedLeads } from '@/lib/blacklist'

export default async function CockpitPage({ searchParams }: { searchParams: Promise<{ list?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const listFilter = (sp.list || '').trim()

  const now = new Date().toISOString()

  // Optional Listen-Filter (?list=Heilpraktiker oder ?list=__none__) auf die
  // Lead-Queries anwenden, ohne die bestehende Logik zu duplizieren.
  function applyListFilter<T extends { eq: (col: string, val: string) => any; is: (col: string, val: null) => any }>(q: T): T {
    if (!listFilter) return q
    if (listFilter === '__none__') return q.is('list_name', null) as T
    return q.eq('list_name', listFilter) as T
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
    { data: listAggregate },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('cluster_content').select('*'),
    applyListFilter(wiedervorlagenQ as any),
    applyListFilter(neueQ as any),
    // Counts pro Liste für die Switcher-Reihe — alle offenen Leads des
    // Setters, unabhängig vom aktiven Filter.
    supabase.from('leads').select('list_name')
      .eq('assigned_to', user.id)
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
  const deck = await filterBlacklistedLeads(rawDeck)

  // Available-Lists für die Switcher-Chip-Reihe
  const listCounts: Record<string, number> = {}
  let noListCount = 0
  for (const row of (listAggregate || []) as Array<{ list_name: string | null }>) {
    const n = (row.list_name || '').trim()
    if (!n) noListCount++
    else listCounts[n] = (listCounts[n] || 0) + 1
  }
  const availableLists = Object.entries(listCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))
  const totalOpen = availableLists.reduce((s, l) => s + l.count, 0) + noListCount

  return (
    <CockpitClient
      initialDeck={deck}
      setter={profile as Profile}
      clusterContent={(clusterContent ?? []) as never[]}
      availableLists={availableLists}
      noListCount={noListCount}
      totalOpen={totalOpen}
      activeList={listFilter}
    />
  )
}
