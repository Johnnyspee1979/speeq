-- ─────────────────────────────────────────────────────────────────────────────
-- Afwijking-en-herstel-logboek per controlepunt
-- ─────────────────────────────────────────────────────────────────────────────
-- Probleem: het review-model (20260607_review_workflow.sql) bewaart alleen de
-- HUIDIGE review_status en overschrijft die bij elke wissel. De keten
--   afgekeurd → hersteld → opnieuw akkoord
-- verdwijnt daardoor; alleen de eindstatus blijft over. Juist die keten is het
-- sterkste bewijs dat de controle écht werkte (Rekenkamer: "resultaat aantonen").
--
-- Oplossing: een append-only herstel-record dat de keten vooruit vastlegt,
-- gekoppeld aan het bestaande controlepunt (evidence). Elk record draagt zijn
-- eigen tijdstempels zodat de tijdlijn narekenbaar is. Geen statusgeschiedenis
-- nodig: het record zélf is de drager van afwijking + herstel + hercontrole.
--
-- Koppeling met eerste-keer-goed (20260614_eerste_keer_goed.sql): het bestaan van
-- een herstel-record impliceert ever_rejected = true, dus eerste_keer_goed = false.
-- De RPC hieronder stempelt dat append-only mee, consistent met de indicator.

create table if not exists public.evidence_herstel (
  id              uuid primary key default gen_random_uuid(),
  evidence_id     bigint not null references public.evidence(id) on delete cascade,
  project_id      text,
  tenant_id       text,
  user_id         uuid references auth.users(id),
  -- De keten, elk met eigen tijdstempel zodat de tijdlijn narekenbaar is.
  afwijking       text not null check (char_length(trim(afwijking)) > 0),
  afgekeurd_at    timestamptz not null default now(),
  herstelactie    text not null check (char_length(trim(herstelactie)) > 0),
  hersteld_at     timestamptz,
  -- Hercontrole: moment + plaats, zelfde vastleg-logica als een regulier punt.
  hercontrole_at  timestamptz not null default now(),
  hercontrole_lat numeric,
  hercontrole_lng numeric,
  hercontrole_plaats text,
  foto_path       text,
  created_at      timestamptz not null default now()
);

create index if not exists evidence_herstel_evidence_idx on public.evidence_herstel (evidence_id);
create index if not exists evidence_herstel_project_idx  on public.evidence_herstel (project_id);

alter table public.evidence_herstel enable row level security;

-- Lezen: meelezen toegestaan (RLS op evidence/tenant dekt de afscherming af,
-- net als evidence_comments). Schrijven: alleen ingelogd.
create policy "evidence_herstel_select" on public.evidence_herstel
  for select using (true);

create policy "evidence_herstel_insert" on public.evidence_herstel
  for insert with check (auth.uid() is not null);

create policy "evidence_herstel_delete" on public.evidence_herstel
  for delete using (
    auth.uid() = user_id
    or exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and (u.raw_app_meta_data->>'role') in ('ADMIN', 'WV')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: herstel-record vastleggen + controlepunt heropenen-naar-akkoord
-- ─────────────────────────────────────────────────────────────────────────────
-- Eén transactie: leg het herstel vast én zet het punt op APPROVED. Daarbij
-- blijft ever_rejected append-only true (eerste_keer_goed = false), ook als de
-- vlag al stond. Geen verplichte invoer bij een punt dat in één keer akkoord is —
-- deze RPC wordt alléén aangeroepen na een afkeuring.
create or replace function public.log_evidence_herstel(
  p_evidence_id bigint,
  p_afwijking text,
  p_herstelactie text,
  p_hercontrole_at timestamptz default now(),
  p_lat numeric default null,
  p_lng numeric default null,
  p_plaats text default null,
  p_foto_path text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_project text;
  v_tenant text;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Niet ingelogd';
  end if;
  if p_afwijking is null or length(trim(p_afwijking)) = 0 then
    raise exception 'Afwijking-omschrijving is verplicht';
  end if;
  if p_herstelactie is null or length(trim(p_herstelactie)) = 0 then
    raise exception 'Herstelactie is verplicht';
  end if;

  select project_id, tenant_id into v_project, v_tenant
    from public.evidence where id = p_evidence_id;

  insert into public.evidence_herstel (
    evidence_id, project_id, tenant_id, user_id,
    afwijking, herstelactie, hercontrole_at,
    hercontrole_lat, hercontrole_lng, hercontrole_plaats, foto_path
  ) values (
    p_evidence_id, v_project, v_tenant, v_user,
    p_afwijking, p_herstelactie, coalesce(p_hercontrole_at, now()),
    p_lat, p_lng, p_plaats, p_foto_path
  ) returning id into v_id;

  -- Punt op akkoord, maar eerste-keer-goed blijft false (append-only vlag).
  update public.evidence
     set review_status = 'APPROVED',
         reviewed_by   = v_user,
         reviewed_at   = now(),
         ever_rejected = true,
         review_rounds = review_rounds + 1
   where id = p_evidence_id;

  return v_id;
end;
$$;

grant execute on function public.log_evidence_herstel(
  bigint, text, text, timestamptz, numeric, numeric, text, text
) to authenticated;
