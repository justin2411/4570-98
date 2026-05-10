import type { Metadata } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/ui/toast'

export const metadata: Metadata = {
  title: 'Leadbooking – Qualifizierte Beratungstermine',
  description: 'Der Marktplatz für Finanzberater – qualifizierte Beratungstermine mit Heilberuflern kaufen.',
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <body>
        <ToastProvider />
        {children}
      </body>
    </html>
  )
}
