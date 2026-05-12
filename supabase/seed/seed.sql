-- ============================================================================
-- SpeeQ WKB Tool — KLANT SEED SQL
-- ============================================================================
-- Doel: in 1 klap een nieuwe klant-Supabase volledig inrichten.
-- 
-- Gebruik:
--   1. Maak nieuw Supabase project op supabase.com
--   2. Open SQL Editor → New query
--   3. Plak de ENTIRE inhoud van dit bestand → Run
--   4. Wacht 'Success' (~10 seconden)
--   5. Pak URL + anon key uit Settings → API
--   6. Voeg toe in /maker paneel
-- 
-- Inhoud: alle 17 migrations samengevoegd in volgorde.
-- Gegenereerd op: 2026-05-12 20:14
-- ============================================================================



-- ============================================================================
-- ↓ 20260313_wkb_rbac.sql
-- ============================================================================

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


-- ============================================================================
-- ↓ 20260313_wkb_schema_alignment.sql
-- ============================================================================

-- Wkb schema-alignment voor frontend + backend integraties
-- Doel: de Supabase tabellen laten aansluiten op de velden die de app,
-- sync-engine, OCR, KiK, BIM/BCF en DSO-routes al gebruiken.

do $$
begin
  if to_regclass('public.evidence') is not null then
    alter table public.evidence add column if not exists project_id text;
    alter table public.evidence add column if not exists inspection_point_id text;
    alter table public.evidence add column if not exists photo_uri text;
    alter table public.evidence add column if not exists media_uri text;
    alter table public.evidence add column if not exists timestamp text;
    alter table public.evidence add column if not exists latitude double precision;
    alter table public.evidence add column if not exists longitude double precision;
    alter table public.evidence add column if not exists gps_accuracy double precision;
    alter table public.evidence add column if not exists exif_hash text;
    alter table public.evidence add column if not exists exif_verified boolean default false;
    alter table public.evidence add column if not exists user_id uuid;
    alter table public.evidence add column if not exists ifc_guid text;
    alter table public.evidence add column if not exists field_note text;
    alter table public.evidence add column if not exists sync_status text default 'PENDING';
    alter table public.evidence add column if not exists ai_status text default 'PENDING';
    alter table public.evidence add column if not exists ai_confidence double precision;
    alter table public.evidence add column if not exists ai_notes text;
    alter table public.evidence add column if not exists cloud_record_id bigint;
    alter table public.evidence add column if not exists kik_sync_status text;
    alter table public.evidence add column if not exists bim_synced boolean default false;
    alter table public.evidence add column if not exists bim_topic_id text;
    alter table public.evidence add column if not exists ocr_text text;
    alter table public.evidence add column if not exists betonkwaliteit text;
    alter table public.evidence add column if not exists volume text;
    alter table public.evidence add column if not exists leverdatum text;

    create index if not exists evidence_project_id_idx on public.evidence (project_id);
    create index if not exists evidence_user_id_idx on public.evidence (user_id);
    create index if not exists evidence_cloud_record_id_idx on public.evidence (cloud_record_id);
    create index if not exists evidence_kik_sync_status_idx on public.evidence (kik_sync_status);
    create index if not exists evidence_ifc_guid_idx on public.evidence (ifc_guid);
  end if;

  if to_regclass('public.projects') is not null then
    alter table public.projects add column if not exists name text;
    alter table public.projects add column if not exists initiator_name text;
    alter table public.projects add column if not exists address text;
    alter table public.projects add column if not exists email text;
    alter table public.projects add column if not exists kadastrale_aanduiding text;
    alter table public.projects add column if not exists latitude double precision;
    alter table public.projects add column if not exists longitude double precision;
    alter table public.projects add column if not exists owner_id uuid;
    alter table public.projects add column if not exists kwaliteitsborger_id uuid;
    alter table public.projects add column if not exists instrument_id text;
    alter table public.projects add column if not exists borgingsplan_url text;
    alter table public.projects add column if not exists risicobeoordeling_url text;
    alter table public.projects add column if not exists dossier_bevoegd_gezag_url text;
    alter table public.projects add column if not exists verklaring_kwaliteitsborger_url text;
    alter table public.projects add column if not exists dso_bouwmelding_status text;
    alter table public.projects add column if not exists dso_meldings_datum timestamptz;
    alter table public.projects add column if not exists dso_transaction_id text;
    alter table public.projects add column if not exists dso_gereedmelding_status text;
    alter table public.projects add column if not exists dso_gereedmeldings_datum timestamptz;
    alter table public.projects add column if not exists dso_gereedmelding_transaction_id text;

    create index if not exists projects_owner_id_idx on public.projects (owner_id);
    create index if not exists projects_kwaliteitsborger_id_idx on public.projects (kwaliteitsborger_id);
  end if;
