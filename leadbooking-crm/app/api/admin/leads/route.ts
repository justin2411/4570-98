import { createAdminClient } from '@/lib/supabase/server'
import { checkAdminAuth } from '@/lib/admin-auth'
import { NextResponse } from 'next/server'
import { getLeadProbabilityScorer } from '@/lib/lead-probability'
import type { Lead } from '@/types'

/**
 * /api/admin/leads — generischer Lead-Admin-Endpoint.
 *
 *   GET    → Liste mit Filtern
 *   PATCH  → Bulk-Update (Whitelist der Spalten)
 *   DELETE → Bulk-Archivieren (soft, default) oder Hard-Delete (mode=hard + confirm)
 *
 * Auth: Bearer-Token (`ADMIN_API_TOKEN`) ODER Admin-Session.
 */

// Spalten, die per PATCH änderbar sind. id, created_at, updated_at etc. bleiben tabu.
const PATCHABLE_COLUMNS = new Set<string>([
  'name', 'phone', 'email', 'state', 'beruf', 'list_name',
  'status', 'appointment_date', 'recall_date', 'notes',
  'assigned_to', 'closer_id', 'teams_link',
  'call_attempts', 'last_call_attempt',
  'archived', 'prio_a', 'score',
])

// ── GET ────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

  const url = new URL(req.url)
  const status = url.searchParams.getAll('status')
  const assignedTo = url.searchParams.get('assignedTo')
  const listName = url.searchParams.get('listName')
  const search = url.searchParams.get('search')?.trim()
  const archivedParam = url.searchParams.get('archived')
  // beruf-Filter: tolerant per ILIKE-Pattern, kann mehrfach übergeben werden.
  //   ?beruf=heilpraktiker%        → nur Heilpraktiker-Schreibweisen
  //   ?excludeBeruf=hebamm%        → ohne Hebammen (Singular + Plural)
  // Mehrfach-Übergabe: include = OR, exclude = alle AND-NOT.
  const berufLike = url.searchParams.getAll('beruf').filter(s => s.trim().length > 0)
  const excludeBerufLike = url.searchParams.getAll('excludeBeruf').filter(s => s.trim().length > 0)
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1), 2000)
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0)
  const orderBy = url.searchParams.get('orderBy') || 'created_at'
  const order = (url.searchParams.get('order') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc'
  const withScore = url.searchParams.get('withScore') === 'true' || url.searchParams.get('withQuality') === 'true'

  const supabase = createAdminClient()
  let query = supabase.from('leads').select('*', { count: 'exact' })

  if (status.length > 0) query = query.in('status', status)
  if (assignedTo === 'null' || assignedTo === '') query = query.is('assigned_to', null)
  else if (assignedTo === 'any') query = query.not('assigned_to', 'is', null)
  else if (assignedTo) query = query.eq('assigned_to', assignedTo)
  if (listName) query = query.eq('list_name', listName)
  if (url.searchParams.get('prio') === 'true') query = query.eq('prio_a', true)
  if (archivedParam === 'true') query = query.eq('archived', true)
  else if (archivedParam === 'false' || archivedParam === null) query = query.or('archived.is.null,archived.eq.false')
  if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
  if (berufLike.length > 0) {
    query = query.or(berufLike.map(p => `beruf.ilike.${p}`).join(','))
  }
  for (const p of excludeBerufLike) {
    // NULL-Berufe gelten als "nicht ausgeschlossen" — sonst würde
    // .not('beruf','ilike',…) jeden Lead ohne beruf-Eintrag rauswerfen.
    query = query.or(`beruf.not.ilike.${p},beruf.is.null`)
  }

  query = query.order(orderBy, { ascending: order === 'asc' }).range(offset, offset + limit - 1)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const leads = (data as Lead[] | null) ?? []
  let enriched: Array<Lead & { probabilityScore?: number }> = leads
  if (withScore) {
    const probScore = await getLeadProbabilityScorer()
    enriched = leads.map(l => ({ ...l, probabilityScore: probScore(l) }))
  }

  return NextResponse.json({
    leads: enriched,
    total: count ?? leads.length,
    limit,
    offset,
  })
}

// ── PATCH ──────────────────────────────────────────────────────────────────
export async function PATCH(req: Request) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const leadIds: string[] = Array.isArray(body.leadIds)
    ? body.leadIds.filter((x: unknown) => typeof x === 'string')
    : []
  const patchRaw: Record<string, unknown> = (body.patch && typeof body.patch === 'object') ? body.patch : {}

  if (leadIds.length === 0) {
    return NextResponse.json({ error: 'leadIds fehlen' }, { status: 400 })
  }
  const patch: Record<string, unknown> = {}
  const rejected: string[] = []
  for (const [k, v] of Object.entries(patchRaw)) {
    if (PATCHABLE_COLUMNS.has(k)) patch[k] = v
    else rejected.push(k)
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Keine erlaubten Spalten im patch', rejected }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error, count } = await supabase
    .from('leads')
    .update(patch as never, { count: 'exact' })
    .in('id', leadIds)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, updated: count ?? leadIds.length, patch, rejected })
}

// ── DELETE ─────────────────────────────────────────────────────────────────
export async function DELETE(req: Request) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const leadIds: string[] = Array.isArray(body.leadIds)
    ? body.leadIds.filter((x: unknown) => typeof x === 'string')
    : []
  const mode: 'archive' | 'hard' = body.mode === 'hard' ? 'hard' : 'archive'
  const confirm = body.confirm === true

  if (leadIds.length === 0) {
    return NextResponse.json({ error: 'leadIds fehlen' }, { status: 400 })
  }
  if (mode === 'hard' && !confirm) {
    return NextResponse.json({ error: 'Hard-Delete benötigt "confirm": true' }, { status: 400 })
  }

  const supabase = createAdminClient()
  if (mode === 'archive') {
    const { error, count } = await supabase
      .from('leads')
      .update({ archived: true } as never, { count: 'exact' })
      .in('id', leadIds)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, mode, archived: count ?? leadIds.length })
  }

  // Hard-Delete: geschützte Leads (termin_gelegt, termin_stattgefunden,
  // wiedervorlage) müssen ausgeschlossen werden — sonst raised der
  // DB-Trigger (D-020) und der ganze Batch failed. App filtert vorab,
  // Trigger bleibt als Sicherheitsnetz aktiv.
  const PROTECTED = ['termin_gelegt', 'termin_stattgefunden', 'wiedervorlage'] as const
  const { data: protectedRows, error: peErr } = await supabase
    .from('leads')
    .select('id')
    .in('id', leadIds)
    .in('status', PROTECTED as unknown as string[])
  if (peErr) return NextResponse.json({ error: 'protected-check: ' + peErr.message }, { status: 500 })
  const protectedIds = new Set((protectedRows || []).map(r => (r as { id: string }).id))
  const deletableIds = leadIds.filter(id => !protectedIds.has(id))
  if (deletableIds.length === 0) {
    return NextResponse.json({
      ok: true, mode,
      deleted: 0,
      skippedProtected: protectedIds.size,
      note: 'Alle angegebenen Leads sind geschützt (Termin/Wiedervorlage).',
    })
  }

  const { error, count } = await supabase.from('leads').delete({ count: 'exact' }).in('id', deletableIds)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    ok: true, mode,
    deleted: count ?? deletableIds.length,
    skippedProtected: protectedIds.size,
  })
}
