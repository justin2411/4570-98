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
  - **Wiedervorlage** (↓) → expliziter Recall mit Datum/Uhrzeit, Lead kommt zur gewählten Zeit zurück
  - **Nicht erreicht** (→) → **endgültig aus dem Cockpit-Deck**, kein Auto-Recall. Wenn der Setter es nochmal versuchen will: bewusst „Wiedervorlage" wählen.
  - **Kein Interesse** (←) → endgültig aus dem Cockpit-Deck
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

Alle akzeptieren entweder Admin-Session-Cookie **oder** Bearer-Token (Env-Var `ADMIN_API_TOKEN`). Auth-Logik zentral in `lib/admin-auth.ts`.

> 🛑 **Goldene Regel (D-016):** Endpoints, die `assigned_to` schreiben (`distribute-leads`, `PATCH /api/admin/leads[/:id]` mit `assigned_to` im patch) ruft der Agent **niemals** ohne ausdrückliche Bestätigung im Chat auf.

**Übersicht / Read**

| Endpoint | Was | Auth |
|---|---|---|
| `GET /api/admin/setters` | Aktive Setter + offene Leads + Unzugeordnete pro Liste | Token/Session |
| `GET /api/admin/leads?status=&assignedTo=&listName=&search=&archived=&limit=&offset=&orderBy=&withQuality=` | Lead-Liste mit Filtern (inkl. optionalem Quality-Score) | Token/Session |
| `GET /api/admin/leads/:id` | Einzel-Lead + activity_log + Setter/Closer | Token/Session |
| `GET /api/admin/stats?groupBy=status,assigned_to,list_name,archived&listName=&includeArchived=` | Aggregate | Token/Session |
| `GET /api/admin/closers` | Alle Closer | Token/Session |
| `GET /api/admin/cluster-content[?listName=…]` | Branding/Vorlagen | Token/Session |
| `GET /api/admin/profiles[?role=&is_active=]` | Profile-Liste | Token/Session |
| `GET /api/admin/lead-probability` | Aktuelles Sortier-Modell + Feature-Statistiken (Diagnose) | Token/Session |
| `POST /api/admin/lead-probability` | Modell sofort neu trainieren (Cache leeren) | Token/Session |
| `GET /api/admin/blacklist?search=&limit=&offset=` | Blacklist-Einträge (D-019) | Token/Session |
| `POST /api/admin/blacklist` `{phone, name?, email?, beruf?, reason?}` | Manuell zur Blacklist | Token/Session |
| `DELETE /api/admin/blacklist` `{ids?, phones?}` | Bulk-Entfernen | Token/Session |
| `DELETE /api/admin/blacklist/:id` | Einzel-Entfernen | Token/Session |
| `GET /api/admin/berufe` | Berufe-Master + Lead-Counts (D-021) | Token/Session |
| `POST /api/admin/berufe` `{name, plural_form?, is_active?}` | Neuer Beruf | Token/Session |
| `PATCH /api/admin/berufe/:name` `{rename?, plural_form?, is_active?}` | Umbenennen (Cascade auf leads.beruf) / Feld-Update | Token/Session |
| `DELETE /api/admin/berufe/:name[?clearLeads=true]` | Beruf entfernen, optional Leads auf NULL | Token/Session |
| `GET /api/admin/listen` | Alle Listen + Lead-Counts | Token/Session |
| `POST /api/admin/listen` `{list_name, display_name?, firma?, …}` | Neue Liste | Token/Session |
| `PATCH /api/admin/listen/:name` `{rename?, display_name?, firma?, …}` | Umbenennen / Branding-Update | Token/Session |
| `DELETE /api/admin/listen/:name[?clearLeads=true]` | Liste entfernen, optional Leads auf NULL | Token/Session |

**Write — Verteilung (⚠️ D-016)**

