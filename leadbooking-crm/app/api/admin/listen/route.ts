import { createAdminClient } from '@/lib/supabase/server'
import { checkAdminAuth } from '@/lib/admin-auth'
import { NextResponse } from 'next/server'

/**
 * /api/admin/listen
 *   GET   → alle Listen (cluster_content) + Lead-Count pro Liste
 *           Auch Listen, die nur in leads.list_name vorkommen aber noch
 *           keinen cluster_content-Eintrag haben, werden zurückgegeben
 *           (mit is_active=null als Flag).
 *   POST  → neue Liste anlegen ({ list_name, display_name?, firma?,
 *           web?, kontakt_email?, tagline? })
 */
export async function GET(req: Request) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })
  const supabase = createAdminClient()

  const [{ data: cc, error: e1 }, { data: leads, error: e2 }] = await Promise.all([
    supabase.from('cluster_content').select('*').order('list_name'),
    supabase.from('leads').select('list_name'),
  ])
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

  const counts: Record<string, number> = {}
  for (const l of (leads || []) as Array<{ list_name?: string | null }>) {
    const n = (l.list_name || '').trim()
    if (n) counts[n] = (counts[n] || 0) + 1
  }

  // Map cluster_content rows
  const known = new Map<string, Record<string, unknown>>()
  for (const row of (cc || []) as Array<{ list_name: string } & Record<string, unknown>>) {
    known.set(row.list_name, { ...row, lead_count: counts[row.list_name] || 0 })
  }
  // Listen aus leads, die noch keinen cluster_content haben: als Stub aufnehmen
  for (const [name, n] of Object.entries(counts)) {
    if (!known.has(name)) {
      known.set(name, {
        list_name: name, display_name: null, firma: '', web: '', kontakt_email: '',
        tagline: '', templates: {}, is_active: null, lead_count: n,
      })
    }
  }

  const listen = Array.from(known.values()).sort((a, b) =>
    String((a as { list_name: string }).list_name).localeCompare(String((b as { list_name: string }).list_name))
  )
  if (e2) return NextResponse.json({ listen, warning: 'lead-counts unvollständig (' + e2.message + ')' })
  return NextResponse.json({ listen })
}

export async function POST(req: Request) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const list_name = typeof body.list_name === 'string' ? body.list_name.trim() : ''
  if (!list_name) return NextResponse.json({ error: 'list_name fehlt' }, { status: 400 })

  const payload: Record<string, unknown> = {
    list_name,
    display_name: typeof body.display_name === 'string' && body.display_name.trim() ? body.display_name.trim() : null,
    firma: typeof body.firma === 'string' ? body.firma : '',
    web: typeof body.web === 'string' ? body.web : '',
    kontakt_email: typeof body.kontakt_email === 'string' ? body.kontakt_email : '',
    tagline: typeof body.tagline === 'string' ? body.tagline : '',
    is_active: body.is_active === false ? false : true,
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('cluster_content')
    .upsert(payload as never, { onConflict: 'list_name' })
    .select('*')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, liste: data })
}