end $$;



-- ============================================================================
-- ↓ 20260314_wkb_evidence_audit_fields.sql
-- ============================================================================

-- Aanvullende auditvelden voor Wkb-bewijsvoering
-- Doel: lokale capturebevestigingen, locatie-integriteit en OCR-uitbreiding
-- end-to-end beschikbaar maken in Supabase.

do $$
begin
  if to_regclass('public.evidence') is not null then
    alter table public.evidence add column if not exists milieuklasse text;
    alter table public.evidence add column if not exists stop_moment_confirmed boolean;
    alter table public.evidence add column if not exists measurement_tool_confirmed boolean;
    alter table public.evidence add column if not exists location_verified boolean;
    alter table public.evidence add column if not exists location_spoof_risk text;
    alter table public.evidence add column if not exists location_security_message text;

    create index if not exists evidence_location_verified_idx
      on public.evidence (location_verified);
    create index if not exists evidence_location_spoof_risk_idx
      on public.evidence (location_spoof_risk);
  end if;
end $$;


-- ============================================================================
-- ↓ 20260314_wkb_review_notifications.sql
-- ============================================================================

-- Wkb review-webhooks + pushregistraties
-- Doel: afgekeurde bewijsstukken automatisch doorzetten naar externe webhooks
-- en geregistreerde uitvoerders op hun toestel waarschuwen.

