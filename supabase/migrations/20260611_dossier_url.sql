-- Adobe-dossiermotor: kolom voor de nieuwste gegenereerde dossier-PDF
-- Datum: 2026-06-11
--
-- Voegt alleen toe, verwijdert niets. De motor
-- (backend/src/services/dossierService.ts) schrijft hier de publieke URL van
-- het laatst gegenereerde dossier (bucket `dossiers`) naar terug.
--
-- NB: niet automatisch gepusht — Johnny draait deze migratie zelf op de
-- betreffende tenant-DB (en de master), net als bij de KYP-integratie.

alter table public.projects
  add column if not exists dossier_url text;

comment on column public.projects.dossier_url is
  'Publieke URL van het laatst door de Adobe-dossiermotor gegenereerde PDF-dossier (bucket: dossiers).';

-- Storage-bucket voor de gegenereerde dossiers (idempotent).
-- Privaat: dossiers bevatten projectgegevens; toegang loopt via signed URLs of
-- de backend (service key). Originele foto's blijven in `wkb-evidence`.
insert into storage.buckets (id, name, public)
values ('dossiers', 'dossiers', false)
on conflict (id) do nothing;

-- Bucket voor het Word-sjabloon dat de motor inleest (idempotent).
insert into storage.buckets (id, name, public)
values ('dossier-templates', 'dossier-templates', false)
on conflict (id) do nothing;
