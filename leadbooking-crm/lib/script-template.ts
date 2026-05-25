import { Lead, Profile } from '@/types'

export interface ScriptSection {
  id: string
  emoji: string
  title: string
  content: string
}

export interface Objection {
  id: string
  emoji: string
  title: string
  answer: string
}

// Feste Plural-Zuordnung pro Beruf (für {beruf_plural}) — zentrale Quelle
export const BERUF_PLURAL: Record<string, string> = {
  'Psychotherapeut': 'Psychotherapeuten', 'Osteopath': 'Osteopathen', 'Logopäde': 'Logopäden',
  'Ergotherapeut': 'Ergotherapeuten', 'Massagepraxis': 'Massagepraxen', 'Heilpraktiker': 'Heilpraktiker',
  'Coach': 'Coaches', 'Fotografin': 'Fotografinnen', 'Yogalehrerin': 'Yogalehrerinnen',
  'Personal Trainer': 'Personal Trainer', 'Kosmetikerin': 'Kosmetikerinnen', 'Nagelstudio': 'Nagelstudios',
  'Handwerksmeister': 'Handwerksmeister', 'Ernährungsberater': 'Ernährungsberater', 'Hebamme': 'Hebammen',
}

// Beruf eines Leads in Singular + Plural auflösen (für {beruf} / {beruf_plural})
export function resolveBeruf(lead: Lead): { beruf: string; berufPlural: string } {
  const raw = ((lead as any).beruf || '').trim()
  if (!raw) return { beruf: 'Fachkraft', berufPlural: 'Fachkräfte' }
  return { beruf: raw, berufPlural: BERUF_PLURAL[raw] || raw }
}

// Berufsspezifischer Firmenname für {firma} (z.B. "Heilpraktiker-Vorsorge").
// Ohne hinterlegten Beruf: Fallback (z.B. Cluster-Firma) bzw. "Hebammen-Vorsorge".
export function resolveFirma(lead: Lead, fallback?: string | null): string {
  const raw = ((lead as any).beruf || '').trim()
  if (raw) return `${resolveBeruf(lead).berufPlural}-Vorsorge`
  return (fallback || '').trim() || 'Hebammen-Vorsorge'
}

export const SCRIPT_SECTIONS: ScriptSection[] = [
  {
    id: 'einstieg',
    emoji: '👋',
    title: 'Einstieg',
    content: 'Schönen guten Tag, hier ist {berater_voll} von {firma}. Spreche ich mit Frau {kunde_nachname}? Ich störe Sie hoffentlich nicht mitten im Berufsalltag, Frau {kunde_nachname}?',
  },
  {
    id: 'lokalisierung',
    emoji: '📍',
    title: 'Lokalisierung',
    content: 'Sie arbeiten als {beruf} in {bundesland}, ist das richtig? Sehr gut.',
  },
  {
    id: 'hook',
    emoji: '🤝',
    title: 'Hook & Kooperation',
    content: 'Ganz kurz, damit Sie mich einordnen: Wir arbeiten mit selbstständigen {beruf_plural} in {bundesland} zusammen. In diesem Rahmen unterstützen wir {beruf_plural} — Sie sind eine davon.',
  },
  {
    id: 'problem',
    emoji: '💡',
    title: 'Problem-Pitch',
    content: 'Konkret geht es darum: Da Sie als {beruf} Ihre Rentenkasse selbst bespielen — wird das Thema Altersvorsorge immer wichtiger. Das weiß auch der Bund, deshalb gibt es staatliche Unterstützung, die Sie nutzen können.',
  },
  {
    id: 'angebot',
    emoji: '📅',
    title: 'Angebot',
    content: 'Seit dem 01.04.2026 gibt es hierzu bundesweite Online-Beratungen speziell für {beruf_plural} — zu den Themen Steueroptimierung, staatliche Förderung und Altersvorsorge. Frau {kunde_nachname}, klingt das erstmal grundsätzlich interessant für Sie?',
  },
  {
    id: 'qualifizierung',
    emoji: '🎯',
    title: 'Qualifizierung',
    content: '• "Was genau klingt interessant?" → Alles klar\n• "Warum denken Sie, ist das Thema so wichtig für Sie?"\n• "Was würde sich für Sie ändern, wenn Sie das Thema gelöst haben?"',
  },
  {
    id: 'termin',
    emoji: '🗓',
    title: 'Terminvereinbarung',
    content: 'Super, aktuell gibt es noch Einzelberatungen, haben Sie gerade Ihren Terminkalender zur Hand oder im Kopf?\n\nJetzt erstmal — passt\'s Ihnen eher vormittags oder nachmittags?\n\n→ Termin ausmachen (Datum + Uhrzeit notieren)\n\nFrau {kunde_nachname}, damit ich Ihnen die Bestätigung auch sicher zustellen kann — Ihre E-Mail-Adresse lautet {email}, ist das noch aktuell?\n\nPerfekt. Dann schicke ich Ihnen gleich die wichtigsten Infos per Mail zu — inklusive Termin-Bestätigung und dem Microsoft-Teams-Link für die Beratung.',
  },
  {
    id: 'whatsapp',
    emoji: '💬',
    title: 'WhatsApp',
    content: 'Eine letzte Frage: Darf ich Ihnen die Bestätigung zusätzlich auch per WhatsApp schicken? Dann haben Sie alles direkt am Handy.',
  },
  {
    id: 'verabschiedung',
    emoji: '👋',
    title: 'Verabschiedung',
    content: 'Vielen Dank für das nette Gespräch. Dann freue ich mich, Sie am {termin_datum} um {termin_uhrzeit} Uhr im digitalen Beratungsraum begrüßen zu dürfen. Ich wünsche Ihnen bis dahin alles Gute und vor allem Gesundheit.',
  },
]

