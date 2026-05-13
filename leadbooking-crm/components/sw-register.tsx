'use client'

import { useEffect } from 'react'

export function SWRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    // Erst nach Load registrieren um Page-Performance nicht zu blockieren
    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* ignore */ })
    }
    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad, { once: true })
  }, [])
  return null
}
