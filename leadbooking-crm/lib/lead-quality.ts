// ============================================================
// Lead-Qualitäts-Score — für die Cockpit-Deck-Sortierung.
// Höhere Punktzahl = besseres Lead-Profil. Reine Heuristik,
// soft (nur Sortier-Bonus, kein harter Filter).
// ============================================================

import type { Lead } from '@/types'
import { formatPhoneForCall } from './phone'
import { cleanLeadName } from './clean-name'

// Häufige deutsche weibliche Vornamen (lowercase, Auswahl der gängigsten).
// Bewusst breite Liste, nicht vollständig; lässt sich später erweitern.
const FEMALE_NAMES = new Set<string>([
  'aaliyah','alea','alessia','alexandra','alia','alice','alicia','alina','alma','amal','amalia','amelie','amira','amy','anastasia','andrea','anette','angela','angelika','angelina','anika','anita','anja','ann','anna','annabel','annabelle','anne','annegret','anneliese','annett','annette','annika','antje','antonia','antonella','arwen','asli','astrid',
  'barbara','beate','beatrice','bea','belinda','bella','berenice','bettina','bianca','birgit','britta','brigitte','brigitta',
  'carla','carmen','carolin','carolina','caroline','cassandra','catalina','cathrin','catharina','cecilia','celina','celine','charleen','charlotte','chiara','christa','christel','christiane','christina','christine','claire','clara','claudia','conny','cordula','corina','cornelia',
  'dagmar','dalia','dana','daniela','danielle','daria','denise','diana','dilara','dominique','doreen','doris','dorothea','dorothee',
  'edith','elena','eleni','eleonora','eleonore','elfi','elfriede','elin','elina','elisa','elisabeth','eliana','elif','elina','eljana','elke','ella','ellen','elly','elsa','elvira','emely','emelie','emilia','emily','emine','emma','enya','erika','erna','esther','eva','evelin','eveline','evelyn',
  'fabienne','fanny','farah','fatima','fatma','felicia','felicitas','filiz','fiona','finja','flora','florentine','franka','franziska','frauke','frieda','friederike',
  'gabi','gabriela','gabriele','gerda','gertraud','gertraude','gertrud','gertrude','gina','giulia','gisela','gloria','greta','gudrun',
  'hadia','hana','hanna','hannah','hannelore','hatice','heide','heidi','heidemarie','heike','helena','helene','helga','henriette','henrike','herma','hermine','hilda','hilde','hildegard','hilke',
  'ida','ilka','ilona','ilse','imke','ina','ines','ingeborg','inge','ingrid','irena','irene','iris','irma','irmgard','isabel','isabella','isabelle','iva','ivana','ivonne',
  'jacqueline','jana','janet','janett','janina','janine','jasmin','jasmine','jeanette','jeannine','jenni','jennifer','jenny','jessica','jessika','jill','joana','johanna','jolanda','jolanthe','jolina','jolene','jolie','josefa','josefine','josephine','josi','josie','joy','judith','julia','juliane','julika','juliana','julie','justine','jutta',
  'kaja','karen','karin','karina','karla','karoline','karolina','katarina','katharina','kathleen','kathrin','kathy','katja','katrin','kerstin','kim','kira','klara','klaudia','konstanze','kornelia','kristin','kristina',
  'laila','lana','lara','larissa','laura','layla','lea','leah','leila','lena','leni','leonie','leonore','leyla','lia','liana','liane','liane','lieselotte','lilli','lillian','lilly','lily','lina','linda','linn','linnea','lisa','liselotte','liv','livia','lola','lorena','lorraine','lotta','lotte','louisa','louise','lucia','lucie','lucy','luise','luisa','luna','lydia','lynn',
  'madeleine','madita','magda','magdalena','magret','maike','maja','malin','manon','manuela','mara','mareike','margaret','margarete','margaretha','margarethe','margit','margot','maria','mariam','mariana','marianne','marie','marielle','marietta','marina','marion','marisa','marlena','marlene','marta','martha','martina','mathilda','mathilde','maxi','maya','mechthild','meike','melanie','melike','melisa','melissa','melody','meret','merve','meta','mia','michaela','michelle','mila','milena','milla','milena','minna','mira','miriam','mirjam','monika','myriam',
  'nadia','nadine','nadja','nala','nancy','naomi','natalia','natalie','natascha','nathalie','nelli','nelly','nena','nicole','nicoletta','niki','nikola','nina','noemi','nora','norina',
  'olga','olivia',
  'paula','pauline','peggy','petra','philine','phoebe','pia',
  'rabea','rahel','raja','ramona','regina','rebecca','renate','riana','rieke','rita','romina','romina','rosa','rosalie','rose','rosemarie','roswitha','rowena','ruth',
  'sabine','sabrina','saliha','salma','sandra','sara','sarah','saskia','selen','selena','selin','semra','sevda','seyma','sibel','sibylle','sigrid','silke','silvana','silvia','simone','sina','sinem','siri','sofia','sofie','sonja','sophia','sophie','soraya','stefanie','steffi','sumeyye','susann','susanne','susi','suzanne','svenja','sybille','sylvia',
  'tabea','tabita','tamara','tamina','tania','tanja','tatjana','tea','tessa','thea','thekla','theresa','therese','theresia','tina','tirza','toni','tracy',
  'ulla','ulrike','ute',
  'valeria','valerie','vanessa','vera','verena','veronika','vicky','victoria','viktoria','viola','vivian','viviane','vivien','vivienne',
  'waltraud','waltraut','wenke',
  'xenia',
  'yasmin','yasemin','yasmine','yana','yelena','yildiz','ylva','yvonne',
  'zara','zeynep','zita','zoe',
])

