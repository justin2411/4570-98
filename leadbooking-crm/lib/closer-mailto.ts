/**
 * Erzeugt die mailto:-URL für die Closer-Benachrichtigung.
 *
 * Apple Mail / Outlook / Mailclient öffnen sich vorgefüllt.
 * Body enthält Termin-Infos + Link zur .ics-Datei.
 * Closer klickt auf den Link → Outlook lädt die .ics →
 * fragt "Annehmen / Ablehnen" → bei Annehmen: Termin im Outlook-Kalender. ✓
 */

interface ClosierMailtoInput {
  closerName: string
  closerEmail: string
  leadId: string
  leadName: string
  leadPhone?: string
  leadEmail?: string | null
  leadState?: string
  leadNotes?: string | null
  appointmentDate: Date
  setterName: string
  teamsLink?: string | null
  baseUrl?: string // default: aus window.location
}

function fmtDate(d: Date): string {
  return d.toLocaleString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function buildCloserMailto(input: ClosierMailtoInput): string {
  const baseUrl = input.baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : 'https://4570-98.vercel.app')
  const icsUrl = `${baseUrl}/api/ics/${input.leadId}`

  const subject = `Neuer Termin: ${input.leadName} – ${fmtDate(input.appointmentDate)}`

  const body = [
    `Hallo ${input.closerName.split(' ')[0]},`,
    '',
    `du hast einen neuen Beratungstermin:`,
    '',
    `👤 Kundin: ${input.leadName}`,
    `📞 Telefon: ${input.leadPhone ?? '—'}`,
    input.leadEmail ? `✉️ E-Mail: ${input.leadEmail}` : '',
    input.leadState ? `📍 Bundesland: ${input.leadState}` : '',
    `📅 Termin: ${fmtDate(input.appointmentDate)} Uhr`,
    input.teamsLink ? `🔗 Beratungsraum: ${input.teamsLink}` : '',
    '',
    input.leadNotes ? `📝 Notizen vom Setter:\n${input.leadNotes}\n` : '',
    '➡️ Termin direkt in Outlook übernehmen:',
    icsUrl,
    '',
    '(Klick auf den Link öffnet eine Kalender-Einladung — auf "Annehmen" tippen und der Termin landet automatisch in deinem Outlook-Kalender.)',
    '',
    'Viel Erfolg im Gespräch!',
    '',
    `— ${input.setterName}`,
    'Hebammen-Vorsorge',
  ]
    .filter(Boolean)
    .join('\n')

  return `mailto:${encodeURIComponent(input.closerEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
