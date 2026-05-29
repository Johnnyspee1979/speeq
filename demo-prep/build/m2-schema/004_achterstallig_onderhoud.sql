-- ============================================================================
-- Migration: 004_achterstallig_onderhoud
-- Generated: 2026-05-29 (M2 milestone)
-- Status: DRAFT — testen op Supabase branch eerst.
-- ============================================================================
-- Doel: MJOP-cyclus + achterstallig-onderhoud-tracking voor onderhoudsbedrijven
--       zoals Combivo. Bouwt voort op bestaande project_checklists.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Velden toevoegen aan project_checklists
-- ---------------------------------------------------------------------------

ALTER TABLE public.project_checklists
  ADD COLUMN IF NOT EXISTS due_date timestamptz,
  ADD COLUMN IF NOT EXISTS last_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS recurrence_months integer
    CHECK (recurrence_months IS NULL OR recurrence_months > 0),
  ADD COLUMN IF NOT EXISTS priority text
    CHECK (priority IS NULL OR priority IN ('laag','medium','hoog','kritiek')),
  ADD COLUMN IF NOT EXISTS estimated_duration_hours numeric(5,2),
  ADD COLUMN IF NOT EXISTS responsible_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS discipline_id text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS imported_from text;  -- bv 'mjop-excel-2026-05'

-- ---------------------------------------------------------------------------
-- 2) Index voor dashboard-query performance
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_checklist_due_date_open
  ON public.project_checklists(tenant_id, due_date)
  WHERE checked = false AND due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_checklist_responsible
  ON public.project_checklists(responsible_user_id, due_date)
  WHERE checked = false;

-- ---------------------------------------------------------------------------
-- 3) View: achterstallig onderhoud per tenant
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_achterstallig_onderhoud AS
SELECT
  pc.id,
  pc.tenant_id,
  pc.project_id,
  p.name AS project_name,
  p.address AS project_address,
  pc.checklist_type,
  pc.item_id,
  pc.title,
  pc.priority,
  pc.discipline_id,
  pc.due_date,
  pc.last_completed_at,
  pc.recurrence_months,
  pc.estimated_duration_hours,
  pc.responsible_user_id,
  prof.display_name AS responsible_name,
  EXTRACT(DAY FROM (NOW() - pc.due_date))::int AS days_overdue,
  CASE
    WHEN pc.due_date > NOW() THEN 'gepland'
    WHEN pc.due_date < NOW() - INTERVAL '30 days' THEN 'lang_achterstallig'
    WHEN pc.due_date < NOW() - INTERVAL '7 days' THEN 'achterstallig'
    ELSE 'binnen_termijn'
  END AS staat,
  pc.notes
FROM public.project_checklists pc
LEFT JOIN public.projects p ON p.id = pc.project_id
LEFT JOIN public.profiles prof ON prof.id = pc.responsible_user_id
WHERE pc.checked = false
  AND pc.due_date IS NOT NULL;

COMMENT ON VIEW public.v_achterstallig_onderhoud IS
  'Alle open onderhoudsitems met due_date — voor MJOP-dashboard en vakman-dagplanning';

-- ---------------------------------------------------------------------------
-- 4) Functie: voltooien + automatisch volgende cyclus inplannen
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.checklist_complete_and_reschedule(
  p_checklist_id bigint,
  p_completed_by uuid DEFAULT auth.uid()
) RETURNS bigint AS $$
DECLARE
  v_item RECORD;
  v_next_id bigint;
BEGIN
  -- Lock het record
  SELECT * INTO v_item FROM public.project_checklists
   WHERE id = p_checklist_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checklist item % bestaat niet', p_checklist_id;
  END IF;

  IF v_item.checked THEN
    RAISE EXCEPTION 'Checklist item % is al voltooid', p_checklist_id;
  END IF;

  -- Markeer als voltooid
  UPDATE public.project_checklists
     SET checked = true,
         last_completed_at = NOW(),
         updated_at = NOW(),
         user_id = COALESCE(p_completed_by, user_id)
   WHERE id = p_checklist_id;

  -- Plan volgende ronde in als recurrence_months gezet is
  IF v_item.recurrence_months IS NOT NULL AND v_item.recurrence_months > 0 THEN
    INSERT INTO public.project_checklists (
      project_id, checklist_type, item_id, title, checked,
      due_date, recurrence_months, priority,
      estimated_duration_hours, responsible_user_id, discipline_id,
      notes, tenant_id, imported_from
    ) VALUES (
      v_item.project_id, v_item.checklist_type, v_item.item_id, v_item.title, false,
      NOW() + (v_item.recurrence_months || ' months')::interval,
      v_item.recurrence_months, v_item.priority,
      v_item.estimated_duration_hours, v_item.responsible_user_id, v_item.discipline_id,
      v_item.notes, v_item.tenant_id, v_item.imported_from
    )
    RETURNING id INTO v_next_id;

    RETURN v_next_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.checklist_complete_and_reschedule IS
  'Voltooi item + plan automatisch volgende cyclus als recurrence_months gezet';

-- Veilig: revoke EXECUTE op anon, alleen authenticated
REVOKE EXECUTE ON FUNCTION public.checklist_complete_and_reschedule FROM anon;
GRANT EXECUTE ON FUNCTION public.checklist_complete_and_reschedule TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) RLS-policies voor de nieuwe view (read-only voor authenticated van tenant)
-- ---------------------------------------------------------------------------
-- Views erven RLS van onderliggende tabellen — project_checklists heeft RLS.
-- We hoeven hier geen aparte policy te zetten zolang project_checklists het tenant
-- correct filtert.

-- ---------------------------------------------------------------------------
-- 6) Bulk-insert helper voor MJOP-import (Excel → SQL)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.import_mjop_items(
  p_tenant_id text,
  p_project_id text,
  p_items jsonb,
  p_imported_from text DEFAULT 'manual'
) RETURNS integer AS $$
DECLARE
  v_count integer := 0;
  v_item jsonb;
BEGIN
  -- Authorize: alleen authenticated van eigen tenant
  IF auth.role() != 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_tenant_id != COALESCE(public.current_tenant_id(), '') THEN
    RAISE EXCEPTION 'Tenant mismatch — niet jouw tenant';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.project_checklists (
      tenant_id, project_id, checklist_type, item_id, title,
      checked, due_date, recurrence_months, priority,
      estimated_duration_hours, discipline_id, notes, imported_from
    ) VALUES (
      p_tenant_id,
      p_project_id,
      COALESCE(v_item->>'checklist_type', 'mjop'),
      COALESCE(v_item->>'item_id', gen_random_uuid()::text),
      v_item->>'title',
      false,
      (v_item->>'due_date')::timestamptz,
      (v_item->>'recurrence_months')::integer,
      v_item->>'priority',
      (v_item->>'estimated_duration_hours')::numeric,
      v_item->>'discipline_id',
      v_item->>'notes',
      p_imported_from
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.import_mjop_items FROM anon;
GRANT EXECUTE ON FUNCTION public.import_mjop_items TO authenticated;

-- ---------------------------------------------------------------------------
-- 7) Verificatie-queries (uitvoeren na migration om te checken)
-- ---------------------------------------------------------------------------
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='project_checklists' ORDER BY ordinal_position;
--
-- SELECT * FROM pg_indexes WHERE schemaname='public' AND tablename='project_checklists';
--
-- SELECT * FROM public.v_achterstallig_onderhoud LIMIT 5;
--
-- SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace
--   AND proname IN ('checklist_complete_and_reschedule','import_mjop_items');

COMMIT;
-- Verwijder COMMIT en zet ROLLBACK als je testdraait.
