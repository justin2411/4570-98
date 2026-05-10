# Leadbooking

Deutscher Marktplatz für qualifizierte Beratungstermine mit Heilberuflern – gebaut für Finanzberater.

## Tech Stack

- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS**
- **Supabase** (PostgreSQL + Auth + Realtime)
- **Stripe** + **PayPal** (Zahlungen)
- **Web Push API** (Service Worker, VAPID)
- **Vercel** (Deployment)

## Termin-Typen

| Typ | Badge | Beschreibung |
|-----|-------|-------------|
| Geplant | 🟡 | Termin in der Zukunft, Heilberufler wartet auf Anruf |
| Stattgefunden | 🟢 | Gespräch hat stattgefunden, Interesse bestätigt |

Beide Typen kosten **100 €** (fest, nicht verhandelbar).

## Nutzerrollen

- **Admin** – Vollzugriff, Termine und Nutzer verwalten
- **Setter** – Termine anlegen (braucht Freischaltung durch Admin)
- **Finanzberater** – Termine kaufen (sofort nach Registrierung aktiv)

## Setup

### 1. Repository klonen & Dependencies installieren

```bash
git clone <repo>
cd leadbooking
npm install
```

### 2. Umgebungsvariablen konfigurieren

```bash
cp .env.local.example .env.local
# .env.local mit Ihren Werten befüllen
```

### 3. Supabase Setup

1. Neues Projekt auf [supabase.com](https://supabase.com) erstellen
2. SQL-Schema im Supabase SQL Editor ausführen (`supabase/schema.sql`)
3. Anon Key + Service Role Key in `.env.local` eintragen

### 4. Admin-Account einrichten

Nach der ersten Registrierung in der Supabase Datenbank:

```sql
UPDATE profiles SET role = 'admin', is_active = true
WHERE email = 'ihre-admin@email.de';
```

### 5. VAPID Keys generieren

```bash
npx web-push generate-vapid-keys
```

Beide Keys in `.env.local` eintragen.

### 6. Stripe Webhook einrichten

1. Stripe Dashboard → Developers → Webhooks
2. Endpoint: `https://ihre-domain.de/api/payments/stripe/webhook`
3. Events: `checkout.session.completed`
4. Webhook Secret als `STRIPE_WEBHOOK_SECRET` in `.env.local`

Lokal mit Stripe CLI:
```bash
stripe listen --forward-to localhost:3000/api/payments/stripe/webhook
```

### 7. Lokal starten

```bash
npm run dev
# http://localhost:3000
```

## Deployment auf Vercel

```bash
vercel --prod
```

Alle Umgebungsvariablen im Vercel Dashboard unter **Settings → Environment Variables** eintragen.

## Seitenstruktur

```
/                          Landingpage
/login                     Anmelden
/registrieren              Registrieren

/dashboard                 Finanzberater-Übersicht
/dashboard/marktplatz      Alle verfügbaren Termine + Filter
/dashboard/termin/[id]     Termin-Detail + Kauf-Flow (Stripe/PayPal)
/dashboard/meine-termine   Gekaufte Termine mit Kontaktdaten
/dashboard/einstellungen   Profil + Push-Notifications

/setter                    Setter-Dashboard
/setter/termin-anlegen     Neuen Termin anlegen
/setter/termine            Eigene Termine verwalten

/admin                     Admin-Dashboard (KPIs, Umsatz)
/admin/termine             Alle Termine verwalten
/admin/nutzer              Nutzer freischalten / sperren
/admin/einstellungen       System-Konfiguration
```

## API Routes

| Route | Methode | Beschreibung |
|-------|---------|-------------|
| `/api/push/subscribe` | POST/DELETE | Push-Subscription verwalten |
| `/api/push/send` | POST | Push an einzelnen Nutzer |
| `/api/push/send-all` | POST | Push an alle Finanzberater |
| `/api/payments/stripe/create-session` | POST | Stripe Checkout Session |
| `/api/payments/stripe/webhook` | POST | Stripe Webhook |
| `/api/payments/paypal/create-order` | POST | PayPal Order erstellen |
| `/api/payments/paypal/capture` | GET | PayPal Zahlung bestätigen |

## Sicherheit

- **Preis-Fixierung**: 100 € immer serverseitig – keine Frontend-Manipulation möglich
- **RLS Policies**: Kontaktdaten nur für Käufer sichtbar
- **Middleware**: Rollenbasierte Zugangskontrolle für alle Routen
- **Stripe Signatur**: Verifizierung aller Webhook-Events
