// ============================================================
// Alters-PROXY — Schätzung „eher jünger / eher älter" aus Vorname + E-Mail.
//
// Wir haben (noch) keine echten Altersdaten. Dieser Proxy ist ein erster,
// bewusst einfacher Indikator, der im Hintergrund mitläuft: er fließt als
// Feature ins Probability-Modell (lib/lead-probability.ts) und wird damit
// NUR insoweit auf die Sortierung wirken, wie er tatsächlich mit Abschlüssen
// (termin_gelegt) korreliert — datengetrieben, kein hartgewichteter Bonus.
//
// Zwei Faktoren (über die Zeit erweiterbar):
//   1) Vorname  — Namens-Ära (jüngere vs. ältere deutsche Vornamen)
//   2) E-Mail   — Provider (t-online/aol/freenet = älter; gmail/icloud =
//                  jünger) + Geburtsjahr im Local-Part
// ============================================================

import type { Lead } from '@/types'
import { cleanLeadName } from './clean-name'

function norm(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-zäöüß-]/g, '')
}

// Vornamen mit Geburts-Peak ~1990–2012 → Träger:innen heute eher jung.
const YOUNG_NAMES = new Set<string>([
  // m
  'leon','luca','luka','finn','ben','paul','jonas','luis','louis','noah','elias','felix','maximilian','max','tim','tom','jan','nico','niklas','lukas','moritz','julian','david','simon','philipp','linus','emil','anton','oskar','theo','henry','henri','jakob','mats','liam','jannik','jannis','fabian','marvin','kevin','justin','dennis','pascal','colin','levi','milan','tyler','joel','jason','marlon','mika','samuel','vincent',
  // f
  'mia','emma','hannah','hanna','lena','lea','lara','lina','marie','sophie','sofie','sofia','laura','lilly','lilli','lily','emily','emilia','maja','maya','nele','pia','amelie','johanna','clara','klara','charlotte','frieda','greta','ida','mathilda','luisa','louisa','paula','romy','annika','vanessa','michelle','celine','chantal','jasmin','jessica','jennifer','leonie','mara','zoe','nora','isabell','isabelle','kim','lana','alina','melina','jolina','fenja','finja','neele','marleen','svenja',
])

// Vornamen mit Geburts-Peak ~1935–1965 → Träger:innen heute eher alt.
const OLD_NAMES = new Set<string>([
  // m
  'helmut','gerhard','horst','wolfgang','klaus','dieter','jürgen','juergen','manfred','günter','guenter','günther','guenther','heinz','reinhard','bernd','rolf','siegfried','hans','heinrich','werner','walter','herbert','kurt','erwin','otto','friedrich','wilhelm','ludwig','reinhold','eberhard','hartmut','detlef','volker','norbert','joachim','lothar','dietmar','wolfram','gunter','egon','helmuth','hubert','alfred','ewald','gustav','bruno','willi','karl-heinz','hans-peter','dietrich',
  // f
  'hildegard','gertrud','gertraud','ursula','renate','brigitte','monika','ingrid','karin','helga','elke','bärbel','baerbel','waltraud','waltraut','edeltraud','hannelore','christa','gisela','erika','inge','ingeborg','christel','roswitha','marianne','annegret','irmgard','adelheid','gudrun','hedwig','elfriede','wilma','margarete','margot','edith','ruth','else','erna','käthe','kaethe','hertha','lieselotte','liselotte','traute','rosemarie','ilse','herta','frieda-old','renata','sieglinde','ingelore','anneliese','mechthild',
])

const OLD_PROVIDERS = new Set<string>(['t-online.de', 'aol.com', 'aol.de', 'freenet.de', 'arcor.de', 'compuserve.de', 'gmx.at'])
const YOUNG_PROVIDERS = new Set<string>(['gmail.com', 'googlemail.com', 'icloud.com', 'me.com'])

/** Vorname-Lean: +1 eher jung, −1 eher alt, 0 neutral/unbekannt. */
export function firstNameAgeLean(firstName: string): -1 | 0 | 1 {
  const f = norm(firstName)
  if (!f) return 0
  if (YOUNG_NAMES.has(f)) return 1
  if (OLD_NAMES.has(f)) return -1
  return 0
}

/** E-Mail-Lean: Provider + Geburtsjahr im Local-Part. */
export function emailAgeLean(email: string): -1 | 0 | 1 {
  const e = (email || '').toLowerCase().trim()
  if (!e.includes('@')) return 0
  const [local, domain] = e.split('@')
  let lean = 0
  if (OLD_PROVIDERS.has(domain)) lean -= 1
  else if (YOUNG_PROVIDERS.has(domain)) lean += 1
  // Geburtsjahr im Local-Part (z. B. "max1958" / "lena2001")
  const ym = (local || '').match(/(19\d{2}|20[01]\d)/)
  if (ym) {
    const y = parseInt(ym[1], 10)
    if (y <= 1975) lean -= 1
    else if (y >= 1990) lean += 1
  }
  return lean < 0 ? -1 : lean > 0 ? 1 : 0
}

/**
 * Kombinierter Proxy-Band: 'younger' | 'older' | 'neutral'.
 * Summe aus Vorname-Lean + E-Mail-Lean.
 */
export function ageProxyBand(lead: Lead): 'younger' | 'older' | 'neutral' {
  const raw = ((lead as any).name || '').trim()
  const cleaned = cleanLeadName(raw, ((lead as any).beruf || ''))
  const first = cleaned.split(/\s+/).filter(Boolean)[0] || ''
  const sum = firstNameAgeLean(first) + emailAgeLean((lead as any).email || '')
  return sum > 0 ? 'younger' : sum < 0 ? 'older' : 'neutral'
}
