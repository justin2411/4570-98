import { createAdminClient } from '@/lib/supabase/server'
import { checkAdminAuth } from '@/lib/admin-auth'
import { NextResponse } from 'next/server'

/**
 * /api/admin/closers
 *   GET   → alle Closer
 *   POST  → neuen Closer anlegen   ({ name, email, phone?, is_active? })
 */
export async function GET(req: Request) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('closers').select('*').order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ closers: data || [] })
}

export async function POST(req: Request) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const is_active = body.is_active === false ? false : true
  if (!name || !email) return NextResponse.json({ error: 'name + email Pflicht' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase.from('closers').insert({ name, email, phone, is_active } as never).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, closer: data })
}
