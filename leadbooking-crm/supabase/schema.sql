-- ============================================================
-- Leadbooking CRM – Supabase Schema
-- ============================================================

-- Enums
CREATE TYPE user_role AS ENUM ('admin', 'setter', 'advisor');
CREATE TYPE lead_status AS ENUM (
  'neu',
  'angerufen',
  'nicht_erreicht',
  'termin_gelegt',
  'termin_stattgefunden',
  'kein_interesse'
);

-- ============================================================
-- Tabelle: profiles
-- ============================================================
CREATE TABLE profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  role          user_role NOT NULL DEFAULT 'setter',
  full_name     text NOT NULL DEFAULT '',
  email         text NOT NULL DEFAULT '',
  avatar_color  text NOT NULL DEFAULT '#2E75B6',
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_self_read" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_admin_all" ON profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "profiles_public_read" ON profiles
  FOR SELECT USING (true);

-- ============================================================
-- Tabelle: leads
-- ============================================================
CREATE TABLE leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_to     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  uploaded_by     uuid NOT NULL REFERENCES profiles(id),
  name            text NOT NULL,
  phone           text NOT NULL UNIQUE,
  email           text,
  state           text NOT NULL DEFAULT '',
  score           decimal(4,1) NOT NULL DEFAULT 0,
  lead_quality    text NOT NULL DEFAULT '',
  age_indicator   text NOT NULL DEFAULT '',
  signals         text NOT NULL DEFAULT '',
  status          lead_status NOT NULL DEFAULT 'neu',
  appointment_date timestamptz,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_setter_select" ON leads
  FOR SELECT USING (
    assigned_to = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "leads_setter_update" ON leads
  FOR UPDATE USING (
    assigned_to = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "leads_admin_insert" ON leads
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "leads_admin_delete" ON leads
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- Tabelle: activity_log
-- ============================================================
CREATE TABLE activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  setter_id   uuid NOT NULL REFERENCES profiles(id),
  old_status  text NOT NULL DEFAULT '',
  new_status  text NOT NULL,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_setter_select" ON activity_log
  FOR SELECT USING (
    setter_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "activity_setter_insert" ON activity_log
  FOR INSERT WITH CHECK (
    setter_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "activity_admin_all" ON activity_log
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- Tabelle: leaderboard_cache
-- ============================================================
CREATE TABLE leaderboard_cache (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setter_id           uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date                date NOT NULL DEFAULT CURRENT_DATE,
  calls_made          int NOT NULL DEFAULT 0,
  appointments_set    int NOT NULL DEFAULT 0,
  appointments_done   int NOT NULL DEFAULT 0,
  points              int NOT NULL DEFAULT 0,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (setter_id, date)
);

ALTER TABLE leaderboard_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leaderboard_public_read" ON leaderboard_cache
  FOR SELECT USING (true);

CREATE POLICY "leaderboard_admin_all" ON leaderboard_cache
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- Trigger: updated_at auf leads
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Trigger: leaderboard_cache nach leads UPDATE
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
  streak_count int := 0;
BEGIN
  v_setter_id := COALESCE(NEW.assigned_to, OLD.assigned_to);
  IF v_setter_id IS NULL THEN RETURN NEW; END IF;

  -- Anrufe heute (angerufen + nicht_erreicht + termin_gelegt + termin_stattgefunden)
  SELECT COUNT(*) INTO v_calls
  FROM activity_log
  WHERE setter_id = v_setter_id
    AND (created_at AT TIME ZONE 'Europe/Berlin')::date = v_date
    AND new_status IN ('angerufen','nicht_erreicht','termin_gelegt','termin_stattgefunden');

  -- Termine gelegt heute
  SELECT COUNT(*) INTO v_set
  FROM activity_log
  WHERE setter_id = v_setter_id
    AND (created_at AT TIME ZONE 'Europe/Berlin')::date = v_date
    AND new_status = 'termin_gelegt';

  -- Termine stattgefunden heute
  SELECT COUNT(*) INTO v_done
  FROM activity_log
  WHERE setter_id = v_setter_id
    AND (created_at AT TIME ZONE 'Europe/Berlin')::date = v_date
    AND new_status = 'termin_stattgefunden';

  -- Streak (aufeinanderfolgende stattgefundene)
  SELECT COUNT(*) INTO v_streak
  FROM (
    SELECT (created_at AT TIME ZONE 'Europe/Berlin')::date AS d
    FROM activity_log
    WHERE setter_id = v_setter_id AND new_status = 'termin_stattgefunden'
    GROUP BY (created_at AT TIME ZONE 'Europe/Berlin')::date
    ORDER BY d DESC
  ) sub;

  -- Punkte
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

CREATE TRIGGER leads_leaderboard_update
  AFTER UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION refresh_leaderboard_cache();

CREATE TRIGGER activity_leaderboard_update
  AFTER INSERT ON activity_log
  FOR EACH ROW EXECUTE FUNCTION refresh_leaderboard_cache();

-- ============================================================
-- Trigger: Auto-Profil nach Signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  colors text[] := ARRAY['#2E75B6','#1E3A5F','#22C55E','#F97316','#EAB308','#8B5CF6','#EC4899'];
BEGIN
  INSERT INTO profiles (id, role, full_name, email, avatar_color)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'setter'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    colors[1 + (floor(random() * 7))::int]
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Indizes
-- ============================================================
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_score ON leads(score DESC);
CREATE INDEX idx_activity_log_setter_id ON activity_log(setter_id);
CREATE INDEX idx_activity_log_lead_id ON activity_log(lead_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at);
CREATE INDEX idx_leaderboard_setter_date ON leaderboard_cache(setter_id, date);

-- Performance: kombinierte/zusätzliche Indizes für Cockpit- & Admin-Queries
CREATE INDEX IF NOT EXISTS idx_leads_assigned_status ON leads(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_leads_recall_date ON leads(recall_date);
CREATE INDEX IF NOT EXISTS idx_leads_list_name ON leads(list_name);
-- Schnelle Suche (ilike '%…%') auf Name & Telefon
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_leads_name_trgm ON leads USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_phone_trgm ON leads USING gin (phone gin_trgm_ops);

-- ============================================================
-- Distinct Listen-Namen für „Admin → Inhalte" (statt Full-Table-Scan)
-- ============================================================
CREATE OR REPLACE FUNCTION get_distinct_list_names()
RETURNS TABLE (list_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
    SELECT DISTINCT l.list_name
    FROM leads l
    WHERE coalesce(l.list_name, '') <> ''
    ORDER BY l.list_name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_distinct_list_names() TO authenticated;
