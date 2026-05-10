import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { Users } from 'lucide-react'
import { UserActionsCell } from './actions'

export default async function AdminNutzerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  const roleLabels: Record<string, string> = {
    admin: 'Admin',
    setter: 'Setter',
    advisor: 'Finanzberater',
  }

  const roleColors: Record<string, string> = {
    admin: 'bg-red-100 text-red-700',
    setter: 'bg-purple-100 text-purple-700',
    advisor: 'bg-blue-100 text-blue-700',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Nutzerverwaltung</h1>
        <p className="text-gray-500 mt-1">{profiles?.length ?? 0} Nutzer registriert</p>
      </div>

      {profiles && profiles.length > 0 ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">E-Mail</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rolle</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Registriert</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{p.full_name}</td>
                    <td className="px-6 py-4 text-gray-600">{p.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[p.role]}`}>
                        {roleLabels[p.role]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {p.is_active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{formatDate(p.created_at)}</td>
                    <td className="px-6 py-4">
                      <UserActionsCell
                        userId={p.id}
                        isActive={p.is_active}
                        role={p.role}
                        currentAdminId={user.id}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState icon={Users} title="Keine Nutzer gefunden" />
      )}
    </div>
  )
}
