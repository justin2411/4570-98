'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, BellOff } from 'lucide-react'

interface Props {
  userId: string
}

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported'

export function NotificationsProvider({ userId }: Props) {
  const supabase = createClient()
  const [permission, setPermission] = useState<PermissionState>('default')
  const [showBanner, setShowBanner] = useState(false)
  const lastCheckRef = useRef<Date>(new Date())

  // Permission-Status beim Mount lesen
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) { setPermission('unsupported'); return }
    setPermission(Notification.permission as PermissionState)
    // Banner zeigen wenn noch nie gefragt
    if (Notification.permission === 'default') {
      // Nach 5 Sekunden anzeigen — nicht direkt beim Login
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
        body: 'Du wirst informiert bei neuen Leads und fälligen Wiedervorlagen.',
        icon: '/favicon.ico',
      })
    }
  }

  function showLocalNotification(title: string, body: string, tag: string) {
    if (permission !== 'granted') return
    // Per Tag verhindert dass dieselbe Notification mehrfach erscheint
    try {
      new Notification(title, { body, icon: '/favicon.ico', tag, requireInteraction: false })
    } catch (_) { /* ignore */ }
  }

  // 1) Realtime: neue Leads, die diesem Setter zugewiesen werden
  useEffect(() => {
    if (permission !== 'granted') return

    const ch = supabase.channel(`notif-setter-${userId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads', filter: `assigned_to=eq.${userId}` },
        (payload) => {
          const lead = payload.new as { id: string; name: string }
          showLocalNotification('🆕 Neuer Lead', lead.name, `lead-new-${lead.id}`)
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leads', filter: `assigned_to=eq.${userId}` },
        (payload) => {
          const newLead = payload.new as { id: string; name: string; assigned_to: string }
          const oldLead = payload.old as { assigned_to?: string }
          // Nur wenn der Lead NEU diesem Setter zugewiesen wurde
          if (oldLead.assigned_to !== userId && newLead.assigned_to === userId) {
            showLocalNotification('🆕 Lead dir zugewiesen', newLead.name, `lead-assigned-${newLead.id}`)
          }
        })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, permission])

  // 2) Polling für fällige Wiedervorlagen (Realtime kann das nicht ohne Cron)
  useEffect(() => {
    if (permission !== 'granted') return

    async function checkDue() {
      const now = new Date()
      const since = lastCheckRef.current.toISOString()
      const until = now.toISOString()
      const { data } = await supabase
        .from('leads')
        .select('id, name, recall_date')
        .eq('assigned_to', userId)
        .eq('status', 'wiedervorlage')
        .gte('recall_date', since)
        .lte('recall_date', until)

      if (data && data.length > 0) {
        for (const lead of data) {
          const key = `recall-${lead.id}-${lead.recall_date}`
          // localStorage verhindert Doppel-Notifications nach Page-Reload
          if (typeof window !== 'undefined' && !localStorage.getItem(key)) {
            showLocalNotification('⏰ Wiedervorlage fällig', lead.name, key)
            try { localStorage.setItem(key, '1') } catch (_) {}
          }
        }
      }
      lastCheckRef.current = now
    }

    checkDue() // sofort einmal
    const interval = setInterval(checkDue, 60_000) // dann jede Minute
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, permission])

  // Banner zum Aktivieren
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
          <p className="text-xs text-gray-600 mt-1">Werde sofort informiert bei neuen Leads und fälligen Wiedervorlagen.</p>
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
