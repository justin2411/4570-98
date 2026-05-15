/**
 * Erzeugt die mailto:-URL für die Closer-Benachrichtigung.
 * Strukturierter Body mit klaren Sektionen, kein automatischer Kalender-Link
 * (Outlook wrappt Links und macht sie kaputt — der Closer trägt selbst ein).
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
  baseUrl?: string
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatPhone(phone?: string | null): string {
  if (!phone) return '—'
  const trimmed = phone.trim()
  if (trimmed.startsWith('+')) return trimmed
  // 0049... → +49..., 00... → +..., sonst einfach + davor
  return '+' + trimmed.replace(/^00/, '')
}

export function buildCloserMailto(input: ClosierMailtoInput): string {
  const subject = `Neuer Beratungstermin: ${input.leadName} – ${fmtDate(input.appointmentDate)}`
  const firstName = input.closerName.split(' ')[0]
  const phone = formatPhone(input.leadPhone)

  const lines: (string | null)[] = [
    `Hallo ${firstName},`,
    '',
    'du hast einen neuen Beratungstermin:',
    '',
    '',
    '📅  TERMIN',
    '──────────────────────',
    `${fmtDate(input.appointmentDate)}`,
    `${fmtTime(input.appointmentDate)} Uhr  ·  60 Minuten`,
    'Online via Microsoft Teams',
    '',
    '',
    '👤  KUNDIN',
    '──────────────────────',
    input.leadName,
    `📞  ${phone}`,
    input.leadEmail ? `✉️  ${input.leadEmail}` : null,
    input.leadState ? `📍  ${input.leadState}` : null,
  ]

  if (input.leadNotes && input.leadNotes.trim()) {
    lines.push('', '')
    lines.push('📝  NOTIZEN VOM SETTER')
    lines.push('──────────────────────')
    lines.push(input.leadNotes.trim())
  }

  if (input.teamsLink) {
    lines.push('', '')
    lines.push('🔗  TEAMS-BERATUNGSRAUM')
    lines.push('──────────────────────')
    lines.push(input.teamsLink)
  }

  lines.push('', '')
  lines.push('Bitte trage dir den Termin in deinen Kalender ein.')
  lines.push('')
  lines.push('Viel Erfolg im Gespräch!')
  lines.push('')
  lines.push(`– ${input.setterName}`)
  lines.push('Hebammen-Vorsorge')

  const body = lines.filter(l => l !== null).join('\n')

  return `mailto:${encodeURIComponent(input.closerEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
