export const dynamic = 'force-dynamic'
import { SetterNav } from '@/components/layout/setter-nav'
import { NotificationsProvider } from '@/components/notifications-provider'
import { createClient } from '@/lib/supabase/server'

export default async function SetterLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-gray-50">
      <SetterNav />
      {user && <NotificationsProvider userId={user.id} />}
      <main
        className={[
          // Desktop: sidebar links, kein top/bottom padding
          'lg:ml-64 lg:!pt-0 lg:!pb-0',
          // Mobile: Platz für fixed top bar (56px + safe-area-inset-top)
          'pt-[calc(3.5rem+env(safe-area-inset-top))]',
          // Mobile: Platz für fixed bottom nav (64px + safe-area-inset-bottom)
          'pb-[calc(4rem+env(safe-area-inset-bottom))]',
        ].join(' ')}
      >
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
