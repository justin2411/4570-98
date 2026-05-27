// ============================================================
// Lead-Wahrscheinlichkeits-Modell (Conversion-Probability-Score).
//
// Idee:  - Wir nehmen alle Leads, deren Schicksal bekannt ist:
//          POSITIV  = status ∈ {termin_gelegt, termin_stattgefunden}
//          NEGATIV  = status = kein_interesse
//          UNLABELED = neu / angerufen / nicht_erreicht / wiedervorlage
//        - Pro Feature-Wert berechnen wir eine geglättete Conversion-Rate
//          (Laplace, α=β=1) und vergleichen sie mit dem Baseline-Rate
//          → log-Uplift. Score = Summe der Uplifts über alle Features.
//
//        Anrufversuche oder Call-History fließen bewusst NICHT ein
//        (User-Vorgabe — wir wollen Wahrscheinlichkeiten anhand der
//        Lead-STAMMDATEN vorhersagen, nicht anhand des Setter-Verhaltens).
//
// Trainings-/Bewertungs-API:
//   - getLeadProbabilityScorer(): Promise<(lead) => number>
//     Sorgt für aktuelles Modell (Cache 30 Min, in-memory) und gibt
//     einen synchronen Scorer zurück. Bei zu wenig Trainingsdaten
//     (oder DB-Fehler) fällt das Modell sauber auf leadQualityScore zurück.
//
//   - getModelSnapshot(): Promise<ProbabilityModel>
//     Für Diagnose-Endpoints — liefert die geglätteten Conversion-Raten
//     pro Feature-Wert + Trainings-Metadaten.
// ============================================================

import { createAdminClient } from '@/lib/supabase/server'
import { leadQualityScore } from '@/lib/lead-quality'
import type { Lead } from '@/types'
import { formatPhoneForCall } from '@/lib/phone'
import { cleanLeadName } from '@/lib/clean-name'

// --- Konstanten ---
const CACHE_TTL_MS = 30 * 60 * 1000       // 30 Minuten
const MIN_LABELED = 10                    // unter 10 Labeled-Leads → Fallback
const SMOOTH_ALPHA = 1                    // Laplace
const SMOOTH_BETA = 1
const POSITIVE_STATUSES = new Set(['termin_gelegt', 'termin_stattgefunden'])
const NEGATIVE_STATUSES = new Set(['kein_interesse'])

