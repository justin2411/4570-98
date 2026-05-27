-- ============================================================
-- Blacklist-Setup für XI CRM
-- ------------------------------------------------------------
-- Idempotent: kann gefahrlos (auch mehrfach) im Supabase-SQL-Editor
-- ausgeführt werden. Persistente Sperre gegen Doppel-Anrufe.
--
-- WAS AUF DIE BLACKLIST KOMMT (jeder Wechsel in einen dieser States
-- triggert idempotenten INSERT):
--   • kein_interesse        → Lead hat abgelehnt
--   • termin_gelegt         → Lead hat einen Termin
--   • termin_stattgefunden  → Termin hat stattgefunden
-- Das `reason`-Feld in der Blacklist hält fest, welcher Status der
-- Auslöser war (für spätere Diagnose/Filter).
--
-- WAS DAS LÖST:
--   1) Wenn ein Lead in einen dieser Terminal-States wechselt, kommt
--      seine (normalisierte) Telefonnummer auf die Blacklist.
--   2) Blacklist überlebt das Löschen des Lead-Datensatzes (ON DELETE
--      SET NULL auf der FK) — Nummer/Name/Mail bleiben erhalten.
--   3) Wird ein blacklisteter Lead später erneut importiert (z. B.
--      nach Hard-Delete aller Leads + frischem Excel-Import), springt
--      der BEFORE-INSERT-Trigger ein und setzt status sofort auf
--      'kein_interesse' — er taucht nirgends mehr im aktiven Pool auf,
--      unabhängig davon, was sein originaler Blacklist-Reason war.
--   4) App-Side filtern Cockpit-Deck und distribute-leads zusätzlich
--      explizit gegen die Blacklist (Defense in Depth).
--
-- FINDBARKEIT: Blacklist ist via Admin-Endpoint suchbar; Setter sieht
-- die ursprünglichen Lead-Datensätze in seiner Suche (kein_interesse-
-- Filter ist nur Default-aus, nicht hart). Damit findet er Rückrufer,
-- ruft sie aber nicht aktiv an (Cockpit zeigt sie nicht).
-- ============================================================

