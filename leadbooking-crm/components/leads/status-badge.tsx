import { STATUS_CONFIG, LeadStatus } from '@/types'

export function StatusBadge({ status }: { status: LeadStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg}`}>
      {cfg.emoji} {cfg.label}
    </span>
  )
}
