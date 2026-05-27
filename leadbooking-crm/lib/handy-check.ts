// ============================================================
// Handy-Check: prüft, ob eine Telefonnummer eine deutsche
// Mobilfunknummer (+49 15x/16x/17x) ist. Wiederverwendung in
// Cockpit-Filter, Setter-Leadliste-Toggle und Admin-Board.
// ============================================================

import { formatPhoneForCall } from '@/lib/phone'

export function isHandyPhone(raw: string | null | undefined): boolean {
  if (!raw) return false
  const intl = formatPhoneForCall(raw)
  return /^\+49(15|16|17)/.test(intl)
}

export function isHandyLead(lead: { phone?: string | null } | null | undefined): boolean {
  return isHandyPhone(lead?.phone)
}