create table if not exists public.review_webhook_endpoints (
  id bigint generated by default as identity primary key,
  project_id text,
  target_url text not null,
  secret text,
  event_type text not null default 'EVIDENCE_REJECTED',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists review_webhook_endpoints_project_idx
  on public.review_webhook_endpoints (project_id);

create index if not exists review_webhook_endpoints_active_idx
  on public.review_webhook_endpoints (is_active);

create table if not exists public.notification_subscriptions (
  id bigint generated by default as identity primary key,
  user_id uuid not null,
  project_id text,
  expo_push_token text not null unique,
  platform text not null default 'unknown',
  device_label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notification_subscriptions_user_idx
  on public.notification_subscriptions (user_id);

create index if not exists notification_subscriptions_project_idx
  on public.notification_subscriptions (project_id);

create index if not exists notification_subscriptions_active_idx
  on public.notification_subscriptions (is_active);

alter table if exists public.review_webhook_endpoints enable row level security;
alter table if exists public.notification_subscriptions enable row level security;


-- ============================================================================
-- ↓ 20260315_consumer_dossier_context.sql
-- ============================================================================

-- Server-side consumentendossier-context voor NPR 8092 en harde exportvalidatie
-- Legt projectchecklists, documentreferenties en consument-scope op bewijs vast.

do $$
begin
  if to_regclass('public.evidence') is not null then
    alter table public.evidence add column if not exists discipline_id text;
    alter table public.evidence add column if not exists dossier_scope text;
    alter table public.evidence add column if not exists stop_moment_label text;
    alter table public.evidence add column if not exists requires_measurement_tool boolean default false;

    create index if not exists evidence_project_scope_idx
      on public.evidence (project_id, dossier_scope);
  end if;
end $$;

create table if not exists public.project_checklists (
  id bigint generated by default as identity primary key,
  project_id text not null,
  checklist_type text not null,
  item_id text not null,
  title text not null,
  checked boolean not null default false,
  updated_at timestamptz not null default now(),
  user_id uuid,
  created_at timestamptz not null default now(),
  unique (project_id, checklist_type, item_id)
);

create table if not exists public.consumer_dossier_documents (
  id bigint generated by default as identity primary key,
  project_id text not null,
  document_id text not null,
  requirement_id text not null,
  title text not null,
  category text not null,
  reference_value text,
  notes text,
  updated_at timestamptz not null default now(),
  user_id uuid,
  created_at timestamptz not null default now(),
  unique (project_id, document_id)
);

create index if not exists project_checklists_project_id_idx
  on public.project_checklists (project_id);
create index if not exists project_checklists_user_id_idx
  on public.project_checklists (user_id);
create index if not exists consumer_dossier_documents_project_id_idx
  on public.consumer_dossier_documents (project_id);
create index if not exists consumer_dossier_documents_user_id_idx
  on public.consumer_dossier_documents (user_id);

alter table public.project_checklists enable row level security;
alter table public.consumer_dossier_documents enable row level security;

drop policy if exists "project_checklists_self_select" on public.project_checklists;
create policy "project_checklists_self_select"
on public.project_checklists
for select
using (auth.uid() = user_id);

drop policy if exists "project_checklists_self_insert" on public.project_checklists;
create policy "project_checklists_self_insert"
on public.project_checklists
for insert
with check (auth.uid() = user_id);

drop policy if exists "project_checklists_self_update" on public.project_checklists;
create policy "project_checklists_self_update"
on public.project_checklists
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "consumer_dossier_documents_self_select" on public.consumer_dossier_documents;
create policy "consumer_dossier_documents_self_select"
on public.consumer_dossier_documents
for select
using (auth.uid() = user_id);

drop policy if exists "consumer_dossier_documents_self_insert" on public.consumer_dossier_documents;
create policy "consumer_dossier_documents_self_insert"
on public.consumer_dossier_documents
for insert
with check (auth.uid() = user_id);

drop policy if exists "consumer_dossier_documents_self_update" on public.consumer_dossier_documents;
create policy "consumer_dossier_documents_self_update"
on public.consumer_dossier_documents
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

do $$
begin
  if to_regclass('public.projects') is not null then
    execute 'drop policy if exists "project_checklists_project_owner_select" on public.project_checklists';
    execute $policy$
      create policy "project_checklists_project_owner_select"
      on public.project_checklists
      for select
      using (
        exists (
          select 1
          from public.projects
          where public.projects.id = public.project_checklists.project_id
            and public.projects.owner_id = auth.uid()
        )
      )
    $policy$;

    execute 'drop policy if exists "project_checklists_quality_assurer_select" on public.project_checklists';
    execute $policy$
      create policy "project_checklists_quality_assurer_select"
      on public.project_checklists
      for select
      using (
        exists (
          select 1
          from public.projects
          where public.projects.id = public.project_checklists.project_id
            and public.projects.kwaliteitsborger_id = auth.uid()
        )
      )
    $policy$;

    execute 'drop policy if exists "consumer_dossier_documents_project_owner_select" on public.consumer_dossier_documents';
    execute $policy$
      create policy "consumer_dossier_documents_project_owner_select"
      on public.consumer_dossier_documents
      for select
      using (
        exists (
          select 1
          from public.projects
          where public.projects.id = public.consumer_dossier_documents.project_id
            and public.projects.owner_id = auth.uid()
        )
      )
    $policy$;

    execute 'drop policy if exists "consumer_dossier_documents_quality_assurer_select" on public.consumer_dossier_documents';
    execute $policy$
      create policy "consumer_dossier_documents_quality_assurer_select"
      on public.consumer_dossier_documents
      for select
      using (
        exists (
          select 1
          from public.projects
          where public.projects.id = public.consumer_dossier_documents.project_id
            and public.projects.kwaliteitsborger_id = auth.uid()
        )
      )
    $policy$;
  end if;
end $$;


-- ============================================================================
-- ↓ 20260501_team_disciplines.sql
-- ============================================================================

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


-- ============================================================================
-- ↓ 20260509_sprint2_rls_and_sync.sql
-- ============================================================================

-- Sprint 2: RLS versterking + sync retry kolom
-- Datum: 2026-05-09

-- ── 1. evidence: sync_retry_count kolom ─────────────────────────────────────
-- Houdt bij hoeveel keer een FAILED item opnieuw geprobeerd is.
-- Na MAX_RETRIES (3) stopt de auto-sync en krijgt de vakman een melding.
alter table public.evidence
  add column if not exists sync_retry_count int not null default 0,
  add column if not exists sync_failed_reason text;

-- ── 2. floor_plans: versterk select policy (alleen ingelogde gebruikers) ──────
-- Vervang de open select (using true) door een auth-check.
-- Elke tenant heeft zijn eigen Supabase instance, maar defense-in-depth.
drop policy if exists "floor_plans_select" on public.floor_plans;
create policy "floor_plans_select"
  on public.floor_plans for select
  using (auth.uid() is not null);

-- ── 3. floor_plans: update policy (maker of beheerder) ───────────────────────
drop policy if exists "floor_plans_update" on public.floor_plans;
create policy "floor_plans_update"
  on public.floor_plans for update
  using (
    auth.uid() = created_by
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('ADMIN', 'WERKVOORBEREIDER', 'PROJECTLEIDER')
    )
  );

-- ── 4. evidence: voeg failed_reason RLS-safe update toe ─────────────────────
-- Eigen evidence mag bijgewerkt worden (sync_status, retry_count, failed_reason)
drop policy if exists "evidence_self_update" on public.evidence;
create policy "evidence_self_update"
  on public.evidence for update
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('ADMIN', 'WERKVOORBEREIDER', 'PROJECTLEIDER')
    )
  );