// dieselben Listen wie in lead-quality.ts — bewusst dupliziert, damit
// das Modell auch dann scoren kann, wenn lead-quality.ts mal abweicht
const FEMALE_NAMES = new Set<string>([
  'aaliyah','alea','alessia','alexandra','alia','alice','alicia','alina','alma','amal','amalia','amelie','amira','amy','anastasia','andrea','anette','angela','angelika','angelina','anika','anita','anja','ann','anna','annabel','annabelle','anne','annegret','anneliese','annett','annette','annika','antje','antonia','antonella','arwen','asli','astrid','barbara','beate','beatrice','bea','belinda','bella','berenice','bettina','bianca','birgit','britta','brigitte','brigitta','carla','carmen','carolin','carolina','caroline','cassandra','catalina','cathrin','catharina','cecilia','celina','celine','charleen','charlotte','chiara','christa','christel','christiane','christina','christine','claire','clara','claudia','conny','cordula','corina','cornelia','dagmar','dalia','dana','daniela','danielle','daria','denise','diana','dilara','dominique','doreen','doris','dorothea','dorothee','edith','elena','eleni','eleonora','eleonore','elfi','elfriede','elin','elina','elisa','elisabeth','eliana','elif','eljana','elke','ella','ellen','elly','elsa','elvira','emely','emelie','emilia','emily','emine','emma','enya','erika','erna','esther','eva','evelin','eveline','evelyn','fabienne','fanny','farah','fatima','fatma','felicia','felicitas','filiz','fiona','finja','flora','florentine','franka','franziska','frauke','frieda','friederike','gabi','gabriela','gabriele','gerda','gertraud','gertraude','gertrud','gertrude','gina','giulia','gisela','gloria','greta','gudrun','hadia','hana','hanna','hannah','hannelore','hatice','heide','heidi','heidemarie','heike','helena','helene','helga','henriette','henrike','herma','hermine','hilda','hilde','hildegard','hilke','ida','ilka','ilona','ilse','imke','ina','ines','ingeborg','inge','ingrid','irena','irene','iris','irma','irmgard','isabel','isabella','isabelle','iva','ivana','ivonne','jacqueline','jana','janet','janett','janina','janine','jasmin','jasmine','jeanette','jeannine','jenni','jennifer','jenny','jessica','jessika','jill','joana','johanna','jolanda','jolanthe','jolina','jolene','jolie','josefa','josefine','josephine','josi','josie','joy','judith','julia','juliane','julika','juliana','julie','justine','jutta','kaja','karen','karin','karina','karla','karoline','karolina','katarina','katharina','kathleen','kathrin','kathy','katja','katrin','kerstin','kim','kira','klara','klaudia','konstanze','kornelia','kristin','kristina','laila','lana','lara','larissa','laura','layla','lea','leah','leila','lena','leni','leonie','leonore','leyla','lia','liana','liane','lieselotte','lilli','lillian','lilly','lily','lina','linda','linn','linnea','lisa','liselotte','liv','livia','lola','lorena','lorraine','lotta','lotte','louisa','louise','lucia','lucie','lucy','luise','luisa','luna','lydia','lynn','madeleine','madita','magda','magdalena','magret','maike','maja','malin','manon','manuela','mara','mareike','margaret','margarete','margaretha','margarethe','margit','margot','maria','mariam','mariana','marianne','marie','marielle','marietta','marina','marion','marisa','marlena','marlene','marta','martha','martina','mathilda','mathilde','maxi','maya','mechthild','meike','melanie','melike','melisa','melissa','melody','meret','merve','meta','mia','michaela','michelle','mila','milena','milla','minna','mira','miriam','mirjam','monika','myriam','nadia','nadine','nadja','nala','nancy','naomi','natalia','natalie','natascha','nathalie','nelli','nelly','nena','nicole','nicoletta','niki','nikola','nina','noemi','nora','norina','olga','olivia','paula','pauline','peggy','petra','philine','phoebe','pia','rabea','rahel','raja','ramona','regina','rebecca','renate','riana','rieke','rita','romina','rosa','rosalie','rose','rosemarie','roswitha','rowena','ruth','sabine','sabrina','saliha','salma','sandra','sara','sarah','saskia','selen','selena','selin','semra','sevda','seyma','sibel','sibylle','sigrid','silke','silvana','silvia','simone','sina','sinem','siri','sofia','sofie','sonja','sophia','sophie','soraya','stefanie','steffi','sumeyye','susann','susanne','susi','suzanne','svenja','sybille','sylvia','tabea','tabita','tamara','tamina','tania','tanja','tatjana','tea','tessa','thea','thekla','theresa','therese','theresia','tina','tirza','toni','tracy','ulla','ulrike','ute','valeria','valerie','vanessa','vera','verena','veronika','vicky','victoria','viktoria','viola','vivian','viviane','vivien','vivienne','waltraud','waltraut','wenke','xenia','yasmin','yasemin','yasmine','yana','yelena','yildiz','ylva','yvonne','zara','zeynep','zita','zoe',
])
const GENERIC_LOCAL = new Set(['info','kontakt','praxis','mail','office','team','empfang','sekretariat','hello','hallo','service','admin','noreply','no-reply','beratung','anfrage','verwaltung','rezeption','support','kanzlei'])
const FREE_PROVIDERS = new Set(['gmail.com','googlemail.com','gmx.de','gmx.net','gmx.com','gmx.at','gmx.ch','web.de','t-online.de','freenet.de','arcor.de','yahoo.de','yahoo.com','hotmail.de','hotmail.com','live.de','live.com','outlook.de','outlook.com','outlook.com.de','icloud.com','me.com','mac.com','aol.com','aol.de','mailbox.org','posteo.de','posteo.net'])

