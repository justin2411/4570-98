import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

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

  const rows = allLeads.map((l: any) => [
    l.name, l.phone, l.state,
    l.consent_date ? new Date(l.consent_date).toLocaleString('de-DE') : '',
    l.profiles?.full_name ?? '',
    l.consent_text ?? ''
  ])

  const csv = [
    ['Name','Telefon','Bundesland','Datum','Setter','Text'],
    ...rows
  ].map(r => r.map((v: any) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="einwilligungen.csv"',
    },
  })
}
