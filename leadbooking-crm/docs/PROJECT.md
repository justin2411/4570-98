# PROJECT.md — Was bisher gebaut wurde

Lebendes Protokoll. Letzte Aktualisierung: **Juni 2026** (Stand: PR #55 gemerged).

Das CRM (`leadbooking-crm/`) ist eine Next.js 14 App auf Supabase, deployt via Vercel. Drei Rollen: **Admin**, **Setter**, **Closer/Advisor**.

---

## 📍 Zwischenstand — Juni 2026 (post #55)

- ✅ **„Meine Leads" paginiert vollständig** (D-034, PR #55) — `app/setter/leads/page.tsx` lädt zugewiesene Leads über `fetchAllRows()` statt nacktem `.select()`. Behebt: Setter mit >1000 Leads (Robert: 1.072) sahen zuletzt zugewiesene Berufe (Doula) nur im Cockpit, nicht unter „Meine Leads".
- ✅ **Cockpit-Chip-Counts vollständig** (Folge-PR zu D-034) — `berufAggregate` in `app/setter/cockpit/page.tsx` lädt jetzt ebenfalls über `fetchAllRows()`; Counts stimmen auch bei >1000 offenen Leads.

## 📍 Zwischenstand — Mai 2026 (post #51)

**Setter-System läuft, Branding ist berufsneutral, Cockpit ist auf gezielte Zielgruppen-Arbeit + persistente Blacklist + High-Potential-Pflege ausgebaut. Aufräum-Welle A→D abgeschlossen + Setter-UX/Persistenz (#48–#51).**

- ✅ **Anruf-Persistenz** (D-030) — Call-Button schreibt via `keepalive` an `POST /api/setter/log-call`; Status/Anruf gehen beim App-Close nicht mehr verloren.
- ✅ **Deck-Position gemerkt** (D-031) — Cockpit startet beim Reopen dort, wo der Setter war (Lead-ID, pro Scope, localStorage).
- ✅ **Termin „stattgefunden" bestätigen** (D-032) — Termin-Ergebnis-Block im Termine-Modal (+ „Nicht erschienen").
- ✅ **Bereinigt-Listen-Workflow** (D-033) — Status-Spalte: `sicher` behalten/verteilen, `unsicher`/`bitte prüfen`/`kein Name` hart löschen; normalisierter Telefon-Abgleich.
- ✅ **Normalisierte Dublettenerkennung beim Import** (D-027) — Excel + Bulk gleichen über `normalizePhoneKey` gegen bestehende Leads + Blacklist ab; gleiche Nummer in anderer Schreibweise wird erkannt.
- ✅ **Voller Bestand statt 1000-Deckel** (D-028) — `fetchAllRows` in Stats/Verteilung/Score; Zahlen + Verteilung jetzt vollständig.
- ✅ **Beruf-balancierte Verteilung + serverseitiger Hebammen-Freeze** (D-029) — `balanceByBeruf` / `excludeBeruf` + Checkbox im Verteilen-Dialog.
- ✅ **Statistik konsistent** — Call-Button schreibt `activity_log`, Undo zählt zurück; Cockpit-Index-Bugs behoben.
- ✅ **Security/Hygiene** — `tsc --noEmit` 0 Fehler, `reset-password` admin-only, Such-Injection escaped, Auth zentral + timing-safe.
- ✅ `kein_interesse` nur per individueller Suche findbar (nicht mehr als Massen-Filter in der Lead-Liste).
- ✅ Berufsneutrales zentrales Skript (Hook + alle Einwände, `{beruf}`/`{beruf_plural}`)
- ✅ Cockpit: Zielgruppen-Switcher (Beruf-Chips), „⭐ High Potential"-Tab (D-024), „📱 Nur Handys"-Filter (D-023), Default-Deck leer (D-022), Terminal-Action entfernt Lead lokal aus Deck (D-026)
- ✅ Lead-Sortierung lernt aus `termin_gelegt`-Historie (Probability-Score, D-018) — Handys-First als zusätzliches Tie-Break (D-023)
- ✅ Persistente Blacklist (D-019) — alle drei Terminal-States (kein_interesse / termin_gelegt / termin_stattgefunden) landen idempotent in `blacklist`, überleben Hard-Delete + Re-Import
- ✅ Lösch-Schutz (D-020) für Termine + Wiedervorlagen — DB-Trigger fängt jeden DELETE ab
- ✅ Struktur-Hub (D-021): Berufe + Listen als first-class Entities (`/admin/struktur`)
- ✅ Lead-Slide-over mit einheitlichem „Termin bestätigen"-Block (Closer + Mail + WhatsApp)
- ✅ WhatsApp-Link-Normalisierung (15/15 getestet), schlanke Mail-/WhatsApp-Signaturen
- ✅ Rangliste/Statistiken in Europe/Berlin-Zeit, Reset-Button im Admin
- ✅ Admin-UI für Lead-Verteilung + Programmatic API (`POST /api/admin/distribute-leads`)
- ✅ Token-fähiger Bulk-Import (D-025): `POST /api/admin/leads/bulk` mit Dedupe gegen DB + Blacklist
- ✅ Breite Admin-API-Surface unter `ADMIN_API_TOKEN` (D-017) — Leads, Stats, Blacklist, Berufe, Listen, Profile, Closer, Cluster-Content
- ✅ XI CRM Branding (Browser-Tab + PWA)
- ✅ Vier lebende Docs (PROJECT/DECISIONS/WORKFLOW/HANDOVER)

**Aktuelle Setter-Last (Snapshot post #40):**

| Setter | offene Leads |
|---|---:|
| Nico Sidorenko | 748 🔴 |
| Elias Sanetra | 602 |
| Jonas Tamele | 462 |
| Emma-Antonia Tischler | 445 |
| Natascha Lehmann | 417 |
| Lukas Rausendorf | 376 |
| Justin Koch | 249 |
| Christian Mende | 0 🟢 |
| **Σ offen** | ~3.300 |
| Unzugeordnet | siehe `GET /api/admin/setters` |
| Gesamt-Leads (DB) | 8.043 |
| `prio_a=true` | 48 (alle bei Lukas Rausendorf, kuratierte Premium-Liste) |
| Blacklist-Einträge | 326 |

**Noch offen (DB-Schritte vom User in Supabase):**
- `supabase/leaderboard-timezone.sql` — Trigger auf Europe/Berlin
- `supabase/perf-upgrade.sql` — Indizes + RPC
- `supabase/blacklist-setup.sql` — Blacklist-Tabelle + Trigger (D-019) + Lösch-Schutz (D-020)
- `supabase/struktur-setup.sql` — Berufe-Master + cluster_content-Erweiterungen (D-021)

**Bekannte Schwachstellen (nicht akut):**
- Closer-Zuweisung erfolgt vor Mail-Versand (bei Abbruch trotzdem gesetzt)
- _(behoben in #44–#47: 1000-Deckel, Undo-/Call-Statistik, tsc-Gate, reset-password/Such-Injection; Streak war bereits consecutive)_

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
| `GET /api/admin/leads?status=&assignedTo=&listName=&search=&archived=&prio=&limit=&offset=&orderBy=&withQuality=` | Lead-Liste mit Filtern (inkl. optionalem Quality-Score; `prio=true` → nur `prio_a=true`) | Token/Session |
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
| `PATCH /api/admin/leads` | `{ leadIds, patch }` | Bulk-Update (Whitelist: name, phone, email, state, beruf, list_name, status, appointment_date, recall_date, notes, assigned_to ⚠️, closer_id, teams_link, call_attempts, last_call_attempt, archived, **prio_a**) |
| `PATCH /api/admin/leads/:id` | gleiches patch-Objekt | Einzel-Update |
| `POST /api/admin/leads/bulk` (D-025) | `{ leads: [{name, phone, email?, state?, beruf?, list_name?, prio_a?, …}] }` | Bulk-Insert mit Dedupe gegen DB+Blacklist (normalisierte Phone); Response: `{inserted, skipped, skippedBlacklisted}` |
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
- **Zielgruppen-Switcher (Chip-Reihe oben):** Setter wählt aktiv Beruf-Filter (z. B. „Physiotherapeut") oder Sondertab. Default-Deck ist leer (D-022). Beruf-Switch forciert vollen Remount via React-`key`.
- **„⭐ High Potential"-Tab (D-024):** zeigt ausschließlich `prio_a=true`-Leads über alle Berufsgruppen. Tab wird nur eingeblendet, wenn der Setter solche Leads zugewiesen hat. Pflege per Admin-PATCH.
- **„📱 Nur Handys"-Filter (D-023):** Toggle reduziert das Deck strikt auf Mobilfunk-Nummern (`+49 15x/16x/17x`).
- **Deck-Sortierung:** nie angerufene zuerst → **Handynummern zuerst** (D-023) → Probability-Score (D-018) → Lead-Score. Setter sehen die Sortier-Signale nicht (D-009).
- **Terminal-Actions entfernen den Lead aus dem Deck (D-026):** „Nicht erreicht / Kein Interesse / Termin / Wiedervorlage" → Lead wird sofort lokal aus dem `deck`-Array entfernt und kann nicht mehr per `goBack` oder Reload zurückkommen.
- **Defensiver Frontend-Filter (D-026):** `useState`-Initializer filtert beim Mount nochmal strikt auf `status ∈ {neu, angerufen, wiedervorlage}` — Sicherheitsnetz gegen Stale-Server-Caches.
- **Undo-Button** auf der Lead-Karte: letzte Aktion (Termin / Wiedervorlage / Nicht erreicht / Kein Interesse) rückgängig — Status + Datum-Felder werden in der DB zurückgesetzt, der Lead wird an seine alte Position im Deck zurückgesetzt.
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
  - ✅ `supabase/blacklist-setup.sql` — **eingespielt** (D-019/D-020 live, 326 Einträge)
  - `supabase/leaderboard-timezone.sql` — Trigger auf Berlin-Zeit (offen)
  - `supabase/perf-upgrade.sql` — Indizes + RPC (offen)
  - `supabase/struktur-setup.sql` — Berufe-Master (offen)
- **Setter-Namen ≠ E-Mail** (B3, offen): Anzeigenamen weichen von den Accounts ab — evtl. bewusste Anruf-Pseudonyme, vor Korrektur klären.
- **Bekannte Schwachstellen** (separates Dokument): Closer-Zuweisung vor Mail-Versand.
