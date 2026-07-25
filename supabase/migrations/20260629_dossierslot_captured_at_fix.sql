-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: dossierslot las een kolom die niet bestaat
-- ─────────────────────────────────────────────────────────────────────────────
-- `prevent_insert_on_locked_dossier` (20260511_sprint8_insert_lock.sql) las
-- `new.captured_at`. Die kolom bestaat niet op `evidence` — geverifieerd op de
-- productie-database, 25 juli 2026, waar de trigger wél actief staat.
--
-- Gevolg vóór deze fix: zodra een dossier op LOCKED stond, viel élke invoeging
-- om met de Postgres-fout `record "new" has no field "captured_at"` in plaats
-- van de bedoelde WKB_LOCKED-melding. En het onderscheid waar de bewaking om
-- draait — bewijs van vóór het slot mag alsnog binnenkomen, bewijs van erna
-- niet — werkte helemaal niet: álles werd geweigerd, ook legitieme na-sync van
-- een vakman die offline stond.
--
-- Wat het vastlegmoment is: `evidence."timestamp"` bevat de client-tijd van de
-- opname (tekst, ISO-formaat). Die is leidend, want dát is het moment waarop de
-- vakman het punt vastlegde. Valt hij niet te lezen, dan `created_at` (het
-- moment van binnenkomst op de server) en anders `now()`. De cast staat in een
-- eigen blok zodat een onleesbare waarde de invoeging niet laat klappen.
--
-- Tijdspoof blijft een aandachtspunt: de client bepaalt `timestamp`. De
-- GPS-/locatiechecks elders moeten die vector dekken. Dit is bewust dezelfde
-- afweging als in de oorspronkelijke migratie.

create or replace function public.prevent_insert_on_locked_dossier()
returns trigger
language plpgsql
as $$
declare
  locked_ts  timestamptz;
  capture_ts timestamptz;
begin
  -- Nog geen dossier-koppeling: laat door, de update-trigger pakt het later op.
  if new.dossier_id is null then
    return new;
  end if;

  select locked_at
    into locked_ts
    from public.dossiers
   where id = new.dossier_id
     and status = 'LOCKED';

  -- Dossier nog open.
  if locked_ts is null then
    return new;
  end if;

  -- Vastlegmoment bepalen; onleesbare client-tijd mag nooit de insert breken.
  begin
    capture_ts := nullif(trim(new."timestamp"), '')::timestamptz;
  exception when others then
    capture_ts := null;
  end;

  capture_ts := coalesce(capture_ts, new.created_at, now());

  if capture_ts > locked_ts then
    raise exception
      'WKB_LOCKED: Dossier is afgesloten op %. Bewijs van na die datum mag niet meer ingevoerd worden.',
      locked_ts;
  end if;

  return new;
end;
$$;

-- Trigger opnieuw zetten zodat hij zeker aan de nieuwe functie hangt.
drop trigger if exists evidence_insert_lock_guard on public.evidence;
create trigger evidence_insert_lock_guard
  before insert on public.evidence
  for each row
  execute function public.prevent_insert_on_locked_dossier();
