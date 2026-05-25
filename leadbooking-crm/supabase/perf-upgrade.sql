-- ============================================================
-- Performance-Upgrade für leadbooking-crm
-- Idempotent: kann gefahrlos (auch mehrfach) im Supabase SQL-Editor
-- ausgeführt werden. Rein additiv – keine Daten werden verändert.
-- ============================================================

-- 1) Composite-/Zusatz-Indizes für die Cockpit- & Admin-Queries
--    (jede Deck-Query filtert assigned_to + status gemeinsam)
create index if not exists idx_leads_assigned_status on leads (assigned_to, status);
create index if not exists idx_leads_recall_date     on leads (recall_date);
create index if not exists idx_leads_list_name       on leads (list_name);

-- 2) Schnelle Suche (ilike '%…%') auf Name & Telefon via Trigram-Index
--    Ohne diese nutzt die Cockpit-Suche einen vollen Tabellen-Scan.
create extension if not exists pg_trgm;
create index if not exists idx_leads_name_trgm  on leads using gin (name gin_trgm_ops);
create index if not exists idx_leads_phone_trgm on leads using gin (phone gin_trgm_ops);

-- 3) Distinct Listen-Namen für „Admin → Inhalte"
--    Ersetzt den Full-Table-Scan (alle Leads laden) durch ein schnelles DISTINCT.
create or replace function get_distinct_list_names()
returns table (list_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Nur Admins dürfen die vollständige Listen-Übersicht abrufen
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception 'not authorized';
  end if;
  return query
    select distinct l.list_name
    from leads l
    where coalesce(l.list_name, '') <> ''
    order by l.list_name;
end;
$$;

grant execute on function get_distinct_list_names() to authenticated;
