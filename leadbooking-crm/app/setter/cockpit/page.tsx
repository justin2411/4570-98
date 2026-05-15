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

  // Smart-Deck: Wiedervorlagen fällig → nicht_erreicht → neu/angerufen
  // Limit 50 für die initial-Ladung
  const now = new Date().toISOString()

  const { data: wiedervorlagen } = await supabase
    .from('leads')
    .select('*')
    .eq('assigned_to', user.id)
    .eq('status', 'wiedervorlage')
    .lte('recall_date', now)
    .order('recall_date', { ascending: true })
    .limit(50)

  const { data: nichtErreicht } = await supabase
    .from('leads')
    .select('*')
    .eq('assigned_to', user.id)
    .eq('status', 'nicht_erreicht')
    .order('last_call_attempt', { ascending: true, nullsFirst: true })
    .limit(50)

  const { data: neueLeads } = await supabase
    .from('leads')
    .select('*')
    .eq('assigned_to', user.id)
    .in('status', ['neu', 'angerufen'])
    .order('score', { ascending: false })
    .limit(50)

  // Zusammen-Deck: Wiedervorlagen zuerst, dann nicht_erreicht, dann neu
  // Dedupliziert per ID (sollte eh keine Dopplungen geben)
  const seen = new Set<string>()
  const deck: Lead[] = []
  for (const list of [wiedervorlagen, nichtErreicht, neueLeads]) {
    for (const lead of list || []) {
      if (!seen.has(lead.id)) {
        seen.add(lead.id)
        deck.push(lead as Lead)
      }
    }
  }

  return <CockpitClient initialDeck={deck} setter={profile as Profile} />
}
