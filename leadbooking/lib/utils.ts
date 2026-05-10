import { clsx, type ClassValue } from 'clsx'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'dd.MM.yyyy', { locale: de })
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'dd.MM.yyyy, HH:mm', { locale: de }) + ' Uhr'
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

export function appointmentTypeLabel(type: string): string {
  return type === 'planned' ? 'Geplant' : 'Stattgefunden'
}

export function appointmentTypeEmoji(type: string): string {
  return type === 'planned' ? '🟡' : '🟢'
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'available': return 'Verfügbar'
    case 'sold': return 'Verkauft'
    case 'no_show': return 'No-Show'
    default: return status
  }
}