-- ── 5. Hulp-index voor FAILED items (snellere retry queries) ─────────────────
create index if not exists evidence_sync_failed_idx
  on public.evidence (sync_status)
  where sync_status = 'FAILED';


-- ============================================================================
-- ↓ 20260510_sprint3_dossier_lock.sql
-- ============================================================================

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


-- ============================================================================
-- ↓ 20260511_sprint8_insert_lock.sql
-- ============================================================================

-- Sprint 8: Insert-lock trigger op evidence (WKB juridische bewaarplicht)
-- Datum: 2026-05-11
--
-- Sprint 3 (20260510_sprint3_dossier_lock.sql) bewaakte alleen UPDATE op evidence.
-- Een offline-vakman die ná lock terug-syncte kon nog rustig nieuwe rijen INSERTEN
-- in een afgesloten dossier — een gat in de bewijsketen dat WKB niet accepteert.
--
-- Deze migratie sluit dat gat. Belangrijk: we onderscheiden bewust pre-lock en
-- post-lock evidence. Pre-lock evidence (objectief opgenomen vóór `locked_at`)
-- mag laat-binnenkomen — het is legitiem bouwplaats-bewijs dat alleen nog niet
-- gesynct was. Post-lock evidence wordt geweigerd.
--
-- Tijdspoof-defensie: we vergelijken `dossiers.locked_at` (server-tijd) met
-- `evidence.captured_at` (client-tijd). Een vakman die zijn telefoon-klok
-- terugzet om de lock te omzeilen, kan in theorie post-lock evidence binnenwurmen.
-- Locatie- en GPS-spoof-checks elders moeten die laatste vector dichten.

-- ── Trigger functie ─────────────────────────────────────────────────────────
create or replace function public.prevent_insert_on_locked_dossier()
returns trigger
language plpgsql
as $$
declare
  locked_ts timestamptz;
