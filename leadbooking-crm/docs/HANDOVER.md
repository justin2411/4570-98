# HANDOVER.md — Übergabeprotokoll

**Stand:** Mai 2026 (post #40)
**Projekt:** XI CRM (`leadbooking-crm/`) auf Next.js 14 + Supabase + Vercel
**Repo:** `justin2411/4570-98`
**Dev-Branch:** wechselt pro Session (z. B. `claude/adoring-rubin-HaFmI`, `claude/brave-galileo-n3x6e` …) — wird vom Web-Harness pro Session generiert. **Immer aktuellen Branch aus der Session-Konfiguration nehmen, nicht hier hardcoden.**
**Production:** https://4570-98.vercel.app
**Letzter Merge:** PR #40 (Cockpit: bearbeitete Leads bleiben weg — auch nach App-Neustart)

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
| **GitHub MCP** | Claude Code | Beschränkt auf Repo `justin2411/4570-98` |

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

**Letzte Welle (#23–#40, Mai 2026):**

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

**a) `supabase/leaderboard-timezone.sql`** — DB-Trigger auf Europe/Berlin umstellen. Ohne diesen Schritt springt die „Heute"-Statistik nahe Mitternacht falsch.

**b) `supabase/perf-upgrade.sql`** — Composite-Indizes (`assigned_to+status`, `recall_date`, `list_name`) + Trigram-Indizes für schnelle `ilike`-Suche + RPC `get_distinct_list_names()`.

### 2. Falls Ranglisten/Stats noch alte Daten zeigen
- Admin → Rangliste → **„⚠️ Ranglisten auf 0 zurücksetzen"** (rote Box unten)
- Setzt activity_log, leaderboard_cache leer + alle termin_gelegt/stattgefunden zurück auf `angerufen`

### 3. Lead-Verteilung
Aktuelle Last (Snapshot post #40, ca. 3.300 offene Leads):

| Setter | Offen |
|---|---:|
| Nico Sidorenko | 748 🔴 |
| Elias Sanetra | 602 |
| Jonas Tamele | 462 |
| Emma-Antonia Tischler | 445 |
| Natascha Lehmann | 417 |
| Lukas Rausendorf | 376 |
| Justin Koch | 249 |
| Christian Mende | 0 🟢 |

Außerdem: **48 `prio_a=true`-Leads** (alle bei Lukas Rausendorf — kuratierte Premium-Liste, siehe D-024) · **326 Blacklist-Einträge** (D-019).

→ Vor Umverteilen: aktuelle Zahlen per `GET /api/admin/setters` ziehen. Goldene Regel D-016 beachten — keine Verteilung ohne ausdrückliche Bestätigung im Chat.

---

## 🐞 Bekannte Schwachstellen (nicht akut, dokumentiert in DECISIONS.md)

| Bug | Wirkung | Fix-Aufwand |
|---|---|---|
| **Undo zählt Statistik nicht zurück** | Bei „Rückgängig" bleibt activity_log → Rangliste zählt Aktion weiter | Klein: Snapshot um `activityLogId` erweitern, in Undo löschen |
| **Call-Button schreibt kein activity_log** | „Anrufe"-Zähler in Rangliste untercountet | Klein: bei Call-Tap `logActivity(lead.id, 'angerufen')` schreiben |
| **Streak ist „distinct days"** | +5-Bonus auch bei unzusammenhängenden Tagen | Mittel: echte consecutive-Logik in DB-Trigger |
| **Closer-Zuweisung vor Mail-Versand** | Wenn Mail abgebrochen, ist Closer trotzdem gesetzt | Klein: Save erst nach explizitem Senden-Klick |

*Vorher gelistet, inzwischen behoben:*
- ~~Back-Button zeigt stale state~~ — gelöst in PR #40 (D-026): bearbeitete Leads sind lokal aus dem Deck entfernt.

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
