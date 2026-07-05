-- ─────────────────────────────────────────────────────────────────────────────
-- Verzegeld bewijs: hash-keten + verzegel-tijdstempel
-- ─────────────────────────────────────────────────────────────────────────────
-- Doel: aantoonbaar maken dat een bewijsstuk ná vastleggen niet meer ongemerkt is
-- gewijzigd (art. 7:758 BW — aannemer moet conform afspraak/regels aantonen).
--
-- Mechaniek:
--   evidence_hash : SHA-256 over het opgeslagen origineel + metadata (lokaal,
--                   offline berekend bij vastleggen).
--   prev_hash     : de evidence_hash van het vorige stuk in het dossier → ketting,
--                   zodat ook volgorde + compleetheid vaststaan (genesis = leeg).
--   chain_index   : positie in de keten (0 = genesis).
--   sealed_at     : betrouwbaar SERVER-tijdstempel dat de keten per dossier
--                   bevriest bij sync. V1 = eigen servertijd; RFC-3161 TSA /
--                   anchoring expliciet pas V2.
--
-- Belangrijk: de hash gaat over het OPGESLAGEN origineel. Niets in dit pad mag de
-- foto opnieuw comprimeren/herschrijven, anders breekt de hash.

alter table public.evidence
  add column if not exists evidence_hash text,
  add column if not exists prev_hash     text,
  add column if not exists chain_index   integer;

-- Snel de keten per dossier in volgorde ophalen.
create index if not exists evidence_chain_idx
  on public.evidence (project_id, chain_index);

-- ─────────────────────────────────────────────────────────────────────────────
-- Verzegeling per dossier
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.dossier_seal (
  project_id       text primary key,
  tenant_id        text,
  sealed_at        timestamptz not null default now(),
  sealed_by        uuid references auth.users(id),
  chain_length     integer not null default 0,
  chain_head_hash  text,            -- evidence_hash van het laatste stuk
  created_at       timestamptz not null default now()
);

alter table public.dossier_seal enable row level security;

create policy "dossier_seal_select" on public.dossier_seal
  for select using (true);

create policy "dossier_seal_insert" on public.dossier_seal
  for insert with check (auth.uid() is not null);

create policy "dossier_seal_update" on public.dossier_seal
  for update using (auth.uid() is not null);

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: dossier verzegelen — server zet het betrouwbare tijdstempel.
-- ─────────────────────────────────────────────────────────────────────────────
-- Upsert: een dossier kan opnieuw verzegeld worden als er bewijs is bijgekomen;
-- sealed_at verspringt dan mee naar het nieuwe (latere) servertijdstempel.
create or replace function public.seal_dossier(
  p_project_id text,
  p_chain_length integer,
  p_chain_head_hash text
) returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_tenant text;
  v_now timestamptz := now();
begin
  if v_user is null then
    raise exception 'Niet ingelogd';
  end if;

  select tenant_id into v_tenant
    from public.evidence where project_id = p_project_id limit 1;

  insert into public.dossier_seal (
    project_id, tenant_id, sealed_at, sealed_by, chain_length, chain_head_hash
  ) values (
    p_project_id, v_tenant, v_now, v_user, p_chain_length, p_chain_head_hash
  )
  on conflict (project_id) do update
    set sealed_at       = v_now,
        sealed_by       = v_user,
        chain_length    = excluded.chain_length,
        chain_head_hash = excluded.chain_head_hash;

  return v_now;
end;
$$;

grant execute on function public.seal_dossier(text, integer, text) to authenticated;
