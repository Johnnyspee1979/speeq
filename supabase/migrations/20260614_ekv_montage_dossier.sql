-- ─────────────────────────────────────────────────────────────────────────────
-- EKV- en montage-dossier (prefab/industrieel bouwen)
-- ─────────────────────────────────────────────────────────────────────────────
-- Uitbreiding van het bestaande projectdossier: een fabrieks-EKV (erkende
-- kwaliteitsverklaring) per project + een montage-checklijst als apart spoor
-- naast de reguliere controlepunten. Offline-first; sync naar de juiste tenant.
-- Geen tweede dossier-engine — het hangt aan het project en rolt mee in de export.

-- EKV: één verklaring per project.
create table if not exists public.project_ekv (
  project_id   text primary key,
  tenant_id    text,
  nummer       text,
  uitgever     text,
  geldig_tot   date,
  bewijs_path  text,
  updated_by   uuid references auth.users(id),
  updated_at   timestamptz not null default now()
);

alter table public.project_ekv enable row level security;

create policy "project_ekv_select" on public.project_ekv
  for select using (auth.uid() is not null);
create policy "project_ekv_insert" on public.project_ekv
  for insert with check (auth.uid() is not null);
create policy "project_ekv_update" on public.project_ekv
  for update using (auth.uid() is not null);

-- Montage-checks: apart controlepunten-spoor.
create table if not exists public.project_montage_checks (
  id               uuid primary key default gen_random_uuid(),
  project_id       text not null,
  tenant_id        text,
  omschrijving     text not null,
  status           text not null default 'OPEN'
    check (status in ('OPEN','AKKOORD','AFGEKEURD')),
  verantwoordelijke text,
  foto_path        text,
  vastgelegd_at    timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists project_montage_checks_project_idx
  on public.project_montage_checks (project_id);

alter table public.project_montage_checks enable row level security;

create policy "project_montage_checks_select" on public.project_montage_checks
  for select using (auth.uid() is not null);
create policy "project_montage_checks_insert" on public.project_montage_checks
  for insert with check (auth.uid() is not null);
create policy "project_montage_checks_update" on public.project_montage_checks
  for update using (auth.uid() is not null);
create policy "project_montage_checks_delete" on public.project_montage_checks
  for delete using (auth.uid() is not null);
