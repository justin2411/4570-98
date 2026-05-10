import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  const appointmentId = searchParams.get('appointmentId')

  if (!token || !appointmentId) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  try {
    const supabaseAdmin = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const accessToken = await getPayPalAccessToken()

    const res = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${token}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    const capture = await res.json()

    if (capture.status === 'COMPLETED') {
      const { data: payment } = await supabaseAdmin
        .from('payments')
        .select('buyer_id')
        .eq('external_id', token)
        .single()

      if (payment) {
        await supabaseAdmin
          .from('appointments')
          .update({ status: 'sold', buyer_id: payment.buyer_id })
          .eq('id', appointmentId)
          .eq('status', 'available')

        await supabaseAdmin
          .from('payments')
          .update({ status: 'completed' })
          .eq('external_id', token)

        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/push/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-key': process.env.SUPABASE_SERVICE_ROLE_KEY!,
          },
          body: JSON.stringify({
            userId: payment.buyer_id,
            title: 'Kauf erfolgreich!',
            body: 'Ihre Kontaktdaten sind jetzt verfügbar.',
            url: `/dashboard/termin/${appointmentId}`,
          }),
        })
      }

      return NextResponse.redirect(
        new URL(`/dashboard/termin/${appointmentId}?success=true`, req.url)
      )
    }
  } catch (error) {
    console.error('PayPal capture error:', error)
  }

  return NextResponse.redirect(
    new URL(`/dashboard/termin/${appointmentId}?error=payment`, req.url)
  )
}
