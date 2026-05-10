'use client'

import { useEffect } from 'react'

export function PushInit({ userId }: { userId: string }) {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return

    // Service Worker registrieren
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope)
      })
      .catch((err) => console.error('SW registration failed:', err))

    // Auto-Subscribe falls bereits erlaubt
    if (Notification.permission === 'granted') {
      autoSubscribe()
    }
  }, [userId])

  async function autoSubscribe() {
    try {
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) return // Bereits abonniert

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) return

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      const subJSON = sub.toJSON()
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subJSON.endpoint,
          p256dh: (subJSON.keys as any)?.p256dh,
          auth: (subJSON.keys as any)?.auth,
        }),
      })
    } catch {}
  }

  return null
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const arr = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i)
  return arr.buffer
}
