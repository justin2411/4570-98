import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ClosersManagement } from './closers-management'
import type { Closer } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ClosersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.role !== 'admin') redirect('/setter')

  const { data: closers } = await supabase
    .from('closers')
    .select('*')
    .order('is_active', { ascending: false })
    .order('name', { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Closer-Verwaltung</h1>
        <p className="text-sm text-gray-600 mt-1">
          Hier legst du die Closer/Beraterinnen an, die Setter beim Termin auswählen können.
          Die Termin-Einladung wird per Apple Mail an die Email-Adresse geschickt.
        </p>
      </div>
      <ClosersManagement initialClosers={(closers ?? []) as Closer[]} />
    </div>
  )
}
