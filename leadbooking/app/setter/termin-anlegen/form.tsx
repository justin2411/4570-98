'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { PROFESSIONS, TOPICS, STATES } from '@/types'
import toast from 'react-hot-toast'

interface FormData {
  type: string
  profession: string
  region: string
  state: string
  topic: string
  appointment_date: string
  appointment_time: string
  completed_date: string
  summary: string
  contact_name: string
  contact_phone: string
  contact_email: string
  notes: string
}

export function TerminAnlegenForm({ setterId }: { setterId: string }) {
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState<FormData>({
    type: 'planned',
    profession: '',
    region: '',
    state: '',
    topic: '',
    appointment_date: '',
    appointment_time: '',
    completed_date: '',
    summary: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    notes: '',
  })
  const [loading, setLoading] = useState(false)

  function setField(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.profession || !form.region || !form.state || !form.topic) {
      toast.error('Bitte alle Pflichtfelder ausfüllen.')
      return
    }
    if (!form.contact_name || !form.contact_phone || !form.contact_email) {
      toast.error('Bitte Kontaktdaten angeben.')
      return
    }
    if (form.type === 'planned' && (!form.appointment_date || !form.appointment_time)) {
      toast.error('Bitte Terminvorschlag (Datum + Uhrzeit) angeben.')
      return
    }
    if (form.type === 'completed' && !form.completed_date) {
      toast.error('Bitte Datum des Gesprächs angeben.')
      return
    }

    setLoading(true)

    let appointment_date: string | null = null
    if (form.type === 'planned' && form.appointment_date && form.appointment_time) {
      appointment_date = new Date(`${form.appointment_date}T${form.appointment_time}`).toISOString()
    }

    const { error } = await supabase.from('appointments').insert({
      setter_id: setterId,
      type: form.type,
      profession: form.profession,
      region: form.region,
      state: form.state,
      topic: form.topic,
      appointment_date: form.type === 'planned' ? appointment_date : null,
      completed_date: form.type === 'completed' ? form.completed_date : null,
      summary: form.type === 'completed' ? form.summary : null,
      contact_name: form.contact_name,
      contact_phone: form.contact_phone,
      contact_email: form.contact_email,
      notes: form.notes || null,
      price: 100.00,
      status: 'available',
    })

    if (error) {
      toast.error('Fehler beim Anlegen: ' + error.message)
      setLoading(false)
      return
    }

    // Push-Benachrichtigung an alle Berater senden
    fetch('/api/push/send-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: form.type,
        profession: form.profession,
        region: form.region,
      }),
    }).catch(() => {}) // Fire & forget

    toast.success('Termin erfolgreich angelegt!')
    router.push('/setter/termine')
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Preis-Hinweis */}
          <div className="flex items-center justify-between p-3 bg-[#1E3A5F]/5 rounded-lg border border-[#1E3A5F]/20">
            <span className="text-sm font-medium text-[#1E3A5F]">Preis (fest)</span>
            <span className="text-xl font-bold text-[#1E3A5F]">100,00 €</span>
          </div>

          <Select
            id="type"
            label="Termin-Typ *"
            value={form.type}
            onChange={(e) => setField('type', e.target.value)}
            options={[
              { value: 'planned', label: '🟡 Geplanter Termin' },
              { value: 'completed', label: '🟢 Stattgefundener Termin' },
            ]}
          />

          {form.type === 'planned' && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <strong>Geplant:</strong> Der Heilberufler hat zugestimmt und wartet auf den Anruf des Beraters.
            </div>
          )}
          {form.type === 'completed' && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              <strong>Stattgefunden:</strong> Das Gespräch hat bereits stattgefunden. Heilberufler hat Interesse bestätigt.
            </div>
          )}

          <Select
            id="profession"
            label="Berufsgruppe *"
            value={form.profession}
            onChange={(e) => setField('profession', e.target.value)}
            placeholder="Bitte wählen..."
            options={PROFESSIONS.map((p) => ({ value: p, label: p }))}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              id="region"
              label="Stadt / Region *"
              placeholder="z.B. München"
              value={form.region}
              onChange={(e) => setField('region', e.target.value)}
              required
            />
            <Select
              id="state"
              label="Bundesland *"
              value={form.state}
              onChange={(e) => setField('state', e.target.value)}
              placeholder="Bitte wählen..."
              options={STATES.map((s) => ({ value: s, label: s }))}
            />
          </div>

          <Select
            id="topic"
            label="Gesprächsthema *"
            value={form.topic}
            onChange={(e) => setField('topic', e.target.value)}
            placeholder="Bitte wählen..."
            options={TOPICS.map((t) => ({ value: t, label: t }))}
          />

          {/* Termin-Typ spezifische Felder */}
          {form.type === 'planned' ? (
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="appointment_date"
                type="date"
                label="Terminvorschlag – Datum *"
                value={form.appointment_date}
                onChange={(e) => setField('appointment_date', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
              <Input
                id="appointment_time"
                type="time"
                label="Uhrzeit *"
                value={form.appointment_time}
                onChange={(e) => setField('appointment_time', e.target.value)}
              />
            </div>
          ) : (
            <>
              <Input
                id="completed_date"
                type="date"
                label="Datum des Gesprächs *"
                value={form.completed_date}
                onChange={(e) => setField('completed_date', e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
              <div className="flex flex-col gap-1">
                <label htmlFor="summary" className="text-sm font-medium text-gray-700">
                  Gesprächszusammenfassung
                </label>
                <textarea
                  id="summary"
                  value={form.summary}
                  onChange={(e) => setField('summary', e.target.value)}
                  rows={3}
                  placeholder="Kurze Zusammenfassung des Gesprächs und des Interesses..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#2E75B6] focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/20"
                />
              </div>
            </>
          )}

          {/* Kontaktdaten */}
          <div className="border-t border-gray-200 pt-5">
            <p className="text-sm font-semibold text-gray-700 mb-4">
              Kontaktdaten des Heilberuflers (nur nach Kauf sichtbar)
            </p>
            <div className="space-y-4">
              <Input
                id="contact_name"
                label="Vorname *"
                placeholder="z.B. Max"
                value={form.contact_name}
                onChange={(e) => setField('contact_name', e.target.value)}
                required
              />
              <Input
                id="contact_phone"
                type="tel"
                label="Telefonnummer *"
                placeholder="+49 170 1234567"
                value={form.contact_phone}
                onChange={(e) => setField('contact_phone', e.target.value)}
                required
              />
              <Input
                id="contact_email"
                type="email"
                label="E-Mail-Adresse *"
                placeholder="kontakt@praxis.de"
                value={form.contact_email}
                onChange={(e) => setField('contact_email', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Interne Notiz */}
          <div className="flex flex-col gap-1">
            <label htmlFor="notes" className="text-sm font-medium text-gray-700">
              Interne Notiz (optional)
            </label>
            <textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              rows={2}
              placeholder="Nur für Sie sichtbar..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#2E75B6] focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/20"
            />
          </div>

          <Button type="submit" loading={loading} className="w-full" size="lg">
            Termin anlegen und veröffentlichen
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
