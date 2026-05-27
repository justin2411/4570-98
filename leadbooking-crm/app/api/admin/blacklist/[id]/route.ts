import { createAdminClient } from '@/lib/supabase/server'
import { checkAdminAuth } from '@/lib/admin-auth'
import { invalidateBlacklistCache } from '@/lib/blacklist'
import { NextResponse } from 'next/server'

/**
 * DELETE /api/admin/blacklist/[id]
 * Einzel-Entfernung aus der Blacklist (z. B. „versehentlich auf
 * kein_interesse gesetzt — Person ist doch interessiert").
 */
type RouteCtx = { params: Promise<{ id: string }> }

export async function DELETE(req: Request, ctx: RouteCtx) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })
  const { id } = await ctx.params
  const supabase = createAdminClient()
  const { error } = await supabase.from('blacklist').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  invalidateBlacklistCache()
  return NextResponse.json({ ok: true })
}