// Generische / Praxis-/Sammel-Mail-Lokalteile.
const GENERIC_LOCAL = new Set<string>([
  'info','kontakt','praxis','mail','office','team','empfang','sekretariat',
  'hello','hallo','service','admin','noreply','no-reply','beratung','anfrage',
  'verwaltung','rezeption','support','kanzlei',
])

// Kostenlose / private Mail-Anbieter (deutscher Markt).
const FREE_PROVIDERS = new Set<string>([
  'gmail.com','googlemail.com',
  'gmx.de','gmx.net','gmx.com','gmx.at','gmx.ch',
  'web.de','t-online.de','freenet.de','arcor.de',
  'yahoo.de','yahoo.com',
  'hotmail.de','hotmail.com','live.de','live.com',
  'outlook.de','outlook.com','outlook.com.de',
  'icloud.com','me.com','mac.com',
  'aol.com','aol.de',
  'mailbox.org','posteo.de','posteo.net',
])

function normalize(s: string): string {
  // Vorname vergleichen: Kleinbuchstaben, nur Buchstaben + Umlaute behalten.
  return (s || '').toLowerCase().replace(/[^a-zäöüß-]/g, '')
}

/**
 * Punktzahl für die Sortierung. Höher = besser.
 * Bonus, keine Filterung — schwache Signale ziehen ein Lead nur ans Ende, nicht raus.
 */
export function leadQualityScore(lead: Lead): number {
  let s = 0

  // 1) Handynummer (+49 15x/16x/17x) > Festnetz
  const phone = formatPhoneForCall((lead as any).phone || '')
  if (/^\+49(15|16|17)/.test(phone)) s += 3

  // 2) Echter Personenname (kein Praxis-/Service-Wort, mind. Vor- + Nachname)
  const beruf = ((lead as any).beruf || '').trim()
  const raw = ((lead as any).name || '').trim()
  const cleaned = cleanLeadName(raw, beruf)
  const tokens = cleaned.split(/\s+/).filter(Boolean)
  if (tokens.length >= 2 && cleaned === raw) s += 2
  if (tokens.length < 2) s -= 1

  // 3) Weiblicher Vorname (heuristisch über Namensliste)
  if (tokens.length >= 1) {
    const first = normalize(tokens[0])
    if (FEMALE_NAMES.has(first)) s += 2
  }

  // 4) Persönliche E-Mail (kein info@/praxis@/…)
  const email = ((lead as any).email || '').trim().toLowerCase()
  if (email && email.includes('@')) {
    const [localRaw, domain] = email.split('@')
    const local = (localRaw || '').replace(/[^a-z0-9._+-]/g, '')
    if (GENERIC_LOCAL.has(local)) s -= 1
    else s += 1
    if (FREE_PROVIDERS.has(domain || '')) s += 1
  }

  return s
}
