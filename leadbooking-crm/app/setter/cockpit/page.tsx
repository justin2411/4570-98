export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CockpitClient } from './cockpit-client'
import type { Lead, Profile } from '@/types'

export default async function CockpitPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Setter-Profil laden
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return (
      <div className="p-8 text-center text-red-600">
        Profil nicht gefunden. Bitte neu anmelden.
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────────
  // Smart-Deck Reihenfolge:
  //   1) Fällige Wiedervorlagen (explizite Zusagen — immer zuerst)
  //   2) Neue/angerufene Leads (frischeste Erfolgschance)
  //   3) Nicht erreicht — NUR wenn recall_date abgelaufen ist
  //      (mit wenigsten Versuchen zuerst — "tote" Leads landen hinten)
  // ───────────────────────────────────────────────────────────────
  const now = new Date().toISOString()

  // 1) Fällige Wiedervorlagen
  const { data: wiedervorlagen } = await supabase
    .from('leads')
    .select('*')
    .eq('assigned_to', user.id)
    .eq('status', 'wiedervorlage')
    .lte('recall_date', now)
    .order('recall_date', { ascending: true })
    .limit(100)

  // 2) Frische Leads (neu + angerufen) — hochwertige zuerst,
  //    bei Gleichstand: wenig Versuche zuerst
  const { data: neueLeads } = await supabase
    .from('leads')
    .select('*')
    .eq('assigned_to', user.id)
    .in('status', ['neu', 'angerufen'])
    .order('score', { ascending: false })
    .order('call_attempts', { ascending: true, nullsFirst: true })
    .limit(100)

  // 3) Nicht erreicht — nur wenn Wartezeit abgelaufen ist
  //    Sortiert nach: wenig Versuche zuerst, dann älteste zuletzt versucht
  const { data: nichtErreicht } = await supabase
    .from('leads')
    .select('*')
    .eq('assigned_to', user.id)
    .eq('status', 'nicht_erreicht')
    .or(`recall_date.is.null,recall_date.lte.${now}`)
    .order('call_attempts', { ascending: true, nullsFirst: true })
    .order('last_call_attempt', { ascending: true, nullsFirst: true })
    .limit(100)

  // Zusammen-Deck: Wiedervorlagen → neue Leads → nicht_erreicht (hinten!)
  const seen = new Set<string>()
  const deck: Lead[] = []
  for (const list of [wiedervorlagen, neueLeads, nichtErreicht]) {
    for (const lead of list || []) {
      if (!seen.has(lead.id)) {
        seen.add(lead.id)
        deck.push(lead as Lead)
      }
    }
  }

  return <CockpitClient initialDeck={deck} setter={profile as Profile} />
}
