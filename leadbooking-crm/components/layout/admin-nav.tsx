'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Users, FileSpreadsheet, Trophy, LogOut, UserCog } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Logo } from './logo'
import { cn } from '@/lib/utils'

const links = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/leads', label: 'Leads', icon: FileSpreadsheet },
  { href: '/admin/setter', label: 'Setter', icon: UserCog },
  { href: '/admin/rangliste', label: 'Rangliste', icon: Trophy },
  { href: '/rangliste', label: 'Öffentl. Rangliste', icon: Users },
]

export function AdminNav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-64 bg-[#1E3A5F] text-white">
        <div className="p-5 border-b border-white/10">
          <Logo light />
          <span className="text-xs text-white/50 mt-1 block">Admin</span>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                pathname === href || (href !== '/admin' && pathname.startsWith(href))
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          ))}
        </nav>
        <button onClick={logout} className="flex items-center gap-3 px-6 py-4 text-white/70 hover:text-white text-sm border-t border-white/10">
          <LogOut className="w-5 h-5" />
          Abmelden
        </button>
      </aside>
      <header className="lg:hidden fixed top-0 inset-x-0 h-14 bg-[#1E3A5F] flex items-center justify-between px-4 z-30">
        <Logo light />
        <nav className="flex items-center gap-1">
          {links.map(({ href, icon: Icon }) => (
            <Link key={href} href={href} className={cn('p-2 rounded-lg', pathname === href ? 'bg-white/20' : 'text-white/70')}>
              <Icon className="w-5 h-5 text-white" />
            </Link>
          ))}
          <button onClick={logout} className="p-2 text-white/70 hover:text-white">
            <LogOut className="w-5 h-5" />
          </button>
        </nav>
      </header>
    </>
  )
}
