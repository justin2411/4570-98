'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/layout/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import toast from 'react-hot-toast'

export function RegisterForm() {
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    passwordConfirm: '',
    role: 'advisor',
  })
  const [loading, setLoading] = useState(false)

  function setField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()

    if (form.password !== form.passwordConfirm) {
      toast.error('Passwörter stimmen nicht überein.')
      return
    }
    if (form.password.length < 8) {
      toast.error('Passwort muss mindestens 8 Zeichen haben.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName,
          role: form.role,
          phone: form.phone,
        },
      },
    })

    if (error) {
      toast.error('Registrierung fehlgeschlagen: ' + error.message)
      setLoading(false)
      return
    }

    toast.success('Registrierung erfolgreich!')
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E3A5F] to-[#2E75B6] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo light className="justify-center" />
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-2xl font-bold text-[#1E3A5F] mb-2">Konto erstellen</h1>
          <p className="text-gray-500 text-sm mb-6">Registrieren Sie sich, um Termine zu kaufen.</p>

          <form onSubmit={handleRegister} className="space-y-4">
            <Input
              id="fullName"
              label="Vollständiger Name"
              placeholder="Max Mustermann"
              value={form.fullName}
              onChange={(e) => setField('fullName', e.target.value)}
              required
            />
            <Input
              id="email"
              type="email"
              label="E-Mail-Adresse"
              placeholder="ihre@email.de"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              id="phone"
              type="tel"
              label="Telefonnummer (optional)"
              placeholder="+49 170 1234567"
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
            />
            <Select
              id="role"
              label="Ich bin..."
              value={form.role}
              onChange={(e) => setField('role', e.target.value)}
              options={[
                { value: 'advisor', label: 'Finanzberater – Termine kaufen' },
                { value: 'setter', label: 'Setter – Termine anlegen (Freischaltung nötig)' },
              ]}
            />
            <Input
              id="password"
              type="password"
              label="Passwort (min. 8 Zeichen)"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setField('password', e.target.value)}
              required
              autoComplete="new-password"
            />
            <Input
              id="passwordConfirm"
              type="password"
              label="Passwort wiederholen"
              placeholder="••••••••"
              value={form.passwordConfirm}
              onChange={(e) => setField('passwordConfirm', e.target.value)}
              required
              autoComplete="new-password"
            />

            {form.role === 'setter' && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                Als Setter muss Ihr Konto zunächst vom Admin freigeschaltet werden.
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full" size="lg">
              Konto erstellen
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Bereits ein Konto?{' '}
            <Link href="/login" className="text-[#2E75B6] font-medium hover:underline">
              Jetzt anmelden
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
