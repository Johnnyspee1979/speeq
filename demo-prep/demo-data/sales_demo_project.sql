-- ============================================================================
-- Demo data setup voor sales 29 mei 2026
-- Project: sales-demo-2026-05-29
-- Tenant: demo
-- ============================================================================
-- Voer dit script uit op 28 mei avond, zodat het klaar staat voor de demo.
-- Opruimen ná demo: zie cleanup_sales_demo_project.sql
-- ============================================================================

BEGIN;

-- 1) Schoon project aanmaken
INSERT INTO public.projects (
  id, tenant_id, name, initiator_name, address, email,
  latitude, longitude, instrument_id, created_at
) VALUES (
  'sales-demo-2026-05-29',
  'demo',
  'Sales Demo — Nieuwbouw Hoofdstraat 12',
  'Spee Solutions',
  'Hoofdstraat 12, 2511 EA Den Haag',
  'demo@speesolutions.nl',
  52.0815,
  4.3107,
  'KIK-MVP',
  NOW()
)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      updated_at = NOW();

-- 2) Vier evidence rows: 2 auto-approved, 1 needs review, 1 rejected
INSERT INTO public.evidence (
  project_id, inspection_point_id, photo_uri,
  timestamp, latitude, longitude, gps_accuracy,
  exif_verified, field_note,
  sync_status, ai_status, ai_confidence, ai_notes,
  review_status, tenant_id, created_at, updated_at,
  discipline_id, etage, ruimtenummer, binnenbuiten
) VALUES
  -- Foto 1: Sanitair — AI goedgekeurd, leader approved
  (
    'sales-demo-2026-05-29', 'KIK-INSTALLATIE-001',
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400',
    NOW()::text, 52.0816, 4.3108, 4.2,
    true, 'Standleiding sanitair — montage conform tekening A-103',
    'SYNCED', 'PASSED', 0.96,
    'Beeld scherp, GPS bevestigt locatie, koppelpunt zichtbaar.',
    'APPROVED', 'demo', NOW(), NOW(),
    'installatie', 'Begane grond', '0.04', 'binnen'
  ),
  -- Foto 2: Brandveiligheid — AI goedgekeurd, leader approved
  (
    'sales-demo-2026-05-29', 'KIK-BRANDVEILIGHEID-006',
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400',
    NOW()::text, 52.0817, 4.3109, 3.8,
    true, 'Brandwerende doorvoer leidingschacht — Promat coating aangebracht',
    'SYNCED', 'PASSED', 0.91,
    'Brandwerende kit zichtbaar over volledige diameter. Hardenberg.',
    'APPROVED', 'demo', NOW(), NOW(),
    'brandveiligheid', '1e verdieping', '1.12', 'binnen'
  ),
  -- Foto 3: Afbouw schilder — AI twijfelt, wacht op leader
  (
    'sales-demo-2026-05-29', 'KIK-AFBOUW_SCHILDER-007',
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400',
    NOW()::text, 52.0815, 4.3107, 5.1,
    true, 'Kit-naden badkamer — controle afwerking randen',
    'SYNCED', 'NEEDS_REVIEW', 0.73,
    'Kit-naad zichtbaar maar lichte oneffenheid aan onderkant — handmatige check aanbevolen.',
    'PENDING_REVIEW', 'demo', NOW(), NOW(),
    'afbouw_schilder', '1e verdieping', '1.05', 'binnen'
  ),
  -- Foto 4: Elektra — AI faalde, automatisch rejected
  (
    'sales-demo-2026-05-29', 'KIK-ELEKTRA-003',
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400',
    NOW()::text, 52.0814, 4.3106, 6.5,
    true, 'Meterkast aarding — meetwaarde 0.18 Ω',
    'SYNCED', 'FAILED', 0.41,
    'Aarding meetwaarde onleesbaar op foto. Vakman: aanvullende foto nodig met heldere meetwaarde.',
    'REJECTED', 'demo', NOW(), NOW(),
    'elektra', 'Begane grond', '0.01', 'binnen'
  );

-- 3) Voor de "needs review" foto: zorg dat hij echt in pending zit voor de leader
INSERT INTO public.evidence_review (
  evidence_id, status, notes, created_at
)
SELECT id, 'PENDING_REVIEW',
       'Wacht op projectleider — AI twijfelt over kit-naden afwerking',
       NOW()
FROM public.evidence
WHERE project_id = 'sales-demo-2026-05-29'
  AND inspection_point_id = 'KIK-AFBOUW_SCHILDER-007';

-- 4) Verificatie
SELECT
  e.id, e.inspection_point_id, e.ai_status, e.ai_confidence, e.review_status, e.field_note
FROM public.evidence e
WHERE e.project_id = 'sales-demo-2026-05-29'
ORDER BY e.id;

COMMIT;

-- ============================================================================
-- Klaar! Open nu de tool en check of 'Sales Demo — Nieuwbouw Hoofdstraat 12'
-- zichtbaar is voor de demo-account.
-- ============================================================================
