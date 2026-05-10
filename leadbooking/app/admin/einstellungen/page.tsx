import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default async function AdminEinstellungenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Admin-Einstellungen</h1>
      </div>
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Admin-Profil</h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Name</span>
              <span className="font-medium">{profile?.full_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">E-Mail</span>
              <span className="font-medium">{profile?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Rolle</span>
              <span className="font-medium text-red-600">Administrator</span>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">System-Konfiguration</h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Termin-Preis (fest)</span>
              <span className="font-bold text-[#1E3A5F] text-lg">100,00 €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Zahlungsmethoden</span>
              <span className="font-medium">Stripe, PayPal</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Push-Notifications</span>
              <span className="font-medium text-green-600">Aktiv (VAPID)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
