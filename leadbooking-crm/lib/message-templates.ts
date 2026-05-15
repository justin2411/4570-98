import { Lead, Profile } from '@/types'
import { buildEmailSignature } from './email-signature'

// ============================================================
// TEMPLATE-DEFINITIONEN
// Jedes Template hat: id, label, description, condition (wann anwendbar),
// + Default-Text mit Platzhaltern wie {kunde}, {termin_datum} etc.
// ============================================================

export interface TemplateDef {
  id: string
  label: string
  emoji: string
  description: string
  condition: (lead: Lead) => boolean
  defaultText: string
}

export interface EmailTemplateDef {
  id: 'email_body'
  label: string
  emoji: string
  description: string
  defaultSubject: string
  defaultBody: string
}

// E-Mail Template (genau 1)
export const EMAIL_TEMPLATE: EmailTemplateDef = {
  id: 'email_body',
  label: 'E-Mail Terminbestätigung',
  emoji: '📧',
  description: 'Wird nach „Termin gelegt" mit Mail-Programm geöffnet',
  defaultSubject: 'Bestätigung Ihres Beratungstermins am {termin_kurzdatum}',
  defaultBody: `Sehr geehrte Frau {kunde_nachname},

vielen Dank für unser nettes Telefongespräch und Ihr Interesse an einer Beratung zur Altersvorsorge & Vermögensaufbau speziell für Hebammen.

Hiermit bestätige ich Ihnen Ihren persönlichen Termin:

▸ Datum: {termin_datum}
▸ Uhrzeit: {termin_uhrzeit} Uhr
▸ Dauer: ca. 60 Minuten
▸ Beratungsraum: {teams_link}

Bitte klicken Sie wenige Minuten vor dem Termin auf den Microsoft Teams-Link. Eine Software-Installation ist nicht erforderlich – ein aktueller Browser genügt vollkommen.

Sollten Sie verhindert sein oder einen anderen Termin benötigen, melden Sie sich gerne rechtzeitig bei uns.

Ich freue mich auf unser Gespräch und wünsche Ihnen bis dahin alles Gute.

Mit freundlichen Grüßen

{signature}`,
}

