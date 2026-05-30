-- KYP-integratie (read-only planning-sync)
-- Datum: 2026-06-10
--
-- Drie tabellen in de per-tenant Supabase:
--   1. kyp_integration_config  — het KYP access-token + base-URL (per tenant)
--   2. kyp_project_mapping      — koppeling SpeeQ-project <-> KYP-project
--   3. kyp_planning_cache       — lokaal gecachte planning/mijlpalen uit KYP
--
-- RLS-posture (defense-in-depth bovenop tenant-isolatie):
--   - Token schrijven: alleen ADMIN (de KEYUSER/klant-admin).
--   - Token lezen: ADMIN + WERKVOORBEREIDER (rollen die de sync uitvoeren).
--   - Cache lezen: elke ingelogde gebruiker. Cache schrijven: planning-rollen.
-- Het token wordt nooit in de master-DB opgeslagen en nooit in code/git.

-- ── 1. Configuratie (token) ─────────────────────────────────────────────────
create table if not exists public.kyp_integration_config (
  id          uuid primary key default gen_random_uuid(),
  kyp_token   text,
  base_url    text not null default 'https://kyp.nl/rest',
  is_active   boolean not null default true,
  updated_by  uuid,
  updated_at  timestamptz not null default now()
);

alter table public.kyp_integration_config enable row level security;

drop policy if exists "kyp_config_select" on public.kyp_integration_config;
create policy "kyp_config_select"
  on public.kyp_integration_config for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('ADMIN', 'WERKVOORBEREIDER')
    )
  );

drop policy if exists "kyp_config_write" on public.kyp_integration_config;
create policy "kyp_config_write"
  on public.kyp_integration_config for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'ADMIN'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'ADMIN'
    )
  );

-- ── 2. Project-koppeling ────────────────────────────────────────────────────
create table if not exists public.kyp_project_mapping (
  id               uuid primary key default gen_random_uuid(),
  speeq_project_id text not null,
  kyp_project_id   integer not null,
  kyp_project_name text,
  created_by       uuid,
  created_at       timestamptz not null default now(),
  unique (speeq_project_id)
);

alter table public.kyp_project_mapping enable row level security;

drop policy if exists "kyp_mapping_select" on public.kyp_project_mapping;
create policy "kyp_mapping_select"
  on public.kyp_project_mapping for select
  using (auth.uid() is not null);

drop policy if exists "kyp_mapping_write" on public.kyp_project_mapping;
create policy "kyp_mapping_write"
  on public.kyp_project_mapping for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('ADMIN', 'WERKVOORBEREIDER')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('ADMIN', 'WERKVOORBEREIDER')
    )
  );

-- ── 3. Planning-cache ───────────────────────────────────────────────────────
create table if not exists public.kyp_planning_cache (
  id               uuid primary key default gen_random_uuid(),
  speeq_project_id text not null,
  kyp_project_id   integer not null,
  phase_name       text,
  activity_id      integer,
  activity_name    text,
  start_date       date,
  end_date         date,
  date_finished    date,
  responsible      text,
  status           text not null default 'gepland',  -- gepland | afgerond | te_laat
  synced_at        timestamptz not null default now()
);

alter table public.kyp_planning_cache enable row level security;

create index if not exists kyp_planning_cache_project_idx
  on public.kyp_planning_cache (speeq_project_id);

drop policy if exists "kyp_cache_select" on public.kyp_planning_cache;
create policy "kyp_cache_select"
  on public.kyp_planning_cache for select
  using (auth.uid() is not null);

drop policy if exists "kyp_cache_write" on public.kyp_planning_cache;
create policy "kyp_cache_write"
  on public.kyp_planning_cache for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('ADMIN', 'WERKVOORBEREIDER', 'PROJECTLEIDER')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('ADMIN', 'WERKVOORBEREIDER', 'PROJECTLEIDER')
    )
  );
