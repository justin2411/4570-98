import { checkAdminAuth } from '@/lib/admin-auth'
import { getModelSnapshot, refreshLeadProbabilityModel } from '@/lib/lead-probability'
import { NextResponse } from 'next/server'

/**
 * GET  /api/admin/lead-probability       → aktuelles Modell-Snapshot
 * POST /api/admin/lead-probability       → erzwingt Neutraining (Cache leeren)
 *
 * Liefert pro Feature die geglätteten Conversion-Raten + log-Uplift.
 * Damit kann man jederzeit nachvollziehen, welche Lead-Merkmale gerade
 * als positiv/negativ gelten und wie sicher das Modell ist.
 */
export async function GET(req: Request) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })
  const model = await getModelSnapshot()
  return NextResponse.json(serialize(model))
}

export async function POST(req: Request) {
  const auth = await checkAdminAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })
  const model = await refreshLeadProbabilityModel()
  return NextResponse.json({ ok: true, retrained: true, ...serialize(model) })
}

function serialize(m: Awaited<ReturnType<typeof getModelSnapshot>>) {
  const features: Record<string, Array<{ value: string; positives: number; negatives: number; rate: number; uplift: number }>> = {}
  for (const [k, byValue] of Object.entries(m.features)) {
    features[k] = Object.values(byValue)
      .sort((a, b) => b.uplift - a.uplift)
      .map(v => ({
        value: v.value,
        positives: v.positives,
        negatives: v.negatives,
        rate: round(v.rate, 4),
        uplift: round(v.uplift, 4),
      }))
  }
  return {
    trainedAt: new Date(m.trainedAt).toISOString(),
    fallback: m.fallback,
    fallbackReason: m.fallbackReason,
    totalLabeled: m.totalLabeled,
    totalPositives: m.totalPositives,
    totalNegatives: m.totalNegatives,
    baselineRate: round(m.baselineRate, 4),
    features,
  }
}

function round(n: number, d: number) { const f = 10 ** d; return Math.round(n * f) / f }
