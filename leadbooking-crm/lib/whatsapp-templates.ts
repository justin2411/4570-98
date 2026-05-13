import { Lead } from '@/types'

export interface WhatsappTemplate {
  id: string
  label: string
  emoji: string
  description: string
  condition: (lead: Lead) => boolean
  render: (lead: Lead, setterName?: string) => string
}

function firstName(fullName: string): string {
  return (fullName || '').split(/\s+/)[0] || ''
}

function formatGermanDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('de-DE', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
  })
}

function formatGermanTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function sign(setterName?: string): string {
  if (!setterName) return '\n\nLiebe Grüße\nvon Hebammen Beratung'
  return `\n\nLiebe Grüße\n${firstName(setterName)}\nvon Hebammen Beratung`
}

// ============================================================
// TEMPLATES — Sie-Form, Termine via Microsoft Teams
// ============================================================
export const WHATSAPP_TEMPLATES: WhatsappTemplate[] = [
  {
    id: 'confirmation',
    label: 'Terminbestätigung',
    emoji: '✅',
    description: 'Direkt nach gelegtem Termin schicken',
    condition: (lead) => lead.status === 'termin_gelegt' && !!lead.appointment_date,
    render: (lead, setterName) => {
      const dt = lead.appointment_date!
      return `Hallo ${firstName(lead.name)},

vielen Dank für unser Gespräch eben! Hiermit bestätige ich Ihnen Ihren Termin:

📅 ${formatGermanDate(dt)}
⏰ ${formatGermanTime(dt)} Uhr
💻 Online via Microsoft Teams

Den Teams-Link erhalten Sie noch separat per E-Mail. Bei Fragen oder falls etwas dazwischenkommen sollte, melden Sie sich gerne jederzeit.${sign(setterName)}`
    },
  },
  {
    id: 'reminder',
    label: 'Termin-Erinnerung',
    emoji: '⏰',
    description: 'Ein Tag oder einige Stunden vor dem Termin',
    condition: (lead) => lead.status === 'termin_gelegt' && !!lead.appointment_date,
    render: (lead, setterName) => {
      const dt = lead.appointment_date!
      return `Hallo ${firstName(lead.name)},

kurze Erinnerung an unser Beratungsgespräch:

⏰ ${formatGermanTime(dt)} Uhr
💻 Den Teams-Link finden Sie in der E-Mail von uns

Falls etwas dazwischenkommt, sagen Sie mir gerne kurz Bescheid. Sonst bis gleich! 🌸${sign(setterName)}`
    },
  },
  {
    id: 'no_reach',
    label: 'Nach „Nicht erreicht"',
    emoji: '🔁',
    description: 'Wenn die Hebamme nicht erreicht werden konnte',
    condition: () => true,
    render: (lead, setterName) => {
      return `Hallo ${firstName(lead.name)},

ich hatte gerade versucht Sie zu erreichen wegen Ihrer Anfrage zur kostenlosen Finanz-Beratung für Hebammen über Facebook.

Wann hätten Sie heute oder morgen kurz 10 Minuten Zeit für ein Telefonat?${sign(setterName)}`
    },
  },
  {
    id: 'first_contact',
    label: 'Erstkontakt',
    emoji: '👋',
    description: 'Erste Kontaktaufnahme nach Lead-Eingang',
    condition: (lead) => lead.status === 'neu' || lead.status === 'angerufen',
    render: (lead, setterName) => {
      return `Hallo ${firstName(lead.name)},

Sie hatten sich über Facebook für eine kostenlose Finanz-Beratung speziell für Hebammen interessiert. Schön, dass Sie dabei sind!

Wann hätten Sie heute oder morgen ca. 10 Minuten Zeit für ein kurzes Telefonat zum Kennenlernen?${sign(setterName)}`
    },
  },
  {
    id: 'no_show',
    label: 'No-Show Followup',
    emoji: '🤷',
    description: 'Wenn jemand den Termin nicht wahrgenommen hat',
    condition: (lead) => lead.status === 'termin_gelegt' || lead.status === 'termin_stattgefunden',
    render: (lead, setterName) => {
      return `Hallo ${firstName(lead.name)},

wir haben Sie gerade zum Beratungsgespräch vermisst — ist alles in Ordnung bei Ihnen? Falls etwas dazwischengekommen ist, kein Problem.

Sollen wir einen neuen Termin finden? Wann würde es Ihnen besser passen?${sign(setterName)}`
    },
  },
]

export function applicableTemplates(lead: Lead): WhatsappTemplate[] {
  return WHATSAPP_TEMPLATES.filter(t => t.condition(lead))
}

export function buildWhatsappUrl(phone: string, text: string): string {
  const cleanPhone = (phone || '').replace(/\D/g, '')
  const encodedText = encodeURIComponent(text)
  return `https://wa.me/${cleanPhone}?text=${encodedText}`
}
