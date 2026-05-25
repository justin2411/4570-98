import { Lead, Profile } from '@/types'
import { buildEmailSignature } from './email-signature'
import { resolveBeruf } from './script-template'
import { cleanLeadName } from './clean-name'

// ============================================================
// TEMPLATE-DEFINITIONEN
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
  id: string
  label: string
  emoji: string
  description: string
  condition: (lead: Lead) => boolean
  defaultSubject: string
  defaultBody: string
}

// ============================================================
// E-MAIL TEMPLATES (4)
// ============================================================
export const EMAIL_TEMPLATES: EmailTemplateDef[] = [
  {
    id: 'email_confirmation',
    label: 'E-Mail Terminbestätigung',
    emoji: '✅',
    description: 'Direkt nach „Termin gelegt"',
    condition: (lead) => lead.status === 'termin_gelegt' && !!lead.appointment_date,
    defaultSubject: 'Bestätigung Ihres Beratungstermins am {termin_kurzdatum}',
    defaultBody: `Sehr geehrte Frau {kunde_nachname},

vielen Dank für unser nettes Telefongespräch und Ihr Interesse an einer Beratung zur Altersvorsorge & Vermögensaufbau speziell für {beruf_plural}.

Hiermit bestätige ich Ihnen Ihren persönlichen Termin:

▸ Datum: {termin_datum}
▸ Uhrzeit: {termin_uhrzeit} Uhr
▸ Dauer: ca. 60 Minuten

🔗 Ihr Microsoft Teams-Beratungsraum:
{teams_link}

Bitte klicken Sie wenige Minuten vor dem Termin auf den Link. Eine Software-Installation ist nicht erforderlich – ein aktueller Browser genügt vollkommen.

Sollten Sie verhindert sein oder einen anderen Termin benötigen, melden Sie sich gerne rechtzeitig bei uns.

Ich freue mich auf unser Gespräch und wünsche Ihnen bis dahin alles Gute.

Mit freundlichen Grüßen

{signature}`,
  },
  {
    id: 'email_reminder',
    label: 'E-Mail Erinnerung — 24h vorher',
    emoji: '📅',
    description: 'Tag vor dem Termin verschicken',
    condition: (lead) => lead.status === 'termin_gelegt' && !!lead.appointment_date,
    defaultSubject: 'Erinnerung: Ihr Beratungstermin morgen, {termin_kurzdatum}',
    defaultBody: `Sehr geehrte Frau {kunde_nachname},

eine freundliche Erinnerung an Ihren morgigen Beratungstermin:

▸ Datum: {termin_datum}
▸ Uhrzeit: {termin_uhrzeit} Uhr

🔗 Ihr Microsoft Teams-Beratungsraum:
{teams_link}

Bitte klicken Sie wenige Minuten vor Termin-Beginn auf den Link. Eine Installation ist nicht nötig – Sie können direkt im Browser teilnehmen.

Sollten Sie wider Erwarten verhindert sein, melden Sie sich gerne kurz bei uns, damit wir einen neuen Termin finden können.

Ich freue mich auf unser Gespräch morgen!

Mit freundlichen Grüßen

{signature}`,
  },
  {
    id: 'email_reminder_3h',
    label: 'E-Mail Erinnerung — 3h vorher',
    emoji: '⏰',
    description: 'Kurz vor dem Termin (heute)',
    condition: (lead) => lead.status === 'termin_gelegt' && !!lead.appointment_date,
    defaultSubject: 'Heute {termin_uhrzeit} Uhr — Ihr Beratungstermin',
    defaultBody: `Sehr geehrte Frau {kunde_nachname},

unser Beratungsgespräch beginnt heute in wenigen Stunden:

▸ Heute, {termin_uhrzeit} Uhr

🔗 Ihr Microsoft Teams-Beratungsraum:
{teams_link}

Bitte klicken Sie wenige Minuten vor Termin-Beginn auf den Link – Sie können direkt im Browser teilnehmen, keine Installation nötig.

Ich freue mich auf unser Gespräch!

Mit freundlichen Grüßen

{signature}`,
  },
  {
    id: 'email_no_show',
    label: 'E-Mail No-Show Nachfassen',
    emoji: '🤷',
    description: 'Wenn der Lead zum Termin nicht erschienen ist',
    condition: (lead) => lead.status === 'termin_gelegt' || lead.status === 'termin_stattgefunden',
    defaultSubject: 'Schade — wir haben Sie heute vermisst',
    defaultBody: `Sehr geehrte Frau {kunde_nachname},

wir haben Sie heute zum vereinbarten Beratungstermin um {termin_uhrzeit} Uhr leider vergeblich erwartet.

Falls etwas Wichtiges dazwischengekommen ist — kein Problem! Das kann jedem mal passieren.

Möchten Sie einen neuen Termin vereinbaren? Antworten Sie einfach kurz auf diese E-Mail mit Ihren Wunschterminen, oder melden Sie sich telefonisch.

Ich würde mich freuen, Sie kennenzulernen und Ihnen die staatlichen Förderungen für {beruf_plural} zu zeigen.

Mit freundlichen Grüßen

{signature}`,
  },
]

