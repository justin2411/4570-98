'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, BellOff } from 'lucide-react'

interface Props {
  userId: string
}

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported'

// Polling: alle 5 Minuten reicht für Wiedervorlagen + Termin-Erinnerungen
const POLL_INTERVAL_MS = 5 * 60 * 1000

export function NotificationsProvider({ userId }: Props) {
  const supabase = createClient()
  const [permission, setPermission] = useState<PermissionState>('default')
  const [showBanner, setShowBanner] = useState(false)

  // Permission-Status beim Mount lesen
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) { setPermission('unsupported'); return }
    setPermission(Notification.permission as PermissionState)
    if (Notification.permission === 'default') {
      const t = setTimeout(() => setShowBanner(true), 5000)
      return () => clearTimeout(t)
    }
  }, [])

  async function askPermission() {
    if (!('Notification' in window)) return
    const result = await Notification.requestPermission()
    setPermission(result as PermissionState)
    setShowBanner(false)
    if (result === 'granted') {
      new Notification('🎉 Benachrichtigungen aktiv', {
        body: 'Du wirst informiert bei neuen Leads, fälligen Wiedervorlagen und anstehenden Terminen.',
        icon: '/favicon.ico',
      })
    }
  }

  function showLocalNotification(title: string, body: string, tag: string) {
    if (permission !== 'granted') return
    try {
      new Notification(title, { body, icon: '/favicon.ico', tag, requireInteraction: false })
    } catch (_) { /* ignore */ }
  }

  // Deduplikation per localStorage — verhindert dass dieselbe Notification
  // beim nächsten Polling oder nach Page-Reload nochmal aufpoppt.
  // Returnt true wenn bereits notified, false wenn neu.
  function alreadyNotified(tag: string): boolean {
    if (typeof window === 'undefined') return true
    if (localStorage.getItem(tag)) return true
    try { localStorage.setItem(tag, '1') } catch (_) {}
    return false
  }

  // ============================================================
  // 1) Neue Leads — Realtime INSERT
  //    (UPDATE-Listener wurde entfernt: triggerte fälschlich bei
  //     jedem Status-Wechsel weil Supabase Realtime den alten
  //     assigned_to-Wert nicht zuverlässig liefert)
  // ============================================================
  useEffect(() => {
    if (permission !== 'granted') return

    const ch = supabase.channel(`notif-new-leads-${userId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads', filter: `assigned_to=eq.${userId}` },
        (payload) => {
          const lead = payload.new as { id: string; name: string }
          showLocalNotification('🆕 Neuer Lead', lead.name, `lead-new-${lead.id}`)
        })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, permission])

  // ============================================================
  // 2) Polling: fällige Wiedervorlagen + Termine in den nächsten 24h
  // ============================================================
  useEffect(() => {
    if (permission !== 'granted') return

    async function checkDue() {
      const now = new Date()
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

      // ---- A) Fällige Wiedervorlagen (recall_date <= jetzt) ----
      const { data: recalls } = await supabase
        .from('leads')
        .select('id, name, recall_date')
        .eq('assigned_to', userId)
        .eq('status', 'wiedervorlage')
        .lte('recall_date', now.toISOString())

      if (recalls) {
        for (const lead of recalls) {
          // Tag enthält recall_date → bei Verschiebung neuer Tag
          const tag = `recall-${lead.id}-${lead.recall_date}`
          if (!alreadyNotified(tag)) {
            showLocalNotification('⏰ Wiedervorlage fällig', lead.name, tag)
          }
        }
      }

      // ---- B) Anstehende Termine in den nächsten 24h ----
      const { data: appts } = await supabase
        .from('leads')
        .select('id, name, appointment_date')
        .eq('assigned_to', userId)
        .eq('status', 'termin_gelegt')
        .gte('appointment_date', now.toISOString())
        .lte('appointment_date', in24h.toISOString())

      if (appts) {
        for (const lead of appts) {
          // Tag mit Termin-Datum → bei Verschiebung neuer Tag
          const tag = `appt-${lead.id}-${lead.appointment_date}`
          if (!alreadyNotified(tag)) {
            const dt = new Date(lead.appointment_date!)
            const timeStr = dt.toLocaleString('de-DE', {
              weekday: 'long',
              hour: '2-digit',
              minute: '2-digit'
            })
            showLocalNotification('📅 Termin steht an', `${lead.name} — ${timeStr}`, tag)
          }
        }
      }
    }

    checkDue() // sofort einmal beim Mount
    const interval = setInterval(checkDue, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, permission])

  // Banner zum Aktivieren (nur beim ersten Login)
  if (!showBanner || permission !== 'default') return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:bottom-4 md:max-w-sm z-40 bg-white border border-[#2E75B6] rounded-xl shadow-lg p-4"
         style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
      <div className="flex items-start gap-3">
        <div className="p-2 bg-blue-50 rounded-lg shrink-0">
          <Bell className="w-5 h-5 text-[#2E75B6]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-[#1E3A5F]">Benachrichtigungen aktivieren?</p>
          <p className="text-xs text-gray-600 mt-1">Werde informiert bei neuen Leads, fälligen Wiedervorlagen und anstehenden Terminen.</p>
          <div className="flex gap-2 mt-3">
            <button onClick={askPermission} className="flex-1 px-3 py-2 bg-[#2E75B6] text-white rounded-lg text-sm font-semibold hover:bg-[#1E3A5F]">
              Aktivieren
            </button>
            <button onClick={() => setShowBanner(false)} className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
              Später
            </button>
          </div>
        </div>
        <button onClick={() => setShowBanner(false)} className="text-gray-400 hover:text-gray-600 shrink-0" aria-label="Banner schließen">
          <BellOff className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
