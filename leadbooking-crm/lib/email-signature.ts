import { Profile } from '@/types'

/**
 * Baut die Mail-Signatur aus dem Setter-Profil.
 * Bewusst schlicht: nur Name + Rolle. Kein Firmen-/Kontakt-Block.
 * Wenn custom_signature aktiv ist, hat sie Vorrang.
 */
export function buildEmailSignature(profile: Pick<Profile, 'full_name' | 'role_title' | 'phone_direct' | 'custom_signature' | 'use_custom_signature'>): string {
  if (profile.use_custom_signature && profile.custom_signature?.trim()) {
    return profile.custom_signature.trim()
  }
  const name = profile.full_name || 'Ihr Berater'
  const role = profile.role_title || 'Beratungsteam'
  return `${name}\n${role}`
}

/**
 * Default-Werte für ein neues Setter-Profil
 */
export const DEFAULT_PROFILE_VALUES = {
  role_title: 'Beratungsteam',
  teams_room_url: '',
  phone_direct: '',
  custom_signature: '',
  use_custom_signature: false,
}
