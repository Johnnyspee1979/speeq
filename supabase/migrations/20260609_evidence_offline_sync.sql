-- Offline-Mode roadmap — DB-laag voor Dual-Mode synchronisatie.
--
-- Voegt twee kolommen toe aan de evidence-tabel:
--   1. client_uuid     — idempotency-key voor sync (UUIDv4 vanuit client)
--   2. client_version  — monotonous counter voor Last-Write-Wins
--
-- Beide kolommen worden door OfflineSyncEngine gebruikt bij create + update
-- om dubbele inserts (retry-storms) en concurrent edits (twee vakmensen
-- offline + zelfde controlemoment) op te lossen.
--
-- Backward compatible:
--   - client_uuid is NULLABLE (cloud-mode klanten vullen 'm niet in)
--   - client_version default 1
--   - Unique-constraint op client_uuid is partial (alleen NOT NULL)
--
-- Onderdeel van docs/strategie/dual-mode-architectuur.md (sectie 5).

-- 1. client_uuid kolom (idempotency)
alter table public.evidence
  add column if not exists client_uuid text;

-- Partial unique index — alleen voor rows waar client_uuid is gevuld
create unique index if not exists evidence_client_uuid_unique
  on public.evidence (client_uuid)
  where client_uuid is not null;

-- 2. client_version kolom (LWW conflict-resolution)
alter table public.evidence
  add column if not exists client_version integer not null default 1;

-- Index voor snelle versie-fetch bij update (zie OfflineSyncEngine.pushOperation)
create index if not exists evidence_client_version_idx
  on public.evidence (id, client_version);

-- Sanity-check: documenteer in tabel-comments wat de kolommen doen
comment on column public.evidence.client_uuid is
  'UUID gegenereerd door client tijdens lokale capture. Idempotency-key voor sync — voorkomt dubbele inserts bij retry. NULL voor records die direct in cloud-mode zijn gemaakt.';

comment on column public.evidence.client_version is
  'Monotonous counter voor Last-Write-Wins conflict-resolution. Iedere lokale mutatie (update) verhoogt deze. Sync-engine fetcht remote versie en push alleen als local >= remote.';
