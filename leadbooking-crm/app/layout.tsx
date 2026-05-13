import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { SWRegister } from '@/components/sw-register'

export const metadata: Metadata = {
  title: 'Leadbooking CRM',
  description: 'CRM für Hebammen-Beratung',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'LBCRM',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/favicon.ico',
  },
}

export const viewport: Viewport = {
  themeColor: '#1E3A5F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <SWRegister />
        {children}
        <Toaster position="top-center" toastOptions={{ duration: 2500 }} />
      </body>
    </html>
  )
}
