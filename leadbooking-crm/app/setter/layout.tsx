export const dynamic = 'force-dynamic'
import { SetterNav } from '@/components/layout/setter-nav'

export default function SetterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <SetterNav />
      <main className="lg:ml-64 pt-14 lg:pt-0">
        <div className="p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
