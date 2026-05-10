export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatDateTime } from '@/lib/utils'
import { StatusBadge } from '@/components/leads/status-badge'
import { ScoreBadge } from '@/components/leads/score-badge'

export default async function SetterTerminePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('assigned_to', user.id)
    .in('status', ['termin_gelegt', 'termin_stattgefunden'])
    .order('appointment_date', { ascending: true })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Meine Termine</h1>
        <p className="text-gray-500 text-sm mt-1">{leads?.length ?? 0} Termine</p>
      </div>
      <div className="space-y-2">
        {leads?.map(lead => (
          <div key={lead.id} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#1E3A5F]">{lead.name}</span>
                  <ScoreBadge score={lead.score} />
                </div>
                <p className="text-sm text-gray-500 mt-1">📅 {formatDateTime(lead.appointment_date)}</p>
                <p className="text-sm text-gray-500">📞 {lead.phone} · {lead.state}</p>
                {lead.notes && <p className="text-sm text-gray-400 mt-1 italic">&ldquo;{lead.notes}&rdquo;</p>}
              </div>
              <StatusBadge status={lead.status} />
            </div>
          </div>
        ))}
        {(!leads || leads.length === 0) && (
          <p className="text-center text-gray-400 py-12">Noch keine Termine</p>
        )}
      </div>
    </div>
  )
}
