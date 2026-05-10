import { cn } from '@/lib/utils'

export function Logo({ light, className }: { light?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="w-8 h-8 bg-[#2E75B6] rounded-lg flex items-center justify-center">
        <span className="text-white font-bold text-sm">LC</span>
      </div>
      <span className={cn('font-bold text-lg', light ? 'text-white' : 'text-[#1E3A5F]')}>
        Leadbooking CRM
      </span>
    </div>
  )
}
