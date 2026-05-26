-- ============================================================
-- Funnel-Baseline für XI CRM – letzte 30 Tage (Europe/Berlin)
-- ------------------------------------------------------------
-- Reine Diagnose-Abfrage. Verändert NICHTS in der DB (nur SELECTs +
-- CTEs). Beliebig oft im Supabase-SQL-Editor ausführbar.
--
-- HINWEIS: Es gibt im Schema KEINEN dedizierten Abschluss-/closed-won-
-- Status. lead_status endet bei 'termin_stattgefunden'. Closers-Tabelle
-- existiert, aber ohne eigenen Abschluss-Flow. Funnel deshalb nur bis
-- "Gehalten/Gelegt".
--
-- Funnel-Definition (an der Leaderboard-Trigger-Logik orientiert):
--   anrufe                = activity_log new_status ∈
--                           (angerufen, nicht_erreicht,
--                            termin_gelegt, termin_stattgefunden)
--   termin_gelegt         = activity_log new_status = 'termin_gelegt'
--   termin_stattgefunden  = activity_log new_status = 'termin_stattgefunden'
--
-- Quoten:
--   quote_termin_pro_anruf_pct  = termin_gelegt / anrufe
--   quote_gehalten_pct          = termin_stattgefunden / termin_gelegt
--
-- BEKANNTER BUG (Schwachstelle #1 in HANDOVER): "Undo" räumt
-- activity_log NICHT zurück. Wir geben deshalb zusätzlich den aktuellen
-- leads.status-Snapshot pro Setter aus. Laufen Flow (activity_log 30d)
-- und Snapshot (Bestand jetzt) bei termin_stattgefunden stark
-- auseinander, ist die Flow-Zahl überzählig → Spalte
-- diskrepanz_warnung leuchtet auf. Bei termin_gelegt ist Flow > Snapshot
-- NORMAL (viele wandern in der Folge zu termin_stattgefunden weiter).
-- ============================================================

WITH
window_bounds AS (
  SELECT
    ((now() AT TIME ZONE 'Europe/Berlin')::date - 30)::timestamp AS window_start,
    ((now() AT TIME ZONE 'Europe/Berlin')::date + 1)::timestamp  AS window_end
),
flow AS (
  -- Flow-Zahlen aus activity_log (rein nach Berliner Datum gefiltert)
  SELECT
    al.setter_id,
    COUNT(*) FILTER (
      WHERE al.new_status IN ('angerufen','nicht_erreicht','termin_gelegt','termin_stattgefunden')
    )                                                                AS calls,
    COUNT(*) FILTER (WHERE al.new_status = 'termin_gelegt')          AS termin_gelegt,
    COUNT(*) FILTER (WHERE al.new_status = 'termin_stattgefunden')   AS termin_stattgefunden
  FROM activity_log al
  CROSS JOIN window_bounds w
  WHERE (al.created_at AT TIME ZONE 'Europe/Berlin') >= w.window_start
    AND (al.created_at AT TIME ZONE 'Europe/Berlin') <  w.window_end
  GROUP BY al.setter_id
),
snap AS (
  -- Snapshot (aktueller Bestand) je Setter — KEINE Zeitfilterung;
  -- bewusst, damit der Undo-/Reset-Effekt auf termin_stattgefunden
  -- sichtbar wird.
  SELECT
    l.assigned_to AS setter_id,
    COUNT(*) FILTER (WHERE l.status = 'termin_gelegt')               AS snap_termin_gelegt,
    COUNT(*) FILTER (WHERE l.status = 'termin_stattgefunden')        AS snap_termin_stattgefunden
  FROM leads l
  WHERE l.assigned_to IS NOT NULL
  GROUP BY l.assigned_to
),
per_setter AS (
  SELECT
    p.full_name                                                       AS setter,
    COALESCE(f.calls, 0)                                              AS anrufe,
    COALESCE(f.termin_gelegt, 0)                                      AS termin_gelegt,
    COALESCE(f.termin_stattgefunden, 0)                               AS termin_stattgefunden,
    CASE WHEN COALESCE(f.calls, 0) = 0 THEN NULL
         ELSE ROUND(100.0 * f.termin_gelegt::numeric / f.calls, 1)
    END                                                               AS quote_termin_pro_anruf_pct,
    CASE WHEN COALESCE(f.termin_gelegt, 0) = 0 THEN NULL
         ELSE ROUND(100.0 * f.termin_stattgefunden::numeric / f.termin_gelegt, 1)
    END                                                               AS quote_gehalten_pct,
    COALESCE(sn.snap_termin_gelegt, 0)                                AS snap_termin_gelegt,
    COALESCE(sn.snap_termin_stattgefunden, 0)                         AS snap_termin_stattgefunden,
    CASE
      WHEN COALESCE(f.termin_stattgefunden, 0) > 0
       AND ABS(COALESCE(sn.snap_termin_stattgefunden, 0)
               - COALESCE(f.termin_stattgefunden, 0))
           > GREATEST(2, COALESCE(f.termin_stattgefunden, 0) * 0.3)
      THEN '⚠ Flow vs. Snapshot weichen >30 % ab (Undo-/Reset-Effekt)'
      ELSE ''
    END                                                               AS diskrepanz_warnung,
    0                                                                 AS _sort
  FROM profiles p
  LEFT JOIN flow f  ON f.setter_id = p.id
  LEFT JOIN snap sn ON sn.setter_id = p.id
  WHERE p.role = 'setter'
),
total_row AS (
  SELECT
    'GESAMT'                                                          AS setter,
    COALESCE(SUM(anrufe), 0)                                          AS anrufe,
    COALESCE(SUM(termin_gelegt), 0)                                   AS termin_gelegt,
    COALESCE(SUM(termin_stattgefunden), 0)                            AS termin_stattgefunden,
    CASE WHEN COALESCE(SUM(anrufe), 0) = 0 THEN NULL
         ELSE ROUND(100.0 * SUM(termin_gelegt)::numeric / SUM(anrufe), 1)
    END                                                               AS quote_termin_pro_anruf_pct,
    CASE WHEN COALESCE(SUM(termin_gelegt), 0) = 0 THEN NULL
         ELSE ROUND(100.0 * SUM(termin_stattgefunden)::numeric / SUM(termin_gelegt), 1)
    END                                                               AS quote_gehalten_pct,
    COALESCE(SUM(snap_termin_gelegt), 0)                              AS snap_termin_gelegt,
    COALESCE(SUM(snap_termin_stattgefunden), 0)                       AS snap_termin_stattgefunden,
    CASE
      WHEN COALESCE(SUM(termin_stattgefunden), 0) > 0
       AND ABS(COALESCE(SUM(snap_termin_stattgefunden), 0)
               - COALESCE(SUM(termin_stattgefunden), 0))
           > GREATEST(2, COALESCE(SUM(termin_stattgefunden), 0) * 0.3)
      THEN '⚠ Flow vs. Snapshot weichen >30 % ab (Undo-/Reset-Effekt, gesamt)'
      ELSE ''
    END                                                               AS diskrepanz_warnung,
    1                                                                 AS _sort
  FROM per_setter
)
SELECT
  setter,
  anrufe,
  termin_gelegt,
  termin_stattgefunden,
  quote_termin_pro_anruf_pct,
  quote_gehalten_pct,
  snap_termin_gelegt,
  snap_termin_stattgefunden,
  diskrepanz_warnung
FROM (
  SELECT * FROM per_setter
  UNION ALL
  SELECT * FROM total_row
) all_rows
ORDER BY _sort, setter;
