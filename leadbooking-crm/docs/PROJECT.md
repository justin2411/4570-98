# PROJECT.md — Was bisher gebaut wurde

Lebendes Protokoll. Letzte Aktualisierung: **Mai 2026**.

Das CRM (`leadbooking-crm/`) ist eine Next.js 14 App auf Supabase, deployt via Vercel. Drei Rollen: **Admin**, **Setter**, **Closer/Advisor**.

---

## 📍 Zwischenstand — Mai 2026

**Setter-System läuft, Branding ist berufsneutral, Performance + Verteil-Tools sind live.**

- ✅ Berufsneutrales zentrales Skript (Hook + alle Einwände, `{beruf}`/`{beruf_plural}`)
- ✅ Cockpit mit Zurück-Button, Undo, qualitätsbasiertem Deck, schließbarer Post-Termin-Maske
- ✅ Lead-Slide-over mit einheitlichem „Termin bestätigen"-Block (Closer + Mail + WhatsApp)
- ✅ WhatsApp-Link-Normalisierung (15/15 getestet) — `wa.me`-Links immer korrekt
- ✅ Mail-/WhatsApp-Signaturen schlank (nur Name + „Beratungsteam") — kein Hebammen-Branding mehr
- ✅ Rangliste/Statistiken in Europe/Berlin-Zeit, im Dashboard, Reset-Button im Admin
- ✅ Quality-Sort überall (Cockpit, Setter-Leads, Admin-Leads) — silent im Hintergrund, nicht für Setter sichtbar
- ✅ Admin-UI für Lead-Verteilung (`/admin/leads` → 📤-Button) + Programmatic API (`POST /api/admin/distribute-leads`)
- ✅ Agent-getriebene Verteilung per Bearer-Token (Env-Var `ADMIN_API_TOKEN`) — Claude Code kann nach Aufforderung verteilen / umstrukturieren, ohne dass der DB-Service-Key geteilt werden muss
- ✅ Setter-Übersicht per `GET /api/admin/setters` (id + offene-Leads-Last + unzugeordnete-pro-Liste)
- ✅ XI CRM Branding (Browser-Tab + PWA)
- ✅ Drei lebende Docs (PROJECT/DECISIONS/WORKFLOW)

**Aktuelle Setter-Last (Snapshot):**

| Setter | offene Leads |
|---|---:|
| Justin Stich | 550 🔴 |
| Max Weiß | 162 |
| Lisa Becker | 111 |
| Paul Sander | 45 |
| Robert Cerbanches | 45 |
| Nicholas Sirenko | 37 |
| Antonia Tischler | 23 |
| Christian Mende | 15 🟢 |
| **Σ offen** | **988** |
| Unzugeordnet | 0 |

→ Sehr ungleich verteilt. Umverteilen jederzeit möglich (Admin-Button oder Agent per Token).

**Noch offen (DB-Schritte vom User in Supabase):**
- `supabase/leaderboard-timezone.sql` — Trigger auf Europe/Berlin
- `supabase/perf-upgrade.sql` — Indizes + RPC

**Bekannte Schwachstellen (nicht akut, dokumentiert in DECISIONS):**
- Undo zählt Statistik nicht zurück (activity_log bleibt)
- Call-Button schreibt kein `activity_log` → „Anrufe"-Zähler undercountet
- Streak ist „distinct days", nicht „consecutive"

---

## 📖 Anleitung — Wie funktioniert das Tool?

### Tech-Stack
- **Frontend & API:** Next.js 14 (App Router), TypeScript, Tailwind CSS — alles in `leadbooking-crm/`
- **Datenbank:** Supabase (Postgres + Auth + Realtime + RLS)
- **Hosting:** Vercel (`main`-Branch → automatischer Production-Deploy)
- **Repo:** `justin2411/4570-98`, Dev-Branch `claude/brave-galileo-n3x6e`

### Rollen
| Rolle | Was sie tun |
|---|---|
| **Setter** | Telefoniert Leads, legt Termine, dokumentiert (Cockpit, Lead-Liste, Wiedervorlage, Termine) |
| **Admin** | Verwaltet Leads (Upload, Verteilung), Cluster-Inhalte, Closer, Ranglisten-Reset |
| **Closer/Advisor** | Übernimmt vom Setter gelegte Termine (60-Min-Beratungen) |

Rolle steht in `profiles.role`. Switch via Supabase Auth (E-Mail/Passwort).

### Setter-Workflow (mobile-first)

**1. Dashboard (`/setter`)** — Persönliche Tagesübersicht: Heute/Woche/Monat/Jahr-Statistik, Streak, Tier-Rangliste aller Setter (deutsche Zeit). Default-Einstieg.

**2. Cockpit (`/setter/cockpit`)** — Vollbild-Anruf-Modus, eine Lead-Karte pro Bildschirm:
- **Anrufen:** Großer Button mit Telefonnummer → öffnet Telefon-App.
- **Skript & Einwände:** Im Drawer unten (📖 Skript / 💬 Einwände / 📝 Notizen). Skript ist zentral für alle Cluster, personalisiert über `{beruf}`, `{kunde_nachname}`, `{firma}` etc.
- **Aktionen:** 4 Buttons (oder Wisch-Gesten):
  - **Termin** (↑) → öffnet TerminModal (Datum/Uhrzeit/Teams-Link) → speichert → öffnet „Termin gespeichert"-Maske
  - **Wiedervorlage** (↓) → Datum/Uhrzeit-Auswahl, Lead kommt automatisch zurück
  - **Nicht erreicht** (→) → setzt auto-Recall (1.Versuch: +2h, 2.: +4h, 3.+: morgen 10 Uhr)
  - **Kein Interesse** (←) → Lead raus
- **Zurück-Button** (← im Header): zur vorherigen Karte navigieren.
- **Undo** (gelber Pill auf der Karte): nach jeder Aktion einmal die Möglichkeit, sie rückgängig zu machen.
- **Deck-Sortierung:** Wiedervorlagen → frische (nie angerufen) sortiert nach Qualität (Handy / echter Name / weiblich / persönliche Mail) → nicht erreicht. Setter sehen die Qualität NICHT, nur die Reihenfolge.

**3. Nach gelegtem Termin** (PostTerminModal im Cockpit, „Termin bestätigen"-Block im Slide-over):
- **Closer benachrichtigen** (CloserNotify): Closer wählen → Mail-App öffnet mit fertiger Termin-Mail (inkl. Lead-Beruf).
- **E-Mail-Bestätigung** an den Lead (Microsoft-Teams-Link).
- **WhatsApp-Bestätigung** an den Lead (Datum/Uhrzeit/Link, `wa.me`-Link robust normalisiert).
- Maske mit **X** schließbar oder mit „Weiter"-Button advance.

**4. Lead-Liste (`/setter/leads`)** — Alle zugewiesenen Leads, serverseitig nach Qualität sortiert (silent). Klick → Slide-over mit Details + Aktionen (gleiche wie Cockpit, plus Status-Buttons + Notizen).

**5. Wiedervorlage (`/setter/wiedervorlage`)** — Fällige Recalls (Heute/Diese Woche/Alle). Klick → Slide-over.

**6. Termine (`/setter/termine`)** — Alle gespeicherten Termine. Klick → Termin-Detail (Lead-Info, WhatsApp/Mail-Vorlagen, Closer ändern).

**7. Profil (`/setter/profil`)** — Name, Rolle (default „Beratungsteam"), Telefon, custom Signatur, Daily Goal, Sound an/aus.

### Admin-Workflow

**1. Leads verwalten (`/admin/leads`)**
- **Excel-Upload:** Spalten erkannt: `ansprechpartner, email, handynummer, bundesland, beruf, website, ort, list_name`. Beim Import wird der Name automatisch bereinigt (`cleanLeadName` entfernt Praxis-Wörter).
- **Filter:** Liste, Beruf, Status, Setter.
- **Bulk-Aktionen:** Setter zuweisen, Liste ändern, archivieren, fix-states.
- **📤 Leads verteilen:** Modal mit Setter-Mehrfachauswahl + optionaler Listen-Filter + Max-pro-Setter. Verteilt unzugeordnete Leads qualitäts-balanced reihum.

**2. Inhalte (`/admin/inhalte`)** — Pro Cluster (= Liste): Branding (Firma, Web, Mail, Tagline), WhatsApp- und E-Mail-Vorlagen. **Skript ist zentral** (kein per-Cluster-Override mehr).

**3. Closer (`/admin/closers`)** — Closer (Berater) anlegen mit Name/E-Mail/Telefon.

**4. Rangliste (`/admin/rangliste`)** — Vollständige Setter-Rangliste (Tier-System: VIP/Diamant/Platin/Gold/Silber/Bronze). Unten in roter Box: **„Ranglisten auf 0 zurücksetzen"** (löscht activity_log + leaderboard_cache + setzt termin_gelegt/stattgefunden auf 'angerufen').

**5. Setter (`/admin/setter`)** — Setter aktivieren/deaktivieren.

### API-Endpoints (Agent / Automation)

Beide Endpoints akzeptieren entweder Admin-Session-Cookie **oder** Bearer-Token (Env-Var `ADMIN_API_TOKEN`).

**`GET /api/admin/setters`** → Übersicht aktiver Setter mit offenen Leads + unzugeordneten pro Liste.
```bash
curl -X GET https://4570-98.vercel.app/api/admin/setters \
  -H "Authorization: Bearer <ADMIN_API_TOKEN>"
```
Response: `{ setters: [{id, name, email, openLeads}], unassigned: {total, byList} }`

**`POST /api/admin/distribute-leads`** → Verteilt Leads qualitäts-balanced.
```bash
curl -X POST https://4570-98.vercel.app/api/admin/distribute-leads \
  -H "Authorization: Bearer <ADMIN_API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"setterIds":["uuid1","uuid2"], "listName":"Heilpraktiker", "perSetterLimit":50, "includeAssigned":true, "statuses":["neu","angerufen"]}'
```
Body-Optionen:
- `setterIds` (pflicht): Ziel-Setter-UUIDs
- `listName` (optional): Filter auf eine Liste
- `perSetterLimit` (optional): Cap pro Setter
- `includeAssigned: true` (optional): bezieht bereits zugewiesene Leads ein (= Umstrukturierung)
- `statuses` (optional, default `['neu','angerufen']`): welche Lead-Status betrachtet werden

**`POST /api/admin/reset-rangliste`** → Nur über Admin-Session (UI-Button auf `/admin/rangliste`).

### Datenbank-Migrations (einmalig in Supabase einspielen)

Im Supabase-SQL-Editor (idempotent, jederzeit wiederholbar):
1. **`supabase/leaderboard-timezone.sql`** — Cache-Trigger auf Europe/Berlin (sonst springt „Heute" um 01-02 Uhr DE).
2. **`supabase/perf-upgrade.sql`** — Composite-Indizes, pg_trgm für schnelle Suche, RPC `get_distinct_list_names()`.
3. **`supabase/schema.sql`** — Hauptschema (nur bei Neu-Setup).

### Wichtige Env-Variablen (Vercel)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase-URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Anon-Key (Client)
- `SUPABASE_SERVICE_ROLE_KEY` — Service-Role-Key (Server, für admin-Operations)
- `ADMIN_API_TOKEN` — Bearer-Token für Agent-getriebene Admin-Calls

### Lokal entwickeln
```bash
cd leadbooking-crm
npm install
cp .env.local.example .env.local   # und ausfüllen
npm run dev                         # → http://localhost:3000
npx tsc --noEmit                    # Typecheck
```
Build wird von Vercel bei jedem `main`-Push automatisch erstellt.

### Was Claude Code in diesem Projekt tun kann
- ✅ Code-Änderungen (Features, Bugfixes, Refactors) → PR → Merge → Vercel deployt automatisch
- ✅ Admin-API-Calls per Bearer-Token (Lead-Verteilung, Übersicht abrufen)
- ✅ PDF-Generierung via pdfkit, Doku-Updates, SQL-Migration-Files erstellen
- ❌ Keine direkten DB-Schreibzugriffe (kein Service-Key in der Cloud-Umgebung) → User muss SQL einspielen oder Admin-Button klicken
- ❌ Keine Tests im echten Browser → bei UI-Änderungen ggf. Preview-Deploy prüfen, bevor merged wird

### Branch- & PR-Konvention
- Dev-Branch: **`claude/brave-galileo-n3x6e`** (force-pushed nach jedem Squash-Merge)
- PRs gehen gegen `main`, Squash-Merge
- Tools: Plain Claude Chat für Diskussion, Claude Code für Implementierung, VS Code lokal

→ Mehr zum Workflow: `WORKFLOW.md`. Begründungen einzelner Entscheidungen: `DECISIONS.md`.

---

## 🟦 Skript & Inhalte (berufsneutral)

- **Zentrales Gesprächs-Skript** in `lib/script-template.ts` — gilt für **alle** Cluster (Heilpraktiker, Hebammen, Psychotherapeuten …). Kein per-Cluster-Override mehr.
- **Hook** neu formuliert: „Wir arbeiten mit selbstständigen `{beruf_plural}` in `{bundesland}` zusammen …"
- Alle „Hebamme/Hebammen"-Texte durch `{beruf}` / `{beruf_plural}` ersetzt — sowohl im Skript als auch in den Einwand-Antworten.
- `BERUF_PLURAL`-Map + `resolveBeruf(lead)` zentral in `script-template.ts`, von allen Render-Pfaden genutzt (Cockpit, Slide-over, Mail/WhatsApp).
- **Firmenname** `{firma}` berufsspezifisch: `{beruf_plural}-Vorsorge` (z.B. „Heilpraktiker-Vorsorge"). Fallback ohne Beruf: „Vorsorge-Beratung".
- **Skript-Editor in Admin → Inhalte entfernt** (dead code) — Skript ist zentral.

## 🟦 Lead-Daten

- **Namens-Bereinigung** (`lib/clean-name.ts`): „Akkupunktur Gebhard" → „Gebhard". Praxis-/Service-Wörter (Akupunktur, Praxis, Studio, Physio, …) und der hinterlegte Beruf werden weggefiltert. Greift beim **Excel-Import** und beim **Anzeigen** (Cockpit-Header, Listen, Slide-over, Termine, Wiedervorlage, Mail-/WhatsApp-Vorlagen).
- **Lead-Qualitäts-Score** (`lib/lead-quality.ts`): Bonus-Punkte für Handynummer (+3), echter Personenname (+2), weiblicher Vorname (+2), persönliche E-Mail (+1), freier Provider (+1).

## 🟦 Cockpit

- **Zurück-Button** im Header (← navigiert zur vorherigen Lead-Karte).
- **Deck-Sortierung**: nie angerufene Leads zuerst, davon die qualitativ besten oben. Wiedervorlagen vorne, „nicht erreicht" hinten.
- **Undo-Button** auf der Lead-Karte: letzte Aktion (Termin / Wiedervorlage / Nicht erreicht / Kein Interesse) rückgängig — Status + Datum-Felder werden in der DB zurückgesetzt, Cockpit springt zur Karte.
- **Post-Termin-Maske** schließbar (X oben rechts) zusätzlich zum „Weiter"-Button.

## 🟦 Lead-Slide-over (Setter-Lead-Liste)

- Nach gespeichertem Termin: einheitlicher **„📬 Termin bestätigen"**-Block — Closer-Benachrichtigung, dann E-Mail-Bestätigung, dann WhatsApp-Bestätigung. Die 4 alten WhatsApp-Varianten (24h, 3h, No-Show) sind entfernt.
- **Sortierung** der Lead-Liste serverseitig nach Qualität (`leadQualityScore`), Sortierung im Hintergrund, **kein** sichtbarer Qualitäts-Indikator in der UI.

## 🟦 Closer / Berater-Benachrichtigung

- **Closer-Mail** (`buildCloserMailto`): Betreff und KUNDIN-Block enthalten jetzt **den Beruf des Leads** (z.B. „Heilpraktiker"). „Hebammen-Vorsorge"-Signaturzeile entfernt.
- **Kalender-Einladung (ICS)**: Termin-Titel zeigt Beruf; PRODID/UID/Fallback-Organizer neutralisiert.

## 🟦 Mail- & WhatsApp-Signaturen

- Signatur reduziert auf **`{Name}\n{Rolle}`** (Default-Rolle „Beratungsteam"). Kein Firmen-/Kontakt-Block mehr — gilt für alle 4 Mail- und 4 WhatsApp-Vorlagen.
- WhatsApp-Bestätigung: „von {firma}" entfernt.

## 🟦 WhatsApp-Link-Fix

- `buildWhatsappUrl` nutzt jetzt die robuste `formatPhoneForCall`-Normalisierung — behebt fehlerhafte `wa.me`-Links bei `0151…` (nationale 0) und `+49 0151…` (Ländercode + überzählige 0). Mit 15 realen Eingabe-Varianten getestet.

## 🟦 Ranglisten & Statistiken

- **Separate `/rangliste`-Seite entfernt** — Rangliste lebt nur noch im Dashboard.
- **Tagesansicht zuverlässig**: alle Zeitgrenzen (Heute/Woche/Monat) in **Europe/Berlin**. Datums-Helfer `lib/dates.ts` (mit DST getestet) + DB-Trigger `refresh_leaderboard_cache` bucketet nach Berlin-Datum (`supabase/leaderboard-timezone.sql`).
- **Admin-Reset-Button** „Ranglisten auf 0 zurücksetzen" auf `/admin/rangliste` (in roter Gefahrenzonen-Box). Admin-only.

## 🟦 Performance

- **Parallele Lade-Queries** (`Promise.all`) in `cockpit/page.tsx` + `termine/page.tsx` statt sequentiell.
- **Admin → Inhalte** ohne Full-Table-Scan: RPC `get_distinct_list_names()` + Fallback.
- **DB-Indizes** (`supabase/perf-upgrade.sql`): kombinierte Indizes + pg_trgm für schnelle `ilike`-Suche.

## 🟦 Mobile / UI

- **Browser-Tab + PWA-Name**: „XI CRM" (vorher „Hebammen-Vorsorge CRM").
- Hotfix mobile Nav: undefined-Crash nach Rangliste-Entfernung behoben.

## 🟦 Admin-Tools

- **Reset-Rangliste-Button** (siehe oben).
- Lead-Übersicht serverseitig nach Qualität sortiert — auch unzugeordnete Leads.
- **Leads verteilen** (`📤`-Button auf `/admin/leads` + `POST /api/admin/distribute-leads`): unzugeordnete Leads werden nach Qualität sortiert und qualitäts-balanciert per Round-Robin auf ausgewählte Setter verteilt. Optional Filter „Nur aus Liste" und Cap „Max. pro Setter".
- **Verteilen/Umstrukturieren per API-Token**: Derselbe Endpoint akzeptiert auch Bearer-Token-Auth (Env-Var `ADMIN_API_TOKEN`) und unterstützt `includeAssigned: true` zum Umverteilen bereits zugewiesener Leads sowie `statuses`-Filter. Schreibzugriffe via Service-Role-Client. **Live und getestet** (Mai 2026).
- **Setter-Übersicht** (`GET /api/admin/setters`, Token-Auth): liefert aktive Setter (id, name, email, openLeads) sowie eine Übersicht der unzugeordneten Leads pro Liste. Damit kann der Agent vor jeder Umverteilung sehen, was zu tun ist und wo die Last steht.

## 📄 Hilfs-Artefakte

- **PDF**: „E-Mail-Postfach einrichten" (STRATO) — Schritt-für-Schritt für MacBook / iPhone / Android. Wurde einmalig generiert und ausgeliefert.

## 🔧 Noch offen / zu beachten

- **Supabase-SQL einspielen** (einmalig, idempotent):
  - `supabase/leaderboard-timezone.sql` — Trigger auf Berlin-Zeit
  - `supabase/perf-upgrade.sql` — Indizes + RPC
- **Bekannte Schwachstellen** (separates Dokument): Undo zählt Statistik nicht zurück; Call-Button schreibt kein `activity_log` (→ Anrufe-Statistik untercountet); Streak ist „distinct days" statt „consecutive".
