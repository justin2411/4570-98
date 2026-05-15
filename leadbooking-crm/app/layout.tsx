import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { SWRegister } from '@/components/sw-register'
import { InstallBanner } from '@/components/install-banner'

export const metadata: Metadata = {
  title: 'Hebammen-Vorsorge CRM',
  description: 'CRM und Cockpit für das Hebammen-Vorsorge Team',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'HV CRM',
  },
  icons: {
    icon: [
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
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
        <InstallBanner />
        <Toaster position="top-center" toastOptions={{ duration: 2500 }} />
      </body>
    </html>
  )
}
