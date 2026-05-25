-- ============================================================
-- Ranglisten-Cache auf deutsche Zeit (Europe/Berlin) umstellen
-- Idempotent: im Supabase-SQL-Editor ausführen.
-- Ersetzt nur die Trigger-FUNKTION (Trigger bleiben bestehen) → die
-- Tages-Buckets richten sich danach nach der deutschen Mitternacht.
-- ============================================================
CREATE OR REPLACE FUNCTION refresh_leaderboard_cache()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_setter_id uuid;
  v_date date := (now() AT TIME ZONE 'Europe/Berlin')::date;
  v_calls int;
  v_set int;
  v_done int;
  v_streak int := 0;
  v_points int;
BEGIN
  v_setter_id := COALESCE(NEW.assigned_to, OLD.assigned_to);
  IF v_setter_id IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_calls
  FROM activity_log
  WHERE setter_id = v_setter_id
    AND (created_at AT TIME ZONE 'Europe/Berlin')::date = v_date
    AND new_status IN ('angerufen','nicht_erreicht','termin_gelegt','termin_stattgefunden');

  SELECT COUNT(*) INTO v_set
  FROM activity_log
  WHERE setter_id = v_setter_id
    AND (created_at AT TIME ZONE 'Europe/Berlin')::date = v_date
    AND new_status = 'termin_gelegt';

  SELECT COUNT(*) INTO v_done
  FROM activity_log
  WHERE setter_id = v_setter_id
    AND (created_at AT TIME ZONE 'Europe/Berlin')::date = v_date
    AND new_status = 'termin_stattgefunden';

  SELECT COUNT(*) INTO v_streak
  FROM (
    SELECT (created_at AT TIME ZONE 'Europe/Berlin')::date AS d
    FROM activity_log
    WHERE setter_id = v_setter_id AND new_status = 'termin_stattgefunden'
    GROUP BY (created_at AT TIME ZONE 'Europe/Berlin')::date
  ) sub;

  v_points := v_set * 1 + v_done * 3;
  IF v_streak >= 5 THEN v_points := v_points + 5; END IF;

  INSERT INTO leaderboard_cache (setter_id, date, calls_made, appointments_set, appointments_done, points)
  VALUES (v_setter_id, v_date, v_calls, v_set, v_done, v_points)
  ON CONFLICT (setter_id, date) DO UPDATE SET
    calls_made = EXCLUDED.calls_made,
    appointments_set = EXCLUDED.appointments_set,
    appointments_done = EXCLUDED.appointments_done,
    points = EXCLUDED.points,
    updated_at = now();

  RETURN NEW;
END;
$$;
