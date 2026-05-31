import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/setter/log-call  { leadId }
 *
 * Persistiert einen Anruf zuverlässig — gedacht für den `keepalive`-fetch
 * direkt aus dem Call-Button. Da `tel:` parallel den Dialer öffnet (und die
 * Seite ggf. weggeräumt wird), darf der Write NICHT als fire-and-forget im
 * Browser hängen — `keepalive` + serverseitige Verarbeitung garantieren, dass
 * call_attempts / Status / activity_log auch nach App-Close persistieren.
 *
 * Auth: Setter-Session (RLS sorgt dafür, dass nur eigene Leads geändert werden).
 * Erster Anruf (Status neu → angerufen) loggt zusätzlich eine 'angerufen'-Aktivität.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const leadId = typeof body.leadId === 'string' ? body.leadId : ''
  if (!leadId) return NextResponse.json({ error: 'leadId fehlt' }, { status: 400 })

  const { data: lead, error: readErr } = await supabase
    .from('leads').select('status, call_attempts').eq('id', leadId).single()
  if (readErr || !lead) return NextResponse.json({ error: 'Lead nicht gefunden' }, { status: 404 })

  const attempts = ((lead as { call_attempts: number | null }).call_attempts || 0) + 1
  const wasNeu = (lead as { status: string }).status === 'neu'
  const patch: Record<string, unknown> = { call_attempts: attempts, last_call_attempt: new Date().toISOString() }
  if (wasNeu) patch.status = 'angerufen'

  const { error: updErr } = await supabase.from('leads').update(patch).eq('id', leadId)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  if (wasNeu) {
    await supabase.from('activity_log').insert({
      lead_id: leadId, setter_id: user.id, old_status: 'neu', new_status: 'angerufen', note: 'Angerufen',
    })
  }

  return NextResponse.json({ ok: true, call_attempts: attempts, status: wasNeu ? 'angerufen' : (lead as { status: string }).status })
}
