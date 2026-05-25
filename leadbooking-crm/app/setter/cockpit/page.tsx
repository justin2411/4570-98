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

  // Cluster-Content laden (Skript/Branding/Templates pro Liste)
  const { data: clusterContent } = await supabase.from('cluster_content').select('*')

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

  // 2) Frische Leads (neu + angerufen)
  const { data: neueLeads } = await supabase
    .from('leads')
    .select('*')
    .eq('assigned_to', user.id)
    .in('status', ['neu', 'angerufen'])
    .order('score', { ascending: false })
    .order('call_attempts', { ascending: true, nullsFirst: true })
    .limit(100)

  // 3) Nicht erreicht — nur wenn Wartezeit abgelaufen
  const { data: nichtErreicht } = await supabase
    .from('leads')
    .select('*')
    .eq('assigned_to', user.id)
    .eq('status', 'nicht_erreicht')
    .or(`recall_date.is.null,recall_date.lte.${now}`)
    .order('call_attempts', { ascending: true, nullsFirst: true })
    .order('last_call_attempt', { ascending: true, nullsFirst: true })
    .limit(100)

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

  return <CockpitClient initialDeck={deck} setter={profile as Profile} clusterContent={(clusterContent ?? []) as never[]} />
}
