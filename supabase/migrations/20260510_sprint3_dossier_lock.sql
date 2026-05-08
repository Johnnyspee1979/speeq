-- Sprint 3: Dossier Lock (WKB juridische bewaarplicht)
-- Datum: 2026-05-10
--
-- Een afgesloten WKB-borgingsdossier moet onveranderbaar (read-only) zijn.
-- Na het tekenen + genereren van de PDF wordt het dossier op LOCKED gezet.
-- Daarna mogen evidence-rijen die bij dat dossier horen niet meer aangepast worden.

-- ── 1. dossiers tabel ───────────────────────────────────────────────────────
create table if not exists public.dossiers (
  id              uuid primary key default gen_random_uuid(),
  project_id      text not null,
  status          text not null default 'OPEN' check (status in ('OPEN','LOCKED')),
  pdf_url         text,
  signed_by_pl    text,
  signed_by_og    text,
  signed_at       timestamptz,
  locked_at       timestamptz,
  locked_by       uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists dossiers_project_idx on public.dossiers (project_id);
create index if not exists dossiers_status_idx on public.dossiers (status);

alter table public.dossiers enable row level security;

create policy "dossiers_select"
  on public.dossiers for select
  using (auth.uid() is not null);

create policy "dossiers_insert"
  on public.dossiers for insert
  with check (auth.uid() is not null);

-- Alleen ADMIN/PL/WV mag locken; daarna is het read-only voor iedereen
create policy "dossiers_update_only_when_open"
  on public.dossiers for update
  using (
    status = 'OPEN'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('ADMIN', 'WERKVOORBEREIDER', 'PROJECTLEIDER')
    )
  );

-- ── 2. evidence: koppeling aan dossier ──────────────────────────────────────
alter table public.evidence
  add column if not exists dossier_id uuid references public.dossiers(id),
  add column if not exists is_locked boolean not null default false;

create index if not exists evidence_dossier_idx on public.evidence (dossier_id)
  where dossier_id is not null;

-- ── 3. Trigger: blokkeer evidence updates als is_locked = true ──────────────
create or replace function public.prevent_locked_evidence_changes()
returns trigger
language plpgsql
as $$
begin
  if old.is_locked = true then
    raise exception 'Dit bewijs zit in een afgesloten dossier en kan niet meer gewijzigd worden.';
  end if;
  return new;
end;
$$;

drop trigger if exists evidence_lock_guard on public.evidence;
create trigger evidence_lock_guard
  before update on public.evidence
  for each row
  when (old.is_locked = true)
  execute function public.prevent_locked_evidence_changes();

-- ── 4. Helper functie: dossier locken in één transactie ─────────────────────
create or replace function public.lock_dossier(p_dossier_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Markeer alle evidence van dit dossier als locked
  update public.evidence
    set is_locked = true
    where dossier_id = p_dossier_id;

  -- Sluit het dossier
  update public.dossiers
    set status = 'LOCKED',
        locked_at = now(),
        locked_by = auth.uid(),
        updated_at = now()
    where id = p_dossier_id
      and status = 'OPEN';
end;
$$;
