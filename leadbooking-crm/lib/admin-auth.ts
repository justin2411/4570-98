import { createClient } from '@/lib/supabase/server'
import { timingSafeEqual } from 'crypto'

/** Konstant-zeitiger Token-Vergleich (kein Timing-Side-Channel). */
export function tokenMatches(provided: string, expected: string): boolean {
  if (!provided || !expected) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Entschärft einen Freitext-Suchbegriff für PostgREST-`.or()`-Filter:
 * entfernt die Trennzeichen `, ( )`, Backslash und Wildcards `% *`, damit
 * ein Wert nicht aus dem gedachten Filter ausbrechen und beliebige
 * Bedingungen anhängen kann (Filter-Injection).
 */
export function sanitizeSearchTerm(s: string): string {
  return s.replace(/[,()*\\%"]/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Prüft, ob der Request entweder
 *  - einen gültigen Bearer-Token (`ADMIN_API_TOKEN` env) mitbringt, ODER
 *  - eine Admin-Session-Cookie hat (profiles.role = 'admin').
 *
 * Liefert { ok, via, error? }. Nutzung in jedem Token-Endpoint:
 *
 *   const auth = await checkAdminAuth(req)
 *   if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })
 */
export async function checkAdminAuth(req: Request): Promise<
  { ok: true; via: 'token' | 'session' } | { ok: false; error: string }
> {
  const authHeader = req.headers.get('authorization') || ''
  const provided = (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '').trim()
  const expected = (process.env.ADMIN_API_TOKEN || '').trim()
  if (tokenMatches(provided, expected)) {
    return { ok: true, via: 'token' }
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role === 'admin') return { ok: true, via: 'session' }
    }
  } catch {
    // Cookie-Kontext fehlt z. B. bei externen Tokens — fällt sauber durch
  }
  return { ok: false, error: 'Nicht berechtigt' }
}
