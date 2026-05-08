-- Sprint 1: Tekening annotatie
-- Tabel voor geüploade bouwtekeningen per project

create table if not exists public.floor_plans (
  id          uuid primary key default gen_random_uuid(),
  project_id  text not null,
  name        text not null default 'Verdieping 0',
  file_url    text not null,
  file_type   text not null default 'PNG',
  width_px    int,
  height_px   int,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create index if not exists floor_plans_project_idx on public.floor_plans (project_id);

alter table public.floor_plans enable row level security;

-- Iedereen mag tekeningen lezen (publiek per project)
create policy "floor_plans_select"
  on public.floor_plans for select
  using (true);

-- Ingelogde gebruikers mogen tekeningen uploaden
create policy "floor_plans_insert"
  on public.floor_plans for insert
  with check (auth.uid() is not null);

-- Maker of admin mag tekeningen verwijderen
create policy "floor_plans_delete"
  on public.floor_plans for delete
  using (
    auth.uid() = created_by
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('ADMIN', 'WERKVOORBEREIDER', 'PROJECTLEIDER')
    )
  );

-- Pin-locatie op tekening koppelen aan evidence
alter table public.evidence
  add column if not exists floor_plan_id uuid references public.floor_plans(id),
  add column if not exists pin_x real,
  add column if not exists pin_y real;

create index if not exists evidence_floor_plan_idx on public.evidence (floor_plan_id)
  where floor_plan_id is not null;
