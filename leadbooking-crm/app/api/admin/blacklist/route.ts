import { createAdminClient } from '@/lib/supabase/server'
import { checkAdminAuth } from '@/lib/admin-auth'
import { invalidateBlacklistCache, normalizeForBlacklist } from '@/lib/blacklist'
import { NextResponse } from 'next/server'

/**
 * /api/admin/blacklist
 *
 *   GET    → Liste mit Filtern (?search=…&limit=&offset=)
 *   POST   → manuell hinzufügen ({ phone, name?, email?, beruf?, reason? })
 *   DELETE → Bulk-Entfernen ({ ids?: string[], phones?: string[] })
 *
 * Auth: Bearer-Token (ADMIN_API_TOKEN) ODER Admin-Session.
 */

export async function GET(req: Request) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

  const url = new URL(req.url)
  const search = url.searchParams.get('search')?.trim() || ''
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1), 2000)
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0)

  const supabase = createAdminClient()
  let query = supabase.from('blacklist').select('*', { count: 'exact' })
  if (search) {
    const digits = search.replace(/\D/g, '')
    const phoneClause = digits ? `,phone.ilike.%${digits}%` : ''
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%${phoneClause}`)
  }
  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    entries: data || [],
    total: count ?? (data?.length ?? 0),
    limit, offset,
  })
}

export async function POST(req: Request) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const norm = normalizeForBlacklist(typeof body.phone === 'string' ? body.phone : '')
  if (!norm) return NextResponse.json({ error: 'phone fehlt oder ungültig' }, { status: 400 })

  const payload = {
    phone: norm,
    email: typeof body.email === 'string' ? body.email : null,
    name: typeof body.name === 'string' ? body.name : null,
    beruf: typeof body.beruf === 'string' ? body.beruf : null,
    reason: typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'manual',
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('blacklist')
    .upsert(payload as never, { onConflict: 'phone' })
    .select('*')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  invalidateBlacklistCache()
  return NextResponse.json({ ok: true, entry: data })
}

export async function DELETE(req: Request) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === 'string') : []
  const rawPhones: string[] = Array.isArray(body.phones) ? body.phones.filter((x: unknown) => typeof x === 'string') : []
  const phones: string[] = rawPhones.map(normalizeForBlacklist).filter((x): x is string => !!x)

  if (ids.length === 0 && phones.length === 0) {
    return NextResponse.json({ error: 'ids oder phones angeben' }, { status: 400 })
  }

  const supabase = createAdminClient()
  let removed = 0
  if (ids.length > 0) {
    const { error, count } = await supabase.from('blacklist').delete({ count: 'exact' }).in('id', ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    removed += count ?? 0
  }
  if (phones.length > 0) {
    const { error, count } = await supabase.from('blacklist').delete({ count: 'exact' }).in('phone', phones)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    removed += count ?? 0
  }
  invalidateBlacklistCache()
  return NextResponse.json({ ok: true, removed })
}
