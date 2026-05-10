'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CreditCard, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'

interface BuyButtonProps {
  appointmentId: string
  userId?: string
}

export function BuyButton({ appointmentId }: BuyButtonProps) {
  const [loading, setLoading] = useState<'stripe' | 'paypal' | null>(null)

  async function handleStripe() {
    setLoading('stripe')
    try {
      const res = await fetch('/api/payments/stripe/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error('Fehler beim Erstellen der Zahlungssitzung.')
      }
    } catch {
      toast.error('Verbindungsfehler. Bitte versuchen Sie es erneut.')
    }
    setLoading(null)
  }

  async function handlePayPal() {
    setLoading('paypal')
    try {
      const res = await fetch('/api/payments/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId }),
      })
      const data = await res.json()
      if (data.approveUrl) {
        window.location.href = data.approveUrl
      } else {
        toast.error('Fehler beim Erstellen der PayPal-Zahlung.')
      }
    } catch {
      toast.error('Verbindungsfehler. Bitte versuchen Sie es erneut.')
    }
    setLoading(null)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-gray-700">Zahlungsmethode wählen:</p>

      <Button
        onClick={handleStripe}
        loading={loading === 'stripe'}
        disabled={loading !== null}
        className="w-full"
        size="lg"
      >
        <CreditCard className="w-5 h-5" />
        Mit Kreditkarte zahlen – 100 €
      </Button>

      <Button
        onClick={handlePayPal}
        loading={loading === 'paypal'}
        disabled={loading !== null}
        variant="secondary"
        className="w-full"
        size="lg"
      >
        <Wallet className="w-5 h-5" />
        Mit PayPal zahlen – 100 €
      </Button>

      <p className="text-xs text-center text-gray-400">
        Alle Zahlungen sind verschlüsselt und sicher.
        Nach erfolgreicher Zahlung erhalten Sie sofort die Kontaktdaten.
      </p>
    </div>
  )
}
