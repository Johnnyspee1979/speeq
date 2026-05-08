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
