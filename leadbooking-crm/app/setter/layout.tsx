export const dynamic = 'force-dynamic'

import { SetterNav } from '@/components/layout/setter-nav'
import { NotificationsProvider } from '@/components/notifications-provider'
import { SetterMain } from './setter-main'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function SetterLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <SetterNav />
      <SetterMain>{children}</SetterMain>
      <NotificationsProvider userId={user.id} />
    </div>
  )
}