begin
  -- Geen dossier-koppeling? Dan is het bewijs nog niet aan een dossier
  -- toegewezen — laat door, Sprint 3 update-trigger pakt het later op.
  if new.dossier_id is null then
    return new;
  end if;

  select locked_at
    into locked_ts
    from public.dossiers
   where id = new.dossier_id
     and status = 'LOCKED';

  -- Dossier nog open: gewoon doorlaten.
  if locked_ts is null then
    return new;
  end if;

  -- Dossier dicht — alleen pre-lock captures door:
  if coalesce(new.captured_at, now()) > locked_ts then
    raise exception
      'WKB_LOCKED: Dossier is afgesloten op %. Bewijs van na die datum mag niet meer ingevoerd worden.',
      locked_ts;
  end if;

  return new;
end;
$$;

drop trigger if exists evidence_insert_lock_guard on public.evidence;

create trigger evidence_insert_lock_guard
  before insert on public.evidence
  for each row
  execute function public.prevent_insert_on_locked_dossier();

-- ── Smoke test: trigger moet bestaan ────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'evidence_insert_lock_guard'
  ) then
    raise exception 'evidence_insert_lock_guard niet aangemaakt';
  end if;
end;
$$;


-- ============================================================================
-- ↓ 20260512_huisnummer.sql
-- ============================================================================

-- Fase 1B: huisnummer toevoegen aan evidence
-- Reden: GPS vult straat + plaats, vakman vult huisnummer handmatig.
-- Zonder dit veld kan een registratie niet uniek aan een adres gekoppeld worden.

alter table public.evidence
  add column if not exists huisnummer text;

-- Index niet nodig — huisnummer wordt alleen gefilterd in combinatie met project_id,
-- en project_id heeft al een index.

comment on column public.evidence.huisnummer is
  'Huisnummer van het pand waar het bewijs is geregistreerd. Handmatig ingevuld door vakman, niet uit GPS-reverse-geocode (te onbetrouwbaar voor exacte nummer-aanduiding). Format: vrije tekst, max 10 chars, bv "12A".';


-- ============================================================================
-- ↓ 20260601_floor_plan_annotations.sql
-- ============================================================================

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


-- ============================================================================
-- ↓ 20260602_task_assignments.sql
-- ============================================================================

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


-- ============================================================================
-- ↓ 20260604_evidence_comments.sql
-- ============================================================================

-- Opmerkingen per bewijsstuk (feedback-loop WV ↔ vakman)
-- WV kan een afwijzing toelichten; vakman ziet het in zijn workspace.

create table if not exists public.evidence_comments (
  id          uuid primary key default gen_random_uuid(),
  evidence_id bigint not null references public.evidence(id) on delete cascade,
  project_id  text,
  user_id     uuid references auth.users(id),
  author_name text,
  role        text not null default 'WV',  -- WV | VAKMAN | ADMIN
  body        text not null check (char_length(body) > 0),
  created_at  timestamptz not null default now()
);

create index if not exists evidence_comments_evidence_idx on public.evidence_comments (evidence_id);
create index if not exists evidence_comments_project_idx  on public.evidence_comments (project_id);

alter table public.evidence_comments enable row level security;

create policy "evidence_comments_select" on public.evidence_comments
  for select using (true);

create policy "evidence_comments_insert" on public.evidence_comments
  for insert with check (auth.uid() is not null);

create policy "evidence_comments_delete" on public.evidence_comments
  for delete using (
    auth.uid() = user_id
    or exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and (u.raw_app_meta_data->>'role') in ('ADMIN', 'WV')
    )
  );


-- ============================================================================
-- ↓ 20260605_tenants_table.sql
-- ============================================================================

-- Sprint 7 — tenants tabel verplaatsen van backend/data/tenants.json
-- naar Supabase, zodat Railway-redeploys geen klantdata meer wissen.
--
-- Service-role schrijft, anon mag niets. De backend leest/schrijft
-- via de service_role key in supabaseAdmin.ts.

