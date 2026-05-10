-- ================================================
-- LEADBOOKING – Supabase Schema + RLS Policies
-- ================================================

-- Enums
CREATE TYPE user_role AS ENUM ('admin', 'setter', 'advisor');
CREATE TYPE appointment_type AS ENUM ('planned', 'completed');
CREATE TYPE appointment_status AS ENUM ('available', 'sold', 'no_show');
CREATE TYPE payment_method AS ENUM ('stripe', 'paypal');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'refunded');

-- ================================================
-- TABELLE: profiles
-- ================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'advisor',
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================
-- TABELLE: appointments
-- ================================================
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setter_id UUID NOT NULL REFERENCES profiles(id),
  buyer_id UUID REFERENCES profiles(id),
  type appointment_type NOT NULL DEFAULT 'planned',
  status appointment_status NOT NULL DEFAULT 'available',
  profession TEXT NOT NULL,
  region TEXT NOT NULL,
  state TEXT NOT NULL,
  topic TEXT NOT NULL,
  appointment_date TIMESTAMPTZ,
  completed_date DATE,
  summary TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 100.00,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT price_fixed CHECK (price = 100.00),
  CONSTRAINT planned_needs_date CHECK (
    (type = 'planned' AND appointment_date IS NOT NULL) OR type = 'completed'
  ),
  CONSTRAINT completed_needs_date CHECK (
    (type = 'completed' AND completed_date IS NOT NULL) OR type = 'planned'
  )
);

-- ================================================
-- TABELLE: payments
-- ================================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id),
  buyer_id UUID NOT NULL REFERENCES profiles(id),
  amount DECIMAL(10,2) NOT NULL DEFAULT 100.00,
  method payment_method NOT NULL,
  external_id TEXT,
  status payment_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT payment_amount_fixed CHECK (amount = 100.00)
);

-- ================================================
-- TABELLE: push_subscriptions
-- ================================================
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================
-- ROW LEVEL SECURITY
-- ================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- profiles: Jeder liest eigenes Profil, Admin liest alle
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_select_admin" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- appointments: Berater sehen verfügbare + eigene gekaufte
--               Setter sehen eigene
--               Admin sieht alle
--               Kontaktdaten nur nach Kauf

CREATE POLICY "appointments_select_advisor" ON appointments
  FOR SELECT USING (
    (status = 'available' AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'advisor' AND is_active = true
    ))
    OR
    (buyer_id = auth.uid())
    OR
    (setter_id = auth.uid())
    OR
    (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  );

CREATE POLICY "appointments_insert_setter" ON appointments
  FOR INSERT WITH CHECK (
    setter_id = auth.uid() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'setter' AND is_active = true)
  );

CREATE POLICY "appointments_insert_admin" ON appointments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "appointments_update_admin" ON appointments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "appointments_update_buyer" ON appointments
  FOR UPDATE USING (buyer_id = auth.uid());

CREATE POLICY "appointments_delete_admin" ON appointments
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- payments: Käufer sehen eigene, Admin alle
CREATE POLICY "payments_select_own" ON payments
  FOR SELECT USING (buyer_id = auth.uid());

CREATE POLICY "payments_select_admin" ON payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "payments_insert_system" ON payments
  FOR INSERT WITH CHECK (buyer_id = auth.uid());

-- push_subscriptions: Nutzer verwalten eigene
CREATE POLICY "push_select_own" ON push_subscriptions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "push_insert_own" ON push_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "push_delete_own" ON push_subscriptions
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "push_select_admin" ON push_subscriptions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ================================================
-- VIEWS: appointments_public (Kontaktdaten maskiert)
-- ================================================
CREATE VIEW appointments_public AS
SELECT
  a.id,
  a.setter_id,
  a.buyer_id,
  a.type,
  a.status,
  a.profession,
  a.region,
  a.state,
  a.topic,
  a.appointment_date,
  a.completed_date,
  a.summary,
  a.price,
  CASE
    WHEN a.buyer_id = auth.uid() THEN a.contact_name
    ELSE NULL
  END AS contact_name,
  CASE
    WHEN a.buyer_id = auth.uid() THEN a.contact_phone
    ELSE NULL
  END AS contact_phone,
  CASE
    WHEN a.buyer_id = auth.uid() THEN a.contact_email
    ELSE NULL
  END AS contact_email,
  a.created_at
FROM appointments a;

-- ================================================
-- TRIGGER: Profil nach Registrierung anlegen
-- ================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'advisor'),
    CASE
      WHEN COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'advisor') = 'advisor' THEN true
      ELSE false
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ================================================
-- ADMIN USER (nach Registrierung manuell setzen)
-- ================================================
-- UPDATE profiles SET role = 'admin', is_active = true WHERE email = 'admin@leadbooking.de';

-- ================================================
-- INDEXES
-- ================================================
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_type ON appointments(type);
CREATE INDEX idx_appointments_setter ON appointments(setter_id);
CREATE INDEX idx_appointments_buyer ON appointments(buyer_id);
CREATE INDEX idx_appointments_state ON appointments(state);
CREATE INDEX idx_appointments_profession ON appointments(profession);
CREATE INDEX idx_payments_appointment ON payments(appointment_id);
CREATE INDEX idx_payments_buyer ON payments(buyer_id);
CREATE INDEX idx_push_user ON push_subscriptions(user_id);
