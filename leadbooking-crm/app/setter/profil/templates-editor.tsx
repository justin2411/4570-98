'use client'

import { useState } from 'react'
import { Profile, Lead } from '@/types'
import {
  EMAIL_TEMPLATE,
  WHATSAPP_TEMPLATES,
  PLACEHOLDERS,
  CustomTemplates,
  renderMessage,
} from '@/lib/message-templates'
import { ChevronDown, ChevronUp, RotateCcw, MessageSquare, Mail } from 'lucide-react'

interface Props {
  initialTemplates: CustomTemplates
  setterPreview: Partial<Profile>
  onChange: (templates: CustomTemplates) => void
}

// Beispiel-Lead für die Live-Preview
const PREVIEW_LEAD: Lead = {
  id: 'preview',
  assigned_to: null,
  uploaded_by: '',
  name: 'Anna Müller',
  phone: '+49 151 12345678',
  email: 'anna.mueller@example.de',
  state: 'Bayern',
  score: 0,
  lead_quality: '',
  age_indicator: '',
  signals: '',
  status: 'termin_gelegt',
  appointment_date: (() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    d.setHours(14, 0, 0, 0)
    return d.toISOString()
  })(),
  recall_date: null,
  notes: null,
  call_attempts: 0,
  last_call_attempt: null,
  teams_link: 'https://teams.microsoft.com/l/meetup-join/...',
  created_at: '',
  updated_at: '',
}

