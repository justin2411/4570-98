import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAdminAuth } from '@/lib/admin-auth'

export async function POST(req: NextRequest) {
  // Nur Admins (Session ODER Token) — vorher konnte JEDER eingeloggte Nutzer
  // für eine beliebige Adresse Reset-Mails auslösen (Mail-Bombing).
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Gültige E-Mail-Adresse erforderlich' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/passwort-reset/update`,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
