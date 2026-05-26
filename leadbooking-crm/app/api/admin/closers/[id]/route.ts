import { createAdminClient } from '@/lib/supabase/server'
import { checkAdminAuth } from '@/lib/admin-auth'
import { NextResponse } from 'next/server'

/**
 * /api/admin/closers/[id]
 *   PATCH  → Felder ändern (name, email, phone, is_active)
 *   DELETE → Closer löschen
 */
const CLOSER_PATCHABLE = new Set(['name', 'email', 'phone', 'is_active'])

type RouteCtx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, ctx: RouteCtx) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body || {})) if (CLOSER_PATCHABLE.has(k)) patch[k] = v
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Keine erlaubten Felder' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase.from('closers').update(patch as never).eq('id', id).select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Closer nicht gefunden' }, { status: 404 })
  return NextResponse.json({ ok: true, closer: data })
}

export async function DELETE(req: Request, ctx: RouteCtx) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })
  const { id } = await ctx.params
  const supabase = createAdminClient()
  const { error } = await supabase.from('closers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
