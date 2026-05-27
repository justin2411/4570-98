# HANDOVER.md — Übergabeprotokoll

**Stand:** Mai 2026
**Projekt:** XI CRM (`leadbooking-crm/`) auf Next.js 14 + Supabase + Vercel
**Repo:** `justin2411/4570-98` · Dev-Branch: `claude/brave-galileo-n3x6e`
**Production:** https://4570-98.vercel.app
**Letzter Merge:** PR #22 (Komplette Anleitung in PROJECT.md)

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

## 🚫 Blacklist (D-019) — kein_interesse ist persistent

**Regel:** Wer einmal `kein_interesse` ist, wird nie wieder angerufen — auch nicht nach Lead-Löschung oder Re-Import.

**Mechanik:**
- DB-Trigger schreibt `kein_interesse`-Leads automatisch in `blacklist` (Key = normalisierte Telefon).
- `blacklist` überlebt Lead-Hard-Delete (FK ON DELETE SET NULL).
- Re-Imports einer blacklisteten Nummer bekommen sofort `status='kein_interesse'` (BEFORE-INSERT-Trigger).
- `distribute-leads` filtert Blacklist vor Round-Robin → `skippedBlacklisted`-Count in der Response.
- Cockpit-Deck filtert Blacklist als zweite Sicherung.

**Findbarkeit:**
- Setter sieht `kein_interesse` nicht in `/setter/leads` Default-View.
- Setter-**Suche zeigt sie aber**, damit Rückrufer einsortierbar sind.
- Admin: `GET /api/admin/blacklist?search=…`, `POST` zum manuellen Hinzufügen, `DELETE /api/admin/blacklist/:id` zum Entfernen (für Korrekturen).

**Einmaliger Setup-Schritt:** `supabase/blacklist-setup.sql` im Supabase-SQL-Editor ausführen (Tabelle + Trigger + Backfill aller bestehenden `kein_interesse`-Leads).

---

## ✅ Was zuletzt fertig gemacht wurde

- **PR #22** — Komplette Anleitung in `PROJECT.md` (Tech-Stack, Setter-/Admin-Workflow, API-Endpoints, DB-Migrations, Env-Vars)
- **PR #21** — Zwischenstand + D-014/D-015 in Docs
- **PR #20** — `GET /api/admin/setters` (Setter + Last + unzugeordnete-pro-Liste)
- **PR #19** — Trim + temp. Diagnose für Token-Auth
- **PR #18** — Trigger-Commit für Vercel-Redeploy
- **PR #17** — Token-Auth (`ADMIN_API_TOKEN`) + `includeAssigned` für distribute-leads
- **PR #16** — Admin-Button „Leads verteilen" + `POST /api/admin/distribute-leads`
- **PR #15** — Erste Doku-Anlage (PROJECT/DECISIONS/WORKFLOW)
- … (komplette Liste siehe Git-Log auf `main`)

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
Aktuell **0 unzugeordnete** Leads, **988 offene** sehr ungleich verteilt:
| Setter | Offen |
|---|---:|
| Justin Stich | 550 🔴 |
| Max Weiß | 162 |
| Lisa Becker | 111 |
| Paul Sander | 45 |
| Robert Cerbanches | 45 |
| Nicholas Sirenko | 37 |
| Antonia Tischler | 23 |
| Christian Mende | 15 🟢 |

→ Umverteilen ist sinnvoll. Entweder Admin-Button (📤 auf `/admin/leads`) oder Agent per Token-Call mit `includeAssigned: true`.

---

## 🐞 Bekannte Schwachstellen (nicht akut, dokumentiert in DECISIONS.md)

| Bug | Wirkung | Fix-Aufwand |
|---|---|---|
| **Undo zählt Statistik nicht zurück** | Bei „Rückgängig" bleibt activity_log → Rangliste zählt Aktion weiter | Klein: Snapshot um `activityLogId` erweitern, in Undo löschen |
| **Call-Button schreibt kein activity_log** | „Anrufe"-Zähler in Rangliste untercountet | Klein: bei Call-Tap `logActivity(lead.id, 'angerufen')` schreiben |
| **Streak ist „distinct days"** | +5-Bonus auch bei unzusammenhängenden Tagen | Mittel: echte consecutive-Logik in DB-Trigger |
| **Back-Button zeigt stale state** | Nach nicht_erreicht/kein_interesse + Zurück → alter Status auf der Karte | Klein: setDeck-Update in den beiden Handlern |
| **Closer-Zuweisung vor Mail-Versand** | Wenn Mail abgebrochen, ist Closer trotzdem gesetzt | Klein: Save erst nach explizitem Senden-Klick |

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
- **`docs/DECISIONS.md`** — Architektur-/UX-Entscheidungen mit Begründung (D-001 bis D-015)
- **`docs/WORKFLOW.md`** — Wie Claude Chat + Claude Code + VS Code zusammenarbeiten

---

## 🤖 So startest du einen neuen Chat

1. Die drei MD-Files (PROJECT, DECISIONS, WORKFLOW + dieses HANDOVER) **als Anhang** in den neuen Chat geben — oder einfach den Repo öffnen lassen, die Dateien liegen in `leadbooking-crm/docs/`.
2. Aufgabe konkret formulieren („Bau X", „Fix Y", „Verteile Z an die Setter A+B").
3. Bei Agent-Daten-Operationen den **Token nicht im Chat tippen** — entweder Admin-Button im UI oder neu setzen in Vercel und den Agenten via env beauftragen.

---

*Diese Datei ist ein Snapshot. Für den jeweils aktuellen Stand siehe `PROJECT.md` (wird laufend aktualisiert) und den `main`-Branch auf GitHub.*
