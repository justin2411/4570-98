'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, X, Check } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

export function SetterManagement({ initialSetters }: { initialSetters: Profile[] }) {
  const supabase = createClient()
  const [setters, setSetters] = useState<Profile[]>(initialSetters)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)

  async function createSetter(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/admin/create-setter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error); setLoading(false); return }
    toast.success('Setter angelegt!')
    setSetters(prev => [...prev, json.profile])
    setShowCreate(false)
    setForm({ full_name: '', email: '', password: '' })
    setLoading(false)
  }

  async function toggleActive(setter: Profile) {
    const { error } = await supabase.from('profiles').update({ is_active: !setter.is_active }).eq('id', setter.id)
    if (error) { toast.error(error.message); return }
    setSetters(prev => prev.map(s => s.id === setter.id ? { ...s, is_active: !s.is_active } : s))
    toast.success(setter.is_active ? 'Setter deaktiviert' : 'Setter aktiviert')
  }

  async function resetPassword(email: string) {
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
    })
    if (res.ok) toast.success('Reset-E-Mail gesendet')
    else toast.error('Fehler beim Senden')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">Setter verwalten</h1>
          <p className="text-gray-500 text-sm mt-1">{setters.length} Setter</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" />Neuer Setter</Button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Neuen Setter anlegen</h2>
            <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-gray-500" /></button>
          </div>
          <form onSubmit={createSetter} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Name" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} required placeholder="Max Mustermann" />
            <Input label="E-Mail" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required placeholder="max@firma.de" />
            <Input label="Passwort" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required placeholder="Min. 8 Zeichen" minLength={8} />
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit" loading={loading}><Check className="w-4 h-4" />Anlegen</Button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 hidden md:table-cell">E-Mail</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 hidden lg:table-cell">Erstellt</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {setters.map(s => (
              <tr key={s.id} className={!s.is_active ? 'opacity-50' : ''}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Avatar name={s.full_name} color={s.avatar_color} size="sm" />
                    <span className="font-medium">{s.full_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{s.email}</td>
                <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{formatDate(s.created_at)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {s.is_active ? 'Aktiv' : 'Deaktiviert'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => toggleActive(s)} className="text-xs text-[#2E75B6] hover:underline">
                      {s.is_active ? 'Deaktivieren' : 'Aktivieren'}
                    </button>
                    <button onClick={() => resetPassword(s.email)} className="text-xs text-gray-500 hover:underline">
                      Passwort reset
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {setters.length === 0 && <p className="text-center py-10 text-gray-400">Keine Setter</p>}
      </div>
    </div>
  )
}
