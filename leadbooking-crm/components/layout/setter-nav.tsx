'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Users, Calendar, Clock, LogOut, Trophy, Settings, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Logo } from './logo'
import { cn } from '@/lib/utils'

const links = [
  { href: '/setter', label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard },
  { href: '/setter/cockpit', label: 'Cockpit', shortLabel: 'Cockpit', icon: Zap, highlight: true },
  { href: '/setter/leads', label: 'Meine Leads', shortLabel: 'Leads', icon: Users },
  { href: '/setter/wiedervorlage', label: 'Wiedervorlagen', shortLabel: 'Wiedervorl.', icon: Clock },
  { href: '/setter/termine', label: 'Meine Termine', shortLabel: 'Termine', icon: Calendar },
  { href: '/rangliste', label: 'Rangliste', shortLabel: 'Rangliste', icon: Trophy },
]

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/setter/profil')) return 'Mein Profil'
  if (pathname.startsWith('/setter/cockpit')) return 'Cockpit'
  const match = links.find(l => pathname === l.href || (l.href !== '/setter' && pathname.startsWith(l.href)))
  return match?.label || 'Dashboard'
}

export function SetterNav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  // Cockpit: Vollbild-Modus ohne Sidebar/Bottom-Nav
  if (pathname.startsWith('/setter/cockpit')) {
    return null
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (href: string) =>
    pathname === href || (href !== '/setter' && pathname.startsWith(href))

  return (
    <>
      {/* ============ Desktop sidebar ============ */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-64 bg-[#1E3A5F] text-white">
        <div className="p-5 border-b border-white/10">
          <Logo light />
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {links.map(({ href, label, icon: Icon, highlight }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive(href)
                  ? 'bg-white/20 text-white'
                  : highlight
                  ? 'text-yellow-300 hover:bg-white/10'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon className="w-5 h-5" />
              {label}
              {highlight && !isActive(href) && (
                <span className="ml-auto text-[10px] bg-yellow-400 text-black px-1.5 py-0.5 rounded font-bold">NEU</span>
              )}
            </Link>
          ))}
          <div className="pt-3 mt-3 border-t border-white/10">
            <Link
              href="/setter/profil"
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive('/setter/profil')
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              <Settings className="w-5 h-5" />
              Mein Profil
            </Link>
          </div>
        </nav>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-6 py-4 text-white/70 hover:text-white text-sm border-t border-white/10 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Abmelden
        </button>
      </aside>

      {/* ============ Mobile Top-Bar ============ */}
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
        <div className="flex items-center gap-1 shrink-0">
          <Link
            href="/setter/profil"
            className={cn(
              'p-2 rounded-lg',
              isActive('/setter/profil') ? 'bg-white/20 text-white' : 'text-white/70'
            )}
            aria-label="Mein Profil"
          >
            <Settings className="w-5 h-5" />
          </Link>
          <button
            onClick={logout}
            className="p-2 -mr-2 text-white/70 hover:text-white"
            aria-label="Abmelden"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ============ Mobile Bottom-Nav ============ */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-30"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-5 h-16">
          {/* Mobile zeigt: Home, Cockpit (highlight), Leads, Termine, Rangliste — Wiedervorlage über Leads erreichbar */}
          {[links[0], links[1], links[2], links[4], links[5]].map(({ href, shortLabel, icon: Icon, highlight }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 transition-colors active:bg-gray-100 relative',
                  active ? 'text-[#2E75B6]' : highlight ? 'text-yellow-600' : 'text-gray-500'
                )}
              >
                {highlight && !active && (
                  <span className="absolute top-1.5 right-3 w-2 h-2 bg-yellow-400 rounded-full"></span>
                )}
                <Icon className={cn('w-5 h-5', active && 'scale-110 transition-transform')} />
                <span className={cn(
                  'text-[10px] font-medium leading-none',
                  active && 'text-[#1E3A5F] font-semibold'
                )}>{shortLabel}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