// WhatsApp Templates (5 Stück)
export const WHATSAPP_TEMPLATES: TemplateDef[] = [
  {
    id: 'wa_confirmation',
    label: 'WhatsApp Terminbestätigung',
    emoji: '✅',
    description: 'Direkt nach gelegtem Termin schicken',
    condition: (lead) => lead.status === 'termin_gelegt' && !!lead.appointment_date,
    defaultText: `Hallo Frau {kunde_nachname} 😊

vielen Dank für unser Gespräch eben! Hiermit bestätige ich Ihnen Ihren Termin:

📅 {termin_datum}
⏰ {termin_uhrzeit} Uhr
💻 Online via Microsoft Teams

Den Teams-Link bekommen Sie noch separat per E-Mail. Bei Fragen oder falls etwas dazwischenkommt, melden Sie sich gerne jederzeit.

Liebe Grüße
{berater}
von Hebammen-Vorsorge`,
  },
  {
    id: 'wa_reminder',
    label: 'WhatsApp Termin-Erinnerung',
    emoji: '⏰',
    description: 'Ein Tag oder einige Stunden vor dem Termin',
    condition: (lead) => lead.status === 'termin_gelegt' && !!lead.appointment_date,
    defaultText: `Hallo Frau {kunde_nachname} 😊

kurze Erinnerung an unser Beratungsgespräch:

⏰ {termin_uhrzeit} Uhr
💻 Den Teams-Link finden Sie in der E-Mail von uns

Falls etwas dazwischenkommt, sagen Sie mir gerne kurz Bescheid. Sonst bis gleich! 🌸

Liebe Grüße
{berater}`,
  },
  {
    id: 'wa_no_reach',
    label: 'WhatsApp Nach „Nicht erreicht"',
    emoji: '🔁',
    description: 'Wenn Sie die Hebamme nicht erreichen konnten',
    condition: () => true,
    defaultText: `Hallo Frau {kunde_nachname} 😊

ich hatte gerade versucht Sie zu erreichen wegen Ihrer Anfrage zur kostenlosen Finanz-Beratung für Hebammen.

Wann hätten Sie heute oder morgen kurz 10 Minuten Zeit für ein Telefonat?

Liebe Grüße
{berater}
von Hebammen-Vorsorge`,
  },
  {
    id: 'wa_first_contact',
    label: 'WhatsApp Erstkontakt',
    emoji: '👋',
    description: 'Erste Kontaktaufnahme nach Lead-Eingang',
    condition: (lead) => lead.status === 'neu' || lead.status === 'angerufen',
    defaultText: `Hallo Frau {kunde_nachname} 😊

Sie hatten Interesse an einer kostenlosen Finanz-Beratung speziell für Hebammen gezeigt. Schön dass Sie dabei sind!

Wann hätten Sie heute oder morgen ca. 10 Minuten Zeit für ein kurzes Telefonat zum Kennenlernen?

Liebe Grüße
{berater}
von Hebammen-Vorsorge`,
  },
  {
    id: 'wa_no_show',
    label: 'WhatsApp No-Show Followup',
    emoji: '🤷',
    description: 'Wenn jemand den Termin nicht wahrgenommen hat',
    condition: (lead) => lead.status === 'termin_gelegt' || lead.status === 'termin_stattgefunden',
    defaultText: `Hallo Frau {kunde_nachname} 😊

wir haben Sie gerade zum Beratungsgespräch vermisst — ist alles ok bei Ihnen? Falls etwas dazwischengekommen ist, kein Problem.

Sollen wir einen neuen Termin finden? Wann würde es Ihnen besser passen?

Liebe Grüße
{berater}`,
  },
]

// ============================================================
// PLATZHALTER-LISTE für UI-Hinweise
// ============================================================
export const PLACEHOLDERS = [
  { key: '{kunde}', desc: 'Vorname der Hebamme', example: 'Anna' },
  { key: '{kunde_voll}', desc: 'Voller Name', example: 'Anna Müller' },
  { key: '{kunde_nachname}', desc: 'Nachname', example: 'Müller' },
  { key: '{berater}', desc: 'Dein Vorname', example: 'Justin' },
  { key: '{berater_voll}', desc: 'Dein voller Name', example: 'Justin Koch' },
  { key: '{bundesland}', desc: 'Bundesland', example: 'Bayern' },
  { key: '{email}', desc: 'E-Mail des Leads', example: 'anna@example.de' },
  { key: '{termin_datum}', desc: 'Datum lang', example: 'Donnerstag, 15. Mai 2026' },
  { key: '{termin_kurzdatum}', desc: 'Datum kurz', example: '15.05.2026' },
  { key: '{termin_uhrzeit}', desc: 'Uhrzeit', example: '14:00' },
  { key: '{teams_link}', desc: 'Microsoft Teams-Link', example: 'https://teams.microsoft.com/...' },
  { key: '{firma}', desc: 'Firma', example: 'Hebammen-Vorsorge' },
  { key: '{signature}', desc: 'Mail-Signatur (nur E-Mail)', example: '(Standard- oder eigene Signatur)' },
]

// ============================================================
// CUSTOM-TEMPLATES STRUKTUR (in profiles.custom_templates JSONB)
// ============================================================
export interface CustomTemplate {
  use_custom: boolean
  text?: string
  subject?: string  // nur für email_body
  body?: string    // nur für email_body
}

export type CustomTemplates = Record<string, CustomTemplate>

// ============================================================
// RENDER-LOGIC
// ============================================================

/**
 * Ersetzt alle Platzhalter durch echte Daten.
 */
