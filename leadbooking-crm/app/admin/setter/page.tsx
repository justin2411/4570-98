export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SetterManagement } from './setter-management'

export default async function AdminSetterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: setters } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'setter')
    .order('full_name')

  return <SetterManagement initialSetters={setters ?? []} />
}
