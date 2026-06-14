-- ─────────────────────────────────────────────────────────────────────────────
-- Borger-profiel: presentatielaag voor het aanleveren aan de kwaliteitsborger
-- ─────────────────────────────────────────────────────────────────────────────
-- Een aannemer werkt met wisselende borgers; elke borger/instrument wil het
-- dossier op zijn manier (volgorde, verplichte rubrieken, bestandsnaam). Dit is
-- ALLEEN een presentatie-/exportlaag bovenop het bestaande dossier — geen tweede
-- datamodel voor het bewijs. De config kan per project of als klant-default.
--
-- Geen harde koppeling met een specifiek instrument in V1 — handmatig profiel.

create table if not exists public.borger_profielen (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            text,
  -- project_id leeg = klant-default; gevuld = projectspecifiek profiel.
  project_id           text,
  naam                 text not null,
  instrument           text,
  rubriek_volgorde     text[] not null default '{}',
  verplichte_categorieen text[] not null default '{}',
  bestandsnaam_sjabloon text,
  created_by           uuid references auth.users(id),
  updated_at           timestamptz not null default now(),
  created_at           timestamptz not null default now()
);

create index if not exists borger_profielen_project_idx
  on public.borger_profielen (project_id);
-- Eén default per tenant (project_id null) en één profiel per project.
create unique index if not exists borger_profielen_uniek
  on public.borger_profielen (tenant_id, coalesce(project_id, ''));

alter table public.borger_profielen enable row level security;

create policy "borger_profielen_select" on public.borger_profielen
  for select using (auth.uid() is not null);

create policy "borger_profielen_insert" on public.borger_profielen
  for insert with check (auth.uid() is not null);

create policy "borger_profielen_update" on public.borger_profielen
  for update using (auth.uid() is not null);

create policy "borger_profielen_delete" on public.borger_profielen
  for delete using (auth.uid() is not null);
