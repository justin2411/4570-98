'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/layout/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import toast from 'react-hot-toast'
import Link from 'next/link'

export function PasswordResetForm() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/passwort-reset/update`,
    })
    if (error) {
      toast.error(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E3A5F] to-[#2E75B6] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8"><Logo light className="justify-center" /></div>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-2xl font-bold text-[#1E3A5F] mb-2">Passwort zurücksetzen</h1>
          {sent ? (
            <div className="text-center py-4">
              <p className="text-green-600 font-medium">E-Mail gesendet!</p>
              <p className="text-gray-500 text-sm mt-2">Prüfen Sie Ihr Postfach und klicken Sie auf den Link.</p>
              <Link href="/login" className="text-[#2E75B6] text-sm hover:underline mt-4 block">Zurück zum Login</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input id="email" type="email" label="E-Mail-Adresse" placeholder="ihre@email.de" value={email} onChange={e => setEmail(e.target.value)} required />
              <Button type="submit" loading={loading} className="w-full">Link senden</Button>
              <p className="text-center"><Link href="/login" className="text-sm text-[#2E75B6] hover:underline">Zurück zum Login</Link></p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
