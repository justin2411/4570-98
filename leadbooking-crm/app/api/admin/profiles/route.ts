import { createAdminClient } from '@/lib/supabase/server'
import { checkAdminAuth } from '@/lib/admin-auth'
import { NextResponse } from 'next/server'

/**
 * GET /api/admin/profiles
 * Liefert alle Profile (Setter + Admins + Closer-Berater) — id, role, full_name, email, is_active.
 * Optionale Query: ?role=setter|admin|advisor   ?is_active=true|false
 */
export async function GET(req: Request) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })
  const url = new URL(req.url)
  const role = url.searchParams.get('role')
  const isActive = url.searchParams.get('is_active')

  const supabase = createAdminClient()
  let q = supabase.from('profiles').select('id, role, full_name, email, is_active, daily_goal, role_title, phone_direct, created_at').order('full_name')
  if (role) q = q.eq('role', role)
  if (isActive === 'true') q = q.eq('is_active', true)
  else if (isActive === 'false') q = q.eq('is_active', false)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profiles: data || [] })
}