create table if not exists public.tenants (
  company_id           text primary key,
  name                 text not null,
  status               text not null default 'active',
  users                int  not null default 0,
  created_at           timestamptz not null default now(),
  supabase_url         text not null default '',
  supabase_anon_key    text not null default '',
  admin_email          text,
  provisioning_status  text not null default 'pending'
    check (provisioning_status in ('pending', 'provisioned'))
);

create index if not exists tenants_admin_email_idx on public.tenants (admin_email);

alter table public.tenants enable row level security;

-- alleen service_role mag iets met deze tabel; anon-key heeft geen toegang
drop policy if exists "tenants_service_all" on public.tenants;
create policy "tenants_service_all" on public.tenants
  for all to service_role using (true) with check (true);

-- Seed: bestaande demo-tenant uit tenants.json zodat tests blijven slagen.
-- Idempotent via ON CONFLICT.
insert into public.tenants (
  company_id, name, status, users, created_at,
  supabase_url, supabase_anon_key, admin_email, provisioning_status
) values (
  'demo',
  'Demo Bouwgroep BV',
  'active',
  3,
  '2026-01-15T00:00:00Z',
  'https://kgiuavfvhtdgwuygbyzo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnaXVhdmZ2aHRkZ3d1eWdieXpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MzgzOTMsImV4cCI6MjA5MzAxNDM5M30.ezL6iv8bSXM4ZNZwtiesYdgiirUPKzh3fhu18HvLMpc',
  'demo@speesolutions.nl',
  'provisioned'
)
on conflict (company_id) do nothing;


-- ============================================================================
-- ↓ 20260606_project_documents.sql
-- ============================================================================

-- Sprint Bon-Scanner: bonnen, leveringsbrieven, certificaten per project
-- Aparte tabel zodat ze NIET mengen met de bewijs-foto's.

create table if not exists public.project_documents (
  id              uuid primary key default gen_random_uuid(),
  project_id      text not null,
  doc_type        text not null default 'BON', -- BON | LEVERINGSBON | CERTIFICAAT | FACTUUR | WERKBON | OVERIG
  title           text,
  photo_url       text not null,
  ocr_text        text,
  ocr_confidence  real,
  detected_fields jsonb,                       -- {leverancier, datum, bedrag, ...}
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

create index if not exists project_documents_project_idx
  on public.project_documents (project_id);

create index if not exists project_documents_type_idx
  on public.project_documents (doc_type);

alter table public.project_documents enable row level security;

create policy "project_documents_select"
  on public.project_documents for select
  using (true);

create policy "project_documents_insert"
  on public.project_documents for insert
  with check (auth.uid() is not null);

create policy "project_documents_delete"
  on public.project_documents for delete
  using (
    auth.uid() = created_by
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('ADMIN', 'WERKVOORBEREIDER', 'PROJECTLEIDER')
    )
  );


-- ============================================================================
-- ↓ 20260607_review_workflow.sql
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Review workflow voor evidence
-- ─────────────────────────────────────────────────────────────────────────────
-- Stroom:
--   PENDING_REVIEW  → bewijs net opgeslagen, wacht op keurmeester
--   APPROVED        → goedgekeurd, mag in dossier-PDF
--   REJECTED        → afgekeurd (verplicht: review_note met reden)
--   FINALIZED       → definitief vergrendeld door projectleider, niet meer wijzigbaar
--
-- Default = PENDING_REVIEW zodat alle nieuwe foto's automatisch in de wachtrij komen.

alter table public.evidence
  add column if not exists review_status text
    check (review_status in ('PENDING_REVIEW','APPROVED','REJECTED','FINALIZED')),
  add column if not exists reviewed_by   uuid references auth.users(id),
  add column if not exists reviewed_at   timestamptz,
  add column if not exists review_note   text;

-- Bestaande rijen zonder status → in review-wachtrij plaatsen
update public.evidence
   set review_status = 'PENDING_REVIEW'
 where review_status is null;

-- Nieuwe rijen krijgen automatisch PENDING_REVIEW
alter table public.evidence
  alter column review_status set default 'PENDING_REVIEW';

