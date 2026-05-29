-- ============================================================================
-- Migration: 001_security_hardening
-- Generated: 2026-05-28
-- Author: Spee Solutions (concept, niet uitgevoerd)
-- Status: DRAFT — Eerst testen op Supabase branch!
-- ============================================================================
-- Doel: dichtmaken van de open security holes die Supabase Advisor signaleert.
-- Pas dit aan met `BEGIN; ... ROLLBACK;` om te zien of het niets breekt.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) RLS-enabled tabellen zonder policy → restrictive default-deny + tenant scope
-- ---------------------------------------------------------------------------

-- evidence_review: alleen lezen voor authenticated van eigen tenant
DROP POLICY IF EXISTS "evidence_review_select_own_tenant" ON public.evidence_review;
CREATE POLICY "evidence_review_select_own_tenant"
  ON public.evidence_review FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.evidence e
      WHERE e.id = evidence_review.evidence_id
        AND e.tenant_id = public.current_tenant_id()
    )
  );

DROP POLICY IF EXISTS "evidence_review_insert_own_tenant" ON public.evidence_review;
CREATE POLICY "evidence_review_insert_own_tenant"
  ON public.evidence_review FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.evidence e
      WHERE e.id = evidence_review.evidence_id
        AND e.tenant_id = public.current_tenant_id()
    )
  );

-- notification_subscriptions: alleen eigenaar mag lezen/schrijven
DROP POLICY IF EXISTS "notif_subs_self_only" ON public.notification_subscriptions;
CREATE POLICY "notif_subs_self_only"
  ON public.notification_subscriptions FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- review_webhook_endpoints: alleen lezen voor authenticated van eigen tenant, geen writes via API
DROP POLICY IF EXISTS "review_webhooks_select_tenant" ON public.review_webhook_endpoints;
CREATE POLICY "review_webhooks_select_tenant"
  ON public.review_webhook_endpoints FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- ---------------------------------------------------------------------------
-- 2) Tighten policies die nu USING (true) zijn
-- ---------------------------------------------------------------------------

-- dossiers: insert + update alleen voor eigen tenant
DROP POLICY IF EXISTS "dossiers_insert" ON public.dossiers;
CREATE POLICY "dossiers_insert"
  ON public.dossiers FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "dossiers_update" ON public.dossiers;
CREATE POLICY "dossiers_update"
  ON public.dossiers FOR UPDATE
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- drawing_change_requests: update alleen voor eigen tenant
DROP POLICY IF EXISTS "drawing_cr_update" ON public.drawing_change_requests;
CREATE POLICY "drawing_cr_update"
  ON public.drawing_change_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = drawing_change_requests.project_id
        AND p.tenant_id = public.current_tenant_id()
    )
  );

-- presets: update/insert/delete alleen voor eigen tenant
DROP POLICY IF EXISTS "presets_update" ON public.presets;
CREATE POLICY "presets_update"
  ON public.presets FOR UPDATE
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "presets_insert" ON public.presets;
CREATE POLICY "presets_insert"
  ON public.presets FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "presets_delete" ON public.presets;
CREATE POLICY "presets_delete"
  ON public.presets FOR DELETE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- project_documents: insert alleen voor eigen tenant
DROP POLICY IF EXISTS "project_documents_insert" ON public.project_documents;
CREATE POLICY "project_documents_insert"
  ON public.project_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_documents.project_id
        AND p.tenant_id = public.current_tenant_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Storage buckets: stop broad SELECT/LIST policies
-- ---------------------------------------------------------------------------
-- Public buckets hoeven geen SELECT policy voor LIST. Object URL's blijven werken.

DROP POLICY IF EXISTS "floor_plans_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "project_documents_public_read" ON storage.objects;
DROP POLICY IF EXISTS "tenant_branding_storage_read" ON storage.objects;
DROP POLICY IF EXISTS "Evidence photos are publicly readable" ON storage.objects;

-- Optioneel: vervang met meer restrictieve SELECT (objecten van eigen tenant)
-- Hier eerst zonder vervangen — direct-URL access blijft werken via signed urls of public.

-- ---------------------------------------------------------------------------
-- 4) Revoke anon EXECUTE op SECURITY DEFINER functies (alleen authenticated)
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.set_evidence_review(bigint, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.lock_dossier(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_evidence_status_change() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;

-- current_tenant_id en get_my_role mag wel callable blijven voor auth helpers,
-- maar niet voor anon. Houd ze toch dicht:
REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_enrolled_organization_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_tenant(text) FROM anon;

-- ---------------------------------------------------------------------------
-- 5) search_path op functies fixen (zonder gedrag te wijzigen)
-- ---------------------------------------------------------------------------

ALTER FUNCTION public.current_wkb_role() SET search_path = public, auth;
ALTER FUNCTION public.set_task_assignment_updated_at() SET search_path = public;
ALTER FUNCTION public.prevent_locked_evidence_changes() SET search_path = public;
ALTER FUNCTION public.lock_dossier(uuid) SET search_path = public;
ALTER FUNCTION public.prevent_insert_on_locked_dossier() SET search_path = public;

-- ---------------------------------------------------------------------------
-- Verificatie: vraag policies + grants op
-- ---------------------------------------------------------------------------
-- Voor commit, run:
--   SELECT * FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname;
--   SELECT proname, has_function_privilege('anon', oid, 'EXECUTE') AS anon_can_run
--   FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND prosecdef ORDER BY proname;

-- ============================================================================
-- Beoordelingen vóór merge naar productie:
-- 1. Werkt vakman-foto-upload nog?
-- 2. Werkt projectleider-review nog?
-- 3. Werkt finalize-dossier nog?
-- 4. Werkt admin-paneel (Maker) nog?
-- 5. Geen errors in Sentry / logs in eerste 24u na deploy?
-- ============================================================================

ROLLBACK;
-- ⬆️ Verwijder deze ROLLBACK als je wilt commit'en.
-- Of: vervang door COMMIT.
