import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/admin/reset-rangliste
 * Setzt alle Ranglisten-/Statistikdaten aller Setter auf 0.
 * Admin-only. Operationen:
 *   1) activity_log komplett leeren
 *   2) leaderboard_cache komplett leeren
 *   3) Leads im Status termin_gelegt / termin_stattgefunden zurücksetzen
 *      auf 'angerufen' + appointment_date = null
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })

  const { error: e1 } = await supabase.from('activity_log').delete().not('id', 'is', null)
  if (e1) return NextResponse.json({ error: 'activity_log: ' + e1.message }, { status: 500 })

  const { error: e2 } = await supabase.from('leaderboard_cache').delete().not('id', 'is', null)
  if (e2) return NextResponse.json({ error: 'leaderboard_cache: ' + e2.message }, { status: 500 })

  const { error: e3 } = await supabase
    .from('leads')
    .update({ status: 'angerufen', appointment_date: null })
    .in('status', ['termin_gelegt', 'termin_stattgefunden'])
  if (e3) return NextResponse.json({ error: 'leads: ' + e3.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
