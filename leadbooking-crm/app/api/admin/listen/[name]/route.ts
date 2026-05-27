import { createAdminClient } from '@/lib/supabase/server'
import { checkAdminAuth } from '@/lib/admin-auth'
import { NextResponse } from 'next/server'

/**
 * /api/admin/listen/[name]
 *   PATCH  → Liste bearbeiten ({ rename?, display_name?, firma?, web?,
 *            kontakt_email?, tagline?, templates?, is_active? }).
 *            Wenn `rename` gesetzt: alle leads.list_name werden mit-umbenannt.
 *   DELETE → cluster_content-Eintrag entfernen.
 *            Optional ?clearLeads=true setzt leads.list_name=null
 *            für alle Leads dieser Liste.
 */
const PATCHABLE = new Set(['display_name', 'firma', 'web', 'kontakt_email', 'tagline', 'templates', 'is_active'])

type RouteCtx = { params: Promise<{ name: string }> }

export async function PATCH(req: Request, ctx: RouteCtx) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })
  const { name: rawName } = await ctx.params
  const name = decodeURIComponent(rawName).trim()
  if (!name) return NextResponse.json({ error: 'name fehlt' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const rename = typeof body.rename === 'string' ? body.rename.trim() : ''

  const supabase = createAdminClient()

  if (rename && rename !== name) {
    // Bestehende cluster_content-Row der Quelle lesen
    const { data: srcRow } = await supabase.from('cluster_content').select('*').eq('list_name', name).maybeSingle()
    const srcPayload = (srcRow as Record<string, unknown> | null) ?? { list_name: name }
    const merged: Record<string, unknown> = { ...srcPayload, list_name: rename }
    for (const k of Object.keys(body)) if (PATCHABLE.has(k)) merged[k] = body[k]

    // Neuen cluster_content unter dem Ziel-Namen anlegen (upsert)
    const { error: e1 } = await supabase.from('cluster_content').upsert(merged as never, { onConflict: 'list_name' })
    if (e1) return NextResponse.json({ error: 'create-target: ' + e1.message }, { status: 500 })
    // leads.list_name umbenennen
    const { error: e2, count } = await supabase
      .from('leads')
      .update({ list_name: rename } as never, { count: 'exact' })
      .eq('list_name', name)
    if (e2) return NextResponse.json({ error: 'rename-leads: ' + e2.message }, { status: 500 })
    // Alten cluster_content-Eintrag löschen
    const { error: e3 } = await supabase.from('cluster_content').delete().eq('list_name', name)
    if (e3) return NextResponse.json({ error: 'drop-old: ' + e3.message }, { status: 500 })
    return NextResponse.json({ ok: true, renamed: name + ' → ' + rename, leads_updated: count })
  }

  const patch: Record<string, unknown> = {}
  for (const k of Object.keys(body)) if (PATCHABLE.has(k)) patch[k] = body[k]
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nichts zu ändern' }, { status: 400 })
  }
  // Upsert, damit auch Listen ohne bestehenden cluster_content-Eintrag
  // (existieren nur in leads.list_name) frisch angelegt werden können.
  const { data, error } = await supabase
    .from('cluster_content')
    .upsert({ list_name: name, ...patch } as never, { onConflict: 'list_name' })
    .select('*')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, liste: data })
}

export async function DELETE(req: Request, ctx: RouteCtx) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })
  const { name: rawName } = await ctx.params
  const name = decodeURIComponent(rawName).trim()
  const url = new URL(req.url)
  const clearLeads = url.searchParams.get('clearLeads') === 'true'

  const supabase = createAdminClient()
  let cleared = 0
  if (clearLeads) {
    const { error: e0, count } = await supabase
      .from('leads')
      .update({ list_name: null } as never, { count: 'exact' })
      .eq('list_name', name)
    if (e0) return NextResponse.json({ error: 'clear-leads: ' + e0.message }, { status: 500 })
    cleared = count ?? 0
  }
  const { error } = await supabase.from('cluster_content').delete().eq('list_name', name)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, deleted: name, leads_cleared: cleared })
}
