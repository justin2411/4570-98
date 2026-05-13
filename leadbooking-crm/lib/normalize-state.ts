// ============================================================
// Bundesland-Normalisierung
// ------------------------------------------------------------
// Wandelt diverse Eingaben in offizielle Bundesland-Namen um.
// Behandelt:
//   - Abkürzungen (BAY, NRW, BaWü, ...)
//   - Mehrfach-Werte (z.B. "Bayern/BaWü" → erste gültige Auswahl)
//   - Groß-/Kleinschreibung
//   - Englische Namen (Bavaria, Saxony, ...)
//
// Wenn nichts erkannt wird → leerer String (Original sollte
// dann manuell geprüft werden).
// ============================================================

const STATE_ALIASES: Record<string, string> = {
  // Bayern
  'bayern': 'Bayern', 'bay': 'Bayern', 'by': 'Bayern', 'bavaria': 'Bayern',
  // Baden-Württemberg
  'baden-württemberg': 'Baden-Württemberg', 'baden württemberg': 'Baden-Württemberg',
  'badenwürttemberg': 'Baden-Württemberg', 'baden-wuerttemberg': 'Baden-Württemberg',
  'baden wuerttemberg': 'Baden-Württemberg', 'badenwuerttemberg': 'Baden-Württemberg',
  'bawü': 'Baden-Württemberg', 'bawue': 'Baden-Württemberg', 'bw': 'Baden-Württemberg',
  'baden': 'Baden-Württemberg', 'württemberg': 'Baden-Württemberg', 'wuerttemberg': 'Baden-Württemberg',
  // Berlin
  'berlin': 'Berlin', 'be': 'Berlin', 'ber': 'Berlin',
  // Brandenburg
  'brandenburg': 'Brandenburg', 'bb': 'Brandenburg', 'brb': 'Brandenburg',
  // Bremen
  'bremen': 'Bremen', 'hb': 'Bremen',
  // Hamburg
  'hamburg': 'Hamburg', 'hh': 'Hamburg', 'ham': 'Hamburg',
  // Hessen
  'hessen': 'Hessen', 'he': 'Hessen', 'hes': 'Hessen', 'hesse': 'Hessen',
  // Mecklenburg-Vorpommern
  'mecklenburg-vorpommern': 'Mecklenburg-Vorpommern', 'mecklenburg vorpommern': 'Mecklenburg-Vorpommern',
  'mv': 'Mecklenburg-Vorpommern', 'meck-pomm': 'Mecklenburg-Vorpommern',
  'meckpomm': 'Mecklenburg-Vorpommern', 'mecklenburg': 'Mecklenburg-Vorpommern', 'vorpommern': 'Mecklenburg-Vorpommern',
  // Niedersachsen
  'niedersachsen': 'Niedersachsen', 'ni': 'Niedersachsen', 'nds': 'Niedersachsen',
  'lower saxony': 'Niedersachsen',
  // Nordrhein-Westfalen
  'nordrhein-westfalen': 'Nordrhein-Westfalen', 'nordrhein westfalen': 'Nordrhein-Westfalen',
  'nrw': 'Nordrhein-Westfalen', 'nw': 'Nordrhein-Westfalen',
  'north rhine-westphalia': 'Nordrhein-Westfalen',
  // Rheinland-Pfalz
  'rheinland-pfalz': 'Rheinland-Pfalz', 'rheinland pfalz': 'Rheinland-Pfalz',
  'rlp': 'Rheinland-Pfalz', 'rp': 'Rheinland-Pfalz',
  // Saarland
  'saarland': 'Saarland', 'sl': 'Saarland', 'saa': 'Saarland',
  // Sachsen
  'sachsen': 'Sachsen', 'sn': 'Sachsen', 'sax': 'Sachsen', 'saxony': 'Sachsen',
  // Sachsen-Anhalt
  'sachsen-anhalt': 'Sachsen-Anhalt', 'sachsen anhalt': 'Sachsen-Anhalt',
  'st': 'Sachsen-Anhalt', 'sa': 'Sachsen-Anhalt',
  // Schleswig-Holstein
  'schleswig-holstein': 'Schleswig-Holstein', 'schleswig holstein': 'Schleswig-Holstein',
  'sh': 'Schleswig-Holstein', 'slh': 'Schleswig-Holstein', 'schleswig': 'Schleswig-Holstein',
  // Thüringen
  'thüringen': 'Thüringen', 'thueringen': 'Thüringen',
  'th': 'Thüringen', 'thu': 'Thüringen', 'thuringia': 'Thüringen',
}

export const VALID_STATES = [
  'Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen',
  'Hamburg', 'Hessen', 'Mecklenburg-Vorpommern', 'Niedersachsen',
  'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland', 'Sachsen',
  'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen',
] as const

const VALID_SET = new Set<string>(VALID_STATES as readonly string[])

export function isValidState(s: string | null | undefined): boolean {
  return !!s && VALID_SET.has(s)
}

/**
 * Normalisiert einen Bundesland-Eingabewert.
 *
 * @returns Offizieller Bundesland-Name (z.B. "Bayern") oder leerer String wenn nichts erkannt wurde.
 */
export function normalizeState(input: string | null | undefined): string {
  if (!input) return ''
  const raw = String(input).trim()
  if (!raw) return ''

  // Schnellweg: schon valide und ohne Trennzeichen → behalten
  if (VALID_SET.has(raw) && !/[\/,|&]/.test(raw)) return raw

  // Auf Trennzeichen splitten (/, ,, |, &, "oder", "und")
  const parts = raw.split(/[\/,|&]|\s+oder\s+|\s+und\s+/i)

  for (const part of parts) {
    const cleaned = part.trim().toLowerCase()
    if (!cleaned) continue
    if (cleaned in STATE_ALIASES) return STATE_ALIASES[cleaned]
    // Auch in Title-Case prüfen, falls schon offiziell geschrieben
    const titled = part.trim()
    if (VALID_SET.has(titled)) return titled
  }

  return ''
}

/**
 * Klassifiziert wie eine Normalisierung aussieht.
 */
export function classifyState(input: string | null | undefined): {
  normalized: string
  status: 'valid' | 'needs_fix' | 'unknown'
} {
  if (!input || !String(input).trim()) return { normalized: '', status: 'unknown' }
  const raw = String(input).trim()
  const normalized = normalizeState(raw)
  if (!normalized) return { normalized: '', status: 'unknown' }
  if (normalized === raw) return { normalized, status: 'valid' }
  return { normalized, status: 'needs_fix' }
}
