import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | null): string {
  if (!date) return '–'
  return new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDateTime(date: string | null): string {
  if (!date) return '–'
  return new Date(date).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export function scoreColor(score: number): string {
  if (score >= 10) return 'text-green-600 bg-green-50 border-green-200'
  if (score >= 9) return 'text-orange-600 bg-orange-50 border-orange-200'
  if (score >= 7) return 'text-blue-600 bg-blue-50 border-blue-200'
  return 'text-gray-600 bg-gray-50 border-gray-200'
}

export function scoreEmoji(score: number): string {
  return score >= 10 ? '🔥' : ''
}

export function calcShowRate(set: number, done: number): number {
  if (set === 0) return 0
  return Math.round((done / set) * 100)
}
