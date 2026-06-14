-- ─────────────────────────────────────────────────────────────────────────────
-- Verklaring-statusmonitor — projectinstellingen + checklist-eisen
-- ─────────────────────────────────────────────────────────────────────────────
-- Per project: geplande gereedmeldingsdatum + drempel (werkdagen) voor de
-- tijdlijn-trigger, plus de uit het borgingsplan afgeleide checklist-eisen voor
-- de borger-verklaring. Per tenant; RLS aan. Offline-first: de app rekent
-- lokaal, dit is de sync-bron.

create table if not exists public.verklaring_monitor_settings (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             text,
  project_id            text not null,
  gereedmelding_datum   date,
  drempel_werkdagen     integer not null default 10,
  bijgewerkt_at         timestamptz not null default now(),
  unique (tenant_id, project_id)
);

create table if not exists public.verklaring_monitor_eis (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     text,
  project_id    text not null,
  eis_sleutel   text not null,
  naam          text not null,
  soort         text not null default 'overig',
  kritisch      boolean not null default false,
  deadline      date,
  aanwezig      boolean not null default false,
  bijgewerkt_at timestamptz not null default now(),
  unique (tenant_id, project_id, eis_sleutel)
);

create index if not exists verklaring_monitor_eis_project_idx
  on public.verklaring_monitor_eis (project_id);

alter table public.verklaring_monitor_settings enable row level security;
alter table public.verklaring_monitor_eis enable row level security;

create policy "verklaring_monitor_settings_select" on public.verklaring_monitor_settings
  for select using (auth.uid() is not null);
create policy "verklaring_monitor_settings_insert" on public.verklaring_monitor_settings
  for insert with check (auth.uid() is not null);
create policy "verklaring_monitor_settings_update" on public.verklaring_monitor_settings
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "verklaring_monitor_eis_select" on public.verklaring_monitor_eis
  for select using (auth.uid() is not null);
create policy "verklaring_monitor_eis_insert" on public.verklaring_monitor_eis
  for insert with check (auth.uid() is not null);
create policy "verklaring_monitor_eis_update" on public.verklaring_monitor_eis
  for update using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "verklaring_monitor_eis_delete" on public.verklaring_monitor_eis
  for delete using (auth.uid() is not null);
