# WORKFLOW.md — So arbeiten wir mit Claude + Claude Code + VS Code

Drei Werkzeuge, klare Rollenverteilung.

---

## 🟦 Claude Chat (claude.ai)

**Wofür:** Reden, Ideen sortieren, Entscheidungen treffen, Vorschläge gegen einander abwägen, Code-Stellen erklären lassen, Konzepte besprechen.

**Spielregeln:**
- **Kein Prompting-Voodoo nötig.** Schreib einfach normal — „Mach mal X" / „Wieso ist Y so?" / „Was wäre besser, A oder B?".
- Schnelles Hin-und-Her. Gut für die Phase **vor** dem Coden.
- Claude Chat hat **keinen** Zugriff auf das Repo. Code-Snippets müssen kopiert/eingefügt werden, falls man etwas Konkretes besprechen will.

**Typische Nutzung:**
- „Sollten wir die Qualität als harten Filter oder nur als Sortierung?"
- „Erklär mir, wie der DB-Trigger funktioniert."
- „Welche Optionen gibt es, das Skript pro Beruf zu personalisieren?"

---

## 🟦 Claude Code (dieser Agent)

**Wofür:** Tatsächliche Code-Änderungen, Commits, Pull Requests, Migrationen, Tests laufen lassen, PDFs erzeugen.

**Spielregeln:**
- Läuft in einer **Remote-Umgebung** (Cloud-Container) mit frisch geklonter Repo-Kopie.
- Hat Zugriff auf `git`, `GitHub MCP` (PRs, Comments, Issues), Dateisystem, Bash, Node/npm.
- Hat **keinen** direkten Zugriff auf die Produktiv-Supabase (keine DB-Credentials). Daten-Operationen → SQL für den User oder Admin-Button.
- Entwickelt **immer** auf Branch **`claude/brave-galileo-n3x6e`**. Pull-Requests gehen gegen `main`, Squash-Merge.
- Nach jedem Merge: Branch wird per `git reset --soft origin/main` neu aufgesetzt → nächste Änderung sauber darauf.

**Typische Nutzung:**
- „Bau Feature X" → Implementierung + PR + Merge.
- „Fix Bug Y" → Hotfix-PR.
- „Generiere PDF Z."

**Wichtig:** Claude Code schreibt **keinen** produktiven Daten-Op (DELETE/UPDATE auf Supabase) direkt. Stattdessen: SQL-Datei oder Admin-Button. Sicherheit vor Geschwindigkeit.

---

## 🟦 Visual Studio Code (lokal)

**Wofür:** Code lesen, lokale Edits, Branches checken, App lokal starten und testen.

**Empfohlener Setup:**
- Lokal `git clone` + `npm install` im `leadbooking-crm/`-Ordner.
- `.env.local` mit den Supabase-Credentials anlegen (siehe `.env.local.example`).
- `npm run dev` → lokal auf `http://localhost:3000`.

**Tipp:** Wenn du eine Preview eines noch nicht gemergten PR siehst, gibt es immer auch die **Vercel-Preview-URL** im PR-Kommentar — meistens schneller als lokal starten.

---

## 🔁 Der typische Ablauf

```
1. Idee / Problem
       │
       ▼
2. Claude Chat: besprechen, Optionen abwägen, Entscheidung
       │
       ▼
3. Claude Code: implementieren, Tests, PR aufmachen
       │
       ▼
4. Vercel-Preview prüfen (mobil/desktop) — oder bei kleinen Sachen direkt mergen
       │
       ▼
5. Merge → Produktion (Vercel deployt main automatisch)
       │
       ▼
6. Falls SQL-Migration nötig: einmal in Supabase ausführen
```

---

## 📦 Pull-Request-Konvention

- **Titel:** kurz, deutsch, beschreibt das Outcome (z.B. „Cockpit: Zurück-Button + nie angerufene Leads zuerst").
- **Body:** ## Summary, was geändert, ggf. Test-Plan, Hinweis falls SQL-Schritt nötig.
- **Draft** für größere Sachen, **direkt ready** für triviale Fixes.
- Nach Merge: keine weiteren Commits auf denselben Branch zu der Sache → neuer PR.

---

## 🗂️ Supabase-Schritte (SQL)

Wenn ein PR Migrationen mitbringt, liegen sie als `.sql`-Datei im `supabase/`-Ordner:
- `supabase/leaderboard-timezone.sql` — Trigger auf Europe/Berlin
- `supabase/perf-upgrade.sql` — DB-Indizes + RPC

**Einspielen:** Supabase Dashboard → SQL Editor → New query → Datei-Inhalt einfügen → Run. Idempotent, kann mehrfach ausgeführt werden.

---

## 📚 Dokumente in diesem Ordner

- **PROJECT.md** — chronologisch/thematisch: was bisher gebaut wurde
- **DECISIONS.md** — warum etwas so entschieden wurde (Architektur, UX-Tradeoffs)
- **WORKFLOW.md** — dieses Dokument

Alle drei werden bei größeren Änderungen vom Agent aktualisiert. Wenn du was ergänzt haben willst, sag einfach „aktualisier die Docs" — kein Prompt-Voodoo nötig.
