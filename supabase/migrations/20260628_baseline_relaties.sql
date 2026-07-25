-- ─────────────────────────────────────────────────────────────────────────────
-- Uitgestelde relaties uit de baseline
-- ─────────────────────────────────────────────────────────────────────────────
-- `evidence` en `drawing_change_requests` verwijzen naar `dossiers` en
-- `floor_plans`. Die tabellen worden pas later in de keten aangemaakt
-- (20260510_sprint3_dossier_lock.sql en 20260601_floor_plan_annotations.sql),
-- dus de foreign keys worden hier achteraf gelegd. Idempotent: bestaat de
-- constraint al, dan gebeurt er niets.

do $$
begin
  if to_regclass('public.dossiers') is not null
     and not exists (select 1 from pg_constraint where conname = 'evidence_dossier_id_fkey') then
    alter table public.evidence
      add constraint evidence_dossier_id_fkey
      foreign key (dossier_id) references public.dossiers(id);
  end if;

  if to_regclass('public.floor_plans') is not null
     and not exists (select 1 from pg_constraint where conname = 'evidence_floor_plan_id_fkey') then
    alter table public.evidence
      add constraint evidence_floor_plan_id_fkey
      foreign key (floor_plan_id) references public.floor_plans(id);
  end if;

  if to_regclass('public.floor_plans') is not null
     and not exists (select 1 from pg_constraint where conname = 'drawing_change_requests_floor_plan_id_fkey') then
    alter table public.drawing_change_requests
      add constraint drawing_change_requests_floor_plan_id_fkey
      foreign key (floor_plan_id) references public.floor_plans(id) on delete cascade;
  end if;
end $$;