// --- Feature-Extraktion ---
type Features = {
  beruf: string
  list_name: string
  state: string
  has_mobile: 'yes' | 'no'
  has_personal_email: 'yes' | 'no'
  is_female_name: 'yes' | 'no'
  has_free_provider_email: 'yes' | 'no'
  has_full_name: 'yes' | 'no'
}

type FeatureKey = keyof Features

const FEATURE_KEYS: FeatureKey[] = [
  'beruf', 'list_name', 'state',
  'has_mobile', 'has_personal_email', 'is_female_name',
  'has_free_provider_email', 'has_full_name',
]

function extractFeatures(lead: Lead): Features {
  const phone = formatPhoneForCall((lead as any).phone || '')
  const hasMobile = /^\+49(15|16|17)/.test(phone)

  const beruf = (((lead as any).beruf || '') as string).trim() || '∅'
  const list_name = (((lead as any).list_name || '') as string).trim() || '∅'
  const state = (((lead as any).state || '') as string).trim() || '∅'

  const rawName = ((lead as any).name || '').trim()
  const cleaned = cleanLeadName(rawName, (lead as any).beruf || '')
  const tokens = cleaned.split(/\s+/).filter(Boolean)
  const has_full_name = tokens.length >= 2 && cleaned === rawName

  const firstNameNorm = (tokens[0] || '').toLowerCase().replace(/[^a-zäöüß-]/g, '')
  const is_female_name = FEMALE_NAMES.has(firstNameNorm)

  const email = (((lead as any).email || '') as string).trim().toLowerCase()
  let has_personal_email = false
  let has_free_provider_email = false
  if (email.includes('@')) {
    const [localRaw, domain] = email.split('@')
    const local = (localRaw || '').replace(/[^a-z0-9._+-]/g, '')
    has_personal_email = !GENERIC_LOCAL.has(local)
    has_free_provider_email = FREE_PROVIDERS.has(domain || '')
  }

  return {
    beruf, list_name, state,
    has_mobile: hasMobile ? 'yes' : 'no',
    has_personal_email: has_personal_email ? 'yes' : 'no',
    is_female_name: is_female_name ? 'yes' : 'no',
    has_free_provider_email: has_free_provider_email ? 'yes' : 'no',
    has_full_name: has_full_name ? 'yes' : 'no',
  }
}

// --- Modell-Struktur ---
export interface FeatureValueStat {
  value: string
  positives: number
  negatives: number
  rate: number    // geglättete Conversion-Rate
  uplift: number  // log(rate / baseline)
}

export interface ProbabilityModel {
  trainedAt: number
  totalLabeled: number
  totalPositives: number
  totalNegatives: number
  baselineRate: number
  features: Record<FeatureKey, Record<string, FeatureValueStat>>
  fallback: boolean              // true → leadQualityScore wird verwendet
  fallbackReason?: string
}

// --- Cache (Modul-Singleton) ---
let cachedModel: ProbabilityModel | null = null
let trainingPromise: Promise<ProbabilityModel> | null = null

