import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { EinstellungenForm } from './form'
import { PushNotificationToggle } from './push-toggle'

export default async function EinstellungenPage() {
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
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Einstellungen</h1>
        <p className="text-gray-500 mt-1">Verwalten Sie Ihr Profil und Benachrichtigungen.</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Profil</h2>
        </CardHeader>
        <CardContent>
          <EinstellungenForm profile={profile} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Push-Benachrichtigungen</h2>
          <p className="text-sm text-gray-500">
            Werden Sie sofort informiert, wenn neue Termine verfügbar sind.
          </p>
        </CardHeader>
        <CardContent>
          <PushNotificationToggle userId={user.id} />
        </CardContent>
      </Card>
    </div>
  )
}
