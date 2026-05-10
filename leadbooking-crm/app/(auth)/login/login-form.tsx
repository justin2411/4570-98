'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/layout/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import toast from 'react-hot-toast'

export function LoginForm() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error('Anmeldung fehlgeschlagen: ' + error.message)
      setLoading(false)
      return
    }
    const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', data.user.id).single()
    if (!profile?.is_active && profile?.role !== 'admin') {
      await supabase.auth.signOut()
      toast.error('Ihr Konto wurde deaktiviert.')
      setLoading(false)
      return
    }
    toast.success('Erfolgreich angemeldet!')
    if (profile?.role === 'admin') router.push('/admin')
    else if (profile?.role === 'setter') router.push('/setter')
    else router.push('/advisor')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E3A5F] to-[#2E75B6] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo light className="justify-center" />
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-2xl font-bold text-[#1E3A5F] mb-2">Willkommen</h1>
          <p className="text-gray-500 text-sm mb-6">Melden Sie sich mit Ihren Zugangsdaten an.</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <Input id="email" type="email" label="E-Mail" placeholder="ihre@email.de" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            <Input id="password" type="password" label="Passwort" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
            <Button type="submit" loading={loading} className="w-full" size="lg">Anmelden</Button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-6">
            <a href="/passwort-reset" className="text-[#2E75B6] hover:underline">Passwort vergessen?</a>
          </p>
        </div>
      </div>
    </div>
  )
}
