export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StrukturClient } from './client'

interface ListeRow {
  list_name: string
  display_name: string | null
  firma: string | null
  web: string | null
  kontakt_email: string | null
  tagline: string | null
  is_active: boolean | null
  lead_count: number
}

interface BerufRow {
  name: string
  plural_form: string
  is_active: boolean
  lead_count: number
}

export default async function StrukturPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  // Initial-Daten parallel laden (Client refreshed danach selbst per fetch)
  const [{ data: cc }, { data: leads }, { data: berufeRaw }] = await Promise.all([
    supabase.from('cluster_content').select('*').order('list_name'),
    supabase.from('leads').select('list_name, beruf'),
    supabase.from('berufe').select('*').order('name'),
  ])

  const listCounts: Record<string, number> = {}
  const berufCounts: Record<string, number> = {}
  for (const l of (leads || []) as Array<{ list_name?: string | null; beruf?: string | null }>) {
    const ln = (l.list_name || '').trim()
    const bn = (l.beruf || '').trim()
    if (ln) listCounts[ln] = (listCounts[ln] || 0) + 1
    if (bn) berufCounts[bn] = (berufCounts[bn] || 0) + 1
  }

  const listenKnown = new Map<string, ListeRow>()
  for (const row of (cc || []) as Array<Record<string, unknown>>) {
    const ln = String(row.list_name)
    listenKnown.set(ln, {
      list_name: ln,
      display_name: (row.display_name as string | null) ?? null,
      firma: (row.firma as string | null) ?? '',
      web: (row.web as string | null) ?? '',
      kontakt_email: (row.kontakt_email as string | null) ?? '',
      tagline: (row.tagline as string | null) ?? '',
      is_active: (row.is_active as boolean | null) ?? true,
      lead_count: listCounts[ln] || 0,
    })
  }
  for (const [name, n] of Object.entries(listCounts)) {
    if (!listenKnown.has(name)) {
      listenKnown.set(name, {
        list_name: name, display_name: null, firma: '', web: '', kontakt_email: '',
        tagline: '', is_active: null, lead_count: n,
      })
    }
  }
  const listen: ListeRow[] = Array.from(listenKnown.values()).sort((a, b) => a.list_name.localeCompare(b.list_name))

  const berufe: BerufRow[] = ((berufeRaw || []) as Array<Record<string, unknown>>).map(b => ({
    name: String(b.name),
    plural_form: String(b.plural_form ?? ''),
    is_active: (b.is_active as boolean) ?? true,
    lead_count: berufCounts[String(b.name)] || 0,
  }))
  // Auch Berufe, die nur in leads stehen aber nicht in der Master-Tabelle
  for (const [name, n] of Object.entries(berufCounts)) {
    if (!berufe.find(b => b.name === name)) {
      berufe.push({ name, plural_form: '', is_active: true, lead_count: n })
    }
  }
  berufe.sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Struktur</h1>
        <p className="text-gray-500 text-sm mt-1">Listen und Berufe als Ordner verwalten — anlegen, umbenennen, deaktivieren, löschen.</p>
      </div>
      <StrukturClient initialListen={listen} initialBerufe={berufe} />
    </div>
  )
}
