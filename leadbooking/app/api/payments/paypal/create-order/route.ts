import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getPayPalAccessToken(): Promise<string> {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  const data = await res.json()
  return data.access_token
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    }

    const { appointmentId } = await req.json()

    // Termin validieren
    const { data: appointment } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .eq('status', 'available')
      .single()

    if (!appointment) {
      return NextResponse.json({ error: 'Termin nicht verfügbar' }, { status: 404 })
    }

    const accessToken = await getPayPalAccessToken()

    // PayPal Order erstellen – Betrag immer 100.00 EUR serverseitig fixiert
    const res = await fetch('https://api-m.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'EUR',
              value: '100.00',
            },
            description: `Beratungstermin: ${appointment.profession} in ${appointment.region}`,
            custom_id: JSON.stringify({ appointmentId, buyerId: user.id }),
          },
        ],
        application_context: {
          return_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/paypal/capture?appointmentId=${appointmentId}`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/termin/${appointmentId}?cancelled=true`,
        },
      }),
    })

    const order = await res.json()

    // Payment vormerken
    await supabase.from('payments').insert({
      appointment_id: appointmentId,
      buyer_id: user.id,
      amount: 100.00,
      method: 'paypal',
      external_id: order.id,
      status: 'pending',
    })

    const approveUrl = order.links?.find((l: any) => l.rel === 'approve')?.href
    return NextResponse.json({ approveUrl, orderId: order.id })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