// ============================================================
// WHATSAPP TEMPLATES (5)
// ============================================================
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

🔗 Hier ist Ihr Teams-Link:
{teams_link}

Bitte klicken Sie wenige Minuten vor dem Termin auf den Link — eine Installation ist nicht nötig.

Bei Fragen oder falls etwas dazwischenkommt, melden Sie sich gerne jederzeit.

Liebe Grüße
{berater}
von {firma}`,
  },
  {
    id: 'wa_reminder',
    label: 'WhatsApp Erinnerung — 24h vorher',
    emoji: '📅',
    description: 'Tag vor dem Termin verschicken',
    condition: (lead) => lead.status === 'termin_gelegt' && !!lead.appointment_date,
    defaultText: `Hallo Frau {kunde_nachname} 😊

freue mich, dass wir uns morgen sehen!

📅 {termin_datum}
⏰ {termin_uhrzeit} Uhr

🔗 Hier ist Ihr Teams-Link für morgen:
{teams_link}

Kurz vor Termin-Beginn einfach den Link antippen — direkt im Browser, keine Installation nötig.

Falls Ihnen noch etwas dazwischen kommt, geben Sie mir gerne kurz Bescheid.

Liebe Grüße
{berater}`,
  },
  {
    id: 'wa_reminder_3h',
    label: 'WhatsApp Erinnerung — 3h vorher',
    emoji: '⏰',
    description: 'Kurz vor dem Termin (heute)',
    condition: (lead) => lead.status === 'termin_gelegt' && !!lead.appointment_date,
    defaultText: `Hallo Frau {kunde_nachname} 😊

kurze Erinnerung — unser Termin ist heute in wenigen Stunden:

⏰ Heute, {termin_uhrzeit} Uhr

🔗 Hier ist nochmal Ihr Teams-Link:
{teams_link}

Einfach kurz vor Termin-Beginn antippen — direkt im Browser. Bis gleich! 🌸

