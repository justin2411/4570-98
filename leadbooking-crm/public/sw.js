// Minimaler Service Worker für PWA-Installability
// KEIN aggressives Caching — die App soll immer fresh sein
// Nur Navigation-Fallback bei komplettem Offline-Zustand

const CACHE_NAME = 'hv-crm-v1'

self.addEventListener('install', (event) => {
  // Sofort aktivieren bei Update
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Alte Caches löschen + sofort übernehmen
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Nur GET-Requests, keine API-Calls oder Supabase
  if (request.method !== 'GET') return
  if (request.url.includes('/api/')) return
  if (request.url.includes('supabase')) return

  // Network-first für alle Seiten
  event.respondWith(
    fetch(request).catch(() => {
      // Offline-Fallback: zeige zuletzt gecachte Version oder einfache Offline-Meldung
      return caches.match(request).then((cached) => {
        if (cached) return cached
        if (request.mode === 'navigate') {
          return new Response(
            '<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline – HV CRM</title><style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#1E3A5F;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}.box{max-width:320px}h1{font-size:24px;margin:0 0 12px}p{opacity:.8;line-height:1.5}</style></head><body><div class="box"><div style="font-size:48px;margin-bottom:8px">📡</div><h1>Offline</h1><p>Du bist gerade offline. Sobald du wieder Verbindung hast, einfach neu laden.</p></div></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          )
        }
      })
    })
  )
})
