// LEGACY-Wrapper für alte Imports — leitet weiter auf die neue message-templates.ts
// Damit existierende Code-Stellen (slide-over etc.) ohne Änderung weiter funktionieren.

import { Lead, Profile } from '@/types'
import {
  WHATSAPP_TEMPLATES as NEW_TEMPLATES,
  applicableWhatsappTemplates,
  buildWhatsappUrl as newBuildWhatsappUrl,
  renderMessage,
  getTemplateText,
  TemplateDef,
  CustomTemplates,
} from './message-templates'

export interface WhatsappTemplate {
  id: string
  label: string
  emoji: string
  description: string
  condition: (lead: Lead) => boolean
  render: (lead: Lead, setterName?: string) => string
}

// Konvertiere neue Templates in alte Struktur für Legacy-Code
// Achtung: die render-Funktion hier kennt das Setter-Profil nicht voll, nur den Namen.
// Daher: minimal-Profile bauen aus setterName.
export const WHATSAPP_TEMPLATES: WhatsappTemplate[] = NEW_TEMPLATES.map((t: TemplateDef) => ({
  id: t.id,
  label: t.label,
  emoji: t.emoji,
  description: t.description,
  condition: t.condition,
  render: (lead: Lead, setterName?: string) => {
    const minimalSetter: Partial<Profile> = {
      full_name: setterName || 'Ihr Berater',
    }
    const text = t.defaultText
    return renderMessage(text, lead, minimalSetter)
  },
}))

export function applicableTemplates(lead: Lead): WhatsappTemplate[] {
  return applicableWhatsappTemplates(lead).map(t => WHATSAPP_TEMPLATES.find(w => w.id === t.id)!).filter(Boolean)
}

export function buildWhatsappUrl(phone: string, text: string): string {
  return newBuildWhatsappUrl(phone, text)
}
