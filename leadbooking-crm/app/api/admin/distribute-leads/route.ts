import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { leadQualityScore } from '@/lib/lead-quality'
import type { Lead } from '@/types'

/**
 * POST /api/admin/distribute-leads
 *
 * Auth: entweder Admin-Session (Cookie) ODER Bearer-Token (ADMIN_API_TOKEN env).
 *
 * Body: {
 *   setterIds:        string[]    // Pflicht — Ziel-Setter
 *   listName?:        string      // optional — nur aus einer Liste
 *   perSetterLimit?:  number      // optional — max. pro Setter
 *   includeAssigned?: boolean     // optional — auch bereits zugewiesene neu verteilen ("umstrukturieren")
 *   statuses?:        string[]    // optional — Status-Filter (default: ['neu','angerufen'])
 * }
 *
 * Verteilung: nach leadQualityScore sortiert, Round-Robin auf die setterIds.
 */
const DEFAULT_STATUSES = ['neu', 'angerufen']

export async function POST(req: Request) {
  // ── Auth: Token ODER Session ──────────────────────────────────────────
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

  // ── Body parsen ───────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({}))
  const setterIds: string[] = Array.isArray(body.setterIds)
    ? body.setterIds.filter((x: unknown) => typeof x === 'string')
    : []
  const listName: string | null = typeof body.listName === 'string' && body.listName.trim()
    ? body.listName.trim()
    : null
  const perSetterLimit: number = Number.isFinite(body.perSetterLimit) && body.perSetterLimit > 0
    ? Math.floor(body.perSetterLimit)
    : 0
  const includeAssigned: boolean = body.includeAssigned === true
  const statuses: string[] = Array.isArray(body.statuses) && body.statuses.length > 0
    ? body.statuses.filter((s: unknown) => typeof s === 'string')
    : DEFAULT_STATUSES

  if (setterIds.length === 0) {
    return NextResponse.json({ error: 'Keine Setter ausgewählt' }, { status: 400 })
  }

  // ── DB-Operationen via Service-Role-Client (umgeht RLS sauber) ────────
  const supabase = createAdminClient()

  let query = supabase.from('leads').select('*')
  if (!includeAssigned) query = query.is('assigned_to', null)
  if (statuses.length > 0) query = query.in('status', statuses)
  if (listName) query = query.eq('list_name', listName)

  const { data: leadsRaw, error: e1 } = await query
  if (e1) return NextResponse.json({ error: 'leads: ' + e1.message }, { status: 500 })

  const leads = ((leadsRaw as Lead[] | null) ?? []).slice()
  if (leads.length === 0) {
    return NextResponse.json({
      ok: true, assigned: {}, total: 0,
      scope: { includeAssigned, statuses, listName, perSetterLimit },
    })
  }

  // Nach Qualität sortieren — bestes Lead zuerst
  leads.sort((a, b) => leadQualityScore(b) - leadQualityScore(a))

  // Round-Robin
  const assignments: Record<string, string[]> = {}
  for (const sid of setterIds) assignments[sid] = []

  const cap = perSetterLimit > 0 ? perSetterLimit * setterIds.length : leads.length
  const slice = leads.slice(0, cap)
  slice.forEach((lead, i) => {
    assignments[setterIds[i % setterIds.length]].push(lead.id)
  })

  // Bulk-Update
  const results: Record<string, number> = {}
  for (const [sid, leadIds] of Object.entries(assignments)) {
    if (leadIds.length === 0) { results[sid] = 0; continue }
    const { error: e2 } = await supabase.from('leads').update({ assigned_to: sid }).in('id', leadIds)
    if (e2) {
      return NextResponse.json({ error: `Setter ${sid}: ${e2.message}`, partial: results }, { status: 500 })
    }
    results[sid] = leadIds.length
  }

  return NextResponse.json({
    ok: true,
    total: slice.length,
    assigned: results,
    scope: { includeAssigned, statuses, listName, perSetterLimit },
  })
}
