import Link from 'next/link'
import { MapPin, Calendar, Tag, ArrowRight, Clock } from 'lucide-react'
import { Appointment } from '@/types'
import { AppointmentTypeBadge, StatusBadge } from '@/components/ui/badge'
import { formatDate, formatDateTime } from '@/lib/utils'
import { Card, CardContent, CardFooter } from '@/components/ui/card'

interface AppointmentCardProps {
  appointment: Appointment
  showBuyButton?: boolean
}

export function AppointmentCard({ appointment, showBuyButton = true }: AppointmentCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <AppointmentTypeBadge type={appointment.type} />
            {!showBuyButton && <StatusBadge status={appointment.status} />}
          </div>
          <div className="text-xl font-bold text-[#1E3A5F] whitespace-nowrap">100 €</div>
        </div>

        <h3 className="font-semibold text-gray-900 text-lg mb-3">{appointment.profession}</h3>

        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span>{appointment.region}, {appointment.state}</span>
          </div>
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span>{appointment.topic}</span>
          </div>
          {appointment.type === 'planned' && appointment.appointment_date && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span>Termin: {formatDateTime(appointment.appointment_date)}</span>
            </div>
          )}
          {appointment.type === 'completed' && appointment.completed_date && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span>Gespräch am: {formatDate(appointment.completed_date)}</span>
            </div>
          )}
        </div>

        {appointment.type === 'completed' && appointment.summary && (
          <div className="mt-3 p-3 bg-green-50 rounded-lg text-sm text-gray-700 border border-green-100">
            <p className="font-medium text-green-800 mb-1 text-xs">Gesprächszusammenfassung:</p>
            <p className="line-clamp-2">{appointment.summary}</p>
          </div>
        )}

        {/* Kontaktdaten nur nach Kauf */}
        {appointment.contact_name && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-xs font-medium text-blue-800 mb-2">Kontaktdaten (nach Kauf):</p>
            <div className="space-y-1 text-sm text-gray-700">
              <p><span className="font-medium">Name:</span> {appointment.contact_name}</p>
              <p><span className="font-medium">Tel:</span> {appointment.contact_phone}</p>
              <p><span className="font-medium">E-Mail:</span> {appointment.contact_email}</p>
            </div>
          </div>
        )}
      </CardContent>

      {showBuyButton && appointment.status === 'available' && (
        <CardFooter>
          <Link
            href={`/dashboard/termin/${appointment.id}`}
            className="flex items-center justify-between w-full group"
          >
            <span className="text-sm text-gray-500">Details ansehen</span>
            <span className="flex items-center gap-1 text-[#2E75B6] font-medium text-sm group-hover:gap-2 transition-all">
              Kaufen für 100 € <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </CardFooter>
      )}
    </Card>
  )
}
