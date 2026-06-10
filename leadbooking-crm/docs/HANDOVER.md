# HANDOVER.md — Übergabeprotokoll

**Stand:** Juni 2026 (post #55)
**Projekt:** XI CRM (`leadbooking-crm/`) auf Next.js 14 + Supabase + Vercel
**Repo:** `justin2411/4570-98`
**Dev-Branch:** wechselt pro Session (z. B. `claude/adoring-rubin-HaFmI`, `claude/brave-galileo-n3x6e` …) — wird vom Web-Harness pro Session generiert. **Immer aktuellen Branch aus der Session-Konfiguration nehmen, nicht hier hardcoden.** Aktuelle Session: `claude/loving-shannon-i1sh77`.
**Production:** https://4570-98.vercel.app
**Letzter Merge:** PR #55 („Meine Leads" paginiert vollständig, D-034)

---

## 🎯 Wo wir stehen

**Setter-System läuft live.** Branding ist von „Hebammen-Vorsorge" auf neutrales „XI CRM" + dynamische berufsspezifische Texte (`{beruf_plural}-Vorsorge`) umgestellt. Cockpit, Lead-Liste, Termin-Bestätigung, Mail-/WhatsApp-Vorlagen, Rangliste, Lead-Verteilung — alles fertig.

**22 PRs in dieser Session** wurden gemerged und sind in `main`.

---

## 🔑 Zugänge & Tokens

| Ressource | Wo | Was zu wissen |
|---|---|---|
| **Vercel-Projekt** | vercel.com/deinetop5-4098s-projects/4570-98 | Auto-Deploy von `main` |
| **Supabase** | Dashboard via supabase.com | Tabellen: `profiles`, `leads`, `activity_log`, `leaderboard_cache`, `cluster_content`, `closers` |
| **`ADMIN_API_TOKEN`** | Vercel → Environment Variables (Production) | Aktiv & getestet. Wert kennt der User (war im Chat). Bei Bedarf rotieren: neuen Wert in Vercel setzen + Redeploy. |
| **`SUPABASE_SERVICE_ROLE_KEY`** | Vercel → Environment Variables | Server-side für admin-Operations |
| **GitHub MCP** | Claude Code | Beschränkt auf Repo `justin2411/4570-98`. **OAuth-Token läuft pro Session ab** — bei „requires re-authorization" den Connector im Web-UI neu verbinden (kein PAT nötig). |

⚠️ Der Claude-Code-Agent hat **keinen** direkten DB-Zugriff. Für Daten-Operationen entweder Admin-Button im UI oder den Token-geschützten API-Endpoint.

---

## 🛑 Goldene Regel — Lead-Zuweisung (D-016)

**Der Agent vergibt NIEMALS Leads ohne ausdrückliche Bestätigung im Chat.**

Das gilt für alle schreibenden Endpoints, die `assigned_to` ändern können:
- `POST /api/admin/distribute-leads`
- `PATCH /api/admin/leads` (wenn `assigned_to` im patch ist)
- `PATCH /api/admin/leads/:id` (wenn `assigned_to` im patch ist)

Auch wenn der User vorher schon mal verteilt hat: **jedes neue Verteilen, Umverteilen, Einzel-Re-Assignment muss vorher kurz gegengezeichnet werden** („soll ich das jetzt so verteilen?"). Read-only ist immer ok. Status-Updates ohne `assigned_to`-Änderung sind ok.

---

## ❄️ Hebammen-Leads eingefroren (gesetzt 27.05.2026)

**Hebammen-Leads sind eingefroren bis ~Ende August 2026.** Nicht anfassen — gilt für **Verteilung** und **Optimierung**.

Konkret:
- Bei `distribute-leads` Hebammen per `beruf` ausschließen (nicht in den Verteil-Pool).
- Bei jeglicher Statistik / Funnel-Analyse / Probability-Score-Auswertung Hebammen separat ausweisen, nicht in die Headline mischen.
- Bei Bulk-Status-Aktionen / Re-Assignments / Score-Optimierungen: Hebammen rausfiltern.

**Filter (SQL):** `LOWER(TRIM(beruf)) LIKE 'hebamm%'` — deckt `Hebamme` (kanonisch, `BERUF_PLURAL`-Key) und `Hebammen` (Plural, kommt per Excel-Import vor) ab.

**Filter (Token-API):** Sobald PR #25 in `main` ist, beim `distribute-leads` keinen `beruf`-Filter haben → entweder pro Liste verteilen (Hebammen-Cluster auslassen) oder vorab über `GET /api/admin/leads?listName=…` prüfen, dass die Ziel-Listen keine Hebammen enthalten.

Die Funnel-Baseline-Query (`supabase/funnel-baseline.sql`) hält sich daran: Headline = ohne Hebammen, separate `HEBAMMEN`-Zeile nur zum Abgleich.

---

## 🚫 Blacklist (D-019) — Terminal-States sind persistent

**Regel:** Wer in einen Terminal-Status wandert, wird nie wieder als frischer Lead behandelt — auch nicht nach Lead-Löschung oder Re-Import. Drei Auslöser:
- `kein_interesse` (Lead hat abgelehnt)
- `termin_gelegt` (Termin steht — kein neuer Anruf)
- `termin_stattgefunden` (Termin gehalten — Sache ist durch)

**Mechanik:**
- DB-Trigger schreibt jeden Wechsel in einen dieser drei Stati automatisch in `blacklist` (Key = normalisierte Telefon, Reason = originaler Status).
- `blacklist` überlebt Lead-Hard-Delete (FK ON DELETE SET NULL).
- Re-Imports einer blacklisteten Nummer bekommen sofort `status='kein_interesse'` (BEFORE-INSERT-Trigger — uniformer Marker, originaler Reason bleibt im Blacklist-Eintrag erhalten).
- `distribute-leads` filtert Blacklist vor Round-Robin → `skippedBlacklisted`-Count in der Response.
- Cockpit-Deck filtert Blacklist als zweite Sicherung.

**Findbarkeit:**
- Setter sieht `kein_interesse` nicht in `/setter/leads` Default-View.
- Setter-**Suche zeigt sie aber**, damit Rückrufer einsortierbar sind.
- Admin: `GET /api/admin/blacklist?search=…`, `POST` zum manuellen Hinzufügen, `DELETE /api/admin/blacklist/:id` zum Entfernen (für Korrekturen).

**Reihenfolge bei großer Bereinigung („alle Leads löschen + neu importieren"):**
1. `supabase/blacklist-setup.sql` einmal in Supabase einspielen — Backfill landet alle bestehenden Terminal-State-Leads in der Blacklist + aktiviert den Lösch-Schutz (D-020).
2. Mit `GET /api/admin/blacklist?limit=1` prüfen: `total` zeigt Anzahl der Einträge → muss > 0 sein.
3. Erst dann: alle Leads löschen (`DELETE /api/admin/leads` mit `mode:"hard"` + `confirm:true`, oder im Admin-Board).
   → **Termine (`termin_gelegt`, `termin_stattgefunden`) und Wiedervorlagen bleiben automatisch erhalten** (D-020, DB-Trigger). Die DELETE-Response enthält `skippedProtected`-Count.
4. Neuer Excel-Import — blacklistete Phones bekommen via BEFORE-INSERT-Trigger automatisch `status='kein_interesse'`, alle frischen Nummern starten als `neu`.

**Geschützte Status (D-020, nicht hart löschbar):**
- `termin_gelegt` – Termin steht
- `termin_stattgefunden` – Termin gehalten
- `wiedervorlage` – geplanter Rückruf

Wer einen geschützten Lead wirklich löschen will, muss zuerst den Status ändern (z. B. auf `kein_interesse`). Bewusste Friktion.

**Einmaliger Setup-Schritt:** `supabase/blacklist-setup.sql` im Supabase-SQL-Editor ausführen. Idempotent — sicher mehrfach laufbar (CREATE IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT).

---

## ✅ Was zuletzt fertig gemacht wurde

**Aktuelle Session (Juni 2026) — Code:**
- **PR #55 (GEMERGED, Juni 2026)** — „Meine Leads" paginiert vollständig via `fetchAllRows()`. → D-034.
- **Folge-PR zu #55** — Cockpit-`berufAggregate` (Chip-Counts) ebenfalls auf `fetchAllRows()` umgezogen + Docs auf Post-Merge-Stand.

**Aktuelle Session (Juni 2026) — Datenoperationen (live, kein Code):**
- **Doula** „Doula Direktkontakt" (186) importiert → Nicholas; später Bestand **215 Doulas** umverteilt: Nicholas 65 / Lisa 100 / Robert 50.
- **Top Leads** (Mix: IBCLC, Familienbegleiterin, Mütterpflegerin …) importiert, beruf = CSV-Kategorie. Doppel-Import mit gemischten Berufen wieder zurückgenommen (Hard-Delete der 249 Fehl-Labels).
- **Hebammen** „Hebammen TOP" (249, beruf korrekt aus `zielgruppe`=Hebamme, nicht `kategorie`=BfHD) importiert, 50/50 auf Antonia/Lisa, dann 50 an Robert → **danach komplett wieder rausgezogen** (unassigned + `archived=true`, reversibel, nichts gelöscht).
- **Yogalehrerinnen** „Yogalehrerinnen BDY" (228 Handy-Leads, beruf=Yogalehrerin aus `zielgruppe`) gleichmäßig 76/76/76 auf **Marie Fischer** (neu angelegt), Robert, Antonia.
- **Fotografen** „BFF Fotografen TOP": 103 freie an Robert → Robert 129 / Nicholas 25 / Markus 1, Pool 0.
- **Lessons (xlsx/CSV-Berufsfeld):** In den `*_bdy_*`/`hebammen`/`doula`-Dateien steht der **Beruf in `zielgruppe`**, `kategorie` ist die Quelle/Verband (BfHD, BDY). Beim Import immer `zielgruppe` → `beruf` mappen, nicht `kategorie`.

**Setter-UX + Persistenz (#48–#51, Mai 2026):**

- **PR #51** — Termin als **„stattgefunden" bestätigen** im Termine-Modal (+ „Nicht erschienen"). → D-032
- **PR #50** — Cockpit merkt sich die **Deck-Position** (Lead-ID, pro Scope, localStorage). → D-031
- **PR #49** — **Anruf-Persistenz** via `keepalive`-Fetch an `POST /api/setter/log-call` (statt fire-and-forget). → D-030
- **PR #48** — Doku-Update (D-027/028/029 + Stand post #47).

**Datenoperationen dieser Session (live, kein Code):**
- **Ernährungsberater** importiert (1. Wahl 111 → ursprünglich 50/50 Markus/Justin; **dann alle 111 zu Markus** — Justins 55 umgezogen). 2. Wahl **611 unzugeordnet** gespeichert (Liste „Ernährungsberater 2. Wahl"), 742 ohne Telefon nicht importiert.
- **Heilpraktiker bereinigt** (296): 211 „sicher" → Name+Bundesland aktualisiert (bleiben bei Settern); 85 „unsicher/kein Name" → hart gelöscht.
- **Anrufliste bereinigt** (2.760): 2.684 „sicher" gleichmäßig auf die 5 (Nicholas/Markus/Robert/Antonia/Lisa) → **je ~501 aktiv**; Justin geleert; 71 „unsicher/bitte prüfen" hart gelöscht (1 geschützt übersprungen).
- → Workflow dazu dokumentiert in **D-033**.

**Aufräum-Welle A→B→C→D + Blacklist-Scharfschaltung (#42–#47, Mai 2026):**

- **PR #47 — Paket D (Code-Hygiene/Security):** `tsc --noEmit` ist **0 Fehler** (tsconfig `target: ES2020`); `reset-password` nur noch für Admins; Such-Injection escaped (`sanitizeSearchTerm`); Auth zentralisiert (`setters`, `distribute-leads` → `checkAdminAuth`) + timing-safe Token. Setter-Slide-over-Call loggt jetzt auch `activity_log`.
- **PR #46 — Paket C (Setter-Bedienung):** Cockpit-Index-Off-by-one bei Undo/Entfernen behoben; Schreibbestätigung (`.select('id')`) für Termin/Wiedervorlage; Call-Button schreibt `activity_log` (Rangliste zählt Anrufe); **Undo zählt Statistik zurück** (löscht activity_log + dekrementiert todayDone).
- **PR #45 — Paket B (Admin-Bedienung):** beruf-balancierte Verteilung (`balanceByBeruf`) + serverseitiger Hebammen-Freeze (`excludeBeruf` default `hebamm%`); Excel-Vorschau schlüsselt Duplikate auf (schon im System vs Blacklist). → D-029
- **PR #44 — Paket A (Verlässlichkeit):** 1000-Zeilen-Deckel behoben — `fetchAllRows` (stabil nach id) in `stats`/`distribute-leads`/`lead-probability`. → D-028
- **PR #43** — Normalisierte Dublettenerkennung im Import (Excel + Bulk), gegen bestehende Leads + Blacklist. → D-027
- **PR #42** — `kein_interesse`-Leads nur noch per individueller Suche findbar (Lead-Liste-Status-Chip entfernt; Cockpit-Rückhol-Toast).

**Vorherige Welle (#23–#40):**

- **PR #40** — Cockpit-Bugfix (D-026): bearbeitete Leads (nicht_erreicht / kein_interesse / Termin / Wiedervorlage) bleiben nach App-Neustart weg. Lokal aus Deck entfernt + defensives Frontend-Filter.
- **PR #39** — Handynummern sortier-priorisiert (D-023) in Cockpit + Setter-Lead-Liste.
- **PR #38** — High-Potential-Tab im Cockpit (D-024: `prio_a`-Flag). PATCH-Whitelist um `prio_a` erweitert.
- **PR #37** — „📱 Nur Handys"-Filter (D-023) im Cockpit + Lead-Liste.
- **PR #36** — Cockpit-Beruf-Switch: vollständiger Remount via React-`key`.
- **PR #35** — Cockpit-Default-Deck leer (D-022: Setter wählt aktiv).
- **PR #34** — Beruf-Tabs im Cockpit + `/api/admin/setters` Pagination-Fix (>1000 Profile).
- **PR #33** — Zielgruppen-Switcher (Beruf-Chips) im Cockpit + Setter-Lead-Liste.
- **PR #32** — `upsert_blacklist_on_terminal_status`: ENUM-Cast-Fix.
- **PR #31** — Bulk-Import: NOT-NULL-Spalten mit `''` statt `null` (D-025-Hardening).
- **PR #30** — `POST /api/admin/leads/bulk` (D-025: Token-fähiger Bulk-Import mit Dedupe).
- **PR #29** — `/admin/leads`: Inline-Edit für Listen/Berufe + Setter-Dropdown.
- **PR #28** — `clearLeads` bei Beruf-/Listen-Delete: NOT-NULL-Crash gefixt.
- **PR #27** — Blacklist + Lösch-Schutz + Struktur-Hub (D-019 / D-020 / D-021).
- **PR #26** — „nicht erreicht" + „kein Interesse" endgültig aus dem Cockpit (Vorläufer von D-026).
- **PR #25** — Erweiterte Admin-API + Probability-Score + Funnel-Baseline (D-017 / D-018).
- **PR #23** — HANDOVER.md (Übergabeprotokoll) angelegt.

… komplette Historie siehe `git log` auf `main` oder Pull-Request-Liste auf GitHub.

---

## ⚠️ Offene Schritte (User muss selbst machen)

### 1. Supabase-SQL einspielen (einmalig, idempotent)
Im Supabase-SQL-Editor ausführen:

- ✅ **`supabase/blacklist-setup.sql`** — **eingespielt** (Mai 2026, 326 Blacklist-Einträge bestätigt). Blacklist + Re-Import-Trigger + Lösch-Schutz (D-019/D-020) sind live.

Noch offen (optional, für diese Features):

**a) `supabase/leaderboard-timezone.sql`** — DB-Trigger auf Europe/Berlin umstellen. Ohne diesen Schritt springt die „Heute"-Statistik nahe Mitternacht falsch.

**b) `supabase/perf-upgrade.sql`** — Composite-Indizes (`assigned_to+status`, `recall_date`, `list_name`) + Trigram-Indizes für schnelle `ilike`-Suche + RPC `get_distinct_list_names()`.

**c) `supabase/struktur-setup.sql`** — Berufe-Master + cluster_content-Erweiterungen (D-021).

### 2. Falls Ranglisten/Stats noch alte Daten zeigen
- Admin → Rangliste → **„⚠️ Ranglisten auf 0 zurücksetzen"** (rote Box unten)
- Setzt activity_log, leaderboard_cache leer + alle termin_gelegt/stattgefunden zurück auf `angerufen`

### 3. Lead-Verteilung
**Hinweis:** Die Anzeigenamen der Setter weichen von den E-Mails ab (z. B. „Lisa Becker" → natascha.lehmann@horbach.de). Ungeklärt, ob das bewusste Anruf-Pseudonyme sind — vor einer Namens-Korrektur mit dem User klären (B3, offen).

Last-Snapshot post #51 (nach Anrufliste-/Heilpraktiker-Bereinigung + Ernährungsberater-Umzug):

| Setter (Anzeigename) | offen (neu/ang.) |
|---|---:|
| Markus Sander | 586 (inkl. 111 Ernährungsberater 1. Wahl) |
| Lisa Becker | 486 |
| Robert Cerbanches | 482 |
| Nicholas Sirenko | 476 |
| Antonia Tischler | 470 |
| Max Weiß | 373 |
| Justin Stich | 116 (Anrufliste/Ernährungsberater geleert) |
| Christian Mende | 0 🟢 |

Unzugeordneter Pool ~5.595 (inkl. „Ernährungsberater 2. Wahl" 611, Kosmetikerinnen, Reste). **Blacklist** (D-019) wächst laufend.

**Offene Daten-Häppchen:** „Ernährungsberater 2. Wahl" (611, Liste) wartet auf Verteilung. Justin Stich wird gerade leergezogen (User-Account).

→ Vor jeder (Um-)Verteilung: aktuelle Zahlen per `GET /api/admin/setters` ziehen (liefert jetzt korrekte Counts, D-028). Beruf-balanciert verteilen via Checkbox bzw. `balanceByBeruf:true` (D-029). Goldene Regel D-016 beachten — keine Verteilung ohne ausdrückliche Bestätigung im Chat.

---

## 🐞 Bekannte Schwachstellen (nicht akut, dokumentiert in DECISIONS.md)

| Bug / Limitation | Wirkung | Fix-Aufwand |
|---|---|---|
| **Closer-Zuweisung vor Mail-Versand** | Wenn Mail abgebrochen, ist Closer trotzdem gesetzt | Klein: Save erst nach explizitem Senden-Klick |
| **`ort`/`website` nicht per Admin-API patchbar** | Bei „Bereinigt"-Updates lassen sich nur `name`+`state` setzen (Whitelist) | Klein: `ort`,`website` in `PATCHABLE_COLUMNS` aufnehmen |
| **B3: Setter-Anzeigenamen ≠ E-Mail** | „Lisa Becker" → natascha.lehmann@… — evtl. bewusste Anruf-Pseudonyme | Mit User klären, dann ggf. `PATCH profiles` |

*Vorher gelistet, inzwischen behoben:*
- ~~„Meine Leads" zeigt bei >1000 Leads die hinteren Berufe (z. B. Doula) nicht~~ — gelöst in PR #55 (D-034), gemerged Juni 2026; Cockpit-Chip-Counts im Folge-PR.
- ~~Anruf-Status geht bei App-Close verloren~~ — gelöst in PR #49 (D-030): keepalive-Endpoint.
- ~~Cockpit startet beim Reopen oben~~ — gelöst in PR #50 (D-031): Position gemerkt.
- ~~Termin nicht als „stattgefunden" bestätigbar~~ — gelöst in PR #51 (D-032).
- ~~Back-Button zeigt stale state~~ — gelöst in PR #40 (D-026).
- ~~Undo zählt Statistik nicht zurück~~ — gelöst in PR #46 (Paket C): Undo löscht den `activity_log`-Eintrag + dekrementiert todayDone.
- ~~Call-Button schreibt kein activity_log~~ — gelöst in PR #46/#47: Cockpit- und Slide-over-Call loggen beim ersten Anruf `angerufen`.
- ~~Streak ist „distinct days"~~ — war bereits consecutive (`calculateStreak` zählt rückwärts ab heute, bricht bei Lücke ab); Notiz war veraltet.
- ~~`tsc --noEmit` nicht grün~~ — gelöst in PR #47 (Paket D): 0 Fehler, `target: ES2020` gesetzt.
- ~~1000-Zeilen-Deckel verfälscht Stats/Verteilung~~ — gelöst in PR #44 (Paket A): `fetchAllRows`.
- ~~`reset-password` ohne Admin-Check / Such-Injection~~ — gelöst in PR #47 (Paket D).

---

## 🚀 Empfohlene nächste Schritte (priorisiert)

1. **Supabase-SQLs einspielen** (siehe oben, 5 Min) → Stats werden zuverlässig
2. **Cleanup-SQL für Stats laufen lassen** (Reset-Button oder SQL aus Chat) → alle starten bei 0
3. **Optional: Bekannte Schwachstellen #1 und #2 fixen** (Undo + Call-Statistik) → komplett konsistente Statistik
4. **Optional: Lead-Umverteilung** (Admin-Button oder per Token-API)
5. **Beobachten:** Vercel-Preview-Test bei jedem PR, bevor gemerged wird — UI-Crashs (wie der mobile Nav-Off-by-One in PR #6) rutschen sonst durch

---

## 🛠️ Cheatsheet — Häufige Befehle

### Setter-Übersicht abrufen
```bash
curl -s -X GET https://4570-98.vercel.app/api/admin/setters \
  -H "Authorization: Bearer <ADMIN_API_TOKEN>" | python3 -m json.tool
```

### Leads verteilen (unzugeordnete an Setter)
```bash
curl -s -X POST https://4570-98.vercel.app/api/admin/distribute-leads \
  -H "Authorization: Bearer <ADMIN_API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "setterIds": ["uuid1","uuid2","uuid3"],
    "perSetterLimit": 100
  }'
```

### Alle 988 offenen Leads gleichmäßig umverteilen
```bash
curl -s -X POST https://4570-98.vercel.app/api/admin/distribute-leads \
  -H "Authorization: Bearer <ADMIN_API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "setterIds": [
      "062486fb-21aa-4bcc-931b-612355043ebf",
      "1f71405d-e366-41ea-9652-62b801e024f7",
      "63f0eaed-67e4-4042-97ab-2692f3d89f30",
      "c96f7ef4-1943-4a23-958b-c964a8df6997",
      "ffcc7044-461e-4968-b8ba-5ab3ad813321",
      "6b8ddc8b-4e21-42c3-bb5d-d6a1f7094399",
      "b63e1763-f9c6-46b4-a26f-bb3230f5e881",
      "e67b7a73-cf54-4368-a7b1-6cf72d3d7dcc"
    ],
    "includeAssigned": true
  }'
```

### Lead-Liste mit Filtern lesen
```bash
curl -s "https://4570-98.vercel.app/api/admin/leads?status=neu&status=angerufen&assignedTo=<UUID>&limit=20&withQuality=true" \
  -H "Authorization: Bearer <ADMIN_API_TOKEN>" | python3 -m json.tool
```

### Bulk-Status-Update (KEINE Zuweisung)
```bash
curl -s -X PATCH https://4570-98.vercel.app/api/admin/leads \
  -H "Authorization: Bearer <ADMIN_API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"leadIds":["uuid1","uuid2"], "patch":{"status":"kein_interesse"}}'
```

### Stats-Übersicht (Aggregate)
```bash
curl -s "https://4570-98.vercel.app/api/admin/stats?groupBy=status,assigned_to" \
  -H "Authorization: Bearer <ADMIN_API_TOKEN>" | python3 -m json.tool
```

### Lokal entwickeln
```bash
cd leadbooking-crm
npm install
cp .env.local.example .env.local   # Supabase-Keys eintragen
npm run dev                         # → http://localhost:3000
npx tsc --noEmit                    # Typecheck
```

---

## 📚 Weiterführende Dokumente

- **`docs/PROJECT.md`** — komplette Feature-Liste + Bedienungsanleitung
- **`docs/DECISIONS.md`** — Architektur-/UX-Entscheidungen mit Begründung (D-001 bis D-026)
- **`docs/WORKFLOW.md`** — Wie Claude Chat + Claude Code + VS Code zusammenarbeiten

---

## 🤖 So startest du einen neuen Chat

1. Die drei MD-Files (PROJECT, DECISIONS, WORKFLOW + dieses HANDOVER) **als Anhang** in den neuen Chat geben — oder einfach den Repo öffnen lassen, die Dateien liegen in `leadbooking-crm/docs/`.
2. Aufgabe konkret formulieren („Bau X", „Fix Y", „Verteile Z an die Setter A+B").
3. Bei Agent-Daten-Operationen den **Token nicht im Chat tippen** — entweder Admin-Button im UI oder neu setzen in Vercel und den Agenten via env beauftragen.

---

*Diese Datei ist ein Snapshot. Für den jeweils aktuellen Stand siehe `PROJECT.md` (wird laufend aktualisiert) und den `main`-Branch auf GitHub.*
