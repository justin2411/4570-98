'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Bell, BellOff } from 'lucide-react'
import toast from 'react-hot-toast'

export function PushNotificationToggle({ userId: _userId }: { userId: string }) {
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if ('Notification' in window && 'serviceWorker' in navigator) {
      setSupported(true)
      checkSubscription()
    }
  }, [])

  async function checkSubscription() {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      setSubscribed(!!sub)
    } catch {}
  }

  async function handleToggle() {
    setLoading(true)
    try {
      if (subscribed) {
        await unsubscribe()
      } else {
        await subscribe()
      }
    } catch (e: any) {
      toast.error('Fehler: ' + e.message)
    }
    setLoading(false)
  }

  async function subscribe() {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      toast.error('Push-Benachrichtigungen wurden abgelehnt.')
      return
    }

    const reg = await navigator.serviceWorker.ready
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

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

    setSubscribed(true)
    toast.success('Push-Benachrichtigungen aktiviert!')
  }

  async function unsubscribe() {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await sub.unsubscribe()
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      })
    }
    setSubscribed(false)
    toast.success('Push-Benachrichtigungen deaktiviert.')
  }

  if (!supported) {
    return (
      <p className="text-sm text-gray-500">
        Ihr Browser unterstützt keine Push-Benachrichtigungen.
      </p>
    )
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-900">
          {subscribed ? 'Benachrichtigungen aktiv' : 'Benachrichtigungen inaktiv'}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {subscribed
            ? 'Sie werden bei neuen Terminen benachrichtigt.'
            : 'Aktivieren, um sofort über neue Termine informiert zu werden.'}
        </p>
      </div>
      <Button
        onClick={handleToggle}
        loading={loading}
        variant={subscribed ? 'outline' : 'primary'}
        size="sm"
        className="flex items-center gap-2"
      >
        {subscribed ? (
          <><BellOff className="w-4 h-4" /> Deaktivieren</>
        ) : (
          <><Bell className="w-4 h-4" /> Aktivieren</>
        )}
      </Button>
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const arr = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i)
  return arr.buffer
}
