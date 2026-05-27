import { createAdminClient } from '@/lib/supabase/server'
import { checkAdminAuth } from '@/lib/admin-auth'
import { NextResponse } from 'next/server'

/**
 * /api/admin/berufe
 *   GET   → alle Berufe (Master-Liste) + Lead-Count pro Beruf
 *   POST  → neuer Beruf ({ name, plural_form?, is_active? })
 *
 * Auth: Bearer-Token ODER Admin-Session.
 */
export async function GET(req: Request) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })
  const supabase = createAdminClient()

  const [{ data: berufe, error: e1 }, { data: leads, error: e2 }] = await Promise.all([
    supabase.from('berufe').select('*').order('name'),
    supabase.from('leads').select('beruf'),
  ])
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

  const counts: Record<string, number> = {}
  for (const l of (leads || []) as Array<{ beruf?: string | null }>) {
    const b = (l.beruf || '').trim()
    if (b) counts[b] = (counts[b] || 0) + 1
  }

  const result = (berufe || []).map(b => ({
    ...(b as Record<string, unknown>),
    lead_count: counts[(b as { name: string }).name] || 0,
  }))
  if (e2) return NextResponse.json({ berufe: result, warning: 'lead-counts unvollständig (' + e2.message + ')' })
  return NextResponse.json({ berufe: result })
}

export async function POST(req: Request) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const plural_form = typeof body.plural_form === 'string' ? body.plural_form.trim() : ''
  const is_active = body.is_active === false ? false : true
  if (!name) return NextResponse.json({ error: 'name fehlt' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('berufe')
    .upsert({ name, plural_form, is_active } as never, { onConflict: 'name' })
    .select('*')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, beruf: data })
}
