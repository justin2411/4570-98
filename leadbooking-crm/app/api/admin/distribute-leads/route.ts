import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getLeadProbabilityScorer } from '@/lib/lead-probability'
import { filterBlacklistedLeads } from '@/lib/blacklist'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import type { Lead } from '@/types'

/**
 * POST /api/admin/distribute-leads
 *
 * Auth: entweder Admin-Session (Cookie) ODER Bearer-Token (ADMIN_API_TOKEN env).
 *
 * Body: {
 *   setterIds:        string[]    // Pflicht — Ziel-Setter
 *   listName?:        string      // optional — nur aus einer Liste
 *   perSetterLimit?:  number      // optional — max. pro Setter
 *   includeAssigned?: boolean     // optional — auch bereits zugewiesene neu verteilen ("umstrukturieren")
 *   statuses?:        string[]    // optional — Status-Filter (default: ['neu','angerufen'])
 *   balanceByBeruf?:  boolean     // optional — pro Beruf gleichmäßig verteilen (jeder Setter bekommt
 *                                 //            denselben Mix aller Berufe statt nur global round-robin)
 *   excludeBeruf?:    string[]    // optional — Beruf-ILIKE-Pattern ausschließen
 *                                 //            (default ['hebamm%'] → Hebammen-Freeze; [] = nichts ausschließen)
 * }
 *
 * Verteilung: nach Probability-Score (gelernt aus termin_gelegt-Historie)
 * sortiert, Round-Robin auf die setterIds. Mit balanceByBeruf wird pro
 * Beruf-Gruppe rotiert, sodass jeder Setter einen ähnlichen Beruf-Mix erhält.
 */
const DEFAULT_STATUSES = ['neu', 'angerufen']
const DEFAULT_EXCLUDE_BERUF = ['hebamm%']   // Hebammen-Freeze (HANDOVER) — per excludeBeruf:[] abschaltbar

