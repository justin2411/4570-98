export type UserRole = 'admin' | 'setter' | 'advisor'
export type AppointmentType = 'planned' | 'completed'
export type AppointmentStatus = 'available' | 'sold' | 'no_show'
export type PaymentMethod = 'stripe' | 'paypal'
export type PaymentStatus = 'pending' | 'completed' | 'refunded'

export interface Profile {
  id: string
  role: UserRole
  full_name: string
  email: string
  phone?: string
  is_active: boolean
  created_at: string
}

export interface Appointment {
  id: string
  setter_id: string
  buyer_id?: string
  type: AppointmentType
  status: AppointmentStatus
  profession: string
  region: string
  state: string
  topic: string
  appointment_date?: string
  completed_date?: string
  summary?: string
  price: number
  contact_name?: string
  contact_phone?: string
  contact_email?: string
  notes?: string
  created_at: string
  setter?: Profile
  buyer?: Profile
}

export interface Payment {
  id: string
  appointment_id: string
  buyer_id: string
  amount: number
  method: PaymentMethod
  external_id?: string
  status: PaymentStatus
  created_at: string
  appointment?: Appointment
}

export interface PushSubscription {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  created_at: string
}

export const PROFESSIONS = [
  'Hebamme',
  'Physiotherapeut',
  'Arzt',
  'Zahnarzt',
  'Heilpraktiker',
  'Ergotherapeut',
  'Logopäde',
  'Sonstiges',
] as const

export const TOPICS = [
  'Altersvorsorge',
  'BU-Versicherung',
  'Kapitalanlage',
  'Rentenplanung',
  'Steueroptimierung',
  'Sonstiges',
] as const

export const STATES = [
  'Baden-Württemberg',
  'Bayern',
  'Berlin',
  'Brandenburg',
  'Bremen',
  'Hamburg',
  'Hessen',
  'Mecklenburg-Vorpommern',
  'Niedersachsen',
  'Nordrhein-Westfalen',
  'Rheinland-Pfalz',
  'Saarland',
  'Sachsen',
  'Sachsen-Anhalt',
  'Schleswig-Holstein',
  'Thüringen',
] as const

export type Profession = typeof PROFESSIONS[number]
export type Topic = typeof TOPICS[number]
export type GermanState = typeof STATES[number]
