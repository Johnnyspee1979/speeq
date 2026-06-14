-- ─────────────────────────────────────────────────────────────────────────────
-- "Eerste keer goed"-vlag voor evidence
-- ─────────────────────────────────────────────────────────────────────────────
-- Probleem: het review-model (20260607_review_workflow.sql) bewaart alleen de
-- HUIDIGE review_status. Een punt dat REJECTED → hersteld → APPROVED ging, ziet
-- er na afloop identiek uit als een punt dat direct APPROVED was. Daardoor is
-- "eerste keer goed" niet uit de bestaande data af te leiden.
--
-- Oplossing: een append-only vlag `ever_rejected` die de RPC `set_evidence_review`
-- zet zodra een punt ooit op REJECTED komt — en die nooit meer wordt teruggezet.
-- `review_rounds` telt het aantal beoordelingsrondes (diagnostisch, optioneel).
--
-- Eerste keer goed  :=  review_status in ('APPROVED','FINALIZED') AND NOT ever_rejected
--
-- Vooruitwerkend: rijen van vóór deze migratie houden ever_rejected = false en
-- worden in de berekening behandeld als "onbekend" (niet meegerekend), zodat het
-- cijfer niet vals positief wordt op historische data.

alter table public.evidence
  add column if not exists ever_rejected boolean not null default false,
  add column if not exists review_rounds integer not null default 0;

-- Bestaande, reeds afgekeurde rijen alvast correct markeren.
update public.evidence
   set ever_rejected = true
 where review_status = 'REJECTED'
   and ever_rejected = false;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC bijwerken: stempel ever_rejected + tel review_rounds
-- ─────────────────────────────────────────────────────────────────────────────
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
         review_note   = case when p_note is not null then p_note else review_note end,
         -- Append-only: eenmaal afgekeurd blijft "ooit afgekeurd".
         ever_rejected = ever_rejected or (p_status = 'REJECTED'),
         -- Eén ronde per daadwerkelijke beoordeling (approve/reject), niet bij reopen.
         review_rounds = review_rounds + case when p_status in ('APPROVED','REJECTED') then 1 else 0 end
   where id = p_evidence_id;
end;
$$;

grant execute on function public.set_evidence_review(bigint, text, text) to authenticated;
