-- ─────────────────────────────────────────────────────────────────────────────
-- KYP-terugmelding (V2) — write-back van alleen actiestatus
-- ─────────────────────────────────────────────────────────────────────────────
-- Bouwt voort op de read-only V1 (20260610_kyp_integration.sql). Voegt toe:
--  - opt-in per gekoppeld project (default uit),
--  - statusmapping SpeeQ-controlepunt → KYP-activiteit,
--  - audit-log van elke terugmeld-poging.
-- Alleen statusvelden worden ooit naar KYP geschreven; nooit planning/documenten.

-- Opt-in per project (default uit). Zonder dit aan: geen enkele schrijfpoging.
alter table public.kyp_project_mapping
  add column if not exists writeback_enabled boolean not null default false;

-- Statusmapping: welk SpeeQ-controlepunt hoort bij welke KYP-activiteit.
create table if not exists public.kyp_status_mapping (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           text,
  speeq_project_id    text not null,
  speeq_controlepunt_id text not null,
  kyp_project_id      integer not null,
  kyp_activity_id     integer not null,
  created_by          uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  unique (speeq_project_id, speeq_controlepunt_id)
);

create index if not exists kyp_status_mapping_project_idx
  on public.kyp_status_mapping (speeq_project_id);

alter table public.kyp_status_mapping enable row level security;

create policy "kyp_status_mapping_select" on public.kyp_status_mapping
  for select using (auth.uid() is not null);
create policy "kyp_status_mapping_insert" on public.kyp_status_mapping
  for insert with check (auth.uid() is not null);
create policy "kyp_status_mapping_update" on public.kyp_status_mapping
  for update using (auth.uid() is not null);
create policy "kyp_status_mapping_delete" on public.kyp_status_mapping
  for delete using (auth.uid() is not null);

-- Audit-log: elke terugmeld-poging, met KYP-respons. Append-only in de praktijk.
create table if not exists public.kyp_writeback_log (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           text,
  speeq_project_id    text not null,
  speeq_controlepunt_id text,
  kyp_project_id      integer,
  kyp_activity_id     integer not null,
  actie               text not null
    check (actie in ('gereed_melden','heropenen')),
  status              text not null
    check (status in ('gelukt','mislukt')),
  http_status         integer,
  foutmelding         text,
  uitgevoerd_door     uuid references auth.users(id),
  uitgevoerd_at       timestamptz not null default now()
);

create index if not exists kyp_writeback_log_project_idx
  on public.kyp_writeback_log (speeq_project_id, uitgevoerd_at desc);

alter table public.kyp_writeback_log enable row level security;

create policy "kyp_writeback_log_select" on public.kyp_writeback_log
  for select using (auth.uid() is not null);
create policy "kyp_writeback_log_insert" on public.kyp_writeback_log
  for insert with check (auth.uid() is not null);