export function renderMessage(text: string, lead: Lead, setter: Partial<Profile>, opts?: { includeSignature?: boolean }): string {
  const setterFull = setter.full_name || 'Ihr Berater'
  const setterFirst = setterFull.split(' ')[0] || 'Ihr Berater'

  const nameParts = (lead.name || '').trim().split(/\s+/).filter(p => p)
  const kundeVoll = lead.name || ''
  const kundeNachname = nameParts.length > 0 ? nameParts[nameParts.length - 1] : kundeVoll
  const kundeVorname = nameParts[0] || kundeVoll

  let terminDatum = '[Datum]'
  let terminKurz = '[Datum]'
  let terminUhrzeit = '[Uhrzeit]'
  if (lead.appointment_date) {
    const d = new Date(lead.appointment_date)
    terminDatum = d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    terminKurz = d.toLocaleDateString('de-DE')
    terminUhrzeit = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  }

  let signature = ''
  if (opts?.includeSignature) {
    signature = buildEmailSignature({
      full_name: setter.full_name || 'Ihr Berater',
      role_title: setter.role_title || 'Hebammen-Beratungsteam',
      phone_direct: setter.phone_direct || null,
      custom_signature: setter.custom_signature || null,
      use_custom_signature: setter.use_custom_signature || false,
    })
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
    .replaceAll('{termin_kurzdatum}', terminKurz)
    .replaceAll('{termin_uhrzeit}', terminUhrzeit)
    .replaceAll('{teams_link}', lead.teams_link || '[Teams-Link]')
    .replaceAll('{firma}', 'Hebammen-Vorsorge')
    .replaceAll('{signature}', signature)
}

/**
 * Liefert den effektiven Template-Text (custom wenn gesetzt, sonst default).
 */
export function getTemplateText(templateId: string, customTemplates: CustomTemplates | undefined | null): string {
  const custom = customTemplates?.[templateId]
  if (custom?.use_custom && custom.text?.trim()) return custom.text
  const def = WHATSAPP_TEMPLATES.find(t => t.id === templateId)
  return def?.defaultText || ''
}

/**
 * Spezielle Variante für E-Mail (Subject + Body).
 */
export function getEmailTemplate(customTemplates: CustomTemplates | undefined | null): { subject: string; body: string } {
  const custom = customTemplates?.['email_body']
  if (custom?.use_custom && custom.subject?.trim() && custom.body?.trim()) {
    return { subject: custom.subject, body: custom.body }
  }
  return { subject: EMAIL_TEMPLATE.defaultSubject, body: EMAIL_TEMPLATE.defaultBody }
}

/**
 * Welche WhatsApp-Templates passen zum aktuellen Lead-Status?
 */
export function applicableWhatsappTemplates(lead: Lead): TemplateDef[] {
  return WHATSAPP_TEMPLATES.filter(t => t.condition(lead))
}

/**
 * Komplette WhatsApp-Nachricht rendern (Template-Lookup + Platzhalter).
 */
export function renderWhatsapp(templateId: string, lead: Lead, setter: Partial<Profile>): string {
  const text = getTemplateText(templateId, setter.custom_templates as CustomTemplates | undefined)
  return renderMessage(text, lead, setter)
}

/**
 * Komplette E-Mail rendern.
 */
export function renderEmail(lead: Lead, setter: Partial<Profile>): { subject: string; body: string } {
  const { subject: subjT, body: bodyT } = getEmailTemplate(setter.custom_templates as CustomTemplates | undefined)
  return {
    subject: renderMessage(subjT, lead, setter),
    body: renderMessage(bodyT, lead, setter, { includeSignature: true }),
  }
}

/**
 * Baut wa.me URL die WhatsApp öffnet.
 */
export function buildWhatsappUrl(phone: string, text: string): string {
  const cleanPhone = (phone || '').replace(/\D/g, '')
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
}

/**
 * Baut mailto: URL die Mail-Programm öffnet.
 */
export function buildMailtoUrl(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
