/**
 * Generiert eine .ics Kalender-Einladung für einen Termin.
 * Outlook erkennt das als Einladung mit "Annehmen / Ablehnen" Buttons,
 * wenn METHOD:REQUEST gesetzt ist und ATTENDEE vorhanden ist.
 */

import { cleanLeadName } from './clean-name'

interface IcsInput {
  leadId: string
  appointmentDate: Date
  durationMinutes?: number // default 30
  leadName: string
  leadBeruf?: string | null
  leadPhone?: string
  leadEmail?: string | null
  leadNotes?: string | null
  setterName: string
  setterEmail?: string | null
  closerName: string
  closerEmail: string
  teamsLink?: string | null
}

function fmtUtc(d: Date): string {
  // Format: YYYYMMDDTHHMMSSZ
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  )
}

function escape(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function fold(line: string): string {
  // RFC 5545: lines > 75 octets müssen geteilt werden mit CRLF + space
  if (line.length <= 75) return line
  const chunks: string[] = []
  let rest = line
  let first = true
  while (rest.length > 0) {
    const limit = first ? 75 : 74
    chunks.push((first ? '' : ' ') + rest.slice(0, limit))
    rest = rest.slice(limit)
    first = false
  }
  return chunks.join('\r\n')
}

export function generateIcs(input: IcsInput): string {
  const start = input.appointmentDate
  const duration = input.durationMinutes ?? 30
  const end = new Date(start.getTime() + duration * 60 * 1000)
  const now = new Date()

  const beruf = (input.leadBeruf || '').trim()
  const cleanName = cleanLeadName(input.leadName, beruf)

  const description = [
    `Beratungstermin mit ${cleanName}`,
    beruf ? `💼 Beruf: ${beruf}` : '',
    '',
    `📞 Telefon: ${input.leadPhone ?? '—'}`,
    input.leadEmail ? `✉️ E-Mail: ${input.leadEmail}` : '',
    '',
    input.teamsLink ? `🔗 Teams-Beratungsraum:\\n${input.teamsLink}` : '',
    '',
    input.leadNotes ? `📝 Notizen vom Setter:\\n${input.leadNotes}` : '',
    '',
    `👤 Setter: ${input.setterName}`,
  ]
    .filter(Boolean)
    .join('\\n')

  const summary = `Beratung ${cleanName}${beruf ? ` (${beruf})` : ''}`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//XI CRM//DE',
    'METHOD:REQUEST',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${input.leadId}@xi-crm.local`,
    `DTSTAMP:${fmtUtc(now)}`,
    `DTSTART:${fmtUtc(start)}`,
    `DTEND:${fmtUtc(end)}`,
    `SUMMARY:${escape(summary)}`,
    `DESCRIPTION:${escape(description)}`,
    input.teamsLink ? `LOCATION:${escape(input.teamsLink)}` : 'LOCATION:Online-Beratungsraum',
    input.teamsLink ? `URL:${escape(input.teamsLink)}` : '',
    `ORGANIZER;CN=${escape(input.setterName)}:mailto:${input.setterEmail ?? 'noreply@example.com'}`,
    `ATTENDEE;CN=${escape(input.closerName)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${input.closerEmail}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'TRANSP:OPAQUE',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escape('Erinnerung: ' + summary)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)

  // Folding + CRLF
  return lines.map(fold).join('\r\n') + '\r\n'
}
