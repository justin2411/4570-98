import { createAdminClient } from '@/lib/supabase/server'
import { checkAdminAuth } from '@/lib/admin-auth'
import { NextResponse } from 'next/server'
import { getLeadProbabilityScorer } from '@/lib/lead-probability'
import type { Lead } from '@/types'

/**
 * /api/admin/leads/[id] — Einzel-Lead.
 *   GET    → Lead + activity_log + (optional) Setter-Profil
 *   PATCH  → Einzel-Update (Whitelist wie /api/admin/leads)
 *   DELETE → Archivieren (default) oder Hard-Delete via ?mode=hard&confirm=true
 */

const PATCHABLE_COLUMNS = new Set<string>([
  'name', 'phone', 'email', 'state', 'beruf', 'list_name',
  'status', 'appointment_date', 'recall_date', 'notes',
  'assigned_to', 'closer_id', 'teams_link',
  'call_attempts', 'last_call_attempt',
  'archived', 'prio_a', 'score',
])

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(req: Request, ctx: RouteCtx) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })
  const { id } = await ctx.params
  const supabase = createAdminClient()

  const [{ data: lead, error: e1 }, { data: log, error: e2 }] = await Promise.all([
    supabase.from('leads').select('*, profiles:assigned_to(id, full_name, email), closers:closer_id(id, name, email)').eq('id', id).maybeSingle(),
    supabase.from('activity_log').select('*').eq('lead_id', id).order('created_at', { ascending: false }).limit(50),
  ])
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
  if (!lead) return NextResponse.json({ error: 'Lead nicht gefunden' }, { status: 404 })

  const probScore = await getLeadProbabilityScorer()
  return NextResponse.json({
    lead: { ...(lead as Lead), probabilityScore: probScore(lead as Lead) },
    activityLog: e2 ? [] : (log || []),
  })
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })
  const { id } = await ctx.params

  const body = await req.json().catch(() => ({}))
  const patchRaw: Record<string, unknown> = (body && typeof body === 'object') ? (body.patch || body) : {}
  const patch: Record<string, unknown> = {}
  const rejected: string[] = []
  for (const [k, v] of Object.entries(patchRaw)) {
    if (PATCHABLE_COLUMNS.has(k)) patch[k] = v
    else if (k !== 'patch') rejected.push(k)
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Keine erlaubten Spalten', rejected }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.from('leads').update(patch as never).eq('id', id).select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Lead nicht gefunden' }, { status: 404 })
  return NextResponse.json({ ok: true, lead: data, rejected })
}

export async function DELETE(req: Request, ctx: RouteCtx) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })
  const { id } = await ctx.params
  const url = new URL(req.url)
  const mode = url.searchParams.get('mode') === 'hard' ? 'hard' : 'archive'
  const confirm = url.searchParams.get('confirm') === 'true'
  if (mode === 'hard' && !confirm) {
    return NextResponse.json({ error: 'Hard-Delete benötigt ?confirm=true' }, { status: 400 })
  }

  const supabase = createAdminClient()
  if (mode === 'archive') {
    const { error } = await supabase.from('leads').update({ archived: true } as never).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, mode })
  }
  // D-020: geschützte Status (Termine/Wiedervorlage) nicht löschbar.
  const { data: row, error: pErr } = await supabase.from('leads').select('status').eq('id', id).maybeSingle()
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
  if (row && ['termin_gelegt', 'termin_stattgefunden', 'wiedervorlage'].includes((row as { status: string }).status)) {
    return NextResponse.json({
      error: `Lead geschützt (status=${(row as { status: string }).status}). Vor dem Löschen Status ändern.`,
    }, { status: 409 })
  }
  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, mode })
}
