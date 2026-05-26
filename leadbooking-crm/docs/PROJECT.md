# PROJECT.md — Was bisher gebaut wurde

Lebendes Protokoll. Letzte Aktualisierung: **Mai 2026**.

Das CRM (`leadbooking-crm/`) ist eine Next.js 14 App auf Supabase, deployt via Vercel. Drei Rollen: **Admin**, **Setter**, **Closer/Advisor**.

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
- **Verteilen/Umstrukturieren per API-Token**: Derselbe Endpoint akzeptiert auch Bearer-Token-Auth (Env-Var `ADMIN_API_TOKEN`) und unterstützt `includeAssigned: true` zum Umverteilen bereits zugewiesener Leads sowie `statuses`-Filter. Schreibzugriffe via Service-Role-Client.

## 📄 Hilfs-Artefakte

- **PDF**: „E-Mail-Postfach einrichten" (STRATO) — Schritt-für-Schritt für MacBook / iPhone / Android. Wurde einmalig generiert und ausgeliefert.

## 🔧 Noch offen / zu beachten

- **Supabase-SQL einspielen** (einmalig, idempotent):
  - `supabase/leaderboard-timezone.sql` — Trigger auf Berlin-Zeit
  - `supabase/perf-upgrade.sql` — Indizes + RPC
- **Bekannte Schwachstellen** (separates Dokument): Undo zählt Statistik nicht zurück; Call-Button schreibt kein `activity_log` (→ Anrufe-Statistik untercountet); Streak ist „distinct days" statt „consecutive".
