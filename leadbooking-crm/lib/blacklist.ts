import { createAdminClient } from '@/lib/supabase/server'
import { normalizePhoneKey } from '@/lib/phone'
import type { Lead } from '@/types'

/**
 * Server-seitiger Blacklist-Helfer.
 *
 *  - normalizeForBlacklist(phone): Ziffern-Form (ohne '+') — muss exakt
 *    der DB-Funktion `normalize_phone(text)` entsprechen (siehe
 *    supabase/blacklist-setup.sql).
 *  - getBlacklistedPhones(): Set aller blacklisteten Telefon-Keys,
 *    cached 5 Min im Node-Prozess.
 *  - filterBlacklistedLeads(leads): entfernt alle Leads, deren Telefon
 *    in der Blacklist steht.
 *
 * Cache wird auf jedem Vercel-Lambda separat gehalten — das ist
 * tolerabel, weil Blacklist-Drift maximal 5 Minuten dauert.
 */

const CACHE_TTL_MS = 5 * 60 * 1000
let cached: { phones: Set<string>; loadedAt: number } | null = null
let loadingPromise: Promise<Set<string>> | null = null

export function normalizeForBlacklist(phone: string | null | undefined): string | null {
  return normalizePhoneKey(phone)
}

async function loadFromDb(): Promise<Set<string>> {
  const supabase = createAdminClient()
  const set = new Set<string>()
  // Paginiert laden (Supabase default-limit 1000)
  let from = 0
  const page = 1000
  while (true) {
    const { data, error } = await supabase.from('blacklist').select('phone').range(from, from + page - 1)
    if (error) throw new Error(error.message)
    const rows = (data || []) as Array<{ phone: string }>
    for (const r of rows) if (r.phone) set.add(r.phone)
    if (rows.length < page) break
    from += page
  }
  return set
}

export async function getBlacklistedPhones(forceRefresh = false): Promise<Set<string>> {
  const now = Date.now()
  if (!forceRefresh && cached && now - cached.loadedAt < CACHE_TTL_MS) {
    return cached.phones
  }
  if (!loadingPromise) {
    loadingPromise = loadFromDb()
      .then(phones => { cached = { phones, loadedAt: now }; return phones })
      .catch(err => { console.error('[blacklist] load failed:', err); return new Set<string>() })
      .finally(() => { loadingPromise = null })
  }
  return loadingPromise
}

export async function filterBlacklistedLeads<T extends Pick<Lead, 'phone'>>(leads: T[]): Promise<T[]> {
  if (leads.length === 0) return leads
  const blacklist = await getBlacklistedPhones()
  if (blacklist.size === 0) return leads
  return leads.filter(l => {
    const key = normalizeForBlacklist((l as any).phone)
    return !key || !blacklist.has(key)
  })
}

/** Test/Diagnose: erzwingt sofortiges Reload (z. B. nach manuellem Add/Remove). */
export function invalidateBlacklistCache(): void {
  cached = null
}

/**
 * Lädt alle normalisierten Telefon-Keys der bestehenden (nicht gelöschten)
 * Leads — paginiert, weil Supabase bei 1000 Zeilen deckelt. Basis für die
 * Dublettenerkennung beim Import (zusätzlich zur Blacklist): dieselbe Nummer
 * in anderer Schreibweise wird so trotzdem als Duplikat erkannt.
 */
export async function getExistingLeadPhoneKeys(): Promise<Set<string>> {
  const supabase = createAdminClient()
  const set = new Set<string>()
  let from = 0
  const page = 1000
  while (true) {
    const { data, error } = await supabase.from('leads').select('phone').range(from, from + page - 1)
    if (error) throw new Error(error.message)
    const rows = (data || []) as Array<{ phone: string | null }>
    for (const r of rows) { const k = normalizePhoneKey(r.phone); if (k) set.add(k) }
    if (rows.length < page) break
    from += page
  }
  return set
}
