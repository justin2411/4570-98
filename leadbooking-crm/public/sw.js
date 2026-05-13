// Leadbooking CRM Service Worker
// Sehr schlank — nur das Nötigste damit "Zum Home-Bildschirm hinzufügen" funktioniert
// und die App im Standalone-Modus läuft. Kein Caching (für Realtime-Updates wichtig).

const VERSION = 'v1'

self.addEventListener('install', (event) => {
  // Sofort die neue Version aktivieren
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Network-only Strategie: keine Caches, damit der Setter immer live-Daten sieht
self.addEventListener('fetch', (event) => {
  // Pass-through — keine speziellen Anpassungen
  // Falls offline: Browser zeigt seine Standard-Fehlermeldung
})

// Optional: Push-Empfang (für künftige echte Push-Notifications via VAPID)
self.addEventListener('push', (event) => {
  if (!event.data) return
  try {
    const payload = event.data.json()
    event.waitUntil(
      self.registration.showNotification(payload.title || 'Leadbooking', {
        body: payload.body || '',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: payload.tag,
        data: payload.data,
      })
    )
  } catch (_) {}
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Falls App schon offen → fokussieren
      for (const client of clients) {
        if ('focus' in client) return client.focus()
      }
      // Sonst öffnen
      if (self.clients.openWindow) return self.clients.openWindow('/')
    })
  )
})
