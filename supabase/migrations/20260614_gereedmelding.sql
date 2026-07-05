-- ─────────────────────────────────────────────────────────────────────────────
-- Gereedmelding dossier bevoegd gezag + tweeweken-klok
-- ─────────────────────────────────────────────────────────────────────────────
-- Bij de gereedmelding van een GK1-project dient de aannemer het dossier bevoegd
-- gezag in. Vanaf dat moment heeft de gemeente 14 dagen om de melding op
-- compleetheid te beoordelen. Deze tabel legt het moment van gereedmelden vast
-- (tijdstempel, net als bij controlepunten) en de uiterste reactiedatum.
--
-- Geen automatische indiening bij het Omgevingsloket — het indienen blijft een
-- bewuste handeling van de aannemer. SpeeQ registreert en bewaakt alleen.

create table if not exists public.project_gereedmelding (
  project_id          text primary key,
  tenant_id           text,
  gereedmeld_at       timestamptz not null default now(),
  uiterste_reactie_at timestamptz not null,
  gemeld_by           uuid references auth.users(id),
  -- Optionele latere uitkomst (gemeente reageerde): vrij veld voor V1.
  reactie_status      text check (reactie_status in ('COMPLEET','ONVOLLEDIG','GEEN_REACTIE')),
  reactie_note        text,
  created_at          timestamptz not null default now()
);

alter table public.project_gereedmelding enable row level security;

create policy "project_gereedmelding_select" on public.project_gereedmelding
  for select using (true);

create policy "project_gereedmelding_insert" on public.project_gereedmelding
  for insert with check (auth.uid() is not null);

create policy "project_gereedmelding_update" on public.project_gereedmelding
  for update using (auth.uid() is not null);

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: gereedmelding registreren — server zet tijdstempel + uiterste datum.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.register_gereedmelding(
  p_project_id text
) returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_tenant text;
  v_now timestamptz := now();
  v_uiterste timestamptz := now() + interval '14 days';
begin
  if v_user is null then
    raise exception 'Niet ingelogd';
  end if;

  select tenant_id into v_tenant
    from public.evidence where project_id = p_project_id limit 1;

  insert into public.project_gereedmelding (
    project_id, tenant_id, gereedmeld_at, uiterste_reactie_at, gemeld_by
  ) values (
    p_project_id, v_tenant, v_now, v_uiterste, v_user
  )
  on conflict (project_id) do update
    set gereedmeld_at       = v_now,
        uiterste_reactie_at = v_uiterste,
        gemeld_by           = v_user;

  return v_uiterste;
end;
$$;

grant execute on function public.register_gereedmelding(text) to authenticated;