export const OBJECTIONS: Objection[] = [
  {
    id: 'kein-interesse',
    emoji: '❌',
    title: 'Kein Interesse',
    answer: 'Verstehe ich, Frau {kunde_nachname}. Ganz kurz nachgefragt — wann haben Sie sich zuletzt überhaupt mal mit dem Thema Altersvorsorge beschäftigt?\n\nWissen Sie was: Genau das sagen mir 9 von 10 {beruf_plural} zuerst. Und am Ende vom Termin sagen die meisten: „warum hab ich das nicht schon früher gemacht". Weil unsere Spezialistin Ihnen ganz konkret zeigt, welche Fördertöpfe der Bund speziell für {beruf_plural} aufgemacht hat — da geht\'s um richtig Geld pro Monat, das aktuell auf der Straße liegt. Kostet nichts, völlig unverbindlich, 60 Minuten online. Sie verlieren nichts — entweder Sie nehmen was mit, oder Sie wissen wenigstens Bescheid. Probieren wir\'s einfach?',
  },
  {
    id: 'keine-zeit',
    emoji: '⏰',
    title: 'Keine Zeit jetzt',
    answer: 'Klar, das versteh ich total. Ich brauch jetzt auch nur 2 Minuten — den ganzen Termin macht später unsere Spezialistin, und da nehmen Sie sich besser bewusst Zeit für, weil\'s wirklich was bringt. Reicht\'s jetzt gerade noch für 2 Minuten oder soll ich Sie heute Abend nochmal kurz anrufen?',
  },
  {
    id: 'mail',
    emoji: '📧',
    title: 'Schicken Sie Infos',
    answer: 'Mach ich gerne. Aber ganz ehrlich — Infos per Mail bringen Ihnen relativ wenig. Was bei einer Kollegin in Bayern voll zieht, passt bei Ihnen vielleicht gar nicht. Deshalb haben wir die Spezialistin: Die schaut sich Ihre konkrete Situation an und sagt Ihnen präzise, welche staatliche Förderung Sie als {beruf} bekommen — bis auf den Euro genau. In 60 Minuten haben Sie Klarheit. Sowas kriegen Sie über \'ne Mail nie. Wann hätten Sie\'s denn nächste Woche?',
  },
  {
    id: 'berater',
    emoji: '👥',
    title: 'Habe schon Berater',
    answer: 'Schön, dann sind Sie ja gut aufgestellt. Aber wissen Sie was wir oft sehen? Klassische Berater kennen sich selten im Detail mit Selbstständigen im Gesundheitsbereich aus — die Förderlandschaft ist da echt speziell. Unsere Spezialistin hat genau das im Fokus, schaut sich auch bestehende Verträge mit an und sieht meistens noch was, wo Förderung ungenutzt liegt. Eine zweite Meinung in 60 Minuten, kostenlos — kann sich für Sie schnell rechnen.',
  },
  {
    id: 'versorgt',
    emoji: '✅',
    title: 'Bin schon versorgt',
    answer: 'Das freut mich für Sie. Aber ganz ehrlich — der Bund hat letztes Jahr und auch 2026 wieder neue Fördertöpfe extra für Selbstständige aufgemacht. Die meisten {beruf_plural} wissen das nicht mal. Unsere Spezialistin schaut im Termin einfach drüber, ob da noch was Aktuelles für Sie dabei ist. Wenn nicht — super, dann sind Sie wirklich top versorgt. Wenn doch — haben Sie was Konkretes gewonnen.',
  },
  {
    id: 'nummer',
    emoji: '⚠️',
    title: 'Woher Nummer?',
    answer: 'Berechtigte Frage. Sie haben vor ein paar Tagen im Internet nach Infos zur Altersvorsorge für {beruf_plural} gesucht und sich bei uns eingetragen — entweder über unsere Website, einen Newsletter oder eine unserer Anzeigen auf Facebook oder Instagram. Deshalb melde ich mich jetzt persönlich bei Ihnen. Können Sie sich erinnern?',
  },
  {
    id: 'ueberlegen',
    emoji: '🤔',
    title: 'Ich überleg\'s mir',
    answer: 'Klar, das kann ich nachvollziehen. Aber Frau {kunde_nachname}, ganz ehrlich — überlegen Sie\'s sich doch erst NACH dem Termin. Vorher überlegen heißt: Sie wissen ja noch gar nicht worüber genau. Die Spezialistin zeigt Ihnen erstmal, was es konkret für Sie gibt — und dann haben Sie alle Fakten zum Abwägen. Wenn Sie nach 60 Minuten sagen „passt nicht für mich" — alles gut, dann passt es nicht. Aber Sie wissen wenigstens worüber Sie entscheiden. Wann hätten Sie nächste Woche?',
  },
  {
    id: 'kosten',
    emoji: '💰',
    title: 'Was kostet das?',
    answer: 'Die Beratung mit unserer Spezialistin ist komplett kostenlos und unverbindlich. Wir verdienen erst dann etwas, wenn die Spezialistin Ihnen wirklich etwas vermittelt, das zu Ihnen passt. Wenn nicht — dann nicht. Aber wertvoll ist der Termin für Sie auf jeden Fall: Sie wissen danach genau, welche staatliche Förderung Ihnen zusteht. Egal ob Sie was abschließen oder nicht — diese Klarheit nehmen Sie mit.',
  },
  {
    id: 'detail-frage',
    emoji: '🔍',
    title: 'Detail-Frage zum Thema',
    answer: 'Gute Frage — und ehrlich gesagt, genau dafür haben wir die Spezialistin. Da gibt\'s so viele Details speziell für {beruf_plural}, dass ich Ihnen jetzt am Telefon nichts Falsches sagen will. Aber wenn die Frage Sie umtreibt, ist das genau der richtige Punkt für die 60 Minuten. Da kriegen Sie die Antwort konkret, richtig und passgenau für Ihre Situation. Wann passt Ihnen der Termin?',
  },
]

