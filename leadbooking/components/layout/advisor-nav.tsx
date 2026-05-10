'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, ShoppingBag, Calendar, Settings, LogOut, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from './logo'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import toast from 'react-hot-toast'

const navItems = [
  { href: '/dashboard', label: 'Übersicht', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/marktplatz', label: 'Marktplatz', icon: ShoppingBag },
  { href: '/dashboard/meine-termine', label: 'Meine Termine', icon: Calendar },
  { href: '/dashboard/einstellungen', label: 'Einstellungen', icon: Settings },
]

export function AdvisorNav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('Abgemeldet')
    router.push('/login')
    router.refresh()
  }

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 min-h-screen bg-[#1E3A5F] text-white fixed left-0 top-0 bottom-0 z-30">
        <div className="p-6 border-b border-white/10">
          <Logo light />
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map(({ href, label, icon: Icon, exact }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive(href, exact)
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors w-full"
          >
            <LogOut className="w-5 h-5" />
            Abmelden
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-[#1E3A5F] text-white px-4 py-3 flex items-center justify-between">
        <Logo light />
        <button onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-20 bg-[#1E3A5F] text-white pt-16">
          <nav className="px-4 py-6 space-y-1">
            {navItems.map(({ href, label, icon: Icon, exact }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium',
                  isActive(href, exact)
                    ? 'bg-white/20 text-white'
                    : 'text-white/70'
                )}
              >
                <Icon className="w-5 h-5" />
                {label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-white/70 w-full"
            >
              <LogOut className="w-5 h-5" />
              Abmelden
            </button>
          </nav>
        </div>
      )}
    </>
  )
}
