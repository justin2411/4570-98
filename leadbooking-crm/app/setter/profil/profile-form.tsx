'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'
import { buildEmailSignature } from '@/lib/email-signature'
import { CustomTemplates } from '@/lib/message-templates'
import { TemplatesEditor } from './templates-editor'
import toast from 'react-hot-toast'

interface Props {
  profile: Profile
}

export function ProfileForm({ profile }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)

  // Form-State
  const [fullName, setFullName] = useState(profile.full_name || '')
  const [roleTitle, setRoleTitle] = useState(profile.role_title || 'Hebammen-Beratungsteam')
  const [teamsRoomUrl, setTeamsRoomUrl] = useState(profile.teams_room_url || '')
  const [phoneDirect, setPhoneDirect] = useState(profile.phone_direct || '')
  const [useCustom, setUseCustom] = useState(profile.use_custom_signature || false)
  const [customSignature, setCustomSignature] = useState(profile.custom_signature || '')
  const [customTemplates, setCustomTemplates] = useState<CustomTemplates>(
    (profile.custom_templates as CustomTemplates) || {}
  )
  const [dailyGoal, setDailyGoal] = useState(profile.daily_goal ?? 10)
  const [soundEnabled, setSoundEnabled] = useState(profile.sound_enabled ?? true)

  // Live-Preview Signatur
  const previewSignature = buildEmailSignature({
    full_name: fullName,
    role_title: roleTitle,
    phone_direct: phoneDirect,
    custom_signature: customSignature,
    use_custom_signature: useCustom,
  })

  // Preview-Setter für Templates
  const setterForPreview: Partial<Profile> = {
    full_name: fullName,
    role_title: roleTitle,
    phone_direct: phoneDirect,
    custom_signature: customSignature,
    use_custom_signature: useCustom,
  }

  async function save() {
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        role_title: roleTitle.trim() || 'Hebammen-Beratungsteam',
        teams_room_url: teamsRoomUrl.trim() || null,
        phone_direct: phoneDirect.trim() || null,
        custom_signature: customSignature.trim() || null,
        use_custom_signature: useCustom,
        custom_templates: customTemplates,
        daily_goal: dailyGoal,
        sound_enabled: soundEnabled,
      })
      .eq('id', profile.id)

    if (error) {
      toast.error('Fehler: ' + error.message)
      setSaving(false)
      return
    }
    toast.success('Profil gespeichert ✓')
    setSaving(false)
  }

  const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5'
  const inputCls = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#2E75B6] focus:border-[#2E75B6] focus:outline-none'
  const hintCls = 'mt-1 text-xs text-gray-500'

  return (
    <div className="space-y-6">
      {/* Persönliche Daten */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-[#1E3A5F] mb-4">👤 Persönliche Daten</h2>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Vollständiger Name *</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="z.B. Justin Koch" className={inputCls} />
            <p className={hintCls}>Erscheint als Absender in Termin-E-Mails und WhatsApp.</p>
          </div>
          <div>
            <label className={labelCls}>Berufsbezeichnung / Rolle</label>
            <input type="text" value={roleTitle} onChange={e => setRoleTitle(e.target.value)} placeholder="z.B. Hebammen-Beratungsteam" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Direkt-Telefon (optional)</label>
            <input type="tel" value={phoneDirect} onChange={e => setPhoneDirect(e.target.value)} placeholder="z.B. +49 151 12345678" className={inputCls} />
          </div>
        </div>
      </section>

      {/* Teams-Raum */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-[#1E3A5F] mb-4">💼 Microsoft Teams-Raum</h2>
        <div>
          <label className={labelCls}>Persönlicher Beratungsraum-URL</label>
          <input type="url" inputMode="url" value={teamsRoomUrl} onChange={e => setTeamsRoomUrl(e.target.value)} placeholder="https://teams.microsoft.com/l/meetup-join/..." className={inputCls} />
          <p className={hintCls}>
            Wird automatisch in jede Termin-Bestätigung eingefügt.
          </p>
        </div>
      </section>

      {/* Signatur */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-[#1E3A5F] mb-4">✍️ Mail-Signatur</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <input type="checkbox" id="use-custom" checked={useCustom} onChange={e => setUseCustom(e.target.checked)} className="mt-0.5 w-4 h-4" />
            <label htmlFor="use-custom" className="flex-1 cursor-pointer text-sm">
              <span className="font-medium text-gray-900">Eigene Signatur verwenden</span>
              <p className="text-xs text-gray-600 mt-0.5">Sonst wird die Standard-Signatur genutzt.</p>
            </label>
          </div>
          {useCustom && (
            <div>
              <label className={labelCls}>Deine Signatur</label>
              <textarea value={customSignature} onChange={e => setCustomSignature(e.target.value)} rows={12} className={inputCls + ' font-mono text-xs leading-relaxed'} />
            </div>
          )}
        </div>
        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
          <div className="text-xs font-semibold text-gray-600 mb-1.5">🔍 So sieht deine Signatur aus:</div>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">{previewSignature}</pre>
        </div>
      </section>

      {/* Cockpit-Settings */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-[#1E3A5F] mb-4">⚡ Cockpit-Einstellungen</h2>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Tägliches Ziel (Termine pro Tag)</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={30}
                value={dailyGoal}
                onChange={e => setDailyGoal(Number(e.target.value))}
                className="flex-1"
              />
              <div className="w-16 text-center font-bold text-lg text-[#1E3A5F]">
                {dailyGoal}
              </div>
            </div>
            <p className={hintCls}>Der Fortschrittsbalken im Cockpit zeigt dir, wieviel du bis zum Ziel noch brauchst.</p>
          </div>

          <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={e => setSoundEnabled(e.target.checked)}
              className="mt-0.5 w-4 h-4"
            />
            <div className="flex-1 text-sm">
              <div className="font-medium text-gray-900">🔔 Erfolgs-Sound bei „Termin gelegt"</div>
              <div className="text-xs text-gray-600 mt-0.5">Kurzes „Ding-Ding-Ding" beim Speichern eines Termins. Motivierend, kann auch nervig sein — du entscheidest.</div>
            </div>
          </label>
        </div>
      </section>

      {/* Nachrichten-Vorlagen */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-[#1E3A5F] mb-1">💬 Nachrichten-Vorlagen</h2>
        <p className="text-xs text-gray-600 mb-4">
          Passe deine E-Mail und WhatsApp-Nachrichten an. Wenn du keinen eigenen Text setzt, wird die Standard-Vorlage verwendet.
        </p>
        <TemplatesEditor
          initialTemplates={customTemplates}
          setterPreview={setterForPreview}
          onChange={setCustomTemplates}
        />
      </section>

      {/* Save-Button */}
      <div className="flex items-center justify-end gap-3 sticky bottom-0 bg-gray-50 -mx-4 px-4 py-3 border-t border-gray-200" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
        <button
          onClick={save}
          disabled={saving || !fullName.trim()}
          className="px-6 py-2.5 rounded-lg bg-[#2E75B6] hover:bg-[#1E3A5F] active:scale-[0.98] text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
        >
          {saving ? 'Speichern...' : '✓ Profil speichern'}
        </button>
      </div>
    </div>
  )
}
