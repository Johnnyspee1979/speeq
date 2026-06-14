-- ─────────────────────────────────────────────────────────────────────────────
-- Verbouw-modus — projecttype per project
-- ─────────────────────────────────────────────────────────────────────────────
-- Splitst projecten in 'gk1' (nieuwbouw, volledige Wkb-flow) en 'verbouw'
-- (vrijwillig privaat kwaliteitsdossier — valt nog niet onder de Wkb). Eén rij
-- per project; bewaard in de per-tenant DB (niet de master-DB). Default 'gk1'
-- zodat bestaande projecten ongewijzigd blijven.

create table if not exists public.project_type_settings (
  project_id   text primary key,
  tenant_id    text,
  projecttype  text not null default 'gk1'
    check (projecttype in ('gk1','verbouw')),
  updated_by   uuid references auth.users(id),
  updated_at   timestamptz not null default now()
);

alter table public.project_type_settings enable row level security;

create policy "project_type_settings_select" on public.project_type_settings
  for select using (auth.uid() is not null);

create policy "project_type_settings_insert" on public.project_type_settings
  for insert with check (auth.uid() is not null);

create policy "project_type_settings_update" on public.project_type_settings
  for update using (auth.uid() is not null);
