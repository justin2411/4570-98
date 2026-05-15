'use client'

import { usePathname } from 'next/navigation'

export function SetterMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isCockpit = pathname.startsWith('/setter/cockpit')

  // Cockpit: Vollbild ohne Wrapper, ohne Padding
  if (isCockpit) {
    return <>{children}</>
  }

  // Normal: mit Sidebar-Offset, Mobile-Header-Padding, Bottom-Nav-Padding
  return (
    <main className="lg:ml-64 pt-14 lg:pt-0 pb-20 lg:pb-6">
      <div className="p-4 lg:p-6 max-w-7xl mx-auto">
        {children}
      </div>
    </main>
  )
}
