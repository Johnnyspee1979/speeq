-- Team disciplines & vakman-rollen migratie
-- Voegt job_type, disciplines, extra taken en projectkoppeling toe aan profiles

alter table if exists public.profiles
  add column if not exists display_name text,
  add column if not exists phone text,
  add column if not exists job_type text not null default 'VAKMAN',
  add column if not exists disciplines text[] not null default '{}',
  add column if not exists extra_task_ids text[] not null default '{}',
  add column if not exists project_ids text[] not null default '{}',
  add column if not exists invite_token text,
  add column if not exists invite_accepted_at timestamptz,
  add column if not exists last_seen_at timestamptz;

-- Index voor snelle discipline-lookup
create index if not exists idx_profiles_disciplines
  on public.profiles using gin (disciplines);

-- Index voor project-koppeling
create index if not exists idx_profiles_project_ids
  on public.profiles using gin (project_ids);

-- Admin mag alle profielen zien binnen hetzelfde bedrijf
drop policy if exists "profiles_admin_select" on public.profiles;
create policy "profiles_admin_select"
  on public.profiles
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('ADMIN', 'WERKVOORBEREIDER')
    )
  );

-- Admin mag profielen aanmaken (uitnodigen)
drop policy if exists "profiles_admin_insert" on public.profiles;
create policy "profiles_admin_insert"
  on public.profiles
  for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('ADMIN', 'WERKVOORBEREIDER')
    )
  );

-- Admin mag profielen bijwerken (disciplines wijzigen)
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update"
  on public.profiles
  for update
  using (
    auth.uid() = id or
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('ADMIN', 'WERKVOORBEREIDER')
    )
  );

-- Vacman mag eigen profiel zien
drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select"
  on public.profiles
  for select
  using (auth.uid() = id);

comment on column public.profiles.job_type is
  'WERKVOORBEREIDER | UITVOERDER | TIMMERMAN | METSELAAR | LOODGIETER | '
  'ELECTRICIEN | KITTER | SCHILDER | DAKDEKKER | ISOLATIESPECIALIST | '
  'BRANDVEILIGHEID | KEUKENBOUWER | VAKMAN';

comment on column public.profiles.disciplines is
  'Categorieën waartoe de vakman toegang heeft: '
  'BOUW | BOUWFYSICA | BRANDVEILIGHEID | INSTALLATIE | ELEKTRA | AFBOUW_SCHILDER';

comment on column public.profiles.extra_task_ids is
  'Losse borgingspunt-IDs die de admin extra heeft toegewezen buiten de discipline.';

comment on column public.profiles.project_ids is
  'Projecten waartoe de vakman toegang heeft (leeg = alle projecten).';
