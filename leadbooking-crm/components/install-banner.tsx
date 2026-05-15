'use client'

import { useEffect, useState } from 'react'
import { X, Smartphone, Share } from 'lucide-react'

/**
 * Schlaues Install-Banner:
 * - Android/Chrome: Nutzt `beforeinstallprompt` Event → nativer Install-Dialog
 * - iOS Safari: Zeigt Anleitung "Teilen → Zum Home-Bildschirm" (kein nativer Prompt verfügbar)
 * - Banner erscheint einmalig pro Browser, dismissal wird in localStorage gespeichert
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'hv-pwa-install-dismissed'
const DISMISS_DAYS = 14 // 14 Tage nicht mehr nerven

function isIos(): boolean {
  if (typeof window === 'undefined') return false
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !('MSStream' in window)
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  // iOS: navigator.standalone, andere: display-mode: standalone
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  )
}

function isDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const ts = parseInt(raw, 10)
    const days = (Date.now() - ts) / (1000 * 60 * 60 * 24)
    return days < DISMISS_DAYS
  } catch {
    return false
  }
}

function setDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {}
}

export function InstallBanner() {
  const [show, setShow] = useState(false)
  const [iosMode, setIosMode] = useState(false)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isStandalone()) return // schon installiert
    if (isDismissed()) return

    // iOS: zeige manuelle Anleitung
    if (isIos()) {
      // Etwas Verzögerung damit's nicht beim ersten Page-Load nervt
      const t = setTimeout(() => {
        setIosMode(true)
        setShow(true)
      }, 3000)
      return () => clearTimeout(t)
    }

    // Android/Chrome: Native Prompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setShow(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!deferred) return
    await deferred.prompt()
    const result = await deferred.userChoice
    if (result.outcome === 'accepted') {
      setShow(false)
    }
    setDeferred(null)
    setDismissed()
  }

  function handleDismiss() {
    setShow(false)
    setDismissed()
  }

  if (!show) return null

  return (
    <div className="fixed bottom-20 left-3 right-3 z-40 sm:left-auto sm:right-3 sm:bottom-4 sm:max-w-sm">
      <div className="bg-[#1E3A5F] text-white rounded-2xl shadow-2xl p-4 relative">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 text-white/60 hover:text-white"
          aria-label="Schließen"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm mb-0.5">📱 App installieren</div>
            {iosMode ? (
              <>
                <p className="text-xs text-white/80 leading-relaxed">
                  Für schnelleren Zugriff: Unten auf <Share className="w-3 h-3 inline -mt-0.5" /> tippen, dann <strong>„Zum Home-Bildschirm"</strong>.
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-white/80 leading-relaxed mb-2">
                  Schneller Zugriff mit App-Icon auf deinem Startbildschirm.
                </p>
                <button
                  onClick={handleInstall}
                  className="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-[#1E3A5F] text-xs font-bold rounded-lg active:scale-95 transition-all"
                >
                  Jetzt installieren
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