async function trainModel(): Promise<ProbabilityModel> {
  const startedAt = Date.now()
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.from('leads').select('*')
    if (error) throw new Error(error.message)
    const leads = (data || []) as Lead[]
    const labeled = leads.filter(l => {
      const s = (l as any).status as string
      return POSITIVE_STATUSES.has(s) || NEGATIVE_STATUSES.has(s)
    })

    if (labeled.length < MIN_LABELED) {
      const m: ProbabilityModel = {
        trainedAt: startedAt,
        totalLabeled: labeled.length,
        totalPositives: 0,
        totalNegatives: 0,
        baselineRate: 0,
        features: emptyFeatures(),
        fallback: true,
        fallbackReason: `Nur ${labeled.length} gelabelte Leads (< ${MIN_LABELED}) — Fallback auf statischen Quality-Score`,
      }
      return m
    }

    // Zählen
    const counts: Record<FeatureKey, Record<string, { p: number; n: number }>> = emptyCounts()
    let totalPositives = 0
    let totalNegatives = 0
    for (const lead of labeled) {
      const isPos = POSITIVE_STATUSES.has((lead as any).status)
      if (isPos) totalPositives++; else totalNegatives++
      const feats = extractFeatures(lead)
      for (const k of FEATURE_KEYS) {
        const v = feats[k]
        const bucket = counts[k][v] || (counts[k][v] = { p: 0, n: 0 })
        if (isPos) bucket.p++; else bucket.n++
      }
    }

    const baseline = (totalPositives + SMOOTH_ALPHA) / (totalPositives + totalNegatives + SMOOTH_ALPHA + SMOOTH_BETA)
    const features = {} as Record<FeatureKey, Record<string, FeatureValueStat>>
    for (const k of FEATURE_KEYS) {
      features[k] = {}
      for (const [v, c] of Object.entries(counts[k])) {
        const total = c.p + c.n
        const rate = (c.p + SMOOTH_ALPHA) / (total + SMOOTH_ALPHA + SMOOTH_BETA)
        const uplift = Math.log(rate / baseline)
        features[k][v] = { value: v, positives: c.p, negatives: c.n, rate, uplift }
      }
    }

    return {
      trainedAt: startedAt,
      totalLabeled: labeled.length,
      totalPositives,
      totalNegatives,
      baselineRate: baseline,
      features,
      fallback: false,
    }
  } catch (err) {
    return {
      trainedAt: startedAt,
      totalLabeled: 0,
      totalPositives: 0,
      totalNegatives: 0,
      baselineRate: 0,
      features: emptyFeatures(),
      fallback: true,
      fallbackReason: 'Training fehlgeschlagen: ' + (err as Error).message,
    }
  }
}

function emptyCounts(): Record<FeatureKey, Record<string, { p: number; n: number }>> {
  const r = {} as Record<FeatureKey, Record<string, { p: number; n: number }>>
  for (const k of FEATURE_KEYS) r[k] = {}
  return r
}
function emptyFeatures(): Record<FeatureKey, Record<string, FeatureValueStat>> {
  const r = {} as Record<FeatureKey, Record<string, FeatureValueStat>>
  for (const k of FEATURE_KEYS) r[k] = {}
  return r
}

async function ensureModel(forceRefresh = false): Promise<ProbabilityModel> {
  const now = Date.now()
  if (!forceRefresh && cachedModel && now - cachedModel.trainedAt < CACHE_TTL_MS) {
    return cachedModel
  }
  if (!trainingPromise) {
    trainingPromise = trainModel().then(m => { cachedModel = m; return m }).finally(() => { trainingPromise = null })
  }
  return trainingPromise
}

/**
 * Liefert das aktuelle Trainings-Modell (für Diagnose-Endpoints).
 * Trainiert bei Bedarf neu.
 */
export async function getModelSnapshot(forceRefresh = false): Promise<ProbabilityModel> {
  return ensureModel(forceRefresh)
}

/**
 * Berechnet den Score für genau einen Lead anhand des gegebenen Modells.
 * Bei `fallback: true` wird leadQualityScore zurückgegeben (statisch).
 */
export function scoreWithModel(lead: Lead, model: ProbabilityModel): number {
  if (model.fallback) return leadQualityScore(lead)
  const feats = extractFeatures(lead)
  let s = 0
  for (const k of FEATURE_KEYS) {
    const v = feats[k]
    const stat = model.features[k][v]
    if (stat) s += stat.uplift
    // unbekannter Feature-Wert: keine Information, kein Beitrag
  }
  return s
}

/**
 * Gibt einen synchronen Scorer-Funktion zurück. Sorgt vorher dafür,
 * dass das Modell aktuell ist (Cache 30 Min).
 */
export async function getLeadProbabilityScorer(): Promise<(lead: Lead) => number> {
  const model = await ensureModel()
  return (lead) => scoreWithModel(lead, model)
}

/** Test/Diagnose: erzwingt Neutraining (z. B. nach Cleanup-SQL). */
export async function refreshLeadProbabilityModel(): Promise<ProbabilityModel> {
  return ensureModel(true)
}
