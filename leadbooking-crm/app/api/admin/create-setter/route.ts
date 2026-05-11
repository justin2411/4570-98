import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Nur Admins' }, { status: 403 })

  const { full_name, email, password } = await req.json()
  if (!full_name || !email || !password) return NextResponse.json({ error: 'Alle Felder erforderlich' }, { status: 400 })

  const admin = createAdminClient()
  const { data: newUser, error } = await admin.auth.admin.createUser({
    email, password,
    email_confirm: true,
    user_metadata: { full_name, role: 'setter' },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Warte kurz auf den Trigger
  await new Promise(r => setTimeout(r, 1000))

  let { data: newProfile } = await admin.from('profiles').select('*').eq('id', newUser.user.id).single()

  // Falls Trigger noch nicht gelaufen – manuell anlegen
  if (!newProfile) {
    await admin.from('profiles').insert({
      id: newUser.user.id,
      role: 'setter',
      full_name,
      email,
      avatar_color: '#2E75B6',
      is_active: true,
    })
    const { data: p } = await admin.from('profiles').select('*').eq('id', newUser.user.id).single()
    newProfile = p
  }

  return NextResponse.json({ profile: newProfile })
}
