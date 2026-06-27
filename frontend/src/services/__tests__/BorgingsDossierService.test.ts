/**
 * Unit-tests voor BorgingsDossierService — de deterministische HTML-generators
 * en de evidence-filter. De async export/upload-functies (window.open, fetch,
 * Storage) laten we ongemoeid; we testen de pure kern.
 *
 * We mocken branding (getBrandingSync/getBranding), de Supabase-client en
 * storageUrl zodat het laden geen netwerk raakt, en borgen:
 *   - filterEvidenceForExport: AUDITOR houdt alleen PASSED/APPROVED/OK over,
 *     INTERNAL en MUNICIPALITY laten alles door;
 *   - generateDossierHtml: zet project-titel/-id, groepeert per borgingspunt,
 *     toont AI-akkoord-badge, en een lege-staat zonder evidence;
 *   - generateOfficialWkbReport: zet de format-pill/-label, de compliance-tabel
 *     en een lege-staat per format.
 */

jest.mock('../TenantBrandingService', () => ({
  getBrandingSync: () => ({ companyName: 'Spee Solutions', logoUrl: null }),
  getBranding: () => Promise.resolve({ companyName: 'Spee Solutions', logoUrl: null }),
}));
jest.mock('../../lib/supabase', () => ({ supabase: {} }));
jest.mock('../../lib/storageUrl', () => ({
  resolveStorageUrl: (_b: unknown, p: string) => Promise.resolve(p),
}));

import type { StoredWkbEvidence } from '../../types/Evidence';
import {
  filterEvidenceForExport,
  generateDossierHtml,
  generateOfficialWkbReport,
} from '../BorgingsDossierService';

// `over` is bewust losjes getypeerd zodat we ook case-varianten als aiStatus
// 'ok' kunnen voeren (de generator doet zelf .toUpperCase()).
const ev = (over: Record<string, unknown> = {}): StoredWkbEvidence =>
  ({
    id: 'e1',
    inspectionPointId: 'WAPENING-1',
    mediaUri: 'https://x/p.jpg',
    latitude: 52.0705,
    longitude: 4.3007,
    timestamp: '2026-01-15T09:30:00Z',
    aiStatus: 'PASSED',
    syncStatus: 'SYNCED',
    ...over,
  } as unknown as StoredWkbEvidence);

describe('filterEvidenceForExport', () => {
  const rows = [
    ev({ id: 'a', aiStatus: 'PASSED' }),
    ev({ id: 'b', aiStatus: 'NEEDS_REVIEW' }),
    ev({ id: 'c', aiStatus: 'FAILED' }),
    ev({ id: 'd', aiStatus: 'ok' }), // case-insensitive
  ];

  it('AUDITOR houdt alleen PASSED/APPROVED/OK over', () => {
    const res = filterEvidenceForExport(rows, 'AUDITOR');
    expect(res.map((r) => r.id)).toEqual(['a', 'd']);
  });

  it('INTERNAL en MUNICIPALITY laten alles door', () => {
    expect(filterEvidenceForExport(rows, 'INTERNAL')).toHaveLength(4);
    expect(filterEvidenceForExport(rows, 'MUNICIPALITY')).toHaveLength(4);
  });
});

describe('generateDossierHtml', () => {
  it('zet project-titel/-id en groepeert per borgingspunt', () => {
    const html = generateDossierHtml(
      [ev({ id: 'e1', inspectionPointId: 'WAPENING-1' }), ev({ id: 'e2', inspectionPointId: 'SPOUW-2' })],
      'p-1',
      'Woning Spee',
    );
    expect(html).toContain('Woning Spee');
    expect(html).toContain('p-1');
    // ankers per borgingspunt (safeId)
    expect(html).toContain('id="WAPENING-1"');
    expect(html).toContain('id="SPOUW-2"');
    // AI akkoord-badge voor PASSED
    expect(html).toContain('AI akkoord');
  });

  it('toont een lege-staat zonder evidence', () => {
    const html = generateDossierHtml([], 'p-9', 'Leeg project');
    expect(html).toContain('Nog geen borgingspunten vastgelegd');
  });
});

describe('generateOfficialWkbReport', () => {
  it('zet de format-pill/-label en de compliance-tabel', () => {
    const html = generateOfficialWkbReport(
      [ev({ inspectionPointId: 'WAPENING-1' })],
      'p-1',
      'Woning Spee',
      {},
      {},
      {},
      [],
      'MUNICIPALITY',
    );
    expect(html).toContain('WKB Compliance Tabel');
    expect(html).toContain('Gemeente / bevoegd gezag'); // FORMAT_LABEL
    expect(html).toContain('WAPENING-1');
  });

  it('toont een lege-staat per format', () => {
    const html = generateOfficialWkbReport([], 'p-9', 'Leeg', {}, {}, {}, [], 'AUDITOR');
    expect(html).toContain('Geen bewijzen geselecteerd');
    expect(html).toContain('Kwaliteitsborger oplevering'); // AUDITOR-label
  });
});
