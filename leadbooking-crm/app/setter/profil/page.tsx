export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProfileForm } from './profile-form'
import type { Profile } from '@/types'

export default async function ProfilPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <h2 className="text-base font-semibold text-red-900 mb-2">Profil konnte nicht geladen werden</h2>
          <p className="text-sm text-red-800">
            {error?.message?.includes('column') || error?.message?.includes('does not exist')
              ? 'Die Datenbank-Migration wurde noch nicht ausgeführt. Bitte führe das SQL aus dem Patch in Supabase aus.'
              : (error?.message || 'Unbekannter Fehler')}
          </p>
        </div>
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
