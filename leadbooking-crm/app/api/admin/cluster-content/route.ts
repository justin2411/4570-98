import { createAdminClient } from '@/lib/supabase/server'
import { checkAdminAuth } from '@/lib/admin-auth'
import { NextResponse } from 'next/server'

/**
 * /api/admin/cluster-content
 *   GET   → alle Cluster-Inhalte (Branding + Vorlagen pro list_name)
 *           Query: ?listName=… optional filtert auf einen
 *   POST  → upsert (list_name + felder); überschreibt vorhandene Werte
 */
const CLUSTER_FIELDS = new Set(['firma', 'web', 'kontakt_email', 'tagline', 'templates'])

export async function GET(req: Request) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })
  const url = new URL(req.url)
  const listName = url.searchParams.get('listName')
  const supabase = createAdminClient()
  let q = supabase.from('cluster_content').select('*').order('list_name')
  if (listName) q = q.eq('list_name', listName)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ clusters: data || [] })
}

export async function POST(req: Request) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const listName = typeof body.list_name === 'string' ? body.list_name.trim() : ''
  if (!listName) return NextResponse.json({ error: 'list_name fehlt' }, { status: 400 })

  const payload: Record<string, unknown> = { list_name: listName }
  for (const [k, v] of Object.entries(body)) if (CLUSTER_FIELDS.has(k)) payload[k] = v

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('cluster_content')
    .upsert(payload as never, { onConflict: 'list_name' })
    .select('*')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, cluster: data })
}
