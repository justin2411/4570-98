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
