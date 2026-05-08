-- Sprint 2: RLS versterking + sync retry kolom
-- Datum: 2026-05-09

-- ── 1. evidence: sync_retry_count kolom ─────────────────────────────────────
-- Houdt bij hoeveel keer een FAILED item opnieuw geprobeerd is.
-- Na MAX_RETRIES (3) stopt de auto-sync en krijgt de vakman een melding.
alter table public.evidence
  add column if not exists sync_retry_count int not null default 0,
  add column if not exists sync_failed_reason text;

-- ── 2. floor_plans: versterk select policy (alleen ingelogde gebruikers) ──────
-- Vervang de open select (using true) door een auth-check.
-- Elke tenant heeft zijn eigen Supabase instance, maar defense-in-depth.
drop policy if exists "floor_plans_select" on public.floor_plans;
create policy "floor_plans_select"
  on public.floor_plans for select
  using (auth.uid() is not null);

-- ── 3. floor_plans: update policy (maker of beheerder) ───────────────────────
drop policy if exists "floor_plans_update" on public.floor_plans;
create policy "floor_plans_update"
  on public.floor_plans for update
  using (
    auth.uid() = created_by
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('ADMIN', 'WERKVOORBEREIDER', 'PROJECTLEIDER')
    )
  );

-- ── 4. evidence: voeg failed_reason RLS-safe update toe ─────────────────────
-- Eigen evidence mag bijgewerkt worden (sync_status, retry_count, failed_reason)
drop policy if exists "evidence_self_update" on public.evidence;
create policy "evidence_self_update"
  on public.evidence for update
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('ADMIN', 'WERKVOORBEREIDER', 'PROJECTLEIDER')
    )
  );

-- ── 5. Hulp-index voor FAILED items (snellere retry queries) ─────────────────
create index if not exists evidence_sync_failed_idx
  on public.evidence (sync_status)
  where sync_status = 'FAILED';
