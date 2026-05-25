export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { InhalteClient } from './client'

export default async function AdminInhaltePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Admin-Check
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/setter')

  // Cluster-Content + Listen parallel laden.
  // Listen schnell per RPC (SELECT DISTINCT); Fallback: Batch-Scan, falls die
  // Funktion in der DB noch nicht angelegt ist.
  const [{ data: contentRows }, { data: rpcLists, error: rpcErr }] = await Promise.all([
    supabase.from('cluster_content').select('*'),
    supabase.rpc('get_distinct_list_names'),
  ])

  let clusters: string[]
  if (!rpcErr && Array.isArray(rpcLists)) {
    clusters = (rpcLists as Array<{ list_name: string }>)
      .map(r => (r?.list_name || '').trim())
      .filter(Boolean)
  } else {
    const lists = new Set<string>()
    let from = 0
    const batchSize = 1000
    while (true) {
      const { data: batch } = await supabase
        .from('leads')
        .select('list_name')
        .range(from, from + batchSize - 1)
      if (!batch || batch.length === 0) break
      batch.forEach((r: { list_name?: string }) => {
        const ln = (r.list_name || '').trim()
        if (ln) lists.add(ln)
      })
      if (batch.length < batchSize) break
      from += batchSize
    }
    clusters = Array.from(lists)
  }

  clusters.sort((a, b) => a.localeCompare(b, 'de'))

  return <InhalteClient clusters={clusters} initialContent={(contentRows ?? []) as never[]} />
}
