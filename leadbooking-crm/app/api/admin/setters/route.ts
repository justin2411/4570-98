import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/admin/setters
 * Liefert aktive Setter (id, name, email) + Anzahl offener Leads (neu/angerufen),
 * damit Verteilungs-Tools eine Übersicht haben.
 *
 * Auth: Admin-Session ODER Bearer-Token (ADMIN_API_TOKEN).
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization') || ''
  const provided = (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '').trim()
  const expected = (process.env.ADMIN_API_TOKEN || '').trim()
  const tokenOk = !!provided && !!expected && provided === expected

  let sessionOk = false
  if (!tokenOk) {
    const supabaseUser = await createClient()
    const { data: { user } } = await supabaseUser.auth.getUser()
    if (user) {
      const { data: profile } = await supabaseUser.from('profiles').select('role').eq('id', user.id).single()
      sessionOk = profile?.role === 'admin'
    }
  }
  if (!tokenOk && !sessionOk) {
    return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Paginiert laden — Supabase default-limit ist 1000 Rows. Bei 5000+ Leads
  // würden ohne Pagination Setter-Counts komplett verschluckt.
  async function fetchAll<T>(builder: () => any): Promise<T[]> {
    const out: T[] = []
    let from = 0
    const PAGE = 1000
    while (true) {
      const { data, error } = await builder().range(from, from + PAGE - 1)
      if (error) throw error
      const rows = (data || []) as T[]
      out.push(...rows)
      if (rows.length < PAGE) break
      from += PAGE
    }
    return out
  }

  let settersRaw: Array<{ id: string; full_name: string; email?: string }> = []
  let leads: Array<{ assigned_to: string | null; status: string }> = []
  let unassigned: Array<{ list_name: string | null }> = []
  try {
    const sRes = await supabase.from('profiles').select('id, full_name, email').eq('role', 'setter').eq('is_active', true).order('full_name')
    if (sRes.error) return NextResponse.json({ error: 'profiles: ' + sRes.error.message }, { status: 500 })
    settersRaw = (sRes.data || []) as typeof settersRaw

    leads = await fetchAll<{ assigned_to: string | null; status: string }>(() =>
      supabase.from('leads').select('assigned_to, status').in('status', ['neu', 'angerufen'])
    )
    unassigned = await fetchAll<{ list_name: string | null }>(() =>
      supabase.from('leads').select('list_name').is('assigned_to', null)
    )
  } catch (err) {
    return NextResponse.json({ error: 'leads: ' + (err as Error).message }, { status: 500 })
  }

  const openPerSetter: Record<string, number> = {}
  for (const l of leads) {
    if (l.assigned_to) openPerSetter[l.assigned_to] = (openPerSetter[l.assigned_to] || 0) + 1
  }

  const unassignedPerList: Record<string, number> = {}
  let unassignedTotal = 0
  for (const l of unassigned) {
    unassignedTotal++
    const ln = (l.list_name || '').trim() || '— ohne Liste —'
    unassignedPerList[ln] = (unassignedPerList[ln] || 0) + 1
  }

  return NextResponse.json({
    setters: settersRaw.map(s => ({
      id: s.id,
      name: s.full_name,
      email: s.email,
      openLeads: openPerSetter[s.id] || 0,
    })),
    unassigned: {
      total: unassignedTotal,
      byList: unassignedPerList,
    },
  })
}