/**
 * Ersetzt alle Platzhalter im Skript-Text mit echten Lead- und Setter-Daten.
 */
export function renderTemplate(text: string, lead: Lead, setter: Partial<Profile>): string {
  const setterFull = setter.full_name || 'Ihr Berater'
  const setterFirst = setterFull.split(' ')[0] || 'Ihr Berater'

  const nameParts = (lead.name || '').trim().split(/\s+/).filter(p => p)
  const kundeVoll = lead.name || ''
  const kundeNachname = nameParts.length > 0 ? nameParts[nameParts.length - 1] : kundeVoll
  const kundeVorname = nameParts[0] || kundeVoll

  const { beruf, berufPlural } = resolveBeruf(lead)

  // Termin-Datum/Uhrzeit (wenn vorhanden)
  let terminDatum = '[Datum]'
  let terminUhrzeit = '[Uhrzeit]'
  if (lead.appointment_date) {
    const d = new Date(lead.appointment_date)
    terminDatum = d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
    terminUhrzeit = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  }

  return text
    .replaceAll('{berater_voll}', setterFull)
    .replaceAll('{berater}', setterFirst)
    .replaceAll('{kunde_voll}', kundeVoll)
    .replaceAll('{kunde_nachname}', kundeNachname)
    .replaceAll('{kunde}', kundeVorname)
    .replaceAll('{bundesland}', lead.state || '[Bundesland]')
    .replaceAll('{beruf}', beruf)
    .replaceAll('{beruf_plural}', berufPlural)
    .replaceAll('{email}', lead.email || '[E-Mail]')
    .replaceAll('{termin_datum}', terminDatum)
    .replaceAll('{termin_uhrzeit}', terminUhrzeit)
    .replaceAll('{firma}', resolveFirma(lead))
}
