'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SCRIPT_SECTIONS } from '@/lib/script-template'
import { WHATSAPP_TEMPLATES, EMAIL_TEMPLATES, PLACEHOLDERS } from '@/lib/message-templates'
import { Save, Upload, ChevronDown, ChevronRight, FolderOpen, Megaphone, MessageCircle, Mail, BookOpen, Info } from 'lucide-react'
import toast from 'react-hot-toast'

interface ClusterRow {
  list_name: string
  firma: string
  web: string
  kontakt_email: string
  tagline: string
  script: string
  templates: Record<string, { text?: string; subject?: string; body?: string }>
}

interface FormState {
  firma: string
  web: string
  kontakt_email: string
  tagline: string
  script: string
  wa: Record<string, string>
  email: Record<string, { subject: string; body: string }>
}

// Standard-Skript als Fließtext-Vorlage (aus den bestehenden Abschnitten)
const DEFAULT_SCRIPT = SCRIPT_SECTIONS.map(s => `## ${s.title}\n${s.content}`).join('\n\n')

export function InhalteClient({ clusters, initialContent }: { clusters: string[]; initialContent: ClusterRow[] }) {
  const supabase = createClient()

  const contentMap = useMemo(() => {
    const m: Record<string, ClusterRow> = {}
    initialContent.forEach(r => { m[r.list_name] = r })
    return m
  }, [initialContent])

  const [savedClusters, setSavedClusters] = useState<Set<string>>(new Set(Object.keys(contentMap)))
  const [selected, setSelected] = useState<string>(clusters[0] || '')
  const [saving, setSaving] = useState(false)
  const [showShortcodes, setShowShortcodes] = useState(false)
  const [openSection, setOpenSection] = useState<'branding' | 'script' | 'whatsapp' | 'email'>('branding')

  function buildForm(cluster: string): FormState {
    const existing = contentMap[cluster]
    const t = existing?.templates || {}
    return {
      firma: existing?.firma || '',
      web: existing?.web || '',
      kontakt_email: existing?.kontakt_email || '',
      tagline: existing?.tagline || '',
      script: existing?.script || DEFAULT_SCRIPT,
      wa: Object.fromEntries(WHATSAPP_TEMPLATES.map(w => [w.id, t[w.id]?.text ?? w.defaultText])),
      email: Object.fromEntries(EMAIL_TEMPLATES.map(e => [e.id, {
        subject: t[e.id]?.subject ?? e.defaultSubject,
        body: t[e.id]?.body ?? e.defaultBody,
      }])),
    }
  }

  const [form, setForm] = useState<FormState>(() => buildForm(clusters[0] || ''))

  useEffect(() => { setForm(buildForm(selected)) /* eslint-disable-next-line */ }, [selected])

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) { setForm(f => ({ ...f, [k]: v })) }
  function setWa(id: string, v: string) { setForm(f => ({ ...f, wa: { ...f.wa, [id]: v } })) }
  function setEmail(id: string, field: 'subject' | 'body', v: string) {
    setForm(f => ({ ...f, email: { ...f.email, [id]: { ...f.email[id], [field]: v } } }))
  }

  function onScriptFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { setField('script', String(reader.result || '')); toast.success('Skript aus Datei geladen') }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function save() {
    if (!selected) return
    setSaving(true)
    const templates: Record<string, { text?: string; subject?: string; body?: string }> = {}
    WHATSAPP_TEMPLATES.forEach(w => { templates[w.id] = { text: form.wa[w.id] } })
    EMAIL_TEMPLATES.forEach(e => { templates[e.id] = { subject: form.email[e.id].subject, body: form.email[e.id].body } })

    const payload = {
      list_name: selected,
      firma: form.firma.trim(),
      web: form.web.trim(),
      kontakt_email: form.kontakt_email.trim(),
      tagline: form.tagline.trim(),
      script: form.script,
      templates,
    }
    const { error } = await supabase.from('cluster_content').upsert(payload as never, { onConflict: 'list_name' })
    setSaving(false)
    if (error) { toast.error('Fehler: ' + error.message); return }
    // lokalen Cache aktualisieren
    contentMap[selected] = payload as never
    setSavedClusters(prev => new Set(prev).add(selected))
    toast.success(`„${selected}" gespeichert ✓`)
  }

  if (clusters.length === 0) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-[#1E3A5F] mb-2">Inhalte</h1>
        <div className="mt-4 p-5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <p className="font-semibold mb-1">Noch keine Cluster vorhanden</p>
          <p>Lege zuerst unter <strong>Leads</strong> ein paar Listen an (z.B. „Therapeuten-Vorsorge.de"). Danach kannst du hier pro Cluster den Content pflegen.</p>
        </div>
      </div>
    )
  }

  const isSaved = savedClusters.has(selected)

  const sectionTabs = [
    { id: 'branding' as const, label: 'Branding', icon: Megaphone },
    { id: 'script' as const, label: 'Skript', icon: BookOpen },
    { id: 'whatsapp' as const, label: 'WhatsApp', icon: MessageCircle },
    { id: 'email' as const, label: 'E-Mails', icon: Mail },
  ]

  return (
    <div className="space-y-4 max-w-4xl pb-28">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Inhalte pro Cluster</h1>
        <p className="text-gray-700 text-sm mt-1">Skript, WhatsApp, E-Mails & Branding — individuell pro Zielgruppe.</p>
      </div>

      {/* Cluster-Auswahl */}
      <div className="flex flex-wrap gap-2 p-3 bg-gradient-to-r from-blue-50 to-slate-50 rounded-xl border border-blue-100">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E3A5F] uppercase tracking-wide px-1 self-center">
          <FolderOpen className="w-4 h-4" /> Cluster
        </div>
        {clusters.map(c => (
          <button key={c} onClick={() => setSelected(c)}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors flex items-center gap-1.5 ${selected === c ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'}`}>
            {c}
            {savedClusters.has(c) && <span className={`text-[10px] ${selected === c ? 'text-green-300' : 'text-green-600'}`}>●</span>}
          </button>
        ))}
      </div>

      {/* Hinweis ob schon Content existiert */}
      {!isSaved && (
        <div className="px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800 flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Dieser Cluster hat noch keinen eigenen Content. Skript & Nachrichten sind mit der <strong>Standard-Vorlage</strong> vorausgefüllt — passe sie für „{selected}" an und speichere.</span>
        </div>
      )}

      {/* Abschnitts-Tabs */}
      <div className="flex gap-2 flex-wrap">
        {sectionTabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setOpenSection(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${openSection === id ? 'bg-[#2E75B6] text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* Shortcode-Hilfe */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <button onClick={() => setShowShortcodes(s => !s)} className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          <span className="flex items-center gap-2">{showShortcodes ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />} 🏷 Verfügbare Platzhalter (Shortcodes)</span>
        </button>
        {showShortcodes && (
          <div className="px-4 py-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {PLACEHOLDERS.map(p => (
              <div key={p.key} className="flex items-baseline gap-2 text-xs">
                <code className="px-1.5 py-0.5 rounded bg-blue-50 text-[#2E75B6] font-mono font-semibold shrink-0">{p.key}</code>
                <span className="text-gray-600">{p.desc}</span>
              </div>
            ))}
            <div className="flex items-baseline gap-2 text-xs">
              <code className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 font-mono font-semibold shrink-0">{'{beruf}'}</code>
              <span className="text-gray-600">Beruf des Leads</span>
            </div>
            <div className="flex items-baseline gap-2 text-xs">
              <code className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 font-mono font-semibold shrink-0">{'{ort}'}</code>
              <span className="text-gray-600">Ort des Leads</span>
            </div>
          </div>
        )}
      </div>

      {/* ─── BRANDING ─── */}
      {openSection === 'branding' && (
        <div className="space-y-3 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-bold text-[#1E3A5F] flex items-center gap-2"><Megaphone className="w-4 h-4" /> Branding</h2>
          <p className="text-xs text-gray-500">Diese Angaben füllen u.a. den Platzhalter <code className="text-[#2E75B6]">{'{firma}'}</code> und die Mail-Signatur.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Firmenname" value={form.firma} onChange={v => setField('firma', v)} placeholder="z.B. Therapeuten-Vorsorge" />
            <Field label="Web-Adresse" value={form.web} onChange={v => setField('web', v)} placeholder="z.B. www.therapeuten-vorsorge.de" />
            <Field label="Kontakt-E-Mail" value={form.kontakt_email} onChange={v => setField('kontakt_email', v)} placeholder="z.B. beratung@therapeuten-vorsorge.de" />
            <Field label="Tagline" value={form.tagline} onChange={v => setField('tagline', v)} placeholder="z.B. Altersvorsorge für Therapeuten" />
          </div>
        </div>
      )}

      {/* ─── SKRIPT ─── */}
      {openSection === 'script' && (
        <div className="space-y-3 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-bold text-[#1E3A5F] flex items-center gap-2"><BookOpen className="w-4 h-4" /> Gesprächs-Skript</h2>
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> .txt hochladen
              <input type="file" accept=".txt,text/plain" onChange={onScriptFile} className="hidden" />
            </label>
          </div>
          <p className="text-xs text-gray-500">Durchgehender Text mit Shortcodes. Die Setter sehen ihn im Cockpit.</p>
          <textarea value={form.script} onChange={e => setField('script', e.target.value)} rows={20}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 font-mono leading-relaxed focus:ring-2 focus:ring-[#2E75B6] focus:outline-none"
            placeholder="Skripttext mit Shortcodes…" />
        </div>
      )}

      {/* ─── WHATSAPP ─── */}
      {openSection === 'whatsapp' && (
        <div className="space-y-4 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-bold text-[#1E3A5F] flex items-center gap-2"><MessageCircle className="w-4 h-4" /> WhatsApp-Nachrichten</h2>
          {WHATSAPP_TEMPLATES.map(w => (
            <div key={w.id}>
              <label className="block text-sm font-semibold text-gray-800 mb-1">{w.emoji} {w.label}</label>
              <p className="text-[11px] text-gray-500 mb-1">{w.description}</p>
              <textarea value={form.wa[w.id] || ''} onChange={e => setWa(w.id, e.target.value)} rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 leading-relaxed focus:ring-2 focus:ring-[#2E75B6] focus:outline-none" />
            </div>
          ))}
        </div>
      )}

      {/* ─── E-MAILS ─── */}
      {openSection === 'email' && (
        <div className="space-y-5 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-bold text-[#1E3A5F] flex items-center gap-2"><Mail className="w-4 h-4" /> E-Mail-Vorlagen</h2>
          {EMAIL_TEMPLATES.map(em => (
            <div key={em.id} className="space-y-1.5 pb-4 border-b border-gray-100 last:border-0">
              <label className="block text-sm font-semibold text-gray-800">{em.emoji} {em.label}</label>
              <p className="text-[11px] text-gray-500">{em.description}</p>
              <input type="text" value={form.email[em.id]?.subject || ''} onChange={e => setEmail(em.id, 'subject', e.target.value)}
                placeholder="Betreff"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#2E75B6] focus:outline-none" />
              <textarea value={form.email[em.id]?.body || ''} onChange={e => setEmail(em.id, 'body', e.target.value)} rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 leading-relaxed focus:ring-2 focus:ring-[#2E75B6] focus:outline-none" />
            </div>
          ))}
        </div>
      )}

      {/* Sticky Speichern */}
      <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white border-t border-gray-200 px-5 py-3 flex items-center justify-between z-20">
        <span className="text-sm text-gray-600">Cluster: <strong className="text-[#1E3A5F]">{selected}</strong></span>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#2E75B6] hover:bg-[#246299] text-white font-semibold disabled:opacity-50">
          <Save className="w-4 h-4" />{saving ? 'Speichern…' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#2E75B6] focus:outline-none" />
    </div>
  )
}
