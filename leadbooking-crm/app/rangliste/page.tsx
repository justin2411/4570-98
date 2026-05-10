export const dynamic = 'force-dynamic'
import { Logo } from '@/components/layout/logo'
import { LeaderboardTable } from '@/components/leaderboard/table'
import { Trophy } from 'lucide-react'

export default function PublicRanglistePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E3A5F] to-[#2E75B6]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <Logo light className="justify-center mb-3" />
          <div className="flex items-center justify-center gap-2 text-white">
            <Trophy className="w-6 h-6 text-yellow-400" />
            <h1 className="text-3xl font-bold">Setter Rangliste</h1>
            <Trophy className="w-6 h-6 text-yellow-400" />
          </div>
          <p className="text-white/70 mt-2">Live-Aktualisierung via Supabase Realtime</p>
        </div>
        <LeaderboardTable />
      </div>
    </div>
  )
}
