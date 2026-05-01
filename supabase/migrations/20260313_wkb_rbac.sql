-- Wkb RBAC / RLS basis voor multi-tenant bewijsvoering
-- Deze migratie is defensief opgezet zodat hij herhaalbaar blijft in omgevingen
-- waar tabellen of kolommen al deels bestaan.

create table if not exists public.profiles (
  id uuid primary key,
  email text,
  role text not null default 'ONDERAANNEMER',
  company_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.profiles enable row level security;

do $$
begin
  if to_regclass('public.evidence') is not null then
    alter table public.evidence add column if not exists user_id uuid;
  end if;

  if to_regclass('public.projects') is not null then
    alter table public.projects add column if not exists owner_id uuid;
    alter table public.projects add column if not exists kwaliteitsborger_id uuid;
  end if;
end $$;

create or replace function public.current_wkb_role()
returns text
language sql
stable
as $$
  select role
  from public.profiles
  where id = auth.uid()
$$;

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select"
on public.profiles
for select
using (auth.uid() = id);

do $$
begin
  if to_regclass('public.evidence') is not null then
    execute 'alter table public.evidence enable row level security';

    execute 'drop policy if exists "evidence_self_select" on public.evidence';
    execute 'create policy "evidence_self_select"
      on public.evidence
      for select
      using (auth.uid() = user_id)';

    execute 'drop policy if exists "evidence_self_insert" on public.evidence';
    execute 'create policy "evidence_self_insert"
      on public.evidence
      for insert
      with check (auth.uid() = user_id)';

    execute 'drop policy if exists "evidence_project_owner_select" on public.evidence';
    if to_regclass('public.projects') is not null then
      execute $policy$
        create policy "evidence_project_owner_select"
        on public.evidence
        for select
        using (
          exists (
            select 1
            from public.projects
            where public.projects.id = public.evidence.project_id
              and public.projects.owner_id = auth.uid()
          )
        )
      $policy$;
    end if;

    execute 'drop policy if exists "evidence_quality_assurer_select" on public.evidence';
    if to_regclass('public.projects') is not null then
      execute $policy$
        create policy "evidence_quality_assurer_select"
        on public.evidence
        for select
        using (
          exists (
            select 1
            from public.projects
            where public.projects.id = public.evidence.project_id
              and public.projects.kwaliteitsborger_id = auth.uid()
          )
        )
      $policy$;
    end if;

    execute 'drop policy if exists "evidence_quality_assurer_update" on public.evidence';
    if to_regclass('public.projects') is not null then
      execute $policy$
        create policy "evidence_quality_assurer_update"
        on public.evidence
        for update
        using (
          exists (
            select 1
            from public.projects
            where public.projects.id = public.evidence.project_id
              and public.projects.kwaliteitsborger_id = auth.uid()
          )
        )
        with check (
          exists (
            select 1
            from public.projects
            where public.projects.id = public.evidence.project_id
              and public.projects.kwaliteitsborger_id = auth.uid()
          )
        )
      $policy$;
    end if;
  end if;
end $$;
