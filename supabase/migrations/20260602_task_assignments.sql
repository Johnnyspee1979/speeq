-- Sprint 2: Taak toewijzing
-- Een werkvoorbereider kan borgingspunten toewijzen aan specifieke vakmansen

create table if not exists public.task_assignments (
  id              uuid primary key default gen_random_uuid(),
  project_id      text not null,
  inspection_point_id text not null,
  assigned_to     uuid references auth.users(id),
  assigned_by     uuid references auth.users(id),
  priority        text not null default 'NORMAAL'
                    check (priority in ('LAAG', 'NORMAAL', 'HOOG', 'URGENT')),
  deadline        date,
  notes           text,
  status          text not null default 'OPEN'
                    check (status in ('OPEN', 'IN_PROGRESS', 'DONE', 'BLOCKED')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists task_assignments_project_idx   on public.task_assignments (project_id);
create index if not exists task_assignments_assigned_idx  on public.task_assignments (assigned_to);
create index if not exists task_assignments_point_idx     on public.task_assignments (project_id, inspection_point_id);

alter table public.task_assignments enable row level security;

-- Iedereen die ingelogd is mag toewijzingen lezen van hun eigen project
create policy "task_assignments_select"
  on public.task_assignments for select
  using (auth.uid() is not null);

-- Alleen admins/WV mogen toewijzingen aanmaken
create policy "task_assignments_insert"
  on public.task_assignments for insert
  with check (
    auth.uid() is not null
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('ADMIN', 'WERKVOORBEREIDER', 'PROJECTLEIDER')
    )
  );

-- Maker of admin mag aanpassen
create policy "task_assignments_update"
  on public.task_assignments for update
  using (
    auth.uid() = assigned_by
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('ADMIN', 'WERKVOORBEREIDER', 'PROJECTLEIDER')
    )
  );

-- Maker of admin mag verwijderen
create policy "task_assignments_delete"
  on public.task_assignments for delete
  using (
    auth.uid() = assigned_by
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('ADMIN', 'WERKVOORBEREIDER', 'PROJECTLEIDER')
    )
  );

-- Auto-update updated_at trigger
create or replace function public.set_task_assignment_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger task_assignment_updated_at
  before update on public.task_assignments
  for each row execute function public.set_task_assignment_updated_at();
