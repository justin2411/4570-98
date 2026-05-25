export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardClient } from './dashboard-client'
import { berlinDate, berlinPeriodStart, berlinDayStartISO, addDaysStr } from '@/lib/dates'

// ============================================================
// Status, die als "Anruf gemacht" gewertet werden
// (alle außer 'neu' — der Setter hat den Lead bearbeitet)
// ============================================================
const CALL_STATUSES = [
  'angerufen',
  'nicht_erreicht',
  'wiedervorlage',
  'termin_gelegt',
  'termin_stattgefunden',
  'kein_interesse',
]

export default async function SetterDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Zeitgrenzen in deutscher Zeit (Europe/Berlin) als UTC-Instant für created_at-Filter
  const today = berlinDate()
  const todayStart = berlinDayStartISO(today)
  const weekStart = berlinDayStartISO(berlinPeriodStart('week')!)
  const monthStart = berlinDayStartISO(berlinPeriodStart('month')!)
  const yearStart = berlinDayStartISO(today.slice(0, 4) + '-01-01')

  const [{ data: todayLog }, { data: weekLog }, { data: monthLog }, { data: yearLog }, { data: profile }, { data: leads }] = await Promise.all([
    supabase.from('activity_log').select('new_status, lead_id').eq('setter_id', user.id).gte('created_at', todayStart),
    supabase.from('activity_log').select('new_status, lead_id').eq('setter_id', user.id).gte('created_at', weekStart),
    supabase.from('activity_log').select('new_status, lead_id').eq('setter_id', user.id).gte('created_at', monthStart),
    supabase.from('activity_log').select('new_status, lead_id').eq('setter_id', user.id).gte('created_at', yearStart),
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    supabase.from('leads').select('id, status').eq('assigned_to', user.id),
  ])

  function calcStats(log: { new_status: string; lead_id: string }[] | null) {
    const l = log ?? []
    // Anrufe: jeder Lead, der mind. einmal aus 'neu' rausgekommen ist (zählt jeden Lead nur einmal)
    const calls = new Set(l.filter(x => CALL_STATUSES.includes(x.new_status)).map(x => x.lead_id)).size
    const set = new Set(l.filter(x => x.new_status === 'termin_gelegt').map(x => x.lead_id)).size
    return { calls, set }
  }

  const totalDone = (leads ?? []).filter(l => l.status === 'termin_stattgefunden').length
  const totalSet = (leads ?? []).filter(l => l.status === 'termin_gelegt' || l.status === 'termin_stattgefunden').length

  const { data: streakLog } = await supabase.from('activity_log').select('created_at').eq('setter_id', user.id).eq('new_status', 'termin_stattgefunden').order('created_at', { ascending: false })
  const streakDays = new Set((streakLog ?? []).map(x => berlinDate(new Date(x.created_at))))
  let streak = 0
  let cur = today
  for (let i = 0; i < 365; i++) {
    if (streakDays.has(cur)) { streak++; cur = addDaysStr(cur, -1) }
    else break
  }

  return (
    <DashboardClient
      fullName={profile?.full_name ?? 'Setter'}
      totalDone={totalDone}
      totalSet={totalSet}
      streak={streak}
      stats={{
        today: calcStats(todayLog),
        week: calcStats(weekLog),
        month: calcStats(monthLog),
        year: calcStats(yearLog),
      }}
      currentSetterId={user.id}
    />
  )
}
