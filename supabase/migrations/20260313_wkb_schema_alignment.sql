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

