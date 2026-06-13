-- Tenant-isolatie dichttimmeren (cross-tenant lek sluiten)
-- Datum: 2026-06-13
--
-- CONTEXT
-- De multi-tenancy is LOGISCH: één gedeelde Supabase-DB met een tenant_id-kolom
-- per rij. Tot nu toe hadden alleen `evidence`, `projects` en de WRITE-kant van
-- `tenant_features` een tenant-bewuste policy. De overige tabellen lekten:
-- hun SELECT-policy stond op `using (true)` of `using (auth.uid() is not null)`,
-- waardoor ELKE ingelogde gebruiker rijen van een ANDERE tenant kon lezen zodra
-- de frontend rechtstreeks met de anon-key query't. De backend gebruikt
-- service_role (bypasst RLS) en is dus niet de lekvector — de frontend wel.
--
-- AANPAK
-- Per lekkende tabel een RESTRICTIVE tenant-hek. Restrictive policies worden met
-- AND gecombineerd bovenop de bestaande (permissive) policies: bestaande
-- rol-/eigenaar-logica blijft intact, maar wordt nu ALTIJD ook begrensd tot de
-- tenants waar de gebruiker bij hoort. Exact het patroon dat `evidence` en
-- `projects` al in productie draaien:
--     tenant_id = any (get_user_enrolled_organization_ids())
--
-- VOORAF GEVERIFIEERD (2026-06-13, live DB kgiuavfvhtdgwuygbyzo):
--   * Alle acht datatabellen hieronder hebben een tenant_id-kolom.
--   * 0 NULL-waarden in tenant_id (behalve profiles: 1 NULL → self-uitzondering).
--   * get_user_enrolled_organization_ids() returnt text[]; tenant_id is text.
--
-- SERVICE_ROLE BYPASST RLS → de backend (dossiermotor, document-upload, reviews,
-- STAM) blijft ongemoeid. Alleen frontend-anon-queries worden afgeschermd.
--
-- ROLLBACK: drop elke policy "tenant_fence_<tabel>".

-- ── Backend-gegenereerd (service_role schrijft; frontend leest) ──────────────
drop policy if exists "tenant_fence_dossiers" on public.dossiers;
create policy "tenant_fence_dossiers" on public.dossiers
  as restrictive for all
  using (tenant_id = any (get_user_enrolled_organization_ids()))
  with check (tenant_id = any (get_user_enrolled_organization_ids()));

drop policy if exists "tenant_fence_consumer_dossier_documents" on public.consumer_dossier_documents;
create policy "tenant_fence_consumer_dossier_documents" on public.consumer_dossier_documents
  as restrictive for all
  using (tenant_id = any (get_user_enrolled_organization_ids()))
  with check (tenant_id = any (get_user_enrolled_organization_ids()));

drop policy if exists "tenant_fence_project_documents" on public.project_documents;
create policy "tenant_fence_project_documents" on public.project_documents
  as restrictive for all
  using (tenant_id = any (get_user_enrolled_organization_ids()))
  with check (tenant_id = any (get_user_enrolled_organization_ids()));

-- ── Frontend schrijft óók (anon-key insert moet tenant_id meesturen) ─────────
-- Aanname: de frontend zet tenant_id bij insert (bewezen: `evidence` draait al
-- met dit FOR ALL-hek en frontend-inserts werken). Smoke-test na toepassen:
-- reactie plaatsen, checklist afvinken, plattegrond uploaden, taak toewijzen.
drop policy if exists "tenant_fence_project_checklists" on public.project_checklists;
create policy "tenant_fence_project_checklists" on public.project_checklists
  as restrictive for all
  using (tenant_id = any (get_user_enrolled_organization_ids()))
  with check (tenant_id = any (get_user_enrolled_organization_ids()));

drop policy if exists "tenant_fence_task_assignments" on public.task_assignments;
create policy "tenant_fence_task_assignments" on public.task_assignments
  as restrictive for all
  using (tenant_id = any (get_user_enrolled_organization_ids()))
  with check (tenant_id = any (get_user_enrolled_organization_ids()));

drop policy if exists "tenant_fence_floor_plans" on public.floor_plans;
create policy "tenant_fence_floor_plans" on public.floor_plans
  as restrictive for all
  using (tenant_id = any (get_user_enrolled_organization_ids()))
  with check (tenant_id = any (get_user_enrolled_organization_ids()));

drop policy if exists "tenant_fence_evidence_comments" on public.evidence_comments;
create policy "tenant_fence_evidence_comments" on public.evidence_comments
  as restrictive for all
  using (tenant_id = any (get_user_enrolled_organization_ids()))
  with check (tenant_id = any (get_user_enrolled_organization_ids()));

drop policy if exists "tenant_fence_drawing_change_requests" on public.drawing_change_requests;
create policy "tenant_fence_drawing_change_requests" on public.drawing_change_requests
  as restrictive for all
  using (tenant_id = any (get_user_enrolled_organization_ids()))
  with check (tenant_id = any (get_user_enrolled_organization_ids()));

-- ── profiles: tenant-hek MET self-uitzondering ──────────────────────────────
-- Een gebruiker moet ALTIJD zijn eigen profiel kunnen zien/bijwerken, ook als
-- tenant_id (nog) NULL is (1 zo'n rij in productie: vermoedelijk maker/orphan).
-- Zonder de self-branch zou die gebruiker zichzelf niet meer kunnen laden.
-- Dit dicht het lek dat reviewers/admins ANDERS profielen van álle tenants zagen
-- (policy profiles_reviewer_select / profiles_admin_*): nu begrensd tot eigen tenant.
drop policy if exists "tenant_fence_profiles" on public.profiles;
create policy "tenant_fence_profiles" on public.profiles
  as restrictive for all
  using (
    id = auth.uid()
    or tenant_id = any (get_user_enrolled_organization_ids())
  )
  with check (
    id = auth.uid()
    or tenant_id = any (get_user_enrolled_organization_ids())
  );

-- ── Verificatie (handmatig draaien na toepassen) ─────────────────────────────
-- select tablename, count(*) from pg_policies
--   where schemaname='public' and policyname like 'tenant_fence_%'
--   group by tablename;  -- verwacht: 9 rijen, elk count 1
