'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Users, Calendar, Clock, LogOut, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Logo } from './logo'
import { cn } from '@/lib/utils'

const links = [
  { href: '/setter', label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard },
  { href: '/setter/leads', label: 'Meine Leads', shortLabel: 'Leads', icon: Users },
  { href: '/setter/wiedervorlage', label: 'Wiedervorlagen', shortLabel: 'Wiedervorl.', icon: Clock },
  { href: '/setter/termine', label: 'Meine Termine', shortLabel: 'Termine', icon: Calendar },
  { href: '/rangliste', label: 'Rangliste', shortLabel: 'Rangliste', icon: Trophy },
]

function getPageTitle(pathname: string): string {
  const match = links.find(l => pathname === l.href || (l.href !== '/setter' && pathname.startsWith(l.href)))
  return match?.label || 'Dashboard'
}

export function SetterNav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (href: string) =>
    pathname === href || (href !== '/setter' && pathname.startsWith(href))

  return (
    <>
      {/* ============ Desktop sidebar (unverändert) ============ */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-64 bg-[#1E3A5F] text-white">
        <div className="p-5 border-b border-white/10">
          <Logo light />
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive(href)
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          ))}
        </nav>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-6 py-4 text-white/70 hover:text-white text-sm border-t border-white/10 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Abmelden
        </button>
      </aside>

      {/* ============ Mobile Top-Bar: Logo links + Seitentitel + Logout rechts ============ */}
      <header
        className="lg:hidden fixed top-0 inset-x-0 bg-[#1E3A5F] flex items-center justify-between px-4 z-30"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          height: 'calc(56px + env(safe-area-inset-top))',
        }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Logo light mobileCompact />
          <span className="text-white/60 text-sm mx-1 shrink-0">·</span>
          <span className="text-white/90 text-sm font-medium truncate">
            {getPageTitle(pathname)}
          </span>
        </div>
        <button
          onClick={logout}
          className="p-2 -mr-2 text-white/70 hover:text-white shrink-0"
          aria-label="Abmelden"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* ============ Mobile Bottom-Nav (native app feel) ============ */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-30"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-5 h-16">
          {links.map(({ href, shortLabel, icon: Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 transition-colors active:bg-gray-100',
                  active ? 'text-[#2E75B6]' : 'text-gray-500'
                )}
              >
                <Icon className={cn('w-5 h-5', active && 'scale-110 transition-transform')} />
                <span className={cn('text-[10px] font-medium leading-none', active && 'text-[#1E3A5F] font-semibold')}>
                  {shortLabel}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
