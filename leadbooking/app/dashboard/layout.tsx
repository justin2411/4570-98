export const dynamic = 'force-dynamic'
import { AdvisorNav } from '@/components/layout/advisor-nav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdvisorNav />
      <main className="lg:ml-64 pt-16 lg:pt-0">
        <div className="p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
