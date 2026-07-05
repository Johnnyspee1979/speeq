-- ─────────────────────────────────────────────────────────────────────────────
-- Bewijs-van-aanwezigheid bij controlepunten
-- ─────────────────────────────────────────────────────────────────────────────
-- Een controleerbaar spoor van waar/wanneer een controlepunt is vastgelegd —
-- momentopname bij een bewust vastlegmoment, GEEN tracking, GEEN juridische claim.
-- Aanleiding: Wkb-evaluatie 2026, kritiek dat fysiek bouwplaatsbezoek niet
-- aantoonbaar is.
--
-- Privacy: locatie is opt-in per project (location_evidence_enabled). Zonder
-- toestemming/GPS gaat alles gewoon door; het item wordt 'ZONDER_LOCATIE'.

alter table public.evidence
  add column if not exists presence_lat        numeric,
  add column if not exists presence_lng        numeric,
  add column if not exists presence_accuracy_m numeric,
  add column if not exists presence_device_time timestamptz,
  add column if not exists presence_server_time timestamptz,
  add column if not exists presence_status     text
    check (presence_status in ('OP_LOCATIE','ZONDER_LOCATIE'));

-- Project-instelling: opt-in locatiebewijs. Aparte tabel zodat het ook per
-- project uit te zetten is zonder de evidence-rijen te raken.
create table if not exists public.project_location_settings (
  project_id                text primary key,
  tenant_id                 text,
  location_evidence_enabled boolean not null default false,
  updated_by                uuid references auth.users(id),
  updated_at                timestamptz not null default now()
);

alter table public.project_location_settings enable row level security;

create policy "project_location_settings_select" on public.project_location_settings
  for select using (auth.uid() is not null);

create policy "project_location_settings_insert" on public.project_location_settings
  for insert with check (auth.uid() is not null);

create policy "project_location_settings_update" on public.project_location_settings
  for update using (auth.uid() is not null);
