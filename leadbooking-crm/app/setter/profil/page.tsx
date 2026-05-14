export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProfileForm } from './profile-form'
import type { Profile } from '@/types'

export default async function ProfilPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return (
      <div className="text-center py-12 text-red-600">
        Profil konnte nicht geladen werden. Bitte neu anmelden.
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Mein Profil</h1>
        <p className="text-sm text-gray-600 mt-1">
          Diese Daten werden automatisch in deinen Termin-Bestätigungs-E-Mails und WhatsApp-Nachrichten verwendet.
        </p>
      </div>
      <ProfileForm profile={profile as Profile} />
    </div>
  )
}
