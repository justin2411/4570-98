import type { PostgrestError } from '@supabase/supabase-js'

/**
 * Lädt ALLE Zeilen einer Supabase-Query über `.range()`-Pagination.
 *
 * Hintergrund: PostgREST deckelt jede Antwort hart bei 1000 Zeilen
 * (`db-max-rows`). Ein einfaches `.select()` ohne `.range()` liefert
 * deshalb NIE mehr als 1000 Zeilen zurück — bei ~8.000 Leads werden also
 * stillschweigend ~7.000 ignoriert (verfälscht Statistik, Verteilung,
 * Score-Training).
 *
 * `makeRangeQuery(from, to)` muss die vollständige Query inkl. Filtern,
 * einer STABILEN Sortierung (z. B. `.order('id')`) und `.range(from, to)`
 * zurückgeben. Die stabile Sortierung ist wichtig — sonst können sich
 * Zeilen zwischen den Seiten verschieben und Datensätze doppelt oder gar
 * nicht erfasst werden.
 *
 * Beispiel:
 *   const leads = await fetchAllRows<Lead>((from, to) =>
 *     supabase.from('leads').select('*').order('id').range(from, to))
 */
export async function fetchAllRows<T>(
  makeRangeQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await makeRangeQuery(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < pageSize) break
    from += pageSize
  }
  return out
}
