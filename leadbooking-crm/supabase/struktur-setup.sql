-- ============================================================
-- Struktur-Setup für XI CRM — Berufe + Listen als verwaltbare Entitäten
-- ------------------------------------------------------------
-- Idempotent. Einmal in Supabase einspielen.
--
-- WAS DAS ANLEGT:
--   1) Tabelle `berufe` (Master-Liste der Berufe mit Plural-Form +
--      is_active-Flag). Bisher waren Berufe nur Free-Text-Strings auf
--      `leads.beruf`; ab jetzt gibt es eine zentrale Verwaltungs-Quelle.
--   2) Erweiterungen auf `cluster_content`:
--        - is_active  boolean default true   (Liste aktiv/archiviert)
--        - display_name text                  (für UI; fallback list_name)
--   3) Backfill der `berufe` aus distinct `leads.beruf`-Werten, plus
--      bekannte Plural-Formen aus dem Code (lib/script-template.ts).
--   4) Trigger: neuer Beruf in `leads.beruf` → automatisch zur Master-
--      Liste hinzugefügt (so dass Excel-Import kein UI-Lock braucht).
-- ============================================================

-- ── Tabelle: berufe ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.berufe (
  name         text PRIMARY KEY,
  plural_form  text NOT NULL DEFAULT '',
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.berufe ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS berufe_read_all ON public.berufe;
CREATE POLICY berufe_read_all ON public.berufe FOR SELECT USING (true);
DROP POLICY IF EXISTS berufe_admin_all ON public.berufe;
CREATE POLICY berufe_admin_all ON public.berufe FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- ── cluster_content: is_active + display_name ─────────────────
ALTER TABLE public.cluster_content
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.cluster_content
  ADD COLUMN IF NOT EXISTS display_name text;

-- ── Backfill: distinct beruf-Werte aus leads ──────────────────
INSERT INTO public.berufe (name, plural_form, is_active)
SELECT DISTINCT trim(beruf), '', true
FROM public.leads
WHERE beruf IS NOT NULL
  AND trim(beruf) <> ''
ON CONFLICT (name) DO NOTHING;

-- Bekannte Plural-Formen aus lib/script-template.ts (BERUF_PLURAL)
INSERT INTO public.berufe (name, plural_form, is_active) VALUES
  ('Psychotherapeut','Psychotherapeuten',true),
  ('Osteopath','Osteopathen',true),
  ('Logopäde','Logopäden',true),
  ('Ergotherapeut','Ergotherapeuten',true),
  ('Massagepraxis','Massagepraxen',true),
  ('Heilpraktiker','Heilpraktiker',true),
  ('Coach','Coaches',true),
  ('Fotografin','Fotografinnen',true),
  ('Yogalehrerin','Yogalehrerinnen',true),
  ('Personal Trainer','Personal Trainer',true),
  ('Kosmetikerin','Kosmetikerinnen',true),
  ('Nagelstudio','Nagelstudios',true),
  ('Handwerksmeister','Handwerksmeister',true),
  ('Ernährungsberater','Ernährungsberater',true),
  ('Hebamme','Hebammen',true),
  ('Physiotherapeut','Physiotherapeuten',true)
ON CONFLICT (name) DO UPDATE
  SET plural_form = CASE
    WHEN public.berufe.plural_form = '' THEN EXCLUDED.plural_form
    ELSE public.berufe.plural_form
  END;

-- ── Trigger: neuer Beruf-Wert in leads → in Master-Liste ──────
CREATE OR REPLACE FUNCTION public.upsert_beruf_master()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.beruf IS NOT NULL AND trim(NEW.beruf) <> '' THEN
    INSERT INTO berufe (name, plural_form, is_active)
    VALUES (trim(NEW.beruf), '', true)
    ON CONFLICT (name) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_upsert_beruf_master ON public.leads;
CREATE TRIGGER leads_upsert_beruf_master
  AFTER INSERT OR UPDATE OF beruf ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.upsert_beruf_master();

-- ── Updated_at-Trigger für berufe ─────────────────────────────
CREATE OR REPLACE FUNCTION public.berufe_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS berufe_updated_at ON public.berufe;
CREATE TRIGGER berufe_updated_at
  BEFORE UPDATE ON public.berufe
  FOR EACH ROW EXECUTE FUNCTION public.berufe_set_updated_at();
