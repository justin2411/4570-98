'use client'

import { useState } from 'react'
import { Lead, LeadStatus, STATUS_CONFIG } from '@/types'
import { StatusBadge } from '@/components/leads/status-badge'
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
  const [activeTab, setActiveTab] = useState<string>('unassigned')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'alle'>('alle')

  const unassigned = leads.filter(l => !l.assigned_to)
  const adminLeads = leads.filter(l => l.assigned_to === adminId)
  const tabs = [
    { id: 'unassigned', label: 'Nicht zugeteilt', count: unassigned.length },
    { id: adminId, label: 'Admin (meine)', count: adminLeads.length },
    ...setters.map(s => ({ id: s.id, label: s.full_name, count: leads.filter(l => l.assigned_to === s.id).length })),
  ]

  const tabLeads = activeTab === 'unassigned' ? unassigned : leads.filter(l => l.assigned_to === activeTab)
  const filtered = statusFilter === 'alle' ? tabLeads : tabLeads.filter(l => l.status === statusFilter)

  function selectAllInTab() { setSelected(new Set(tabLeads.map(l => l.id))) }
  function toggleSelect(id: string) {
    setSelected(prev => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">Leads verwalten</h1>
          <p className="text-gray-700 text-sm mt-1">{leads.length} Leads gesamt</p>
        </div>
        <div className="flex gap-2">
          <button onClick={selectAllInTab} className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 hover:bg-gray-50">Alle in Tab ({tabLeads.length})</button>
          {selected.size > 0 && (
            <Button variant="secondary" onClick={() => setAssignTarget(Array.from(selected))}>
              {selected.size} zuweisen
            </Button>
          )}
          <Button onClick={() => setShowUpload(true)}><Upload className="w-4 h-4" />Excel hochladen</Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); setSelected(new Set()); setStatusFilter('alle') }}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === t.id ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'}`}>
            {t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === t.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}>{t.count}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 p-4 bg-white rounded-xl border border-gray-200">
        <button onClick={() => setStatusFilter('alle')} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${statusFilter === 'alle' ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'}`}>
          Alle ({tabLeads.length})
        </button>
        {(Object.keys(STATUS_CONFIG) as LeadStatus[]).map(s => {
          const count = tabLeads.filter(l => l.status === s).length
          if (count === 0) return null
          return (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${statusFilter === s ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'}`}>
              {STATUS_CONFIG[s].label} ({count})
            </button>
          )
        })}
      </div>

      <div className="space-y-2">
        {filtered.map(lead => (
          <div key={lead.id} className="bg-white border border-gray-200 rounded-2xl px-5 py-4 hover:border-[#2E75B6] hover:shadow-sm transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 mb-1">
                <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleSelect(lead.id)} className="mr-1" />
                <span className="font-bold text-gray-900 text-[15px]">{lead.name}</span>
                
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={lead.status} />
                <button onClick={() => setAssignTarget([lead.id])} className="text-xs text-[#2E75B6] hover:underline font-medium">Zuweisen</button>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm mt-1 ml-6">
              <span className="font-semibold text-gray-900">+{lead.phone.replace(/^\+/, '')}</span>
              {lead.email && <span className="text-gray-500 text-xs truncate">{lead.email}</span>}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 ml-6">
              {lead.age_indicator && <span>{lead.age_indicator.replace(/[^a-zA-ZäöüÄÖÜß0-9 .,()-]/g, '').trim()}</span>}
              {lead.state && <span>· {lead.state}</span>}
              {lead.lead_quality && <span>· {lead.lead_quality}</span>}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center py-10 text-gray-700">Keine Leads</p>}
      </div>

      {showUpload && <ExcelUpload adminId={adminId} setters={setters} onClose={() => setShowUpload(false)} onImported={newLeads => { setLeads(prev => [...newLeads, ...prev]); setShowUpload(false) }} />}
      {assignTarget.length > 0 && <AssignModal leadIds={assignTarget} allLeads={leads} setters={setters} adminId={adminId} adminName="Admin" onClose={() => setAssignTarget([])} onAssigned={(leadIds, setterId) => { setLeads(prev => prev.map(l => leadIds.includes(l.id) ? { ...l, assigned_to: setterId } : l)); setAssignTarget([]); setSelected(new Set()) }} />}
    </div>
  )
}
