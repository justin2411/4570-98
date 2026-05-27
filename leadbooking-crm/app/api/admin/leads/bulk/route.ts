import { createAdminClient } from '@/lib/supabase/server'
import { checkAdminAuth } from '@/lib/admin-auth'
import { cleanLeadName } from '@/lib/clean-name'
import { normalizeState } from '@/lib/normalize-state'
import { NextResponse } from 'next/server'

/**
 * POST /api/admin/leads/bulk
 *
 * Bulk-Import von Leads via Token-API.
 * Auth: Bearer-Token ODER Admin-Session.
 *
 * Body: {
 *   leads: [{
 *     name, phone, email?, state?, beruf?, list_name?, website?, ort?,
 *     score?, lead_quality?, age_indicator?, signals?
 *   }],
 *   list_name?: string         // default für alle leads ohne eigenen list_name
 *   assigned_to?: string|null  // default null
 *   uploaded_by: string        // Pflicht (Profile-ID, NOT NULL in leads-Tabelle)
 * }
 *
 * Server normalisiert: cleanLeadName, normalizeState. Bulk-upsert mit
 * onConflict='phone' (ignoreDuplicates) → bestehende Phones werden
 * still übersprungen. DB-Trigger setzen u. a. blacklistete Phones
 * automatisch auf status='kein_interesse' und legen neue Berufe in
 * der berufe-Master-Tabelle an.
 *
 * Response: { ok, total_received, valid, invalid_reasons, batches: [...] }
 */
const BATCH_SIZE = 500

interface IncomingLead {
  name?: string
  phone?: string
  email?: string
  state?: string
  beruf?: string
  list_name?: string
  website?: string
  ort?: string
  score?: number
  lead_quality?: string
  age_indicator?: string
  signals?: string
}

export async function POST(req: Request) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const incoming: IncomingLead[] = Array.isArray(body.leads) ? body.leads : []
  const defaultListName: string = typeof body.list_name === 'string' ? body.list_name.trim() : ''
  const assignedTo: string | null = typeof body.assigned_to === 'string' && body.assigned_to.length > 0 ? body.assigned_to : null
  const uploadedBy: string = typeof body.uploaded_by === 'string' ? body.uploaded_by : ''

  if (!uploadedBy) return NextResponse.json({ error: 'uploaded_by fehlt (Profile-ID Pflicht — leads.uploaded_by ist NOT NULL)' }, { status: 400 })
  if (incoming.length === 0) return NextResponse.json({ error: 'leads-Array leer' }, { status: 400 })

  const invalid: Array<{ index: number; reason: string }> = []
  const cleaned: Record<string, unknown>[] = []

  for (let i = 0; i < incoming.length; i++) {
    const l = incoming[i]
    const beruf = (l.beruf || '').trim()
    const rawName = (l.name || '').trim()
    const name = cleanLeadName(rawName, beruf)
    const phone = (l.phone || '').trim()
    if (!name || !phone) {
      invalid.push({ index: i, reason: !name ? 'name fehlt' : 'phone fehlt' })
      continue
    }
    const stateNorm = normalizeState(l.state)
    cleaned.push({
      name,
      phone,
      // Mehrere leads-Spalten sind NOT NULL (beruf, list_name, website, …).
      // Defensiv überall '' statt null verwenden, nur assigned_to darf NULL sein.
      email: (l.email || '').trim(),
      state: stateNorm || (l.state || '').trim() || '',
      beruf: beruf || '',
      list_name: (l.list_name || '').trim() || defaultListName || '',
      website: (l.website || '').trim(),
      ort: (l.ort || '').trim(),
      score: Number.isFinite(l.score) ? l.score : 0,
      lead_quality: (l.lead_quality || '').trim() || '',
      age_indicator: (l.age_indicator || '').trim() || '',
      signals: (l.signals || '').trim() || '',
      status: 'neu',
      uploaded_by: uploadedBy,
      assigned_to: assignedTo,
    })
  }

  if (cleaned.length === 0) {
    return NextResponse.json({
      ok: false,
      total_received: incoming.length,
      valid: 0,
      invalid_reasons: summarize(invalid),
      error: 'Nichts zu importieren',
    }, { status: 400 })
  }

  const supabase = createAdminClient()
  const batches: Array<{ batch: number; inserted: number; error?: string }> = []
  let totalInserted = 0

  for (let i = 0; i < cleaned.length; i += BATCH_SIZE) {
    const chunk = cleaned.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const { data, error } = await supabase
      .from('leads')
      .upsert(chunk as never, { onConflict: 'phone', ignoreDuplicates: true })
      .select('id')
    if (error) {
      batches.push({ batch: batchNum, inserted: 0, error: error.message })
      // Soft-fail: nicht abbrechen, weiter mit nächstem Batch
      continue
    }
    const n = (data as Array<{ id: string }> | null)?.length ?? 0
    totalInserted += n
    batches.push({ batch: batchNum, inserted: n })
  }

  return NextResponse.json({
    ok: true,
    total_received: incoming.length,
    valid: cleaned.length,
    inserted: totalInserted,
    skipped_duplicates: cleaned.length - totalInserted,
    invalid_reasons: summarize(invalid),
    batches,
  })
}

function summarize(invalid: Array<{ index: number; reason: string }>) {
  const counts: Record<string, number> = {}
  for (const r of invalid) counts[r.reason] = (counts[r.reason] || 0) + 1
  return { count: invalid.length, by_reason: counts, examples: invalid.slice(0, 5) }
}
