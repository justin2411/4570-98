// Heuristik: entfernt Praxis-/Service-/Branchenwörter aus Lead-Namen,
// damit z.B. "Akkupunktur Gebhard" → "Gebhard" wird.
// Das Original wird nie zu leer bereinigt — Fallback ist immer der Rohname.

const NAME_NOISE = new Set<string>([
  // Praxis / allgemein
  'praxis', 'praxen', 'praxisgemeinschaft', 'gemeinschaftspraxis', 'naturheilpraxis',
  'heilpraxis', 'heilpraktiker', 'heilpraktikerin',
  'institut', 'zentrum', 'center', 'centrum', 'studio', 'team', 'gesundheit',
  'gesundheitszentrum', 'gesundheitspraxis', 'therapie', 'therapiezentrum',
  // Akupunktur / TCM
  'akupunktur', 'akkupunktur', 'tcm',
  // Physio / Ergo / Logo / Osteo
  'physiotherapie', 'physio', 'physiotherapeut', 'physiotherapeutin', 'krankengymnastik',
  'ergotherapie', 'ergo', 'ergotherapeut', 'ergotherapeutin',
  'logopädie', 'logopaedie', 'logopäde', 'logopaede', 'logopädin', 'logopaedin',
  'osteopathie', 'osteopath', 'osteopathin',
  // Psycho
  'psychotherapie', 'psychotherapeut', 'psychotherapeutin', 'psychologie', 'psychologische',
  'psychologin', 'psychologe',
  // Massage / Wellness / Kosmetik / Nägel
  'massage', 'massagepraxis', 'wellness', 'spa',
  'kosmetik', 'kosmetikstudio', 'kosmetikinstitut', 'kosmetikerin',
  'nagelstudio', 'nagel', 'nägel', 'naegel', 'nails',
  // Yoga / Fitness
  'yoga', 'yogastudio', 'yogalehrerin', 'pilates', 'fitness', 'fitnessstudio',
  'personal', 'trainer', 'training',
  // Foto
  'fotografie', 'fotostudio', 'foto', 'fotograf', 'fotografin', 'photography',
  'photographie', 'photo',
  // Coaching / Ernährung / Hebamme / Handwerk
  'coaching', 'coach', 'ernährungsberatung', 'ernaehrungsberatung', 'ernährungsberater',
  'ernaehrungsberater', 'hebamme', 'hebammen', 'hebammenpraxis',
  'handwerk', 'handwerksmeister', 'meisterbetrieb', 'meister',
  // Rechtsformen / Verbinder
  'gmbh', 'mbh', 'ug', 'kg', 'ohg', 'gbr', 'ek', 'co', 'und', 'für', 'fuer', '&',
])

function normalizeToken(t: string): string {
  return t.toLowerCase().replace(/[.,;:|/\\()"'`]/g, '').trim()
}

export function cleanLeadName(rawName: string | null | undefined, beruf?: string | null): string {
  const raw = (rawName || '').trim()
  if (!raw) return ''
  const berufNorm = beruf ? normalizeToken(beruf) : ''
  const tokens = raw.split(/\s+/)
  const kept = tokens.filter(tok => {
    const n = normalizeToken(tok)
    if (!n) return false
    if (NAME_NOISE.has(n)) return false
    if (berufNorm && n === berufNorm) return false
    return true
  })
  const cleaned = kept.join(' ').trim()
  return cleaned || raw
}
