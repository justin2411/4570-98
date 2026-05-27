import { createAdminClient } from '@/lib/supabase/server'
import { checkAdminAuth } from '@/lib/admin-auth'
import { NextResponse } from 'next/server'

/**
 * /api/admin/berufe/[name]
 *   PATCH  → Beruf bearbeiten ({ rename?, plural_form?, is_active? })
 *            Wenn `rename` gesetzt: alle leads.beruf werden mit-umbenannt
 *            (DB-Trigger upsert_beruf_master sorgt für Konsistenz).
 *   DELETE → Beruf entfernen. Optional ?clearLeads=true setzt leads.beruf=null
 *            für alle Leads mit diesem Wert. Sonst nur Master-Eintrag weg
 *            (leads.beruf bleibt als Free-Text-Wert, kommt beim Trigger-
 *            Hit wieder zurück in die Master-Liste).
 */
type RouteCtx = { params: Promise<{ name: string }> }

export async function PATCH(req: Request, ctx: RouteCtx) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })
  const { name: rawName } = await ctx.params
  const name = decodeURIComponent(rawName).trim()
  if (!name) return NextResponse.json({ error: 'name fehlt' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const rename = typeof body.rename === 'string' ? body.rename.trim() : ''
  const plural_form = typeof body.plural_form === 'string' ? body.plural_form.trim() : undefined
  const is_active = typeof body.is_active === 'boolean' ? body.is_active : undefined

  const supabase = createAdminClient()

  // Rename: erst neuen Master-Eintrag anlegen (falls noch nicht da),
  // dann alle leads umbenennen, dann alten Master-Eintrag löschen.
  if (rename && rename !== name) {
    const { error: e1 } = await supabase
      .from('berufe')
      .upsert({
        name: rename,
        plural_form: plural_form ?? '',
        is_active: is_active ?? true,
      } as never, { onConflict: 'name' })
    if (e1) return NextResponse.json({ error: 'create-new: ' + e1.message }, { status: 500 })

    const { error: e2, count } = await supabase
      .from('leads')
      .update({ beruf: rename } as never, { count: 'exact' })
      .eq('beruf', name)
    if (e2) return NextResponse.json({ error: 'rename-leads: ' + e2.message }, { status: 500 })

    const { error: e3 } = await supabase.from('berufe').delete().eq('name', name)
    if (e3) return NextResponse.json({ error: 'drop-old: ' + e3.message }, { status: 500 })
    return NextResponse.json({ ok: true, renamed: name + ' → ' + rename, leads_updated: count })
  }

  // Nur Feld-Updates ohne Rename
  const patch: Record<string, unknown> = {}
  if (plural_form !== undefined) patch.plural_form = plural_form
  if (is_active !== undefined) patch.is_active = is_active
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nichts zu ändern' }, { status: 400 })
  }
  const { data, error } = await supabase.from('berufe').update(patch as never).eq('name', name).select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Beruf nicht gefunden' }, { status: 404 })
  return NextResponse.json({ ok: true, beruf: data })
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
    // leads.beruf ist NOT NULL → wir setzen auf '' (Leerstring), nicht NULL.
    // Effekt für die App identisch: alle UI/Filter behandeln '' wie "kein beruf".
    const { error: e0, count } = await supabase
      .from('leads')
      .update({ beruf: '' } as never, { count: 'exact' })
      .eq('beruf', name)
    if (e0) return NextResponse.json({ error: 'clear-leads: ' + e0.message }, { status: 500 })
    cleared = count ?? 0
  }
  const { error } = await supabase.from('berufe').delete().eq('name', name)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, deleted: name, leads_cleared: cleared })
}
