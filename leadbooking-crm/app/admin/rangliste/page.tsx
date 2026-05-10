export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LeaderboardTable } from '@/components/leaderboard/table'

export default async function AdminRanglistePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[#1E3A5F]">Rangliste konfigurieren</h1>
      <LeaderboardTable />
    </div>
  )
}
