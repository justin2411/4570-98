'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Filter } from 'lucide-react'

interface MarktplatzFilterProps {
  professions: string[]
  states: string[]
  currentType?: string
  currentProfession?: string
  currentState?: string
  currentSort?: string
}

export function MarktplatzFilter({
  professions,
  states,
  currentType,
  currentProfession,
  currentState,
  currentSort,
}: MarktplatzFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      router.push(`/dashboard/marktplatz?${params.toString()}`)
    },
    [router, searchParams]
  )

  const clearAll = () => router.push('/dashboard/marktplatz')

  const hasFilters = currentType || currentProfession || currentState

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filter</span>
          {hasFilters && (
            <button
              onClick={clearAll}
              className="ml-auto text-xs text-[#2E75B6] hover:underline"
            >
              Filter zurücksetzen
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Termin-Typ</label>
            <select
              value={currentType ?? ''}
              onChange={(e) => updateFilter('type', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:border-[#2E75B6] focus:outline-none"
            >
              <option value="">Alle Typen</option>
              <option value="planned">🟡 Geplant</option>
              <option value="completed">🟢 Stattgefunden</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Berufsgruppe</label>
            <select
              value={currentProfession ?? ''}
              onChange={(e) => updateFilter('profession', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:border-[#2E75B6] focus:outline-none"
            >
              <option value="">Alle Berufe</option>
              {professions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Bundesland</label>
            <select
              value={currentState ?? ''}
              onChange={(e) => updateFilter('state', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:border-[#2E75B6] focus:outline-none"
            >
              <option value="">Alle Bundesländer</option>
              {states.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Sortierung</label>
            <select
              value={currentSort ?? ''}
              onChange={(e) => updateFilter('sort', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:border-[#2E75B6] focus:outline-none"
            >
              <option value="">Neueste zuerst</option>
              <option value="oldest">Älteste zuerst</option>
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
