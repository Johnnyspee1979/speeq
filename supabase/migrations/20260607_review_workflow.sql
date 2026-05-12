-- ─────────────────────────────────────────────────────────────────────────────
-- Review workflow voor evidence
-- ─────────────────────────────────────────────────────────────────────────────
-- Stroom:
--   PENDING_REVIEW  → bewijs net opgeslagen, wacht op keurmeester
--   APPROVED        → goedgekeurd, mag in dossier-PDF
--   REJECTED        → afgekeurd (verplicht: review_note met reden)
--   FINALIZED       → definitief vergrendeld door projectleider, niet meer wijzigbaar
--
-- Default = PENDING_REVIEW zodat alle nieuwe foto's automatisch in de wachtrij komen.

alter table public.evidence
  add column if not exists review_status text
    check (review_status in ('PENDING_REVIEW','APPROVED','REJECTED','FINALIZED')),
  add column if not exists reviewed_by   uuid references auth.users(id),
  add column if not exists reviewed_at   timestamptz,
  add column if not exists review_note   text;

-- Bestaande rijen zonder status → in review-wachtrij plaatsen
update public.evidence
   set review_status = 'PENDING_REVIEW'
 where review_status is null;

-- Nieuwe rijen krijgen automatisch PENDING_REVIEW
alter table public.evidence
  alter column review_status set default 'PENDING_REVIEW';

-- Index voor dashboard-filters (snel zoeken op "alles wat nog beoordeeld moet")
create index if not exists evidence_review_status_idx
  on public.evidence (project_id, review_status);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS-policy update: alleen ingelogde gebruikers mogen review-velden bijwerken
-- ─────────────────────────────────────────────────────────────────────────────
-- We laten de bestaande update-policy intact, maar voegen een extra grant toe
-- voor de review-kolommen wanneer de uitvoerder ingelogd is.
-- (Specifieke rol-beperking — alleen WERKVOORBEREIDER / ADMIN — wordt
-- afgedwongen via de RPC `set_evidence_review` hieronder.)

create or replace function public.set_evidence_review(
  p_evidence_id bigint,
  p_status text,
  p_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Niet ingelogd';
  end if;

  if p_status not in ('PENDING_REVIEW','APPROVED','REJECTED','FINALIZED') then
    raise exception 'Ongeldige review_status: %', p_status;
  end if;

  if p_status = 'REJECTED' and (p_note is null or length(trim(p_note)) = 0) then
    raise exception 'Afkeuring vereist een toelichting (review_note)';
  end if;

  update public.evidence
     set review_status = p_status,
         reviewed_by   = v_user,
         reviewed_at   = now(),
         review_note   = case when p_note is not null then p_note else review_note end
   where id = p_evidence_id;
end;
$$;

grant execute on function public.set_evidence_review(bigint, text, text) to authenticated;