Liebe Grüße
{berater}`,
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
// PLATZHALTER-LISTE
// ============================================================
export const PLACEHOLDERS = [
  { key: '{kunde}', desc: 'Vorname des Leads', example: 'Anna' },
  { key: '{kunde_voll}', desc: 'Voller Name', example: 'Anna Müller' },
  { key: '{kunde_nachname}', desc: 'Nachname', example: 'Müller' },
  { key: '{berater}', desc: 'Dein Vorname', example: 'Justin' },
  { key: '{berater_voll}', desc: 'Dein voller Name', example: 'Justin Koch' },
  { key: '{bundesland}', desc: 'Bundesland', example: 'Bayern' },
  { key: '{beruf}', desc: 'Beruf des Leads (Singular)', example: 'Hebamme' },
  { key: '{beruf_plural}', desc: 'Beruf des Leads (Plural)', example: 'Hebammen' },
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
  subject?: string
  body?: string
}

export type CustomTemplates = Record<string, CustomTemplate>

// ============================================================
// RENDER-LOGIC
// ============================================================

export function renderMessage(text: string, lead: Lead, setter: Partial<Profile>, opts?: { includeSignature?: boolean }): string {
  const setterFull = setter.full_name || 'Ihr Berater'
  const setterFirst = setterFull.split(' ')[0] || 'Ihr Berater'

  const { beruf, berufPlural } = resolveBeruf(lead)

  const kundeVoll = cleanLeadName(lead.name, beruf)
  const nameParts = kundeVoll.split(/\s+/).filter(p => p)
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
    .replaceAll('{beruf}', beruf)
    .replaceAll('{beruf_plural}', berufPlural)
    .replaceAll('{email}', lead.email || '[E-Mail]')
    .replaceAll('{termin_datum}', terminDatum)
    .replaceAll('{termin_kurzdatum}', terminKurz)
    .replaceAll('{termin_uhrzeit}', terminUhrzeit)
    .replaceAll('{teams_link}', lead.teams_link || '[Teams-Link]')
    .replaceAll('{firma}', 'Hebammen-Vorsorge')
    .replaceAll('{signature}', signature)
}

// WhatsApp helpers
export function getTemplateText(templateId: string, customTemplates: CustomTemplates | undefined | null): string {
  const custom = customTemplates?.[templateId]
  if (custom?.use_custom && custom.text?.trim()) return custom.text
  const def = WHATSAPP_TEMPLATES.find(t => t.id === templateId)
  return def?.defaultText || ''
}

// Email helpers — now takes templateId
export function getEmailTemplate(
  templateId: string,
  customTemplates: CustomTemplates | undefined | null
): { subject: string; body: string } {
  // Backward-Compat: alter 'email_body' key gilt als 'email_confirmation'
  const legacyKey = (templateId === 'email_confirmation' && customTemplates?.['email_body']?.use_custom) ? 'email_body' : null
  const custom = customTemplates?.[legacyKey || templateId]

  if (custom?.use_custom && custom.subject?.trim() && custom.body?.trim()) {
    return { subject: custom.subject, body: custom.body }
  }
  const def = EMAIL_TEMPLATES.find(t => t.id === templateId)
  if (!def) {
    // Fallback (sollte nicht vorkommen)
    const conf = EMAIL_TEMPLATES.find(t => t.id === 'email_confirmation')!
    return { subject: conf.defaultSubject, body: conf.defaultBody }
  }
  return { subject: def.defaultSubject, body: def.defaultBody }
}

export function applicableWhatsappTemplates(lead: Lead): TemplateDef[] {
  return WHATSAPP_TEMPLATES.filter(t => t.condition(lead))
}

export function applicableEmailTemplates(lead: Lead): EmailTemplateDef[] {
  return EMAIL_TEMPLATES.filter(t => t.condition(lead))
}

export function renderWhatsapp(templateId: string, lead: Lead, setter: Partial<Profile>): string {
  const text = getTemplateText(templateId, setter.custom_templates as CustomTemplates | undefined)
  return renderMessage(text, lead, setter)
}

export function renderEmail(
  templateId: string,
  lead: Lead,
  setter: Partial<Profile>
): { subject: string; body: string } {
  const { subject: subjT, body: bodyT } = getEmailTemplate(templateId, setter.custom_templates as CustomTemplates | undefined)
  return {
    subject: renderMessage(subjT, lead, setter),
    body: renderMessage(bodyT, lead, setter, { includeSignature: true }),
  }
}

export function buildWhatsappUrl(phone: string, text: string): string {
  const cleanPhone = (phone || '').replace(/\D/g, '')
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
}

export function buildMailtoUrl(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
