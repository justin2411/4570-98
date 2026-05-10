import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { MapPin, Calendar, Tag, Clock, User, Phone, Mail, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { AppointmentTypeBadge, StatusBadge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { formatDate, formatDateTime } from '@/lib/utils'
import { BuyButton } from './buy-button'
import { NoShowButton } from './no-show-button'

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params

  const { data: appointment } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', id)
    .single()

  if (!appointment) notFound()

  const isBuyer = appointment.buyer_id === user.id
  const isAvailable = appointment.status === 'available'
  const canBuy = isAvailable && !isBuyer

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/marktplatz"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#1E3A5F]"
        >
          <ArrowLeft className="w-4 h-4" /> Zurück zum Marktplatz
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AppointmentTypeBadge type={appointment.type} />
                <StatusBadge status={appointment.status} />
              </div>
              <h1 className="text-2xl font-bold text-[#1E3A5F]">{appointment.profession}</h1>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-[#1E3A5F]">100 €</div>
              <p className="text-xs text-gray-500 mt-1">inkl. MwSt.</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Standort</p>
                <p className="font-medium text-gray-900">{appointment.region}</p>
                <p className="text-sm text-gray-600">{appointment.state}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Tag className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Thema</p>
                <p className="font-medium text-gray-900">{appointment.topic}</p>
              </div>
            </div>
            {appointment.type === 'planned' && appointment.appointment_date && (
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Terminvorschlag</p>
                  <p className="font-medium text-gray-900">
                    {formatDateTime(appointment.appointment_date)}
                  </p>
                </div>
              </div>
            )}
            {appointment.type === 'completed' && appointment.completed_date && (
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Gespräch am</p>
                  <p className="font-medium text-gray-900">
                    {formatDate(appointment.completed_date)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {appointment.type === 'completed' && appointment.summary && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
              <p className="text-sm font-semibold text-green-800 mb-2">
                Gesprächszusammenfassung
              </p>
              <p className="text-sm text-gray-700">{appointment.summary}</p>
            </div>
          )}

          {/* Kontaktdaten – nur nach Kauf */}
          {isBuyer ? (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-sm font-semibold text-blue-800 mb-3">
                Kontaktdaten (freigeschaltet)
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <User className="w-4 h-4 text-blue-500" />
                  <span className="font-medium">{appointment.contact_name}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-blue-500" />
                  <a href={`tel:${appointment.contact_phone}`} className="text-[#2E75B6] hover:underline">
                    {appointment.contact_phone}
                  </a>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-blue-500" />
                  <a href={`mailto:${appointment.contact_email}`} className="text-[#2E75B6] hover:underline">
                    {appointment.contact_email}
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">Kontaktdaten</p>
                  <p className="text-xs text-gray-500">Nach dem Kauf erhalten Sie Name, Telefon und E-Mail.</p>
                </div>
                <div className="flex flex-col gap-1 text-xs text-gray-400 font-mono">
                  <span>████████████</span>
                  <span>+49 ███ ███████</span>
                  <span>████@████████</span>
                </div>
              </div>
            </div>
          )}

          {/* Kauf-Bereich */}
          {canBuy && (
            <BuyButton appointmentId={appointment.id} userId={user.id} />
          )}

          {isBuyer && appointment.type === 'planned' && appointment.status !== 'no_show' && (
            <NoShowButton appointmentId={appointment.id} />
          )}

          {isBuyer && (
            <p className="text-xs text-center text-gray-400">
              Dieser Termin wurde von Ihnen gekauft.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
