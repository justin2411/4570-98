import { createAdminClient } from '@/lib/supabase/server'
import { checkAdminAuth } from '@/lib/admin-auth'
import { NextResponse } from 'next/server'

/**
 * PATCH /api/admin/profiles/[id]
 * Erlaubt Änderungen an: full_name, role, role_title, phone_direct, is_active,
 *   daily_goal, sound_enabled, custom_signature, use_custom_signature.
 * Nicht erlaubt: id, email (laufen über Supabase-Auth-Flow), created_at.
 */
const PROFILE_PATCHABLE = new Set([
  'full_name', 'role', 'role_title', 'phone_direct',
  'is_active', 'daily_goal', 'sound_enabled',
  'custom_signature', 'use_custom_signature',
  'teams_room_url', 'avatar_color',
])

type RouteCtx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, ctx: RouteCtx) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}
  const rejected: string[] = []
  for (const [k, v] of Object.entries(body || {})) {
    if (PROFILE_PATCHABLE.has(k)) patch[k] = v
    else rejected.push(k)
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Keine erlaubten Felder', rejected }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase.from('profiles').update(patch as never).eq('id', id).select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })
  return NextResponse.json({ ok: true, profile: data, rejected })
}
