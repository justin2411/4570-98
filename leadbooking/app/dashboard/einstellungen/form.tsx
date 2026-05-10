'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Profile } from '@/types'
import toast from 'react-hot-toast'

export function EinstellungenForm({ profile }: { profile: Profile | null }) {
  const supabase = createClient()
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [loading, setLoading] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, phone })
      .eq('id', profile?.id)

    if (error) toast.error('Fehler beim Speichern.')
    else toast.success('Profil gespeichert.')
    setLoading(false)
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <Input
        id="fullName"
        label="Vollständiger Name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        required
      />
      <Input
        id="email"
        label="E-Mail-Adresse"
        value={profile?.email ?? ''}
        disabled
      />
      <Input
        id="phone"
        label="Telefonnummer"
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="+49 170 1234567"
      />
      <Button type="submit" loading={loading}>Speichern</Button>
    </form>
  )
}