-- ── Helper: Telefonnummer normalisieren ───────────────────────
-- Analog zu lib/phone.ts formatPhoneForCall, aber gibt nur Ziffern
-- zurück (ohne '+'). Sowohl Trigger als auch App-Side normalisieren
-- identisch → konsistente Match-Keys.
CREATE OR REPLACE FUNCTION public.normalize_phone(p text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  digits text;
  had_plus boolean;
BEGIN
  IF p IS NULL OR length(trim(p)) = 0 THEN RETURN NULL; END IF;
  had_plus := position('+' in p) > 0;
  digits := regexp_replace(p, '\D', '', 'g');
  IF digits = '' THEN RETURN NULL; END IF;
  -- 00xx → international
  IF substring(digits FROM 1 FOR 2) = '00' THEN
    digits := substring(digits FROM 3);
    had_plus := true;
  END IF;
  -- bereits international (+ oder 00 oder beginnt mit 49)
  IF had_plus OR substring(digits FROM 1 FOR 2) = '49' THEN
    digits := regexp_replace(digits, '^490+', '49');
    RETURN digits;
  END IF;
  -- nationale Notation (führende 0)
  IF substring(digits FROM 1 FOR 1) = '0' THEN
    RETURN '49' || regexp_replace(digits, '^0+', '');
  END IF;
  -- nackte Nummer → deutsch annehmen
  RETURN '49' || digits;
END;
$$;

-- ── Tabelle ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blacklist (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone             text NOT NULL UNIQUE,
  email             text,
  name              text,
  beruf             text,
  original_lead_id  uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  reason            text NOT NULL DEFAULT 'kein_interesse',
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_blacklist_phone ON public.blacklist(phone);
CREATE INDEX IF NOT EXISTS idx_blacklist_email ON public.blacklist(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blacklist_name_trgm ON public.blacklist USING gin (name gin_trgm_ops);

ALTER TABLE public.blacklist ENABLE ROW LEVEL SECURITY;
-- Setter dürfen lesen (zur Suche), nicht ändern
DROP POLICY IF EXISTS blacklist_authenticated_read ON public.blacklist;
CREATE POLICY blacklist_authenticated_read ON public.blacklist FOR SELECT USING (true);
DROP POLICY IF EXISTS blacklist_admin_all ON public.blacklist;
CREATE POLICY blacklist_admin_all ON public.blacklist FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- ── Trigger 1: Lead → Terminal-Status ⇒ Blacklist ─────────────
-- Greift bei kein_interesse, termin_gelegt, termin_stattgefunden.
-- reason-Feld speichert, welcher Status der Auslöser war.
CREATE OR REPLACE FUNCTION public.upsert_blacklist_on_terminal_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  norm text;
  terminals text[] := ARRAY['kein_interesse', 'termin_gelegt', 'termin_stattgefunden'];
BEGIN
  IF NEW.status = ANY(terminals)
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
  THEN
    norm := normalize_phone(NEW.phone);
    IF norm IS NOT NULL THEN
      INSERT INTO blacklist (phone, email, name, beruf, original_lead_id, reason, created_by)
      VALUES (norm, NEW.email, NEW.name, NEW.beruf, NEW.id, NEW.status, NEW.assigned_to)
      ON CONFLICT (phone) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Alter Trigger-Name (Migration für alte Setups) + neuer einheitlicher Name
DROP TRIGGER IF EXISTS leads_kein_interesse_to_blacklist ON public.leads;
DROP TRIGGER IF EXISTS leads_terminal_status_to_blacklist ON public.leads;
CREATE TRIGGER leads_terminal_status_to_blacklist
  AFTER INSERT OR UPDATE OF status ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.upsert_blacklist_on_terminal_status();

-- ── Trigger 2: Re-Import einer blacklisteten Nummer ⇒ kein_interesse ───
-- Falls ein Lead mit blacklisteter Telefonnummer neu importiert wird
-- (Hard-Delete + neuer Insert), wird sein Status sofort auf
-- 'kein_interesse' gesetzt. Defense in Depth.
CREATE OR REPLACE FUNCTION public.enforce_blacklist_on_lead_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  norm text;
BEGIN
  norm := normalize_phone(NEW.phone);
  IF norm IS NOT NULL AND EXISTS (SELECT 1 FROM blacklist WHERE phone = norm) THEN
    NEW.status := 'kein_interesse';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_enforce_blacklist_on_insert ON public.leads;
CREATE TRIGGER leads_enforce_blacklist_on_insert
  BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_blacklist_on_lead_insert();

-- ── Backfill: alle bestehenden Terminal-State-Leads übernehmen ─
-- (kein_interesse + termin_gelegt + termin_stattgefunden)
INSERT INTO public.blacklist (phone, email, name, beruf, original_lead_id, reason, created_by)
SELECT normalize_phone(l.phone), l.email, l.name, l.beruf, l.id, l.status::text, l.assigned_to
FROM public.leads l
WHERE l.status IN ('kein_interesse', 'termin_gelegt', 'termin_stattgefunden')
  AND l.phone IS NOT NULL
  AND normalize_phone(l.phone) IS NOT NULL
ON CONFLICT (phone) DO NOTHING;

-- ── Trigger 3: Lösch-Schutz für wertvolle Lead-States ─────────
-- Leads mit Status termin_gelegt, termin_stattgefunden oder
-- wiedervorlage dürfen nicht gelöscht werden — sie repräsentieren
-- aktive Vereinbarungen/Verpflichtungen, die durch eine Bereinigungs-
-- Aktion ("alle Leads löschen") nicht verloren gehen dürfen.
--
-- Wer einen geschützten Lead wirklich löschen will, muss zuerst
-- explizit den Status ändern (z. B. auf 'kein_interesse') — das ist
-- bewusste Friktion.
CREATE OR REPLACE FUNCTION public.protect_active_leads_from_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('termin_gelegt', 'termin_stattgefunden', 'wiedervorlage') THEN
    RAISE EXCEPTION 'Lead % darf nicht gelöscht werden (status=%). Termine + Wiedervorlagen sind geschützt — vor dem Löschen Status ändern.', OLD.id, OLD.status
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS leads_protect_from_delete ON public.leads;
CREATE TRIGGER leads_protect_from_delete
  BEFORE DELETE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.protect_active_leads_from_delete();

-- Hinweis: Diese Datei ist read-/idempotent, aber legt eine NEUE
-- Tabelle an. Nur einmal initial einspielen; weitere Läufe sind
-- harmlos (CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT).
