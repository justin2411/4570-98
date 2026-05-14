export type UserRole = 'admin' | 'setter' | 'advisor'

export type LeadStatus =
  | 'neu'
  | 'angerufen'
  | 'nicht_erreicht'
  | 'wiedervorlage'
  | 'termin_gelegt'
  | 'termin_stattgefunden'
  | 'kein_interesse'

export interface Profile {
  id: string
  role: UserRole
  full_name: string
  email: string
  avatar_color: string
  is_active: boolean
  created_at: string
  // Setter-Profil-Felder (Migration 01-migration-setter-profil.sql)
  role_title: string | null
  teams_room_url: string | null
  phone_direct: string | null
  custom_signature: string | null
  use_custom_signature: boolean
}

export interface Lead {
  id: string
  assigned_to: string | null
  uploaded_by: string
  name: string
  phone: string
  email: string | null
  state: string
  score: number
  lead_quality: string
  age_indicator: string
  signals: string
  status: LeadStatus
  appointment_date: string | null
  recall_date: string | null
  notes: string | null
  call_attempts: number
  last_call_attempt: string | null
  teams_link: string | null
  created_at: string
  updated_at: string
  profiles?: Profile
}

export interface ActivityLog {
  id: string
  lead_id: string
  setter_id: string
  old_status: string
  new_status: string
  note: string | null
  created_at: string
  profiles?: Profile
  leads?: Lead
}

export interface LeaderboardCache {
  id: string
  setter_id: string
  date: string
  calls_made: number
  appointments_set: number
  appointments_done: number
  points: number
  updated_at: string
  profiles?: Profile
}

export interface LeaderboardEntry {
  setter_id: string
  full_name: string
  avatar_color: string
  appointments_set: number
  appointments_done: number
  points: number
  show_rate: number
}

export const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string; emoji: string }> = {
  neu: { label: 'Neu', color: '#6366F1', bg: 'bg-indigo-100 text-indigo-700', emoji: '🆕' },
  angerufen: { label: 'Angerufen', color: '#2E75B6', bg: 'bg-blue-100 text-blue-700', emoji: '📞' },
  nicht_erreicht: { label: 'Nicht erreicht', color: '#F97316', bg: 'bg-orange-100 text-orange-700', emoji: '🔁' },
  wiedervorlage: { label: 'Wiedervorlage', color: '#8B5CF6', bg: 'bg-purple-100 text-purple-700', emoji: '⏰' },
  termin_gelegt: { label: 'Termin gelegt', color: '#EAB308', bg: 'bg-yellow-100 text-yellow-700', emoji: '🟡' },
  termin_stattgefunden: { label: 'Termin stattgefunden', color: '#22C55E', bg: 'bg-green-100 text-green-700', emoji: '🟢' },
  kein_interesse: { label: 'Kein Interesse', color: '#EF4444', bg: 'bg-red-100 text-red-700', emoji: '🚫' },
}

export const GERMAN_STATES = [
  'Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen',
  'Hamburg', 'Hessen', 'Mecklenburg-Vorpommern', 'Niedersachsen',
  'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland', 'Sachsen',
  'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen',
]