`POST /api/admin/distribute-leads` → Leads qualitäts-balanced verteilen.
```bash
curl -X POST https://4570-98.vercel.app/api/admin/distribute-leads \
  -H "Authorization: Bearer <ADMIN_API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"setterIds":["uuid1","uuid2"], "listName":"Heilpraktiker", "perSetterLimit":50, "includeAssigned":true, "statuses":["neu","angerufen"]}'
```
Body: `setterIds` (Pflicht), `listName`, `perSetterLimit`, `includeAssigned`, `statuses`.

**Write — Leads**

| Endpoint | Body / Query | Wirkung |
|---|---|---|
| `PATCH /api/admin/leads` | `{ leadIds, patch }` | Bulk-Update (Whitelist: name, phone, email, state, beruf, list_name, status, appointment_date, recall_date, notes, assigned_to ⚠️, closer_id, teams_link, call_attempts, last_call_attempt, archived) |
| `PATCH /api/admin/leads/:id` | gleiches patch-Objekt | Einzel-Update |
| `DELETE /api/admin/leads` | `{ leadIds, mode?: "archive"\|"hard", confirm? }` | Default: archivieren (soft). Hard-Delete nur mit `confirm: true` |
| `DELETE /api/admin/leads/:id?mode=hard&confirm=true` | — | Einzel-Delete/Archiv |

**Write — Stammdaten**

| Endpoint | Was |
|---|---|
| `POST /api/admin/closers` `{name,email,phone?,is_active?}` | Closer anlegen |
| `PATCH /api/admin/closers/:id` | Closer ändern |
| `DELETE /api/admin/closers/:id` | Closer löschen |
| `POST /api/admin/cluster-content` `{list_name, firma?, web?, kontakt_email?, tagline?, templates?}` | Upsert pro Liste |
| `PATCH /api/admin/profiles/:id` | Setter-Felder ändern (Whitelist: full_name, role, role_title, phone_direct, is_active, daily_goal, sound_enabled, custom_signature, use_custom_signature, teams_room_url, avatar_color) |
| `POST /api/admin/reset-rangliste` | Stats auf 0 (auch per Token) |

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
- **Lead-Qualitäts-Score** (`lib/lead-quality.ts`): Statische Heuristik — Bonus-Punkte für Handynummer (+3), echter Personenname (+2), weiblicher Vorname (+2), persönliche E-Mail (+1), freier Provider (+1). **Wird als Fallback** vom Probability-Score genutzt, wenn zu wenig Trainings-Daten da sind.
- **Lead-Probability-Score** (`lib/lead-probability.ts`, D-018): Lernt aus der `termin_gelegt`-Historie und sortiert Leads nach geschätzter Conversion-Wahrscheinlichkeit. Features: beruf, list_name, state, has_mobile, persönliche/Free-Provider-Mail, weiblicher Vorname, vollständiger Name. Cache 30 Min im Server-Prozess. Diagnose-Endpoint: `GET /api/admin/lead-probability`.

## 🟦 Cockpit

- **Zurück-Button** im Header (← navigiert zur vorherigen Lead-Karte).
- **Deck-Sortierung**: nie angerufene Leads zuerst, davon die mit der höchsten Termin-Wahrscheinlichkeit oben (Probability-Score, D-018). Wiedervorlagen vorne, „nicht erreicht" hinten.
- **Undo-Button** auf der Lead-Karte: letzte Aktion (Termin / Wiedervorlage / Nicht erreicht / Kein Interesse) rückgängig — Status + Datum-Felder werden in der DB zurückgesetzt, Cockpit springt zur Karte.
- **Post-Termin-Maske** schließbar (X oben rechts) zusätzlich zum „Weiter"-Button.

## 🟦 Lead-Slide-over (Setter-Lead-Liste)

- Nach gespeichertem Termin: einheitlicher **„📬 Termin bestätigen"**-Block — Closer-Benachrichtigung, dann E-Mail-Bestätigung, dann WhatsApp-Bestätigung. Die 4 alten WhatsApp-Varianten (24h, 3h, No-Show) sind entfernt.
- **Sortierung** der Lead-Liste serverseitig nach Probability-Score (`lib/lead-probability.ts`, D-018), im Hintergrund — **kein** sichtbarer Indikator in der UI.

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
