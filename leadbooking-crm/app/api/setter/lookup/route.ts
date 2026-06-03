import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { normalizePhoneKey } from '@/lib/phone'
import { sanitizeSearchTerm } from '@/lib/admin-auth'

/**
 * GET /api/setter/lookup?q=<name|nummer>
 *
 * Systemweite, READ-ONLY Lead-Suche für Setter — damit ein Rückrufer
 * GARANTIERT gefunden wird, auch wenn die Nummer einem anderen Setter
 * gehört, unzugeordnet ist oder auf der Blacklist steht (gelöscht/abgelehnt).
 *
 * Der Setter-Browser-Client sieht via RLS nur eigene Leads — deshalb läuft die
 * Suche hier serverseitig über den Service-Role-Client (umgeht RLS), gibt aber
 * nur ein schlankes, nicht-editierbares Lookup-Ergebnis zurück (wer/Status/
 * Besitzer). Keine Schreiboperation.
 *
 * Auth: Setter-Session (jeder eingeloggte Nutzer).
 */
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const q = (new URL(req.url).searchParams.get('q') || '').trim()
  if (q.length < 2) return NextResponse.json({ results: [] })
  const safe = sanitizeSearchTerm(q)
  const digits = q.replace(/\D/g, '')

  const admin = createAdminClient()

  // ── Leads (alle, RLS-frei) ────────────────────────────────────────────
  const orParts: string[] = []
  if (safe) orParts.push(`name.ilike.%${safe}%`, `email.ilike.%${safe}%`)
  if (digits.length >= 3) orParts.push(`phone.ilike.%${digits}%`)
  if (safe && safe !== digits) orParts.push(`phone.ilike.%${safe}%`)
  if (orParts.length === 0) return NextResponse.json({ results: [] })

  const { data: leads, error } = await admin
    .from('leads')
    .select('id, name, phone, email, beruf, status, list_name, state, assigned_to, recall_date, appointment_date, archived')
    .or(orParts.join(','))
    .limit(30)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Setter-Namen für assigned_to auflösen
  const setterIds = [...new Set((leads || []).map(l => (l as any).assigned_to).filter(Boolean))] as string[]
  const nameMap: Record<string, string> = {}
  if (setterIds.length) {
    const { data: profs } = await admin.from('profiles').select('id, full_name').in('id', setterIds)
    for (const p of profs || []) nameMap[(p as { id: string }).id] = (p as { full_name?: string }).full_name || '—'
  }

  // ── Blacklist (für Nummern, deren Lead gelöscht wurde) ────────────────
  const blOr: string[] = []
  if (safe) blOr.push(`name.ilike.%${safe}%`)
  if (digits.length >= 3) blOr.push(`phone.ilike.%${digits}%`)
  let blacklist: Array<{ phone: string; name: string | null; email: string | null; beruf: string | null; reason: string }> = []
  if (blOr.length) {
    const { data: bl } = await admin.from('blacklist').select('phone, name, email, beruf, reason').or(blOr.join(',')).limit(15)
    blacklist = (bl as typeof blacklist) || []
  }

  const leadPhoneKeys = new Set((leads || []).map(l => normalizePhoneKey((l as any).phone)).filter(Boolean) as string[])

  const results = [
    ...(leads || []).map(l => {
      const a = l as any
      return {
        id: a.id,
        name: a.name,
        phone: a.phone,
        email: a.email,
        beruf: a.beruf,
        status: a.status,
        list_name: a.list_name,
        state: a.state,
        archived: a.archived === true,
        recall_date: a.recall_date,
        appointment_date: a.appointment_date,
        mine: a.assigned_to === user.id,
        assignedName: a.assigned_to ? (nameMap[a.assigned_to] || '—') : null,
        source: 'lead' as const,
      }
    }),
    // Blacklist-Treffer, deren Nummer NICHT (mehr) als Lead existiert
    ...blacklist
      .filter(b => !leadPhoneKeys.has(b.phone))
      .map(b => ({
        id: 'bl:' + b.phone,
        name: b.name,
        phone: b.phone,
        email: b.email,
        beruf: b.beruf,
        status: b.reason,           // kein_interesse / termin_gelegt / termin_stattgefunden
        list_name: null,
        archived: false,
        recall_date: null,
        appointment_date: null,
        mine: false,
        assignedName: null,
        source: 'blacklist' as const,
      })),
  ]

  return NextResponse.json({ results })
}
