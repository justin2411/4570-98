'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

/**
 * Universeller Zurück-Button für Mobile.
 * router.back() wenn History vorhanden, sonst fallback auf /setter.
 *
 * Style ist auf dunkle Hintergründe abgestimmt (white/10 backdrop).
 * Für helle Hintergründe: variant="light" verwenden.
 */
export function BackButton({
  fallbackHref = '/setter',
  variant = 'dark',
  label = 'Zurück',
}: {
  fallbackHref?: string
  variant?: 'dark' | 'light'
  label?: string
}) {
  const router = useRouter()

  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push(fallbackHref)
    }
  }

  const styles = variant === 'dark'
    ? 'bg-white/10 hover:bg-white/20 text-white backdrop-blur'
    : 'bg-white hover:bg-gray-50 text-[#1E3A5F] border border-gray-200 shadow-sm'

  return (
    <button
      onClick={handleBack}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-colors active:scale-95 ${styles}`}
      aria-label={label}
    >
      <ArrowLeft className="w-4 h-4" />
      <span>{label}</span>
    </button>
  )
}
