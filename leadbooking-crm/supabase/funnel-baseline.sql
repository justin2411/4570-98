-- ============================================================
-- Funnel-Baseline für XI CRM – letzte 30 Tage (Europe/Berlin)
-- ------------------------------------------------------------
-- Reine Diagnose-Abfrage. Verändert NICHTS in der DB (nur SELECTs +
-- CTEs). Beliebig oft im Supabase-SQL-Editor ausführbar (idempotent).
--
-- HINWEIS – kein Abschluss-Status im Schema:
-- lead_status (siehe supabase/schema.sql) hat die Werte
--   neu | angerufen | nicht_erreicht | termin_gelegt
--   | termin_stattgefunden | kein_interesse
-- Es gibt KEINEN dedizierten Abschluss-/closed-won-Status. Closers-
-- Tabelle existiert, aber ohne eigenen Abschluss-Flow. Funnel endet
-- deshalb bei termin_stattgefunden ("Gehalten/Gelegt").
--
-- HEBAMMEN-Handling (siehe HANDOVER.md, Stand 27.05.2026):
-- Hebammen-Leads sind eingefroren bis ~Ende August 2026. Die Headline-
-- Zahlen lassen sie aus; eine separate HEBAMMEN-Zeile am Ende dient
-- nur zum Abgleich. Filter: LOWER(TRIM(beruf)) LIKE 'hebamm%' deckt
-- sowohl 'Hebamme' (Singular, kanonisch aus lib/script-template.ts)
-- als auch 'Hebammen' (Plural, kommt per Excel-Import vor) sowie
-- Schreibweisen mit Whitespace/Großbuchstaben ab.
--
-- ─── PROBE für distinct beruf-Werte (einmalig empfohlen) ────────────
-- Bevor du der Filter-Annahme blind vertraust, lass diese Probe einmal
-- in Supabase laufen und ergänze hier als Kommentar, falls exotische
-- Schreibweisen ('Hebbamme', 'hebamme ' mit Whitespace, ...) auftauchen,
-- die der LIKE 'hebamm%' NICHT erwischen würde:
--
--   SELECT TRIM(COALESCE(beruf,'')) AS beruf_wert, COUNT(*) AS n
--   FROM leads
--   GROUP BY 1
--   ORDER BY n DESC;
--
-- Bekannte Werte aus dem Code (lib/script-template.ts BERUF_PLURAL):
--   Hebamme, Heilpraktiker, Psychotherapeut, Osteopath, Logopäde,
--   Ergotherapeut, Massagepraxis, Coach, Fotografin, Yogalehrerin,
--   Personal Trainer, Kosmetikerin, Nagelstudio, Handwerksmeister,
--   Ernährungsberater
--
-- BEKANNTER BUG (HANDOVER Schwachstelle #1): "Undo" räumt activity_log
-- nicht zurück → die Flow-Zahlen können bei termin_stattgefunden
-- überzählig sein. Deshalb werden Snapshot-Spalten aus leads.status
-- nebeneinander ausgegeben; weichen Flow und Snapshot >30 % ab,
-- markiert die Spalte diskrepanz_warnung die betroffene Zeile als
-- "Statistik unzuverlässig".
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
-- ============================================================

WITH
window_bounds AS (
  SELECT
    ((now() AT TIME ZONE 'Europe/Berlin')::date - 30)::timestamp AS window_start,
    ((now() AT TIME ZONE 'Europe/Berlin')::date + 1)::timestamp  AS window_end
),
flow AS (
  -- Pro Setter alle Flow-Zahlen, jeweils einmal ohne und einmal mit
  -- Hebammen — damit wir in einer einzigen Query Headline + Hebammen-
  -- Abgleich liefern können.
  SELECT
    al.setter_id,
    -- Headline (OHNE Hebammen)
    COUNT(*) FILTER (
      WHERE al.new_status IN ('angerufen','nicht_erreicht','termin_gelegt','termin_stattgefunden')
        AND LOWER(TRIM(COALESCE(l.beruf,''))) NOT LIKE 'hebamm%'
    )                                                                AS calls,
    COUNT(*) FILTER (
      WHERE al.new_status = 'termin_gelegt'
        AND LOWER(TRIM(COALESCE(l.beruf,''))) NOT LIKE 'hebamm%'
    )                                                                AS termin_gelegt,
    COUNT(*) FILTER (
      WHERE al.new_status = 'termin_stattgefunden'
        AND LOWER(TRIM(COALESCE(l.beruf,''))) NOT LIKE 'hebamm%'
    )                                                                AS termin_stattgefunden,
    -- Hebammen-Spur (NUR Hebammen)
    COUNT(*) FILTER (
      WHERE al.new_status IN ('angerufen','nicht_erreicht','termin_gelegt','termin_stattgefunden')
        AND LOWER(TRIM(COALESCE(l.beruf,''))) LIKE 'hebamm%'
    )                                                                AS calls_heb,
    COUNT(*) FILTER (
      WHERE al.new_status = 'termin_gelegt'
        AND LOWER(TRIM(COALESCE(l.beruf,''))) LIKE 'hebamm%'
    )                                                                AS termin_gelegt_heb,
    COUNT(*) FILTER (
      WHERE al.new_status = 'termin_stattgefunden'
        AND LOWER(TRIM(COALESCE(l.beruf,''))) LIKE 'hebamm%'
    )                                                                AS termin_stattgefunden_heb
  FROM activity_log al
  JOIN leads l ON l.id = al.lead_id
  CROSS JOIN window_bounds w
  WHERE (al.created_at AT TIME ZONE 'Europe/Berlin') >= w.window_start
    AND (al.created_at AT TIME ZONE 'Europe/Berlin') <  w.window_end
  GROUP BY al.setter_id
),
snap AS (
  -- Aktueller Bestand je Setter (KEIN Zeitfilter, damit der Undo-
  -- /Reset-Effekt sichtbar wird), jeweils ohne und mit Hebammen.
  SELECT
    l.assigned_to AS setter_id,
    COUNT(*) FILTER (
      WHERE l.status = 'termin_gelegt'
        AND LOWER(TRIM(COALESCE(l.beruf,''))) NOT LIKE 'hebamm%'
    )                                                                AS snap_termin_gelegt,
    COUNT(*) FILTER (
      WHERE l.status = 'termin_stattgefunden'
        AND LOWER(TRIM(COALESCE(l.beruf,''))) NOT LIKE 'hebamm%'
    )                                                                AS snap_termin_stattgefunden,
    COUNT(*) FILTER (
      WHERE l.status = 'termin_gelegt'
        AND LOWER(TRIM(COALESCE(l.beruf,''))) LIKE 'hebamm%'
    )                                                                AS snap_termin_gelegt_heb,
    COUNT(*) FILTER (
      WHERE l.status = 'termin_stattgefunden'
        AND LOWER(TRIM(COALESCE(l.beruf,''))) LIKE 'hebamm%'
    )                                                                AS snap_termin_stattgefunden_heb
  FROM leads l
  WHERE l.assigned_to IS NOT NULL
  GROUP BY l.assigned_to
),
per_setter AS (
  -- Headline (OHNE Hebammen) — eine Zeile pro Setter
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
      THEN '⚠ Statistik unzuverlässig — Flow vs. Snapshot >30 % Abweichung (Undo-/Reset-Effekt)'
      ELSE ''
    END                                                               AS diskrepanz_warnung,
    0                                                                 AS _sort
  FROM profiles p
  LEFT JOIN flow f  ON f.setter_id = p.id
  LEFT JOIN snap sn ON sn.setter_id = p.id
  WHERE p.role = 'setter'
),
total_row AS (
  -- GESAMT (Headline-Summe, OHNE Hebammen)
  SELECT
    'GESAMT (ohne Hebammen)'                                          AS setter,
    COALESCE(SUM(f.calls), 0)                                         AS anrufe,
    COALESCE(SUM(f.termin_gelegt), 0)                                 AS termin_gelegt,
    COALESCE(SUM(f.termin_stattgefunden), 0)                          AS termin_stattgefunden,
    CASE WHEN COALESCE(SUM(f.calls), 0) = 0 THEN NULL
         ELSE ROUND(100.0 * SUM(f.termin_gelegt)::numeric / SUM(f.calls), 1)
    END                                                               AS quote_termin_pro_anruf_pct,
    CASE WHEN COALESCE(SUM(f.termin_gelegt), 0) = 0 THEN NULL
         ELSE ROUND(100.0 * SUM(f.termin_stattgefunden)::numeric / SUM(f.termin_gelegt), 1)
    END                                                               AS quote_gehalten_pct,
    COALESCE(SUM(sn.snap_termin_gelegt), 0)                           AS snap_termin_gelegt,
    COALESCE(SUM(sn.snap_termin_stattgefunden), 0)                    AS snap_termin_stattgefunden,
    CASE
      WHEN COALESCE(SUM(f.termin_stattgefunden), 0) > 0
       AND ABS(COALESCE(SUM(sn.snap_termin_stattgefunden), 0)
               - COALESCE(SUM(f.termin_stattgefunden), 0))
           > GREATEST(2, COALESCE(SUM(f.termin_stattgefunden), 0) * 0.3)
      THEN '⚠ Statistik unzuverlässig — Flow vs. Snapshot >30 % Abweichung (Undo-/Reset-Effekt, gesamt)'
      ELSE ''
    END                                                               AS diskrepanz_warnung,
    1                                                                 AS _sort
  FROM profiles p
  LEFT JOIN flow f  ON f.setter_id = p.id
  LEFT JOIN snap sn ON sn.setter_id = p.id
  WHERE p.role = 'setter'
),
hebammen_row AS (
  -- HEBAMMEN (eingefroren bis ~Ende August 2026, siehe HANDOVER.md)
  -- Reine Abgleichs-Zeile — nicht für Optimierung/Verteilung nutzen.
  SELECT
    'HEBAMMEN (eingefroren)'                                          AS setter,
    COALESCE(SUM(f.calls_heb), 0)                                     AS anrufe,
    COALESCE(SUM(f.termin_gelegt_heb), 0)                             AS termin_gelegt,
    COALESCE(SUM(f.termin_stattgefunden_heb), 0)                      AS termin_stattgefunden,
    CASE WHEN COALESCE(SUM(f.calls_heb), 0) = 0 THEN NULL
         ELSE ROUND(100.0 * SUM(f.termin_gelegt_heb)::numeric / SUM(f.calls_heb), 1)
    END                                                               AS quote_termin_pro_anruf_pct,
    CASE WHEN COALESCE(SUM(f.termin_gelegt_heb), 0) = 0 THEN NULL
         ELSE ROUND(100.0 * SUM(f.termin_stattgefunden_heb)::numeric / SUM(f.termin_gelegt_heb), 1)
    END                                                               AS quote_gehalten_pct,
    COALESCE(SUM(sn.snap_termin_gelegt_heb), 0)                       AS snap_termin_gelegt,
    COALESCE(SUM(sn.snap_termin_stattgefunden_heb), 0)                AS snap_termin_stattgefunden,
    CASE
      WHEN COALESCE(SUM(f.termin_stattgefunden_heb), 0) > 0
       AND ABS(COALESCE(SUM(sn.snap_termin_stattgefunden_heb), 0)
               - COALESCE(SUM(f.termin_stattgefunden_heb), 0))
           > GREATEST(2, COALESCE(SUM(f.termin_stattgefunden_heb), 0) * 0.3)
      THEN '⚠ Statistik unzuverlässig — Flow vs. Snapshot >30 % Abweichung (Hebammen)'
      ELSE ''
    END                                                               AS diskrepanz_warnung,
    2                                                                 AS _sort
  FROM profiles p
  LEFT JOIN flow f  ON f.setter_id = p.id
  LEFT JOIN snap sn ON sn.setter_id = p.id
  WHERE p.role = 'setter'
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
  UNION ALL
  SELECT * FROM hebammen_row
) all_rows
ORDER BY _sort, setter;
