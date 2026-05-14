import { Profile } from '@/types'

/**
 * Baut die Mail-Signatur aus dem Setter-Profil.
 * Wenn custom_signature aktiv ist: nimm die.
 * Sonst: bau Standard-Signatur aus full_name + role_title + phone_direct.
 */
export function buildEmailSignature(profile: Pick<Profile, 'full_name' | 'role_title' | 'phone_direct' | 'custom_signature' | 'use_custom_signature'>): string {
  // Custom-Signatur hat Vorrang wenn aktiviert + nicht leer
  if (profile.use_custom_signature && profile.custom_signature?.trim()) {
    return profile.custom_signature.trim()
  }

  // Standard-Signatur zusammenbauen
  const name = profile.full_name || 'Ihr Berater'
  const role = profile.role_title || 'Hebammen-Beratungsteam'
  const phone = profile.phone_direct?.trim()

  let signature = `${name}\n${role}`
  if (phone) {
    signature += `\nTel: ${phone}`
  }
  signature += `\n\n\n────────────────────────────────────────\n\n   HEBAMMEN VORSORGE\n   Altersvorsorge & Vermögensaufbau\n   speziell für Hebammen in Deutschland\n\n   E-Mail:   beratung@hebammen-vorsorge.de\n   Web:      www.hebammen-vorsorge.de\n\n────────────────────────────────────────`

  return signature
}

/**
 * Default-Werte für ein neues Setter-Profil
 */
export const DEFAULT_PROFILE_VALUES = {
  role_title: 'Hebammen-Beratungsteam',
  teams_room_url: '',
  phone_direct: '',
  custom_signature: '',
  use_custom_signature: false,
}
