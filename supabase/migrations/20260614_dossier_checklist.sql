-- ─────────────────────────────────────────────────────────────────────────────
-- Compleetheidscheck dossier bevoegd gezag
-- ─────────────────────────────────────────────────────────────────────────────
-- Doel: per project bijhouden of het dossier bevoegd gezag klaar is voor
-- gereedmelding. De verplichte categorieën staan in de frontend-config
-- (frontend/src/config/dossierBevoegdGezag.ts); deze tabel bewaart per project +
-- categorie de status (aanwezig / ontbreekt / n.v.t.) en een optionele koppeling
-- naar een document of notitie.
--
-- Geen automatische gereedmelding/DSO in V1 — dit is alleen de interne check.

create table if not exists public.dossier_checklist_items (
  id            uuid primary key default gen_random_uuid(),
  project_id    text not null,
  tenant_id     text,
  categorie_id  text not null,                       -- verwijst naar config-id
  status        text not null default 'ONTBREEKT'
                  check (status in ('AANWEZIG','ONTBREEKT','NVT')),
  nvt_reden     text,                                -- verplicht bij NVT (app-laag)
  document_path text,                                -- optionele koppeling
  notitie       text,
  updated_by    uuid references auth.users(id),
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (project_id, categorie_id)
);

create index if not exists dossier_checklist_project_idx
  on public.dossier_checklist_items (project_id);

alter table public.dossier_checklist_items enable row level security;

create policy "dossier_checklist_select" on public.dossier_checklist_items
  for select using (true);

create policy "dossier_checklist_insert" on public.dossier_checklist_items
  for insert with check (auth.uid() is not null);

create policy "dossier_checklist_update" on public.dossier_checklist_items
  for update using (auth.uid() is not null);

create policy "dossier_checklist_delete" on public.dossier_checklist_items
  for delete using (
    auth.uid() is not null
    and exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and (u.raw_app_meta_data->>'role') in ('ADMIN', 'WV')
    )
  );
