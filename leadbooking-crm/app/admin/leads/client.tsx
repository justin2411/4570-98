'use client'

import { useState } from 'react'
import { Lead, LeadStatus, STATUS_CONFIG } from '@/types'
import { StatusBadge } from '@/components/leads/status-badge'
import { ScoreBadge } from '@/components/leads/score-badge'
import { ExcelUpload } from './excel-upload'
import { AssignModal } from './assign-modal'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'

interface Setter { id: string; full_name: string; avatar_color: string }
interface Props { initialLeads: Lead[]; setters: Setter[]; adminId: string }

export function AdminLeadsClient({ initialLeads, setters, adminId }: Props) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [showUpload, setShowUpload] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [assignTarget, setAssignTarget] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'alle'>('alle')
  const [setterFilter, setSetterFilter] = useState<string>('alle')

  const filtered = leads.filter(l => {
    if (statusFilter !== 'alle' && l.status !== statusFilter) return false
    if (setterFilter !== 'alle' && l.assigned_to !== setterFilter) return false
    return true
  })

  function toggleSelect(id: string) {
    setSelected(prev => { const s = new Set(prev); if (s.has(id)) { s.delete(id) } else { s.add(id) }; return s })
  }
  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(l => l.id)))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">Leads verwalten</h1>
          <p className="text-gray-500 text-sm mt-1">{leads.length} Leads gesamt</p>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <Button variant="secondary" onClick={() => setAssignTarget(Array.from(selected))}>
              {selected.size} zuweisen
            </Button>
          )}
          <Button onClick={() => setShowUpload(true)}><Upload className="w-4 h-4" />Excel hochladen</Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-3 p-4 bg-white rounded-xl border border-gray-200">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as LeadStatus | 'alle')} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
          <option value="alle">Alle Status</option>
          {(Object.keys(STATUS_CONFIG) as LeadStatus[]).map(s => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>
        <select value={setterFilter} onChange={e => setSetterFilter(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
          <option value="alle">Alle Setter</option>
          <option value="unassigned">Nicht zugewiesen</option>
          {setters.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left"><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} /></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 hidden md:table-cell">Telefon</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 hidden lg:table-cell">Bundesland</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Score</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 hidden lg:table-cell">Setter</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(lead => {
              const setter = setters.find(s => s.id === lead.assigned_to)
              return (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleSelect(lead.id)} /></td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#1E3A5F]">{lead.name}</div>
                    <div className="text-xs text-gray-400">{lead.lead_quality}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{lead.phone}</td>
                  <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{lead.state}</td>
                  <td className="px-4 py-3"><ScoreBadge score={lead.score} /></td>
                  <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {setter ? <span className="text-sm text-gray-700">{setter.full_name}</span> : <span className="text-xs text-gray-400">–</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setAssignTarget([lead.id])} className="text-xs text-[#2E75B6] hover:underline">Zuweisen</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center py-10 text-gray-400">Keine Leads</p>}
      </div>

      {showUpload && <ExcelUpload adminId={adminId} setters={setters} onClose={() => setShowUpload(false)} onImported={newLeads => { setLeads(prev => [...newLeads, ...prev]); setShowUpload(false) }} />}
      {assignTarget.length > 0 && <AssignModal leadIds={assignTarget} setters={setters} onClose={() => setAssignTarget([])} onAssigned={(leadIds, setterId) => { setLeads(prev => prev.map(l => leadIds.includes(l.id) ? { ...l, assigned_to: setterId } : l)); setAssignTarget([]); setSelected(new Set()) }} />}
    </div>
  )
}
