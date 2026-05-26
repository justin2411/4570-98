'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

export function ResetRanglisteButton() {
  const [loading, setLoading] = useState(false)

  async function onClick() {
    const ok = confirm(
      'Alle Ranglisten-/Statistikdaten aller Setter werden auf 0 gesetzt.\n' +
      'Gelegte/stattgefundene Termine werden auf "angerufen" zurückgesetzt.\n\n' +
      'Das kann nicht rückgängig gemacht werden. Fortfahren?'
    )
    if (!ok) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/reset-rangliste', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Unbekannter Fehler')
      toast.success('✅ Ranglisten zurückgesetzt')
      setTimeout(() => location.reload(), 800)
    } catch (e: any) {
      toast.error('Fehler: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
      <h3 className="text-sm font-bold text-red-900">Gefahrenzone</h3>
      <p className="text-xs text-red-800">
        Setzt sämtliche Anruf-/Termin-Statistiken aller Setter auf 0. Termine
        im Status „gelegt"/„stattgefunden" werden auf „angerufen" zurückgesetzt.
        Nicht rückgängig zu machen.
      </p>
      <button
        onClick={onClick}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm"
      >
        {loading ? 'Setze zurück…' : '⚠️ Ranglisten auf 0 zurücksetzen'}
      </button>
    </div>
  )
}
