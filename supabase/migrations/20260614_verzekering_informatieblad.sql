-- ─────────────────────────────────────────────────────────────────────────────
-- Verzekering & financiële zekerheid — bedrijfsstandaard + per-project blad
-- ─────────────────────────────────────────────────────────────────────────────
-- Drie tabellen: de bedrijfsstandaard-dekking (eenmalig per tenant), het
-- per-project informatieblad (override + datum), en de overhandiging-bevestiging
-- met tijdstempel (aantoonbaar "vooraf geïnformeerd"). Per tenant; RLS aan.
-- Offline-first: de app stelt lokaal samen, dit is de sync-bron.

create table if not exists public.verzekering_bedrijfsstandaard (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     text,
  aannemer      text not null,
  -- Dekkingen als JSON-array (vorm, omschrijving, periode, bewijsVerwijzing).
  dekkingen     jsonb not null default '[]'::jsonb,
  bijgewerkt_at timestamptz not null default now(),
  unique (tenant_id)
);

create table if not exists public.verzekering_informatieblad (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       text,
  project_id      text not null,
  -- Optionele per-project override; leeg = bedrijfsstandaard gebruiken.
  dekkingen       jsonb not null default '[]'::jsonb,
  blad_datum      date not null default current_date,
  bijgewerkt_at   timestamptz not null default now(),
  unique (tenant_id, project_id)
);

create table if not exists public.verzekering_overhandiging (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      text,
  project_id     text not null,
  overhandigd_at timestamptz not null default now(),
  notitie        text,
  geregistreerd_door uuid references auth.users(id)
);

create index if not exists verzekering_overhandiging_project_idx
  on public.verzekering_overhandiging (project_id, overhandigd_at desc);

alter table public.verzekering_bedrijfsstandaard enable row level security;
alter table public.verzekering_informatieblad enable row level security;
alter table public.verzekering_overhandiging enable row level security;

create policy "verzekering_bedrijfsstandaard_select" on public.verzekering_bedrijfsstandaard
  for select using (auth.uid() is not null);
create policy "verzekering_bedrijfsstandaard_insert" on public.verzekering_bedrijfsstandaard
  for insert with check (auth.uid() is not null);
create policy "verzekering_bedrijfsstandaard_update" on public.verzekering_bedrijfsstandaard
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "verzekering_informatieblad_select" on public.verzekering_informatieblad
  for select using (auth.uid() is not null);
create policy "verzekering_informatieblad_insert" on public.verzekering_informatieblad
  for insert with check (auth.uid() is not null);
create policy "verzekering_informatieblad_update" on public.verzekering_informatieblad
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "verzekering_overhandiging_select" on public.verzekering_overhandiging
  for select using (auth.uid() is not null);
create policy "verzekering_overhandiging_insert" on public.verzekering_overhandiging
  for insert with check (auth.uid() is not null);
