// ============================================================
// Zentrale Telefon- & Website-Helfer
// Überall verwenden (Cockpit, Setter-Leads, Admin), damit Nummern
// konsistent sauber und direkt anrufbar angezeigt werden.
// ============================================================

/**
 * Normalisiert eine Telefonnummer ins deutsche +49-Format (E.164).
 * Funktioniert für Handy UND Festnetz und ist direkt per tel: anrufbar.
 *
 *  0151 234567        → +49151234567   (Handy)
 *  030 123456         → +4930123456    (Festnetz)
 *  0049 151 ...       → +49151...
 *  +49 (0)151 ...     → +49151...
 *  ++49 / +49 0151    → +49151...
 *  +1 555 ...         → +1555...        (andere Länder bleiben erhalten)
 */
export function formatPhoneForCall(raw: string | null | undefined): string {
  if (!raw) return ''
  const hadPlus = String(raw).includes('+')
  let digits = String(raw).replace(/\D/g, '')
  if (!digits) return ''

  let intl = hadPlus
  if (digits.startsWith('00')) { digits = digits.slice(2); intl = true }

  if (intl) {
    // war international (+ oder 00): führende 0 nach Ländercode 49 entfernen
    digits = digits.replace(/^490+/, '49')
    return '+' + digits
  }
  if (digits.startsWith('49')) {
    digits = digits.replace(/^490+/, '49')
    return '+' + digits
  }
  if (digits.startsWith('0')) {
    // nationale Notation: führende 0 weg, +49 davor
    return '+49' + digits.replace(/^0+/, '')
  }
  // nackte Nummer ohne Kontext → deutsch annehmen
  return '+49' + digits
}

// Platzhalter-/Leerwerte, die KEINE echte Website sind
const WEBSITE_BLANKS = new Set([
  'na', 'n/a', 'n.a.', 'keine', 'kein', 'keine website', 'keinewebsite',
  '-', '--', '—', 'none', 'null', 'nan', 'k.a.', 'ka', 'tbd', '.',
])

/** true, wenn die URL eine echte anklickbare Adresse ist (kein "na", "-", leer …) */
export function isRealWebsite(url: string | null | undefined): boolean {
  const u = String(url || '').trim().toLowerCase()
  if (!u) return false
  if (WEBSITE_BLANKS.has(u)) return false
  if (!u.includes('.')) return false
  return true
}

/** Baut eine vollständige href (ergänzt https:// falls nötig) */
export function websiteHref(url: string): string {
  const u = (url || '').trim()
  return u.startsWith('http') ? u : `https://${u}`
}

/** Lesbares Label ohne Protokoll / abschließenden Slash */
export function websiteLabel(url: string): string {
  return (url || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')
}
