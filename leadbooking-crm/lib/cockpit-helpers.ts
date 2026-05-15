// Erfolgs-Sound mit Web Audio API (kein Asset nötig)
export function playSuccessSound() {
  if (typeof window === 'undefined') return
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    // Aufsteigender 3-Ton "Ding-Ding-Ding"
    const notes = [
      { freq: 523.25, time: 0.00 },   // C5
      { freq: 659.25, time: 0.10 },   // E5
      { freq: 783.99, time: 0.20 },   // G5
    ]
    notes.forEach(n => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = n.freq
      o.connect(g)
      g.connect(ctx.destination)
      g.gain.setValueAtTime(0, ctx.currentTime + n.time)
      g.gain.linearRampToValueAtTime(0.25, ctx.currentTime + n.time + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.time + 0.35)
      o.start(ctx.currentTime + n.time)
      o.stop(ctx.currentTime + n.time + 0.35)
    })
  } catch {}
}

// Relative-Time-Formatter für Anruf-Anzeige
export function formatRelativeTime(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diff = now - then
  const min = 60 * 1000
  const hour = 60 * min
  const day = 24 * hour

  if (diff < min * 2) return 'gerade eben'
  if (diff < hour) return `vor ${Math.floor(diff / min)} Min`
  if (diff < hour * 2) return 'vor 1 Std'
  if (diff < day) return `vor ${Math.floor(diff / hour)} Std`
  if (diff < day * 2) return 'gestern'
  if (diff < day * 7) return `vor ${Math.floor(diff / day)} Tagen`
  return new Date(iso).toLocaleDateString('de-DE')
}

// Streak berechnen: wieviele Tage in Folge gab es mindestens 1 termin_gelegt?
export function calculateStreak(termineDates: string[]): number {
  // termineDates: array of ISO-strings, frischeste zuerst (egal eigentlich, wir dedupen by date)
  const setOfDays = new Set(termineDates.map(d => new Date(d).toDateString()))
  let streak = 0
  const d = new Date()
  // Wenn heute nichts war: Streak ist trotzdem nicht gebrochen, solang gestern was war
  // → Wir prüfen ab heute rückwärts, akzeptieren aber dass heute leer sein kann
  if (!setOfDays.has(d.toDateString())) {
    d.setDate(d.getDate() - 1)
  }
  while (setOfDays.has(d.toDateString())) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}
