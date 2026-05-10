import { CalendarCheck } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  light?: boolean
}

export function Logo({ className, light }: LogoProps) {
  return (
    <Link href="/" className={cn('flex items-center gap-2 font-bold text-xl', className)}>
      <div className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center',
        light ? 'bg-white/20' : 'bg-[#1E3A5F]'
      )}>
        <CalendarCheck className={cn('w-5 h-5', light ? 'text-white' : 'text-white')} />
      </div>
      <span className={light ? 'text-white' : 'text-[#1E3A5F]'}>Leadbooking</span>
    </Link>
  )
}
