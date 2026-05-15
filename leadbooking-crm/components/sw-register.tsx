'use client'

import { useEffect } from 'react'

/**
 * Registriert den Service Worker.
 * Ersetzt die alte Version - ist robuster und versionsbewusst.
 */
export function SWRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    const timer = setTimeout(() => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((err) => {
          console.warn('SW registration failed:', err)
        })
    }, 1500)

    return () => clearTimeout(timer)
  }, [])

  return null
}
