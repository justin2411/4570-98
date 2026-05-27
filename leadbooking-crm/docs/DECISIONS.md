# DECISIONS.md — Architektur- und UX-Entscheidungen

Warum etwas so ist, wie es ist. Wenn eine Entscheidung später revidiert wird → Eintrag bleibt stehen, neue Entscheidung wird darunter ergänzt.

---

## D-001 · Zentrales Skript für alle Cluster (statt per-Cluster-Override)

**Entscheidung:** Das Gesprächs-Skript lebt zentral in `lib/script-template.ts` und wird über `{beruf}`/`{beruf_plural}`-Shortcodes personalisiert. Der frühere per-Liste-Editor (`cluster_content.script`) ist aus dem Admin entfernt.

**Warum:** Vermeidet Drift. Es gab den Fall, dass „Heilpraktiker" noch das alte Hebammen-Skript zeigte, obwohl der Default längst angepasst war.

**Tradeoff:** Per-Cluster-Anpassung des Skripts ist nicht mehr möglich. Branding/Mail-Vorlagen pro Cluster bleiben anpassbar.

---

## D-002 · Qualitäts-Score „soft", frische zuerst

**Entscheidung:** Im Cockpit-Deck **erst** `call_attempts asc` (nie angerufene zuerst), **dann** `leadQualityScore desc`. Soft-Sortierung — kein harter Filter, jeder Lead bleibt im Deck.

**Warum:** Frische Leads sind „zeit-sensibel" (Conversion fällt mit Wartezeit). Innerhalb der frischen kommt Qualität nach vorne. Setter sehen den Score nicht (→ D-009).

**Alternative verworfen:** „Qualität zuerst" — würde alte Leads mit hohem Score über frische lassen.

---

## D-003 · Firma-Brand `{beruf_plural}-Vorsorge` (Plural, nicht Singular)

**Entscheidung:** `resolveFirma(lead)` baut die Firma aus dem Beruf-**Plural** („Heilpraktiker-Vorsorge", „Hebammen-Vorsorge").

**Warum:** Matched die etablierte Marke „Hebammen-Vorsorge". Singular hätte „Hebamme-Vorsorge" ergeben (ungewohnt).

