import { cn } from '@/lib/utils'

export function AppointmentTypeBadge({ type, className }: { type: string; className?: string }) {
  const isPlanned = type === 'planned'
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium',
      isPlanned
        ? 'bg-yellow-100 text-yellow-800'
        : 'bg-green-100 text-green-800',
      className
    )}>
      {isPlanned ? '🟡' : '🟢'} {isPlanned ? 'Geplant' : 'Stattgefunden'}
    </span>
  )
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const config: Record<string, { label: string; classes: string }> = {
    available: { label: 'Verfügbar', classes: 'bg-blue-100 text-blue-800' },
    sold: { label: 'Verkauft', classes: 'bg-gray-100 text-gray-700' },
    no_show: { label: 'No-Show', classes: 'bg-red-100 text-red-700' },
  }
  const { label, classes } = config[status] || { label: status, classes: 'bg-gray-100 text-gray-600' }
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', classes, className)}>
      {label}
    </span>
  )
}