export function TemplatesEditor({ initialTemplates, setterPreview, onChange }: Props) {
  const [templates, setTemplates] = useState<CustomTemplates>(initialTemplates)
  const [openId, setOpenId] = useState<string | null>(null)

  function updateTemplate(id: string, updates: Partial<CustomTemplates[string]>) {
    const next = {
      ...templates,
      [id]: { ...templates[id], use_custom: templates[id]?.use_custom ?? false, ...updates },
    }
    setTemplates(next)
    onChange(next)
  }

  function reset(id: string) {
    if (!confirm('Diesen eigenen Text löschen und Standard wiederherstellen?')) return
    const next = { ...templates }
    delete next[id]
    setTemplates(next)
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {/* Hilfe-Block */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
        <strong>💡 So funktioniert's:</strong> Klick auf eine Vorlage → Toggle „Eigene Version verwenden" → 
        deinen Text eintippen. Nutze Platzhalter wie <code className="bg-blue-100 px-1 rounded">{'{kunde}'}</code> oder <code className="bg-blue-100 px-1 rounded">{'{termin_datum}'}</code>. 
        Die Live-Vorschau zeigt dir wie's mit echten Daten aussieht.
      </div>

      {/* E-Mail Template */}
      <TemplateRow
        id={EMAIL_TEMPLATE.id}
        label={EMAIL_TEMPLATE.label}
        emoji={EMAIL_TEMPLATE.emoji}
        description={EMAIL_TEMPLATE.description}
        isOpen={openId === EMAIL_TEMPLATE.id}
        onToggleOpen={() => setOpenId(openId === EMAIL_TEMPLATE.id ? null : EMAIL_TEMPLATE.id)}
        isEmail
        current={templates[EMAIL_TEMPLATE.id]}
        defaultSubject={EMAIL_TEMPLATE.defaultSubject}
        defaultBody={EMAIL_TEMPLATE.defaultBody}
        setterPreview={setterPreview}
        onChange={(updates) => updateTemplate(EMAIL_TEMPLATE.id, updates)}
        onReset={() => reset(EMAIL_TEMPLATE.id)}
      />

      {/* WhatsApp Templates */}
      {WHATSAPP_TEMPLATES.map(t => (
        <TemplateRow
          key={t.id}
          id={t.id}
          label={t.label}
          emoji={t.emoji}
          description={t.description}
          isOpen={openId === t.id}
          onToggleOpen={() => setOpenId(openId === t.id ? null : t.id)}
          current={templates[t.id]}
          defaultText={t.defaultText}
          setterPreview={setterPreview}
          onChange={(updates) => updateTemplate(t.id, updates)}
          onReset={() => reset(t.id)}
        />
      ))}
    </div>
  )
}

// ============== TEMPLATE-ROW ==============

interface RowProps {
  id: string
  label: string
  emoji: string
  description: string
  isOpen: boolean
  onToggleOpen: () => void
  isEmail?: boolean
  current?: CustomTemplates[string]
  defaultText?: string
  defaultSubject?: string
  defaultBody?: string
  setterPreview: Partial<Profile>
  onChange: (updates: Partial<CustomTemplates[string]>) => void
  onReset: () => void
}

function TemplateRow(props: RowProps) {
  const useCustom = props.current?.use_custom || false
  const hasCustom = useCustom && (props.current?.text?.trim() || props.current?.body?.trim())

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Header */}
      <button
        onClick={props.onToggleOpen}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {props.isEmail ? <Mail className="w-4 h-4 text-gray-500 shrink-0" /> : <MessageSquare className="w-4 h-4 text-gray-500 shrink-0" />}
          <div className="min-w-0">
            <div className="font-semibold text-sm text-[#1E3A5F] truncate">
              {props.emoji} {props.label}
            </div>
            <div className="text-xs text-gray-500 truncate">{props.description}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasCustom && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-semibold">EIGEN</span>}
          {props.isOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </div>
      </button>

      {/* Body */}
      {props.isOpen && (
        <div className="p-4 space-y-3 border-t border-gray-200">
          {/* Toggle */}
          <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={useCustom}
              onChange={e => props.onChange({ use_custom: e.target.checked })}
              className="mt-0.5 w-4 h-4"
            />
            <div className="flex-1 text-sm">
              <div className="font-medium text-gray-900">Eigene Version verwenden</div>
              <div className="text-xs text-gray-600">
                Wenn deaktiviert: Standard-Vorlage wird genutzt.
              </div>
            </div>
            {hasCustom && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); props.onReset() }}
                className="text-xs text-red-600 hover:underline flex items-center gap-1"
                type="button"
              >
                <RotateCcw className="w-3 h-3" />
                Zurücksetzen
              </button>
            )}
          </label>

          {/* Editor + Preview (nur wenn useCustom aktiv) */}
          {useCustom ? (
            <CustomEditor {...props} />
          ) : (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="text-xs font-semibold text-yellow-900 mb-2">📄 Standard-Vorlage (wird verwendet):</div>
              <div className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
                {props.isEmail ? (
                  <>
                    <strong>Betreff:</strong> {props.defaultSubject}
                    <br /><br />
                    {props.defaultBody}
                  </>
                ) : (
                  props.defaultText
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============== CUSTOM EDITOR mit Live-Preview ==============

function CustomEditor(props: RowProps) {
  const subject = props.current?.subject ?? props.defaultSubject ?? ''
  const text = props.isEmail ? (props.current?.body ?? props.defaultBody ?? '') : (props.current?.text ?? props.defaultText ?? '')

  function insertPlaceholder(placeholder: string) {
    if (props.isEmail) {
      props.onChange({ body: (props.current?.body ?? props.defaultBody ?? '') + placeholder })
    } else {
      props.onChange({ text: (props.current?.text ?? props.defaultText ?? '') + placeholder })
    }
  }

  // Live-Preview
  const renderedSubject = props.isEmail ? renderMessage(subject, PREVIEW_LEAD, props.setterPreview) : ''
  const renderedText = renderMessage(text, PREVIEW_LEAD, props.setterPreview, { includeSignature: props.isEmail })

  return (
    <div className="space-y-3">
      {/* Subject (nur E-Mail) */}
      {props.isEmail && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Betreff</label>
          <input
            type="text"
            value={subject}
            onChange={e => props.onChange({ subject: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#2E75B6] focus:border-[#2E75B6] focus:outline-none"
          />
        </div>
      )}

      {/* Body / Text */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {props.isEmail ? 'Nachrichten-Text' : 'Text'}
        </label>
        <textarea
          value={text}
          onChange={e => props.isEmail ? props.onChange({ body: e.target.value }) : props.onChange({ text: e.target.value })}
          rows={props.isEmail ? 14 : 8}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#2E75B6] focus:border-[#2E75B6] focus:outline-none font-mono leading-relaxed"
        />
      </div>

      {/* Placeholder Buttons */}
      <div>
        <div className="text-xs font-medium text-gray-700 mb-1.5">Platzhalter einfügen (Klick = ans Ende):</div>
        <div className="flex flex-wrap gap-1.5">
          {PLACEHOLDERS.filter(p => props.isEmail || p.key !== '{signature}').map(p => (
            <button
              key={p.key}
              onClick={() => insertPlaceholder(p.key)}
              title={`${p.desc} → z.B. ${p.example}`}
              type="button"
              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded text-xs text-blue-800 font-mono"
            >
              {p.key}
            </button>
          ))}
        </div>
      </div>

      {/* Live Preview */}
      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
        <div className="text-xs font-semibold text-green-900 mb-2">
          🔍 Live-Vorschau mit Beispiel-Lead „Anna Müller":
        </div>
        {props.isEmail && (
          <div className="text-xs text-gray-700 mb-2 pb-2 border-b border-green-300">
            <strong>Betreff:</strong> {renderedSubject}
          </div>
        )}
        <div className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
          {renderedText}
        </div>
      </div>
    </div>
  )
}
