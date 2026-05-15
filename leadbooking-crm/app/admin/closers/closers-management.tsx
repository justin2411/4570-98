'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Closer } from '@/types'
import { Plus, Trash2, Edit, Mail, Phone, X, Save } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  initialClosers: Closer[]
}

export function ClosersManagement({ initialClosers }: Props) {
  const supabase = createClient()
  const [closers, setClosers] = useState<Closer[]>(initialClosers)
  const [editing, setEditing] = useState<Closer | 'new' | null>(null)

  async function refresh() {
    const { data } = await supabase
      .from('closers')
      .select('*')
      .order('is_active', { ascending: false })
      .order('name', { ascending: true })
    setClosers((data ?? []) as Closer[])
  }

  async function toggleActive(c: Closer) {
    const { error } = await supabase
      .from('closers')
      .update({ is_active: !c.is_active })
      .eq('id', c.id)
    if (error) { toast.error('Fehler: ' + error.message); return }
    toast.success(c.is_active ? 'Deaktiviert' : 'Aktiviert')
    refresh()
  }

  async function remove(c: Closer) {
    if (!confirm(`Closer "${c.name}" wirklich löschen?\n\nBestehende Termine behalten den Closer-Namen, aber neue können diesen Closer nicht mehr auswählen.`)) return
    const { error } = await supabase.from('closers').delete().eq('id', c.id)
    if (error) { toast.error('Fehler: ' + error.message); return }
    toast.success('Closer gelöscht')
    refresh()
  }

  return (
    <>
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          {closers.filter(c => c.is_active).length} aktiv · {closers.length} gesamt
        </p>
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-2 px-4 py-2 bg-[#2E75B6] text-white rounded-xl text-sm font-semibold hover:bg-[#1E3A5F] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Neuer Closer
        </button>
      </div>

      {closers.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-gray-700 font-medium">Noch keine Closer angelegt</p>
          <p className="text-sm text-gray-500 mt-1">Klick oben rechts auf "Neuer Closer" um zu beginnen.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">E-Mail</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Telefon</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {closers.map(c => (
                <tr key={c.id} className={c.is_active ? '' : 'opacity-50'}>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-gray-900">{c.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <a href={`mailto:${c.email}`} className="text-sm text-[#2E75B6] hover:underline flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      {c.email}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    {c.phone ? (
                      <a href={`tel:${c.phone}`} className="text-sm text-gray-700 hover:underline flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" />
                        {c.phone}
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActive(c)}
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        c.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {c.is_active ? 'Aktiv' : 'Inaktiv'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => setEditing(c)}
                        className="p-2 text-gray-500 hover:text-[#2E75B6] hover:bg-blue-50 rounded-lg"
                        aria-label="Bearbeiten"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => remove(c)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        aria-label="Löschen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <CloserFormModal
          closer={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh() }}
        />
      )}
    </>
  )
}

function CloserFormModal({
  closer,
  onClose,
  onSaved,
}: {
  closer: Closer | null
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [name, setName] = useState(closer?.name ?? '')
  const [email, setEmail] = useState(closer?.email ?? '')
  const [phone, setPhone] = useState(closer?.phone ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim() || !email.trim()) {
      toast.error('Name und E-Mail sind Pflicht')
      return
    }
    setSaving(true)
    const payload = { name: name.trim(), email: email.trim(), phone: phone.trim() }
    const { error } = closer
      ? await supabase.from('closers').update(payload).eq('id', closer.id)
      : await supabase.from('closers').insert(payload)
    setSaving(false)
    if (error) { toast.error('Fehler: ' + error.message); return }
    toast.success(closer ? 'Aktualisiert' : 'Angelegt')
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-bold text-lg text-[#1E3A5F]">
            {closer ? 'Closer bearbeiten' : 'Neuer Closer'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="z.B. Anna Müller"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#2E75B6] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">E-Mail *</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="anna.mueller@hebammen-vorsorge.de"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#2E75B6] focus:outline-none"
            />
            <p className="text-[11px] text-gray-500 mt-1">An diese Adresse geht die Termin-Einladung.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Telefon</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+49 ..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#2E75B6] focus:outline-none"
            />
            <p className="text-[11px] text-gray-500 mt-1">Optional — Setter sieht das für Rückfragen.</p>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl"
          >
            Abbrechen
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#2E75B6] text-white text-sm font-semibold rounded-xl hover:bg-[#1E3A5F] disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}
