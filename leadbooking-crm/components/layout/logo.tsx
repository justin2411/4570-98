'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

/**
 * Logo mit dynamischen Setter-Initialen.
 *   "Justin Koch" → "JK"
 *   "Jonas Tamele" → "JT"
 *   "Anna Lisa Müller" → "AM" (erstes + letztes Wort)
 *   Single-Name "Madonna" → "M"
 */
function getInitials(name: string | null | undefined): string {
  if (!name) return '·'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Logo({
  light,
  // mobileCompact bleibt als Prop für Backward-Compat, wird aber ignoriert
  mobileCompact: _mobileCompact,
  className,
}: {
  light?: boolean
  mobileCompact?: boolean
  className?: string
}) {
  const supabase = createClient()
  const [initials, setInitials] = useState<string>('·')
  const [avatarColor, setAvatarColor] = useState<string>('#2E75B6')

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_color')
        .eq('id', user.id)
        .maybeSingle()

      if (cancelled) return
      if (profile?.full_name) setInitials(getInitials(profile.full_name))
      if (profile?.avatar_color) setAvatarColor(profile.avatar_color)
    }

    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: avatarColor }}
      >
        <span className="text-white font-bold text-sm">{initials}</span>
      </div>
      <span className={cn('font-bold text-lg', light ? 'text-white' : 'text-[#1E3A5F]')}>
        CRM
      </span>
    </div>
  )
}
