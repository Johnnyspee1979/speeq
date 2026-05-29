-- ============================================================================
-- Cleanup van demo data ná sales 29 mei 2026
-- Verwijdert het sales-demo-2026-05-29 project + alle bijbehorende evidence
-- ============================================================================

BEGIN;

-- 1) Eerst evidence_review entries weghalen
DELETE FROM public.evidence_review
WHERE evidence_id IN (
  SELECT id FROM public.evidence WHERE project_id = 'sales-demo-2026-05-29'
);

-- 2) Evidence rows weghalen
DELETE FROM public.evidence
WHERE project_id = 'sales-demo-2026-05-29';

-- 3) Project zelf weghalen
DELETE FROM public.projects
WHERE id = 'sales-demo-2026-05-29';

-- 4) Verificatie — moet 0 rows opleveren
SELECT 'projects' AS table_name, COUNT(*) AS remaining
FROM public.projects WHERE id = 'sales-demo-2026-05-29'
UNION ALL
SELECT 'evidence', COUNT(*) FROM public.evidence WHERE project_id = 'sales-demo-2026-05-29';

COMMIT;
