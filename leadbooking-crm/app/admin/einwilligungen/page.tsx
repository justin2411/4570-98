export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ConsentExportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let allLeads: Record<string, unknown>[] = []
  let from = 0
  while (true) {
    const { data: batch } = await supabase
      .from('leads')
      .select('name, phone, state, consent_given, consent_date, consent_text, profiles!leads_consent_setter_id_fkey(full_name)')
      .eq('consent_given', true)
      .range(from, from + 999)
    if (!batch || batch.length === 0) break
    allLeads = [...allLeads, ...batch]
    if (batch.length < 1000) break
    from += 1000
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[#1E3A5F]">Einwilligungsprotokoll</h1>
      <p className="text-gray-600">{allLeads.length} Leads mit Einwilligung</p>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Name','Telefon','Bundesland','Datum','Setter'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-700">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {allLeads.map((l: any, i: number) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-[#1E3A5F]">{l.name}</td>
                <td className="px-4 py-3 text-gray-700">{l.phone}</td>
                <td className="px-4 py-3 text-gray-700">{l.state}</td>
                <td className="px-4 py-3 text-gray-700 text-xs">{l.consent_date ? new Date(l.consent_date).toLocaleString('de-DE') : '–'}</td>
                <td className="px-4 py-3 text-gray-700">{(l.profiles as any)?.full_name ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {allLeads.length === 0 && <p className="text-center py-10 text-gray-400">Noch keine Einwilligungen</p>}
      </div>
    </div>
  )
}
