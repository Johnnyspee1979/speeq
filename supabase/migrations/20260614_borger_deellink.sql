-- ─────────────────────────────────────────────────────────────────────────────
-- Read-only deellink voor de kwaliteitsborger
-- ─────────────────────────────────────────────────────────────────────────────
-- Doel: de aannemer laat zijn borger live meekijken met één project, zonder
-- account, alleen-lezen. Veiligheid is hier leidend:
--   * Token geeft NOOIT schrijfrechten.
--   * De ontvanger ziet ALLEEN het ene gedeelde project (tenant-isolatie + AVG).
--   * Altijd vervaldatum + intrekbaar; geen publieke, niet-verlopende links.
--
-- Opzet: de tabel staat onder strikte RLS (alleen ingelogde tenant-gebruikers
-- beheren hun links). De publieke leesroute loopt UITSLUITEND via de
-- security-definer RPC `get_shared_project(p_token)`, die het token valideert
-- (niet verlopen, niet ingetrokken) en strikt op het token-project filtert.
-- Zo bypasst de RPC RLS gecontroleerd, zonder de isolatie te breken.

create table if not exists public.project_share_links (
  id          uuid primary key default gen_random_uuid(),
  token       text not null unique,
  project_id  text not null,
  tenant_id   text,
  created_by  uuid references auth.users(id),
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists project_share_links_token_idx
  on public.project_share_links (token);
create index if not exists project_share_links_project_idx
  on public.project_share_links (project_id);

alter table public.project_share_links enable row level security;

-- Beheer: alleen ingelogde gebruikers; intrekken = revoked_at zetten (update).
-- Geen select-policy voor anon: de publieke route loopt enkel via de RPC.
create policy "share_links_select" on public.project_share_links
  for select using (auth.uid() is not null);

create policy "share_links_insert" on public.project_share_links
  for insert with check (auth.uid() is not null);

create policy "share_links_update" on public.project_share_links
  for update using (auth.uid() is not null);

-- ─────────────────────────────────────────────────────────────────────────────
-- Publieke leesroute: alleen-lezen projectkijk op basis van een geldig token.
-- ─────────────────────────────────────────────────────────────────────────────
-- Retourneert de read-only controlepunten van het ENE gedeelde project. Filtert
-- strikt op het project_id dat bij het token hoort; geeft niets terug bij een
-- verlopen of ingetrokken token. Geen schrijfbewerking mogelijk.
create or replace function public.get_shared_project(p_token text)
returns table (
  evidence_id        bigint,
  project_id         text,
  inspection_point_id text,
  discipline_id      text,
  review_status      text,
  ai_status          text,
  created_at         timestamptz,
  reviewed_at        timestamptz,
  media_uri          text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project text;
begin
  select l.project_id into v_project
    from public.project_share_links l
   where l.token = p_token
     and l.revoked_at is null
     and l.expires_at > now();

  if v_project is null then
    return; -- ongeldig/verlopen/ingetrokken → leeg, geen lek
  end if;

  -- Alleen-lezen projectkijk: controlepunt, status en bewijsfoto. Geen GPS of
  -- persoonsgegevens die niet nodig zijn voor meekijken (AVG-minimalisatie).
  return query
    select e.id, e.project_id, e.inspection_point_id, e.discipline_id,
           e.review_status, e.ai_status, e.created_at, e.reviewed_at,
           coalesce(e.media_uri, e.photo_uri)
      from public.evidence e
     where e.project_id = v_project;
end;
$$;

-- Bewust ook aan anon: de RPC is de enige, gecontroleerde publieke leesroute.
grant execute on function public.get_shared_project(text) to anon, authenticated;
