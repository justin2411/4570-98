import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { generateIcs } from '@/lib/ics-generator'

/**
 * GET /api/ics/[leadId]
 *
 * Returns eine .ics-Datei für einen Termin, die der Closer in Outlook öffnen kann.
 * Public URL — kein Auth, da der Closer sonst nicht klicken könnte. UUIDs sind
 * nicht erratbar (10^36 Möglichkeiten), Privacy ist OK.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { leadId } = await params

  const supabase = createAdminClient()

  const { data: lead, error } = await supabase
    .from('leads')
    .select(`
      id, name, beruf, phone, email, notes, appointment_date, teams_link, closer_id, assigned_to,
      closers ( id, name, email, phone ),
      profiles!leads_assigned_to_fkey ( full_name, email, teams_room_url )
    `)
    .eq('id', leadId)
    .maybeSingle()

  if (error || !lead) {
    return new NextResponse('Termin nicht gefunden', { status: 404 })
  }

  if (!lead.appointment_date) {
    return new NextResponse('Termin hat noch kein Datum', { status: 400 })
  }

  if (!lead.closers) {
    return new NextResponse('Kein Closer zugewiesen', { status: 400 })
  }

  const closer = Array.isArray(lead.closers) ? lead.closers[0] : lead.closers
  const setter = Array.isArray(lead.profiles) ? lead.profiles[0] : lead.profiles
  const teamsLink = (lead as { teams_link?: string | null }).teams_link ?? setter?.teams_room_url ?? null

  const ics = generateIcs({
    leadId: lead.id,
    appointmentDate: new Date(lead.appointment_date),
    durationMinutes: 30,
    leadName: lead.name,
    leadBeruf: (lead as { beruf?: string | null }).beruf,
    leadPhone: lead.phone,
    leadEmail: lead.email,
    leadNotes: lead.notes,
    setterName: setter?.full_name ?? 'Setter',
    setterEmail: setter?.email ?? null,
    closerName: closer.name,
    closerEmail: closer.email,
    teamsLink,
  })

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="termin-${leadId}.ics"`,
      'Cache-Control': 'no-store',
    },
  })
}