export async function POST(req: Request) {
  // ── Auth: Token ODER Session ──────────────────────────────────────────
  const authHeader = req.headers.get('authorization') || ''
  const provided = (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '').trim()
  const expected = (process.env.ADMIN_API_TOKEN || '').trim()
  const tokenOk = !!provided && !!expected && provided === expected

  let sessionOk = false
  if (!tokenOk) {
    const supabaseUser = await createClient()
    const { data: { user } } = await supabaseUser.auth.getUser()
    if (user) {
      const { data: profile } = await supabaseUser.from('profiles').select('role').eq('id', user.id).single()
      sessionOk = profile?.role === 'admin'
    }
  }
  if (!tokenOk && !sessionOk) {
    return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 401 })
  }

  // ── Body parsen ───────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({}))
  const setterIds: string[] = Array.isArray(body.setterIds)
    ? body.setterIds.filter((x: unknown) => typeof x === 'string')
    : []
  const listName: string | null = typeof body.listName === 'string' && body.listName.trim()
    ? body.listName.trim()
    : null
  const perSetterLimit: number = Number.isFinite(body.perSetterLimit) && body.perSetterLimit > 0
    ? Math.floor(body.perSetterLimit)
    : 0
  const includeAssigned: boolean = body.includeAssigned === true
  const statuses: string[] = Array.isArray(body.statuses) && body.statuses.length > 0
    ? body.statuses.filter((s: unknown) => typeof s === 'string')
    : DEFAULT_STATUSES
  const balanceByBeruf: boolean = body.balanceByBeruf === true
  // excludeBeruf: explizit übergebenes Array gewinnt (auch []), sonst Hebammen-Freeze.
  const excludeBeruf: string[] = Array.isArray(body.excludeBeruf)
    ? body.excludeBeruf.filter((s: unknown) => typeof s === 'string' && s.trim().length > 0)
    : DEFAULT_EXCLUDE_BERUF

  if (setterIds.length === 0) {
    return NextResponse.json({ error: 'Keine Setter ausgewählt' }, { status: 400 })
  }

  // ── DB-Operationen via Service-Role-Client (umgeht RLS sauber) ────────
  const supabase = createAdminClient()

  // Vollständig paginiert laden (stabil nach id sortiert) — sonst würden
  // bei >1000 passenden Leads die übrigen stillschweigend ignoriert.
  let rawLeads: Lead[]
  try {
    rawLeads = await fetchAllRows<Lead>((from, to) => {
      let q = supabase.from('leads').select('*').order('id', { ascending: true }).range(from, to)
      if (!includeAssigned) q = q.is('assigned_to', null)
      if (statuses.length > 0) q = q.in('status', statuses)
      if (listName) q = q.eq('list_name', listName)
      // Beruf-Ausschluss (z. B. Hebammen-Freeze). NULL-Berufe bleiben drin.
      for (const pat of excludeBeruf) q = q.or(`beruf.not.ilike.${pat},beruf.is.null`)
      return q
    })
  } catch (err) {
    return NextResponse.json({ error: 'leads: ' + (err as Error).message }, { status: 500 })
  }
  // Blacklist filtern: Telefonnummern mit kein_interesse-Historie kommen
  // niemals erneut in den Verteil-Pool (D-019).
  const leads = await filterBlacklistedLeads(rawLeads)
  const skippedBlacklisted = rawLeads.length - leads.length
  if (leads.length === 0) {
    return NextResponse.json({
      ok: true, assigned: {}, total: 0, skippedBlacklisted,
      scope: { includeAssigned, statuses, listName, perSetterLimit },
    })
  }

  // Nach Wahrscheinlichkeit sortieren — bestes Lead zuerst
  const probScore = await getLeadProbabilityScorer()
  leads.sort((a, b) => probScore(b) - probScore(a))

  const n = setterIds.length
  const perCap = perSetterLimit > 0 ? perSetterLimit : Infinity
  const assignments: Record<string, string[]> = {}
  for (const sid of setterIds) assignments[sid] = []

  // Reihenfolge der zu verteilenden Gruppen festlegen.
  //  - balanceByBeruf: pro Beruf eine Gruppe (Score-Reihenfolge bleibt erhalten)
  //  - sonst: eine einzige Gruppe (klassisches globales Round-Robin)
  const groups: Lead[][] = balanceByBeruf
    ? Object.values(leads.reduce((acc, l) => {
        const b = ((l as any).beruf || '∅').trim() || '∅'
        ;(acc[b] ||= []).push(l)
        return acc
      }, {} as Record<string, Lead[]>))
    : [leads]

  // Fortlaufender Rotations-Zeiger über ALLE Gruppen hinweg → jeder Setter
  // bekommt einen fairen Anteil JEDER Beruf-Gruppe und die Gesamtsummen
  // bleiben balanciert. Setter, die ihr perSetterLimit erreicht haben,
  // werden übersprungen.
  let ptr = 0
  let assignedTotal = 0
  outer: for (const group of groups) {
    for (const lead of group) {
      let tries = 0
      while (assignments[setterIds[ptr % n]].length >= perCap) {
        ptr++; tries++
        if (tries >= n) break outer   // alle Setter voll
      }
      assignments[setterIds[ptr % n]].push(lead.id)
      ptr++; assignedTotal++
    }
  }

  // Bulk-Update
  const results: Record<string, number> = {}
  for (const [sid, leadIds] of Object.entries(assignments)) {
    if (leadIds.length === 0) { results[sid] = 0; continue }
    const { error: e2 } = await supabase.from('leads').update({ assigned_to: sid }).in('id', leadIds)
    if (e2) {
      return NextResponse.json({ error: `Setter ${sid}: ${e2.message}`, partial: results }, { status: 500 })
    }
    results[sid] = leadIds.length
  }

  return NextResponse.json({
    ok: true,
    total: assignedTotal,
    assigned: results,
    skippedBlacklisted,
    scope: { includeAssigned, statuses, listName, perSetterLimit, balanceByBeruf, excludeBeruf },
  })
}
