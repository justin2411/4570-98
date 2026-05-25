// ============================================================
// Zeitzonen-Helfer — alle Statistik-/Ranglisten-Zeiträume in
// deutscher Zeit (Europe/Berlin), damit "Heute" um Mitternacht
// (DE) wechselt und mit dem DB-Trigger übereinstimmt.
// ============================================================

const TZ = 'Europe/Berlin'

/** Datum in Europe/Berlin als 'YYYY-MM-DD'. */
export function berlinDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
}

/** Verschiebt einen 'YYYY-MM-DD'-String um delta Tage (kalendarisch). */
export function addDaysStr(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + delta)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(dt)
}

/** Start des Berlin-Zeitraums als 'YYYY-MM-DD' (oder null für 'all'). */
export function berlinPeriodStart(p: 'today' | 'week' | 'month' | 'all'): string | null {
  const today = berlinDate()
  if (p === 'today') return today
  if (p === 'month') return today.slice(0, 7) + '-01'
  if (p === 'week') {
    const [y, m, d] = today.split('-').map(Number)
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0=So..6=Sa
    const sinceMonday = dow === 0 ? 6 : dow - 1
    return addDaysStr(today, -sinceMonday)
  }
  return null
}

/** UTC-Offset (Minuten, Berlin vor UTC) zum gegebenen Zeitpunkt. */
function tzOffsetMinutes(date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
  const map: Record<string, string> = {}
  for (const part of dtf.formatToParts(date)) if (part.type !== 'literal') map[part.type] = part.value
  let hour = map.hour
  if (hour === '24') hour = '00'
  const asUTC = Date.UTC(+map.year, +map.month - 1, +map.day, +hour, +map.minute, +map.second)
  return Math.round((asUTC - date.getTime()) / 60000)
}

/** UTC-ISO-Zeitpunkt von Berlin-Mitternacht eines 'YYYY-MM-DD'-Datums. */
export function berlinDayStartISO(berlinDateStr: string): string {
  const utcMidnight = Date.parse(berlinDateStr + 'T00:00:00Z')
  const off = tzOffsetMinutes(new Date(utcMidnight))
  return new Date(utcMidnight - off * 60000).toISOString()
}
