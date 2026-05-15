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
    content: 'Sie arbeiten als Hebamme in {bundesland}, ist das richtig? Sehr gut.',
  },
  {
    id: 'hook',
    emoji: '🤝',
    title: 'Hook & Kooperation',
    content: 'Ganz kurz, damit Sie mich einordnen: Wir arbeiten in einer offiziellen Kooperation mit der Hebammen-Koordinierungsstelle in {bundesland} zusammen. Im Rahmen dieser Kooperation melden wir uns einmal persönlich bei allen Hebammen im Verband — Sie sind eine davon.',
  },
  {
    id: 'problem',
    emoji: '💡',
    title: 'Problem-Pitch',
    content: 'Konkret geht es darum: Da Sie als Hebamme Ihre Rentenkasse selbst bespielen — wird das Thema Altersvorsorge immer wichtiger. Das weiß auch der Bund, deshalb gibt es staatliche Unterstützung, die Sie nutzen können.',
  },
  {
    id: 'angebot',
    emoji: '📅',
    title: 'Angebot',
    content: 'Seit dem 01.04.2026 gibt es hierzu bundesweite Online-Beratungen speziell für Hebammen und medizinische Fachkräfte — zu den Themen Steueroptimierung, staatliche Förderung und Altersvorsorge. Frau {kunde_nachname}, klingt das erstmal grundsätzlich interessant für Sie?',
  },
  {
    id: 'qualifizierung',
    emoji: '🎯',
    title: 'Qualifizierung',
    content: '• "Was genau klingt interessant?" → Alles klar\n• "Warum denken Sie, ist das Thema so wichtig für Sie?"',
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
    answer: 'Verstehe ich, Frau {kunde_nachname}. Ganz kurz nachgefragt — wann haben Sie sich zuletzt überhaupt mal mit dem Thema Altersvorsorge beschäftigt?\n\nWissen Sie, viele Hebammen sagen mir das genauso. Und am Ende der 60 Minuten sind sie ehrlich froh, dass wir\'s gemacht haben. Kostet nichts, völlig unverbindlich. Probieren wir\'s einfach?',
  },
  {
    id: 'keine-zeit',
    emoji: '⏰',
    title: 'Keine Zeit jetzt',
    answer: 'Klar, das versteh ich. Ganz kurz nur: Es geht wirklich um 2 Minuten am Telefon — reicht das jetzt gerade noch, oder soll ich Sie heute Abend nochmal anrufen? Wann passt\'s Ihnen besser?',
  },
  {
    id: 'mail',
    emoji: '📧',
    title: 'Schicken Sie Infos',
    answer: 'Mach ich gerne. Aber ehrlich gesagt — Infos per Mail bringen meist wenig. Jede Hebamme ist in einer anderen Situation. Lassen Sie uns lieber 60 Minuten zusammensetzen, dann kann ich konkret auf Ihre Lage eingehen. Wann hätten Sie\'s denn nächste Woche?',
  },
  {
    id: 'berater',
    emoji: '👥',
    title: 'Habe schon Berater',
    answer: 'Schön, dann sind Sie ja gut aufgestellt. Trotzdem — eine zweite Meinung schadet nie. Wir sehen oft, dass bei staatlicher Förderung noch viel ungenutzt liegen bleibt. Sehen Sie\'s einfach wie \'nen kostenlosen Check-Up. 60 Minuten, ohne Verpflichtung.',
  },
  {
    id: 'versorgt',
    emoji: '✅',
    title: 'Bin schon versorgt',
    answer: 'Das freut mich für Sie. Trotzdem — es kommen ständig neue Förderungen dazu, speziell für Selbstständige im Gesundheitsbereich. Ich zeig Ihnen einfach mal was neu ist. Wenn Sie eh alles haben, super. Wenn nicht, haben Sie was gelernt.',
  },
  {
    id: 'nummer',
    emoji: '⚠️',
    title: 'Woher Nummer?',
    answer: 'Berechtigte Frage. Sie haben vor ein paar Tagen im Internet nach Infos zur Altersvorsorge für Hebammen gesucht und sich bei uns eingetragen — entweder über unsere Website, einen Newsletter oder eine unserer Anzeigen auf Facebook oder Instagram. Deshalb melde ich mich jetzt persönlich bei Ihnen. Können Sie sich erinnern?',
  },
  {
    id: 'ueberlegen',
    emoji: '🤔',
    title: 'Ich überleg\'s mir',
    answer: 'Klar, kann ich nachvollziehen. Aber ganz ehrlich Frau {kunde_nachname} — Sie wissen ja selbst, im Alltag geht das schnell unter. Lassen Sie uns lieber direkt einen unverbindlichen Termin festmachen. Wenn Sie nach der Beratung sagen „passt nicht für mich" — dann passt es nicht. Aber Sie haben dann zumindest die Infos. Wann hätten Sie nächste Woche Zeit?',
  },
  {
    id: 'kosten',
    emoji: '💰',
    title: 'Was kostet das?',
    answer: 'Die Beratung ist komplett kostenlos und unverbindlich. Wir verdienen erst dann was, wenn wir Ihnen wirklich was vermitteln, das zu Ihnen passt. Wenn nicht — dann nicht.',
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
    .replaceAll('{email}', lead.email || '[E-Mail]')
    .replaceAll('{termin_datum}', terminDatum)
    .replaceAll('{termin_uhrzeit}', terminUhrzeit)
    .replaceAll('{firma}', 'Hebammen-Vorsorge')
}
