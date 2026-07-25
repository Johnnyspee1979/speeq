-- ─────────────────────────────────────────────────────────────────────────────
-- BASELINE-AANVULLING — tenant-kolommen en hulpfuncties
-- ─────────────────────────────────────────────────────────────────────────────
-- Net als het kernschema zijn deze objecten ooit met de hand aangemaakt en stonden
-- ze in geen enkele migratie. `20260613_tenant_isolation_rls.sql` heeft ze wél
-- nodig: dat bestand zet tenant-hekken op acht tabellen en roept
-- `get_user_enrolled_organization_ids()` aan. Zonder dit bestand klapt de keten
-- daar, en kan een nieuwe tenant-database niet worden uitgerold.
--
-- Gereconstrueerd uit productie (kgiuavfvhtdgwuygbyzo, 25 juli 2026).
--
-- BEWUST NIET HIER: `notify_evidence_status_change()` en de bijbehorende trigger
-- `evidence_status_push_trigger`. Die functie bevat een vast ingebakken
-- Edge-Function-URL én een webhook-secret (`x-webhook-secret`). Dat hoort niet
-- in een migratie die je per klant uitrolt — zie het losse punt daarover in het
-- auditrapport.

-- ── tenant_id op de tabellen die het hek nodig hebben ───────────────────────
alter table if exists public.profiles                    add column if not exists tenant_id text default 'demo';
alter table if exists public.project_checklists          add column if not exists tenant_id text default 'demo';
alter table if exists public.consumer_dossier_documents  add column if not exists tenant_id text default 'demo';
alter table if exists public.floor_plans                 add column if not exists tenant_id text default 'demo';
alter table if exists public.task_assignments            add column if not exists tenant_id text default 'demo';
alter table if exists public.evidence_comments           add column if not exists tenant_id text default 'demo';
alter table if exists public.project_documents           add column if not exists tenant_id text default 'demo';
alter table if exists public.dossiers                    add column if not exists tenant_id text default 'demo';

-- ── Hulpfuncties voor rol- en tenant-bepaling ───────────────────────────────
create or replace function public.get_user_enrolled_organization_ids()
returns text[]
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  org_ids text[];
begin
  select array_agg(distinct tenant_id)
    into org_ids
    from profiles
   where id = auth.uid()
     and tenant_id is not null;
  return coalesce(org_ids, array[]::text[]);
end;
$$;

create or replace function public.current_tenant_id()
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    (select tenant_id from public.profiles where id = auth.uid() limit 1),
    'demo'
  );
$$;

create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select role from public.profiles where id = auth.uid() limit 1
$$;

-- Alleen zinvol op de master-DB (tabel `tenants`), maar idempotent en
-- ongevaarlijk op een tenant-DB.
create or replace function public.resolve_tenant(p_company_id text)
returns table(company_id text, name text, supabase_url text, supabase_anon_key text, status text)
language sql
security definer
set search_path to 'public'
as $$
  select t.company_id, t.name, t.supabase_url, t.supabase_anon_key, t.status
    from public.tenants t
   where lower(t.company_id) = lower(p_company_id)
     and t.status = 'active'
     and t.provisioning_status = 'provisioned'
     and t.supabase_url is not null
     and t.supabase_anon_key is not null
   limit 1;
$$;

-- ── Toegang tot de hulpfuncties ─────────────────────────────────────────────
-- `resolve_tenant` moet publiek blijven: de inlogpagina zoekt daarmee de juiste
-- klantomgeving op vóórdat iemand is ingelogd. De rest hoeft anon niet te kunnen.
revoke execute on function public.current_tenant_id() from anon;
revoke execute on function public.get_my_role() from anon;
revoke execute on function public.get_user_enrolled_organization_ids() from anon;

grant execute on function public.current_tenant_id() to authenticated;
grant execute on function public.get_my_role() to authenticated;
grant execute on function public.get_user_enrolled_organization_ids() to authenticated;
grant execute on function public.resolve_tenant(text) to anon, authenticated;
