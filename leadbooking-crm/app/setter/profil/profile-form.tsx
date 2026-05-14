'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'
import { buildEmailSignature } from '@/lib/email-signature'
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

  // Preview-Berechnung
  const previewSignature = buildEmailSignature({
    full_name: fullName,
    role_title: roleTitle,
    phone_direct: phoneDirect,
    custom_signature: customSignature,
    use_custom_signature: useCustom,
  })

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
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="z.B. Justin Koch"
              className={inputCls}
            />
            <p className={hintCls}>Erscheint als Absender in Termin-E-Mails und WhatsApp.</p>
          </div>

          <div>
            <label className={labelCls}>Berufsbezeichnung / Rolle</label>
            <input
              type="text"
              value={roleTitle}
              onChange={e => setRoleTitle(e.target.value)}
              placeholder="z.B. Hebammen-Beratungsteam"
              className={inputCls}
            />
            <p className={hintCls}>Erscheint unter deinem Namen in der Mail-Signatur.</p>
          </div>

          <div>
            <label className={labelCls}>Direkt-Telefon (optional)</label>
            <input
              type="tel"
              value={phoneDirect}
              onChange={e => setPhoneDirect(e.target.value)}
              placeholder="z.B. +49 151 12345678"
              className={inputCls}
            />
            <p className={hintCls}>Wird in der Signatur angezeigt — falls die Hebamme dich direkt erreichen können soll.</p>
          </div>
        </div>
      </section>

      {/* Teams-Raum */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-[#1E3A5F] mb-4">💼 Microsoft Teams-Raum</h2>

        <div>
          <label className={labelCls}>Persönlicher Beratungsraum-URL</label>
          <input
            type="url"
            inputMode="url"
            value={teamsRoomUrl}
            onChange={e => setTeamsRoomUrl(e.target.value)}
            placeholder="https://teams.microsoft.com/l/meetup-join/..."
            className={inputCls}
          />
          <p className={hintCls}>
            Wird automatisch in jede Termin-Bestätigung eingefügt. So musst du den Link nicht jedes Mal manuell eintippen.
            <br />
            <span className="text-blue-700">👉 In Teams: Kalender → „Sofortbesprechung" → „Link kopieren" → hier einfügen.</span>
          </p>
        </div>
      </section>

      {/* Signatur */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-[#1E3A5F] mb-4">✍️ Mail-Signatur</h2>

        <div className="space-y-4">
          {/* Toggle */}
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              id="use-custom"
              checked={useCustom}
              onChange={e => setUseCustom(e.target.checked)}
              className="mt-0.5 w-4 h-4"
            />
            <label htmlFor="use-custom" className="flex-1 cursor-pointer text-sm">
              <span className="font-medium text-gray-900">Eigene Signatur verwenden</span>
              <p className="text-xs text-gray-600 mt-0.5">
                Wenn aktiviert: deine eigene Signatur wird verwendet statt der Standard-Signatur (Name + Rolle + Brand-Footer).
              </p>
            </label>
          </div>

          {useCustom && (
            <div>
              <label className={labelCls}>Deine Signatur</label>
              <textarea
                value={customSignature}
                onChange={e => setCustomSignature(e.target.value)}
                rows={12}
                placeholder={`Justin Koch\nBerater für Altersvorsorge\nTel: +49 151 12345678\n\n--\nHebammen-Vorsorge\nberatung@hebammen-vorsorge.de`}
                className={inputCls + ' font-mono text-xs leading-relaxed'}
              />
              <p className={hintCls}>Frei gestaltbar. Wird 1:1 ans Ende jeder Mail angehängt.</p>
            </div>
          )}
        </div>
      </section>

      {/* Preview */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-[#1E3A5F] mb-3">🔍 Live-Vorschau Signatur</h2>
        <pre className="bg-gray-50 rounded-lg p-4 text-xs text-gray-800 whitespace-pre-wrap font-mono leading-relaxed border border-gray-200">
{previewSignature}
        </pre>
        <p className={hintCls + ' mt-2'}>So sieht die Signatur am Ende deiner Termin-E-Mails aus.</p>
      </section>

      {/* Save-Button */}
      <div className="flex items-center justify-end gap-3 sticky bottom-0 bg-gray-50 -mx-4 px-4 py-3 border-t border-gray-200">
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
