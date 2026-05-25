export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardClient } from './dashboard-client'

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

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
  const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
  const yearStart = `${now.getFullYear()}-01-01`

  const [{ data: todayLog }, { data: weekLog }, { data: monthLog }, { data: yearLog }, { data: profile }, { data: leads }] = await Promise.all([
    supabase.from('activity_log').select('new_status, lead_id').eq('setter_id', user.id).gte('created_at', today),
    supabase.from('activity_log').select('new_status, lead_id').eq('setter_id', user.id).gte('created_at', weekStart.toISOString().split('T')[0]),
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
  const streakDays = new Set((streakLog ?? []).map(x => x.created_at.split('T')[0]))
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(now); d.setDate(d.getDate() - i)
    if (streakDays.has(d.toISOString().split('T')[0])) streak++
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
