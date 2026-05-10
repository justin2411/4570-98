'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { X, Upload, AlertTriangle, CheckCircle } from 'lucide-react'
import { Lead } from '@/types'
import toast from 'react-hot-toast'

interface RawRow {
  Name?: string; Telefon?: string | number; 'E-Mail'?: string;
  Bundesland?: string; Gesamt?: number | string; Lead?: string;
  Alter?: string; Signale?: string
}

interface ParsedLead {
  name: string; phone: string; email: string; state: string; score: number;
  lead_quality: string; age_indicator: string; signals: string; isDuplicate?: boolean
}

interface Setter { id: string; full_name: string }

interface Props {
  adminId: string
  setters: Setter[]
  onClose: () => void
  onImported: (leads: Lead[]) => void
}

export function ExcelUpload({ adminId, setters, onClose, onImported }: Props) {
  const supabase = createClient()
  const [step, setStep] = useState<'upload' | 'preview' | 'assign'>('upload')
  const [parsed, setParsed] = useState<ParsedLead[]>([])
  const [loading, setLoading] = useState(false)
  const [assignMode, setAssignMode] = useState<'auto' | 'setter'>('auto')
  const [selectedSetter, setSelectedSetter] = useState('')
  const [_importedLeads, setImportedLeads] = useState<Lead[]>([])

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    const ab = await file.arrayBuffer()
    const wb = XLSX.read(ab)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows: RawRow[] = XLSX.utils.sheet_to_json(ws)

    const { data: existing } = await supabase.from('leads').select('phone')
    const existingPhones = new Set((existing ?? []).map(r => String(r.phone)))

    const leads: ParsedLead[] = rows.filter(r => r.Name && r.Telefon).map(r => {
      const phone = String(r.Telefon ?? '').trim()
      return {
        name: String(r.Name ?? '').trim(),
        phone,
        email: String(r['E-Mail'] ?? '').trim(),
        state: String(r.Bundesland ?? '').trim(),
        score: parseFloat(String(r.Gesamt ?? '0')),
        lead_quality: String(r.Lead ?? '').trim(),
        age_indicator: String(r.Alter ?? '').trim(),
        signals: String(r.Signale ?? '').trim(),
        isDuplicate: existingPhones.has(phone),
      }
    })
    setParsed(leads)
    setStep('preview')
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/vnd.ms-excel': ['.xls'] }, maxFiles: 1 })

  async function handleImport() {
    setLoading(true)
    const newLeads = parsed.filter(l => !l.isDuplicate)
    if (newLeads.length === 0) { toast.error('Keine neuen Leads zum Importieren.'); setLoading(false); return }

    let assigned_to: string | null = null
    if (assignMode === 'setter' && selectedSetter) assigned_to = selectedSetter

    const toInsert = newLeads.map(l => ({
      ...l, status: 'neu', uploaded_by: adminId,
      assigned_to: assignMode === 'auto' ? null : assigned_to,
    }))

    const { data, error } = await supabase.from('leads').insert(toInsert).select()
    if (error) { toast.error('Import fehlgeschlagen: ' + error.message); setLoading(false); return }

    if (assignMode === 'auto' && setters.length > 0 && data) {
      for (let i = 0; i < data.length; i++) {
        const setter = setters[i % setters.length]
        await supabase.from('leads').update({ assigned_to: setter.id }).eq('id', data[i].id)
      }
      const { data: updated } = await supabase.from('leads').select('*').in('id', data.map(d => d.id))
      setImportedLeads(updated ?? [])
    } else {
      setImportedLeads(data ?? [])
    }

    toast.success(`${newLeads.length} Leads importiert!`)
    setLoading(false)
    onImported(data ?? [])
  }

  const newCount = parsed.filter(l => !l.isDuplicate).length
  const dupCount = parsed.filter(l => l.isDuplicate).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-bold text-lg text-[#1E3A5F]">Excel hochladen</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === 'upload' && (
            <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${isDragActive ? 'border-[#2E75B6] bg-blue-50' : 'border-gray-300 hover:border-[#2E75B6]'}`}>
              <input {...getInputProps()} />
              <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="font-medium text-gray-700">Excel-Datei hier ablegen</p>
              <p className="text-sm text-gray-500 mt-1">oder klicken zum Auswählen (.xlsx, .xls)</p>
              <div className="mt-4 text-xs text-gray-400 space-y-1">
                <p>Erwartete Spalten: Name, Telefon, E-Mail, Bundesland, Gesamt, Lead, Alter, Signale</p>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-green-600 text-sm"><CheckCircle className="w-4 h-4" />{newCount} neue Leads</div>
                {dupCount > 0 && <div className="flex items-center gap-2 text-orange-600 text-sm"><AlertTriangle className="w-4 h-4" />{dupCount} Duplikate (übersprungen)</div>}
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Name', 'Telefon', 'Bundesland', 'Score', 'Lead', 'Status'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsed.slice(0, 10).map((l, i) => (
                      <tr key={i} className={l.isDuplicate ? 'bg-orange-50 opacity-60' : ''}>
                        <td className="px-3 py-2">{l.name}</td>
                        <td className="px-3 py-2">{l.phone}</td>
                        <td className="px-3 py-2">{l.state}</td>
                        <td className="px-3 py-2">{l.score}</td>
                        <td className="px-3 py-2">{l.lead_quality}</td>
                        <td className="px-3 py-2">{l.isDuplicate ? '⚠️ Duplikat' : '✅ Neu'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.length > 10 && <p className="text-center text-xs text-gray-400 py-2">... und {parsed.length - 10} weitere</p>}
              </div>

              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                <p className="font-semibold text-sm">Setter zuweisen:</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={assignMode === 'auto'} onChange={() => setAssignMode('auto')} />
                  <span className="text-sm">Gleichmäßig auf alle aktiven Setter verteilen</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={assignMode === 'setter'} onChange={() => setAssignMode('setter')} />
                  <span className="text-sm">Einem bestimmten Setter zuweisen:</span>
                </label>
                {assignMode === 'setter' && (
                  <select value={selectedSetter} onChange={e => setSelectedSetter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm ml-6">
                    <option value="">Setter wählen...</option>
                    {setters.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={assignMode === 'auto' && setters.length === 0} onChange={() => {}} disabled />
                  <span className="text-sm text-gray-400">Später zuweisen (nicht zugewiesen)</span>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
          {step === 'preview' && (
            <>
              <Button variant="secondary" onClick={() => setStep('upload')}>Zurück</Button>
              <Button onClick={handleImport} loading={loading} disabled={newCount === 0}>
                {newCount} Leads importieren
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
