import { createAdminClient } from '@/lib/supabase/server'
import { checkAdminAuth } from '@/lib/admin-auth'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { NextResponse } from 'next/server'

/**
 * GET /api/admin/stats
 *
 * Liefert Aggregate über Leads — frei filterbar via Query-String.
 * Default-Gruppierung: status × setter × list.
 *
 * Query-Parameter:
 *   listName        – auf eine Liste filtern
 *   includeArchived – default false
 *   groupBy         – kommagetrennt, default: "status,assigned_to,list_name"
 *                     erlaubt: status, assigned_to, list_name, archived
 *
 * Response: { rows: [{ key1, key2, ..., count }], total, setters: [{id,name}] }
 */
const ALLOWED_GROUPS = ['status', 'assigned_to', 'list_name', 'archived'] as const
type GroupKey = (typeof ALLOWED_GROUPS)[number]

export async function GET(req: Request) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

  const url = new URL(req.url)
  const listName = url.searchParams.get('listName')
  const includeArchived = url.searchParams.get('includeArchived') === 'true'
  const groupParam = (url.searchParams.get('groupBy') || 'status,assigned_to,list_name')
    .split(',')
    .map(s => s.trim())
    .filter((g): g is GroupKey => (ALLOWED_GROUPS as readonly string[]).includes(g))
  const groups: GroupKey[] = groupParam.length > 0 ? groupParam : ['status', 'assigned_to', 'list_name']

  const supabase = createAdminClient()
  // Vollständig paginiert (stabil nach id) — sonst würden Aggregate über
  // nur 1000 Leads gerechnet (PostgREST-Deckel) und die Zahlen wären falsch.
  let rows: Array<Record<GroupKey, unknown>>
  try {
    rows = await fetchAllRows<Record<GroupKey, unknown>>((from, to) => {
      let q = supabase.from('leads').select('status, assigned_to, list_name, archived')
        .order('id', { ascending: true }).range(from, to)
      if (listName) q = q.eq('list_name', listName)
      if (!includeArchived) q = q.or('archived.is.null,archived.eq.false')
      return q
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
  const buckets: Record<string, { count: number } & Partial<Record<GroupKey, unknown>>> = {}
  for (const r of rows) {
    const key = groups.map(g => String(r[g] ?? '∅')).join('|')
    if (!buckets[key]) {
      const seed: Partial<Record<GroupKey, unknown>> = {}
      groups.forEach(g => { seed[g] = r[g] ?? null })
      buckets[key] = { ...seed, count: 0 }
    }
    buckets[key].count++
  }

  // Setter-Namen mitliefern, damit assigned_to-UUIDs lesbar sind
  const { data: setters } = await supabase.from('profiles').select('id, full_name').in('role', ['setter', 'admin'])

  return NextResponse.json({
    groupBy: groups,
    total: rows.length,
    rows: Object.values(buckets).sort((a, b) => b.count - a.count),
    setters: (setters || []).map(s => ({ id: s.id, name: (s as { full_name?: string }).full_name })),
  })
}
