import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { leadQualityScore } from '@/lib/lead-quality'
import type { Lead } from '@/types'

/**
 * POST /api/admin/distribute-leads
 * Verteilt unzugeordnete Leads qualitäts-balanciert auf ausgewählte Setter
 * (Round-Robin durch nach Qualität sortierte Lead-Liste).
 *
 * Body: { setterIds: string[], listName?: string, perSetterLimit?: number }
 * Response: { ok, assigned: { [setterId]: count }, total }
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })

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

  if (setterIds.length === 0) {
    return NextResponse.json({ error: 'Keine Setter ausgewählt' }, { status: 400 })
  }

  // Unzugeordnete Leads laden (optional auf eine Liste eingeschränkt)
  let query = supabase.from('leads').select('*').is('assigned_to', null)
  if (listName) query = query.eq('list_name', listName)
  const { data: leadsRaw, error: e1 } = await query
  if (e1) return NextResponse.json({ error: 'leads: ' + e1.message }, { status: 500 })

  const leads = ((leadsRaw as Lead[] | null) ?? []).slice()
  if (leads.length === 0) {
    return NextResponse.json({ ok: true, assigned: {}, total: 0 })
  }

  // Nach Qualität sortieren — bestes Lead zuerst
  leads.sort((a, b) => leadQualityScore(b) - leadQualityScore(a))

  // Round-Robin: zip durch die sortierte Liste, verteile reihum auf die Setter
  const assignments: Record<string, string[]> = {}
  for (const sid of setterIds) assignments[sid] = []

  const cap = perSetterLimit > 0 ? perSetterLimit * setterIds.length : leads.length
  const slice = leads.slice(0, cap)

  slice.forEach((lead, i) => {
    const sid = setterIds[i % setterIds.length]
    assignments[sid].push(lead.id)
  })

  // Bulk-Update pro Setter
  const results: Record<string, number> = {}
  for (const [sid, leadIds] of Object.entries(assignments)) {
    if (leadIds.length === 0) { results[sid] = 0; continue }
    const { error: e2 } = await supabase.from('leads').update({ assigned_to: sid }).in('id', leadIds)
    if (e2) {
      return NextResponse.json({ error: `Setter ${sid}: ${e2.message}`, partial: results }, { status: 500 })
    }
    results[sid] = leadIds.length
  }

  return NextResponse.json({ ok: true, assigned: results, total: slice.length })
}
