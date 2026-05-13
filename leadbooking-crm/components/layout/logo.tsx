import { cn } from '@/lib/utils'

export function Logo({
  light,
  className,
  mobileCompact,
}: {
  light?: boolean
  className?: string
  /** Wenn true: auf Handys nur "LBCRM", auf Desktop voller Name */
  mobileCompact?: boolean
}) {
  return (
    <div className={cn('flex items-center gap-2 min-w-0', className)}>
      <div className="w-8 h-8 bg-[#2E75B6] rounded-lg flex items-center justify-center shrink-0">
        <span className="text-white font-bold text-sm">LC</span>
      </div>
      {mobileCompact ? (
        <span className={cn('font-bold text-lg whitespace-nowrap', light ? 'text-white' : 'text-[#1E3A5F]')}>
          <span className="sm:hidden">LBCRM</span>
          <span className="hidden sm:inline">Leadbooking CRM</span>
        </span>
      ) : (
        <span className={cn('font-bold text-lg whitespace-nowrap', light ? 'text-white' : 'text-[#1E3A5F]')}>
          Leadbooking CRM
        </span>
      )}
    </div>
  )
}