**Tradeoff:** Bei manchen Berufen klingt der Plural sperrig („Coaches-Vorsorge"). Kann jederzeit per Cluster überschrieben werden, falls gewünscht.

---

## D-004 · Daten-Operationen NICHT vom Agent direkt

**Entscheidung:** Claude Code löscht/aktualisiert keine Produktiv-Daten in Supabase direkt. Für destruktive Operationen liefert der Agent fertig getestetes SQL oder baut einen Admin-Button.

**Warum:** Sicherheit. Diese Umgebung hat keine DB-Credentials, und selbst wenn — Produktiv-Daten ändern ohne Bestätigung wäre fahrlässig.

**Konsequenz:** Für „Ranglisten auf 0" gibt es jetzt einen **Admin-Button** auf `/admin/rangliste` (`POST /api/admin/reset-rangliste`).

---

## D-005 · Single Dev-Branch + Squash-Merge

**Entscheidung:** Alle Entwicklung läuft auf **`claude/brave-galileo-n3x6e`**. Jeder PR wird per **Squash** in `main` gemerged.

**Warum:** Vorgabe der Remote-Umgebung. Vorteil: saubere `main`-Historie (ein Commit pro Feature).

**Konsequenz:** Nach jedem Squash-Merge wird der Dev-Branch per `git reset --soft origin/main` neu aufgesetzt und mit `--force-with-lease` zurück-gepusht. Sicher, weil der Branch immer schon gemerged ist.

---

## D-006 · `BERUF_PLURAL`-Map bleibt im Code

**Entscheidung:** Die Beruf→Plural-Zuordnung (`Hebamme→Hebammen`, `Osteopath→Osteopathen` …) lebt als Konstante in `lib/script-template.ts`, nicht in der DB.

**Warum:** Plural-Bildung ist sprachlich und braucht keine Admin-UI. Code-Deploy reicht zum Erweitern.

---

## D-007 · Zeitzone überall `Europe/Berlin`

**Entscheidung:** Alle Tages-/Wochen-/Monatsgrenzen werden in Berlin-Zeit gerechnet — Client (Cockpit, Dashboard, Rangliste) und DB-Trigger (`refresh_leaderboard_cache`).

**Warum:** „Heute" wechselte vorher um 01–02 Uhr deutscher Zeit (UTC). Verwirrt nahe Mitternacht.

**Konsequenz:** Beim Wechsel muss einmal `supabase/leaderboard-timezone.sql` ausgeführt werden, damit Client und Cache übereinstimmen.

---

## D-008 · Schlanke Signatur: nur Name + Rolle

**Entscheidung:** Mail-/WhatsApp-Signaturen geben ausschließlich `{Name}\n{Rolle}` aus (Default-Rolle „Beratungsteam"). Kein Kontakt-Block, keine Domain, keine Tagline.

**Warum:** Kontakt-Domain (`hebammen-vorsorge.de`) passt nicht zu jeder Berufsgruppe; Tagline ist redundant zum Body. Setter müssen sich nicht um Signaturen kümmern.

---

## D-009 · Qualitäts-Ranking NICHT sichtbar für Setter

**Entscheidung:** Sortierung passiert serverseitig im Hintergrund. **Kein** sichtbarer Score/Badge/Tier auf der Lead-Karte. Jeder Lead sieht gleich aus.

**Warum:** „Jeder Lead ist wertvoll" — Setter sollen nicht psychologisch „erste schon abgehakt"-getriggert werden. Die optimale Reihenfolge passiert silent.

---

## D-010 · Namens-Bereinigung in DB UND beim Anzeigen

**Entscheidung:** `cleanLeadName` läuft beim **Excel-Import** (saubere DB-Daten ab nächstem Upload) **und** beim **Anzeigen/Versenden** (deckt auch Altbestand ab).

**Warum:** Beim Import allein würden alte Datensätze hässlich bleiben. Beim Anzeigen allein bleibt die DB schmutzig (Probleme bei Such-Indizes).

---

## D-011 · `select('*')`-Trimmen bewusst NICHT durchgezogen

**Entscheidung:** Komponenten laden Leads weiterhin mit `select('*')`, statt nur die benötigten Spalten.

**Warum:** Lead-Komponenten referenzieren viele Felder (`(lead as any).beruf`, `teams_link`, `closer_id` …). Aggressives Trimmen birgt Regressionsrisiko bei mageren Payload-Gewinnen.

---

## D-012 · UI-Crashs durch Off-by-One bei Index-Arrays

**Lesson Learned:** Beim Entfernen eines Nav-Eintrags hat die mobile Bottom-Nav fest verdrahtet auf `links[5]` zugegriffen → undefined → React-Crash auf allen Setter-Seiten am Handy.

**Konsequenz:** Bei UI-Strukturänderungen Index-basiertes Slicing vermeiden, lieber per `.filter()`/`.find()` arbeiten. Außerdem: künftig Preview-Deploy testen, bevor gemerged wird (Typecheck reicht nicht für Render-Crashs).

---

## D-013 · Lead-Verteilung auf Setter — Quality-balanced Round-Robin ✅

**Umgesetzt:** Unzugeordnete Leads werden nach `leadQualityScore` sortiert und reihum auf die ausgewählten Setter verteilt. Optional: nur eine Liste, mit Max-Cap pro Setter.

**Warum:** Jeder Setter bekommt einen ähnlichen Mix aus Top- und Standard-Leads. Verhindert, dass ein Setter alle „Filet-Stücke" abbekommt.

**Endpoint:** `POST /api/admin/distribute-leads` (admin-only).
**UI:** Button auf `/admin/leads` + Dialog (Setter-Mehrfachauswahl, Listen-Filter, Limit).

---

## D-014 · Schmaler Admin-API-Token statt Service-Role-Key im Agent ✅

**Entscheidung:** Statt dem Agent (Claude Code) den Supabase Service-Role-Key zu geben, gibt es einen **schmalen Bearer-Token** (`ADMIN_API_TOKEN` env var), der genau die exponierten Admin-Endpoints triggern kann (`distribute-leads`, `setters`, perspektivisch weitere). DB-Schreibzugriffe laufen serverseitig via `createAdminClient` (Service-Role).

**Warum:** Minimale Angriffsfläche. Der Token kann ausschließlich die definierten Endpoints; nicht die ganze DB. Token ist jederzeit revoke-bar (Env-Variable in Vercel ändern + Redeploy). Kein DB-Root-Key im Chat.

**Wo gesetzt:** Vercel → Project Settings → Environment Variables → `ADMIN_API_TOKEN` (Production) — Wert ist ein langer Random-String.

**Wie genutzt:** `curl -H "Authorization: Bearer <TOKEN>" -X POST <url>/api/admin/distribute-leads -d '...'`.

**Status:** Live & verifiziert (Mai 2026). Auth funktioniert, Service-Role-Writes laufen sauber durch.

---

## D-016 · „Nicht erreicht" und „Kein Interesse" entfernen Leads endgültig aus dem Cockpit

**Entscheidung:** Beide Aktionen blenden den Lead **dauerhaft** aus dem Cockpit-Deck aus. Kein Auto-Recall mehr für „Nicht erreicht" (`recall_date` wird auf `null` gesetzt). Wenn der Setter ein erneutes Probieren will, muss er bewusst die Aktion „Wiedervorlage" mit Datum/Uhrzeit wählen.

**Warum:** Setter haben sich beschwert, dass auf „Nicht erreicht" gesetzte Leads kurz darauf wieder oben auftauchen — verwirrend und ineffizient. Der frühere Auto-Recall (+2h/+4h/morgen) lief still im Hintergrund, ohne dass der Setter es entschieden hat. Mit dieser Änderung ist die Entscheidung explizit: einmal „nicht erreicht" = aus dem Deck. „Wiedervorlage" bleibt der explizite Recall-Knopf.

**Konsequenz für die DB:** `nicht_erreicht`-Leads bleiben in der DB (für Reporting/Admin sichtbar), sind aber nicht mehr im Setter-Cockpit. Können bei Bedarf vom Admin neu verteilt werden (mit `statuses: ['nicht_erreicht']` im distribute-leads-Call).

**Defensive Verbesserung:** Die Status-Updates verifizieren jetzt per `.select('id')` zurück, dass wirklich eine Zeile betroffen war — silente RLS-Rejections werfen jetzt einen sichtbaren Toast (statt das Lead zurückkehren zu lassen).

---

## D-015 · Read-Endpoint `GET /api/admin/setters` für Agent-Übersicht

**Entscheidung:** Neben dem write-Endpoint (`distribute-leads`) gibt es einen read-Endpoint, der Setter-IDs, Namen, E-Mails sowie aktuelle Lead-Last + unzugeordnete-pro-Liste liefert.

**Warum:** Der Agent braucht IDs (nicht nur Namen) für eine zielgerichtete Verteilung. Außerdem sieht er sofort, ob „verteilen" überhaupt was zu tun hat (unzugeordnete) bzw. wo die Last unausgewogen ist.

**Auth:** Gleicher Bearer-Token wie `distribute-leads`. Token-Scope bleibt bewusst eng (nur diese paar Admin-Endpoints).

---

## D-016 · 🛑 Goldene Regel — Lead-Zuweisung nur mit Bestätigung

**Entscheidung:** Der Agent (Claude Code, oder welche Instanz auch immer) vergibt **niemals** Leads ohne ausdrückliche Bestätigung des Users im laufenden Chat.

**Geltungsbereich:** alle schreibenden Endpoints, die `assigned_to` ändern können:
- `POST /api/admin/distribute-leads` (gesamte Verteilung / Umverteilung)
- `PATCH /api/admin/leads` mit `assigned_to` im patch (Bulk-Re-Assignment)
- `PATCH /api/admin/leads/:id` mit `assigned_to` im patch (einzeln)

**Warum:** Lead-Zuweisungen sind operativ teuer und psychologisch sensibel — falsche Verteilung führt sofort zu Reibung mit Settern, einer falschen Round-Robin-Reihenfolge sieht man die Auswirkung erst Tage später. Eine „zu schnelle" Zuweisung ist nicht reversibel ohne dem nächsten Setter wieder Leads wegzunehmen.

**Was bleibt erlaubt ohne Rückfrage:**
- Alle Read-Endpoints
- Status-Updates ohne `assigned_to`-Änderung
- Archivieren / Reaktivieren von Leads (Daten bleiben beim Owner)
- Branding/Vorlagen (`cluster_content`), Closer-CRUD, Profil-Settings

**Operationaler Check:** Bevor der Agent einen `assigned_to`-Write absetzt, muss im aktuellen Chat eine eindeutige Bestätigung des Users vorliegen (z. B. „mach das jetzt so", „grünes Licht"). Eine vor Tagen erteilte Erlaubnis zählt nicht für eine neue Verteilung.

---

## D-017 · Erweiterte Admin-API-Surface für den Agent

**Entscheidung:** Der Agent bekommt einen breiten Satz Admin-Endpoints, alle unter demselben `ADMIN_API_TOKEN`. Damit kann er praktisch jede Admin-Operation aus dem UI auch programmatisch erledigen.

**Endpoints (alle Bearer-Token-fähig):**
- `GET /api/admin/setters` — Setter-Last (D-015)
- `POST /api/admin/distribute-leads` — Verteilung (D-013/D-014) ⚠️ siehe D-016
- `GET /api/admin/leads` — Liste mit Filtern (status, assignedTo, listName, search, archived, limit/offset)
- `GET /api/admin/leads/:id` — Einzel-Lead + activity_log
- `PATCH /api/admin/leads` — Bulk-Update (Spalten-Whitelist) ⚠️ `assigned_to` siehe D-016
- `PATCH /api/admin/leads/:id` — Einzel-Update ⚠️ `assigned_to` siehe D-016
- `DELETE /api/admin/leads` + `DELETE /api/admin/leads/:id` — Archivieren (soft, default) oder Hard-Delete (`mode=hard` + `confirm=true`)
- `GET /api/admin/stats` — Aggregate (groupBy: status, assigned_to, list_name, archived)
- `GET|POST /api/admin/closers` + `PATCH|DELETE /api/admin/closers/:id` — Closer-CRUD
- `GET|POST /api/admin/cluster-content` — Branding/Vorlagen pro Liste
- `GET /api/admin/profiles` + `PATCH /api/admin/profiles/:id` — Setter aktivieren/deaktivieren, Profil-Felder ändern
- `POST /api/admin/reset-rangliste` — Stats auf 0 (auch per Token, vorher nur Session)

**Sicherheits-Leitplanken:**
- Auth-Logik zentral in `lib/admin-auth.ts` (`checkAdminAuth(req)`)
- Spalten-Whitelist beim PATCH — `id`, `created_at`, `updated_at`, `email` (für profiles) bleiben tabu
- Hard-Delete nur mit explizitem `mode: "hard"` + `confirm: true`
- Token bleibt schmal — wer ihn hat, kann _diese_ Endpoints, nicht die ganze DB
- Goldene Regel D-016 als organisatorische Leitplanke obenauf

**Tradeoff:** Mehr Code-Surface = mehr Fläche, die gepflegt werden will. Akzeptabel, weil jeder Endpoint die DRY-Auth nutzt und sich an dieselben Patterns hält.

---

## D-018 · Lead-Sortierung lernt aus `termin_gelegt`-Historie (Probability-Score)

**Entscheidung:** Die zentrale Lead-Sortierung läuft ab jetzt über einen **gelernten Probability-Score** (`lib/lead-probability.ts`) statt über die statische `leadQualityScore`-Heuristik. Höher = höhere geschätzte Conversion-Wahrscheinlichkeit auf einen Termin.

**Trainings-Signal:** Die DB selbst.
- Positiv-Klasse: Leads mit `status ∈ {termin_gelegt, termin_stattgefunden}`
- Negativ-Klasse: Leads mit `status = kein_interesse`
- Unlabeled (gehen nicht ins Training): `neu`, `angerufen`, `nicht_erreicht`, `wiedervorlage`

**Features (bewusst keine Anruf-Historie):** beruf, list_name, state, has_mobile (+49 15x/16x/17x), has_personal_email, is_female_name, has_free_provider_email, has_full_name.

**Mathematik:** Per Feature-Wert geglättete Conversion-Rate (Laplace α=β=1), Score = Summe der log-Uplifts gegen Baseline. Klassisches Naive-Bayes-light, robust gegen kleine Stichproben.

**Caching:** In-Memory-Singleton im Node-Prozess, TTL 30 Min. Bei zu wenigen Labeled-Leads (< 10) oder DB-Fehler sauberer Fallback auf statische `leadQualityScore`.

**Sichtbarkeit:** Silent (D-009 bleibt — Setter sehen keinen Score). Sortierung passiert serverseitig.

**Diagnose:** `GET /api/admin/lead-probability` liefert das aktuelle Modell als JSON inklusive Feature-Statistiken; `POST` erzwingt Neutraining.

**Wo verwendet:** Cockpit-Deck, Setter-Leadliste, Admin-Leadliste, `distribute-leads` (Verteilung), Admin-API (`withScore`-Flag).

**Tradeoff:** Mehr Komplexität als die alte Heuristik, dafür lernt das System aus echten Abschlüssen. Wenn die Stichprobe sehr klein ist (z. B. nach einem `reset-rangliste`), greift automatisch der Fallback — kein Bruch.

---

## D-019 · Persistente Blacklist für Terminal-States

**Entscheidung:** Jeder Lead, der in einen Terminal-Status wechselt — **`kein_interesse`**, **`termin_gelegt`** oder **`termin_stattgefunden`** — landet automatisch auf einer zentralen `blacklist`-Tabelle (Key = normalisierte Telefonnummer). Die Blacklist überlebt das Löschen des Lead-Datensatzes; re-importierte Telefonnummern werden beim Insert sofort auf `kein_interesse` gesetzt — sie tauchen nirgends mehr im aktiven Pool auf.

**Warum:** „Wir rufen niemanden zweimal an" — weder einen, der abgelehnt hat, noch einen, dem bereits ein Termin angeboten wurde. Frühere Implementierung verlässt sich auf `leads.status` — sobald der Lead per Hard-Delete oder Excel-Reimport neu in der Tabelle landet, wäre er als „neu" wieder im Pool. Die Blacklist macht die Ablehnung/Terminierung **persistent über den Lead-Lebenszyklus hinaus**. Das ist besonders wichtig bei großen Bereinigungen („alle Leads löschen + neu importieren").

**Umsetzung:**
- Tabelle `blacklist` (id, phone UNIQUE normalisiert, email, name, beruf, original_lead_id mit ON DELETE SET NULL, **reason** = einer von `kein_interesse`/`termin_gelegt`/`termin_stattgefunden`, created_at, created_by).
- DB-Trigger `AFTER INSERT OR UPDATE OF status ON leads` → idempotenter INSERT in `blacklist` bei jedem Terminal-Status.
- DB-Trigger `BEFORE INSERT ON leads` → wenn Phone in Blacklist, `NEW.status := 'kein_interesse'` (Defense in Depth gegen Re-Import — uniformer Marker, originaler Reason bleibt im Blacklist-Eintrag erhalten).
- Helper `lib/blacklist.ts` mit 5-Min-Cache + `filterBlacklistedLeads()`.
- `distribute-leads` filtert Blacklist vor dem Round-Robin (Antwort enthält `skippedBlacklisted`-Count).
- Cockpit-Deck filtert Blacklist als zusätzliche Sicherung.
- SQL: `supabase/blacklist-setup.sql` — idempotent, einmal in Supabase einspielen. Backfill umfasst alle drei Terminal-States.

**Sichtbarkeit / Findbarkeit:**
- Setter sieht `kein_interesse`-Leads **nicht im Default-Listenview** (`/setter/leads`).
- Setter-**Suche zeigt sie trotzdem** — damit Rückrufer eines blacklisteten Leads zuordenbar sind („Ah, der ruft nochmal an — der wollte ja nicht").
- Admin: `GET /api/admin/blacklist` mit Search-Filter, `POST` zum manuellen Hinzufügen, `DELETE /api/admin/blacklist/:id` zum Entfernen (für Korrekturen).

**Tradeoff:** Eine versehentliche `kein_interesse`-Aktion wandert sofort in die Blacklist und ist nur per Admin reversibel. Das ist gewollt — bewusste Friktion, damit nichts unbemerkt aus der Blacklist verschwindet.

---

## D-020 · Lösch-Schutz für Termine + Wiedervorlagen

**Entscheidung:** Leads mit `status` in `{termin_gelegt, termin_stattgefunden, wiedervorlage}` können nicht hart gelöscht werden — weder per App-DELETE noch per SQL. DB-Trigger raised `restrict_violation` bei jedem `DELETE`-Versuch.

**Warum:** Diese drei Stati repräsentieren aktive Verpflichtungen — vereinbarte Termine, gehaltene Termine (Closer-Übergabe), zukünftige Rückrufe. Eine pauschale „alle Leads löschen"-Aktion (z. B. vor einem frischen Excel-Import) darf diese Vereinbarungen niemals wegwerfen. Das Risiko: ein Setter hat sich Mühe mit einem Termin gemacht, und ein Bulk-Cleanup macht die Arbeit zunichte.

**Umsetzung:**
- DB-Trigger `BEFORE DELETE ON leads` → raised mit klarem Fehlertext, sobald `OLD.status` einer der drei geschützten Werte ist.
- App-DELETE-Endpoints (`DELETE /api/admin/leads` + `/:id`) filtern geschützte Leads vorab und liefern `skippedProtected`-Count zurück (graceful Bulk-Delete statt Trigger-Exception).
- DB-Trigger bleibt aktiv als Sicherheitsnetz — selbst direkter SQL-DELETE im Supabase-Editor wird abgefangen.

**Wer löschen will:** Status erst explizit ändern (`kein_interesse`, oder `archived=true`). Bewusste Friktion = bewusster Eingriff.

**Tradeoff:** Bulk-Löschen wird zweigleisig (offene Leads → weg, Termine/Wiedervorlagen → bleiben). Akzeptabel — Termine sind selten genug, dass die manuelle Trennung kein Aufwand ist; und wenn doch nötig, Status ändern → löschen.

---

## D-021 · Berufe + Listen als verwaltbare Entitäten („Struktur")

**Entscheidung:** Berufe und Listen werden zu first-class entities mit eigener Admin-UI (`/admin/struktur`). Beide haben CRUD-APIs, Lead-Counts, Aktiv-Flag, optionalen Anzeigenamen. Berufe haben zusätzlich eine editierbare Plural-Form (ersetzt langfristig die hardcoded `BERUF_PLURAL`-Map in `lib/script-template.ts`).

**Warum:** Vorher waren Berufe nur Free-Text-Strings auf `leads.beruf`, Listen nur `list_name`-Strings mit optionalem `cluster_content`-Eintrag. Umbenennen/Löschen war manuelle SQL-Arbeit, Plural-Verwaltung lag im Code. Mit der Struktur-UI kann der Admin:
- Listen anlegen, umbenennen (inkl. Cascade auf `leads.list_name`), Branding/Templates editieren, deaktivieren, löschen (mit Option `leads.list_name=NULL`).
- Berufe anlegen, umbenennen (Cascade auf `leads.beruf`), Plural-Form pflegen, deaktivieren, löschen.

**Umsetzung:**
- DB: neue Tabelle `berufe(name PK, plural_form, is_active, …)`. `cluster_content` ergänzt um `is_active` + `display_name`.
- Trigger `upsert_beruf_master` auf `leads`: neue beruf-Werte landen automatisch in der Master-Tabelle (Excel-Import braucht kein UI-Lock).
- APIs: `GET/POST /api/admin/berufe`, `PATCH/DELETE /api/admin/berufe/:name`, dito `/listen`.
- UI: `/admin/struktur` — Ordner-Layout mit Karten, Suche, Modal-CRUD, Lead-Counts pro Karte. Nav-Eintrag „Struktur" zwischen „Leads" und „Inhalte".
- `/admin/inhalte` bleibt vorerst bestehen (per-Cluster Template-Editor); langfristig könnte das in `/admin/struktur` integriert werden.
- SQL: `supabase/struktur-setup.sql` — idempotent, einmal in Supabase einspielen, enthält Backfill aus `leads.beruf` + bekannte Plural-Formen aus dem Code.

**Tradeoff:** Doppelte Wahrheit (Berufe-Master + Free-Text auf Leads) — gelöst per Trigger, der die Master-Liste auto-aktuell hält. Listen-Rename ist nicht atomar (cluster_content + leads-Update in zwei Statements), aber idempotent und für die Größenordnung unkritisch.
