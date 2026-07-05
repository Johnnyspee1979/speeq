/**
 * @jest-environment node
 *
 * Gedrag-tests voor de WKB-keuringsrapport-generator (services/KeuringsrapportService.ts).
 * generateKeuringsrapportHtml bouwt een formeel rapport (Wkb art. 2.17) als
 * HTML-string: samenvatting per status, één regel per borgingspunt (meest recente
 * foto), niet-akkoord bovenaan. Een fout in de aggregatie laat verkeerde
 * akkoord-tellingen of de verkeerde foto in een juridisch document belanden. We
 * borgen de aggregatie-/sorteer-/format-logica (de interne helpers worden via de
 * generator geraakt), niet de exacte CSS:
 *  - per borgingspunt wordt de LAATSTE evidence (op timestamp) gekozen (dedup);
 *  - totaal/akkoord/afgekeurd/review/pending + akkoord-% kloppen;
 *  - niet-akkoord-volgorde: FAILED → NEEDS_REVIEW → pending → PASSED;
 *  - projectnaam en branding-label komen in de cover;
 *  - lege evidence → 0 punten en 0%.
 *
 * De print-/download-helpers (window.open / blob-download) zijn pure DOM-side-
 * effects en worden hier bewust niet getest. TenantBrandingService is gemockt →
 * geen RN/opslag nodig → @jest-environment node.
 */

jest.mock('../TenantBrandingService', () => ({
  getBrandingSync: jest.fn(() => ({ companyName: 'Spee Test BV' })),
}));

import { getBrandingSync } from '../TenantBrandingService';
import {
  generateKeuringsrapportHtml,
  type KeuringsrapportEvidence,
  type KeuringsrapportOptions,
} from '../KeuringsrapportService';

const ev = (
  over: Partial<KeuringsrapportEvidence> & Pick<KeuringsrapportEvidence, 'id' | 'inspectionPointId'>,
): KeuringsrapportEvidence => ({
  mediaUri: null,
  timestamp: null,
  aiStatus: null,
  aiNotes: null,
  fieldNote: null,
  userId: null,
  latitude: null,
  longitude: null,
  ...over,
});

const baseOpts = (evidence: KeuringsrapportEvidence[]): KeuringsrapportOptions => ({
  projectName: 'Testproject',
  projectId: '104A',
  evidence,
});

beforeEach(() => {
  (getBrandingSync as jest.Mock).mockReturnValue({ companyName: 'Spee Test BV' });
});

describe('generateKeuringsrapportHtml — aggregatie', () => {
  const evidence: KeuringsrapportEvidence[] = [
    ev({ id: 'a1', inspectionPointId: 'A', aiStatus: 'PASSED', timestamp: '2026-06-01T08:00:00Z', fieldNote: 'oud' }),
    ev({ id: 'a2', inspectionPointId: 'A', aiStatus: 'PASSED', timestamp: '2026-06-02T08:00:00Z', fieldNote: 'nieuw', latitude: 52.08, longitude: 4.31 }),
    ev({ id: 'b1', inspectionPointId: 'B', aiStatus: 'FAILED', timestamp: '2026-06-01T09:00:00Z' }),
    ev({ id: 'c1', inspectionPointId: 'C', aiStatus: 'NEEDS_REVIEW', timestamp: '2026-06-01T09:00:00Z' }),
    ev({ id: 'd1', inspectionPointId: 'D', aiStatus: null, timestamp: null }),
  ];
  const html = () => generateKeuringsrapportHtml(baseOpts(evidence));

  it('dedupliceert per borgingspunt en kiest de laatste evidence', () => {
    const out = html();
    expect((out.match(/bp-id">A</g) ?? []).length).toBe(1);
    expect(out).toContain('nieuw');
    expect(out).not.toContain('>oud<');
  });

  it('telt totaal/akkoord/afgekeurd/review en berekent het akkoord-%', () => {
    const out = html();
    expect(out).toContain('<strong>4</strong>'); // totaal unieke punten
    expect(out).toContain('Borgingspunten (4) — niet-akkoord eerst');
    expect(out).toContain('color:#059669">1</div>'); // akkoord
    expect(out).toContain('color:#dc2626">1</div>'); // afgekeurd
    expect(out).toContain('color:#d97706">1</div>'); // review
    expect(out).toContain('color:#6b7280">25%</div>'); // 1 van 4
  });

  it('zet niet-akkoord bovenaan: FAILED → NEEDS_REVIEW → pending → PASSED', () => {
    const out = html();
    const iB = out.indexOf('bp-id">B<');
    const iC = out.indexOf('bp-id">C<');
    const iD = out.indexOf('bp-id">D<');
    const iA = out.indexOf('bp-id">A<');
    expect(iB).toBeGreaterThanOrEqual(0);
    expect(iB).toBeLessThan(iC);
    expect(iC).toBeLessThan(iD);
    expect(iD).toBeLessThan(iA);
  });

  it('toont GPS bij aanwezige coördinaten en — bij ontbrekend tijdstip', () => {
    const out = html();
    expect(out).toContain('52.08000, 4.31000');
    expect(out).toContain('>—</td>'); // fmtDate(null) voor punt D
  });

  it('zet projectnaam en branding-label in de cover', () => {
    const out = html();
    expect(out).toContain('WKB Keuringsrapport — Testproject');
    expect(out).toContain('Spee Test BV');
  });
});

describe('generateKeuringsrapportHtml — randgevallen', () => {
  it('lege evidence → 0 punten en 0%', () => {
    const out = generateKeuringsrapportHtml(baseOpts([]));
    expect(out).toContain('Borgingspunten (0) — niet-akkoord eerst');
    expect(out).toContain('color:#6b7280">0%</div>');
    expect(out).toContain('<strong>0</strong>');
  });

  it('verdraagt een lege branding-naam zonder te crashen', () => {
    (getBrandingSync as jest.Mock).mockReturnValue({ companyName: null });
    const out = generateKeuringsrapportHtml(baseOpts([]));
    expect(out).toContain('WKB Keuringsrapport — Testproject');
    expect(out).not.toContain('Spee Test BV');
  });
});