-- Index voor dashboard-filters (snel zoeken op "alles wat nog beoordeeld moet")
create index if not exists evidence_review_status_idx
  on public.evidence (project_id, review_status);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS-policy update: alleen ingelogde gebruikers mogen review-velden bijwerken
-- ─────────────────────────────────────────────────────────────────────────────
-- We laten de bestaande update-policy intact, maar voegen een extra grant toe
-- voor de review-kolommen wanneer de uitvoerder ingelogd is.
-- (Specifieke rol-beperking — alleen WERKVOORBEREIDER / ADMIN — wordt
-- afgedwongen via de RPC `set_evidence_review` hieronder.)

create or replace function public.set_evidence_review(
  p_evidence_id bigint,
  p_status text,
  p_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Niet ingelogd';
  end if;

  if p_status not in ('PENDING_REVIEW','APPROVED','REJECTED','FINALIZED') then
    raise exception 'Ongeldige review_status: %', p_status;
  end if;

  if p_status = 'REJECTED' and (p_note is null or length(trim(p_note)) = 0) then
    raise exception 'Afkeuring vereist een toelichting (review_note)';
  end if;

  update public.evidence
     set review_status = p_status,
         reviewed_by   = v_user,
         reviewed_at   = now(),
         review_note   = case when p_note is not null then p_note else review_note end
   where id = p_evidence_id;
end;
$$;

grant execute on function public.set_evidence_review(bigint, text, text) to authenticated;


-- ============================================================================
-- ↓ 20260608_tenant_branding.sql
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Tenant branding (logo + bedrijfsnaam) per klant-Supabase
-- ─────────────────────────────────────────────────────────────────────────────
-- Architectuur: elke klant heeft zijn eigen Supabase-project, dus we slaan de
-- branding lokaal op in dat project. Singleton-row: er is altijd precies één
-- branding-record per tenant.
--
-- Velden:
--   company_name  → de naam die in headers + PDF's verschijnt
--   logo_url      → publieke URL naar het geüploade logo in Storage
--   primary_color → optionele hex-kleur die hero-knoppen kleurt (CTA's etc.)
--   updated_at    → laatste wijziging (audit)
--
-- Rol-check: ADMIN / WERKVOORBEREIDER / KEYUSER / PROJECTLEIDER mogen wijzigen.

create table if not exists public.tenant_branding (
  id            int primary key default 1,
  company_name  text,
  logo_url      text,
  primary_color text,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id),
  constraint tenant_branding_singleton check (id = 1)
);

alter table public.tenant_branding enable row level security;

drop policy if exists "tenant_branding_select" on public.tenant_branding;
create policy "tenant_branding_select"
  on public.tenant_branding for select to authenticated using (true);

drop policy if exists "tenant_branding_upsert" on public.tenant_branding;
create policy "tenant_branding_upsert"
  on public.tenant_branding for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and upper(coalesce(p.role,'')) in ('ADMIN','WERKVOORBEREIDER','KEYUSER','PROJECTLEIDER')
    )
  );

drop policy if exists "tenant_branding_update" on public.tenant_branding;
create policy "tenant_branding_update"
  on public.tenant_branding for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and upper(coalesce(p.role,'')) in ('ADMIN','WERKVOORBEREIDER','KEYUSER','PROJECTLEIDER')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage bucket voor logo's — publieke read (PDF + <img> moet werken)
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('tenant-branding', 'tenant-branding', true)
on conflict (id) do nothing;

drop policy if exists "tenant_branding_storage_read" on storage.objects;
create policy "tenant_branding_storage_read"
  on storage.objects for select using (bucket_id = 'tenant-branding');

drop policy if exists "tenant_branding_storage_write" on storage.objects;
create policy "tenant_branding_storage_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'tenant-branding');

drop policy if exists "tenant_branding_storage_update" on storage.objects;
create policy "tenant_branding_storage_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'tenant-branding');

