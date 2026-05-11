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
  if (score >= 10) return 'text-green-700 bg-green-50 border-green-300'
  if (score >= 9) return 'text-orange-700 bg-orange-50 border-orange-300'
  if (score >= 7) return 'text-blue-700 bg-blue-50 border-blue-300'
  return 'text-gray-900 bg-gray-200 border-gray-500'
}
export function scoreEmoji(score: number): string {
  return score >= 10 ? '🔥' : ''
}
export function calcShowRate(set: number, done: number): number {
  if (set === 0) return 0
  return Math.round((done / set) * 100)
}
