import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_placeholder', {
  apiVersion: '2026-04-22.dahlia' as const,
})

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

    // Stripe Session erstellen – Preis immer 10000 Cent (100€)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: 10000, // 100.00 EUR in Cent – serverseitig fixiert
            product_data: {
              name: `Beratungstermin: ${appointment.profession}`,
              description: `${appointment.type === 'planned' ? '🟡 Geplanter' : '🟢 Stattgefundener'} Termin in ${appointment.region}, ${appointment.state}`,
            },
          },
        },
      ],
      metadata: {
        appointmentId,
        buyerId: user.id,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/termin/${appointmentId}?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/termin/${appointmentId}?cancelled=true`,
    })

    // Payment in DB vormerken
    await supabase.from('payments').insert({
      appointment_id: appointmentId,
      buyer_id: user.id,
      amount: 100.00,
      method: 'stripe',
      external_id: session.id,
      status: 'pending',
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('Stripe session error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
