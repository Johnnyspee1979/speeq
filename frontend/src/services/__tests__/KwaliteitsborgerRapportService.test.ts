/**
 * @jest-environment node
 *
 * Gedrag-tests voor het technische kwaliteitsborger-eindrapport
 * (services/KwaliteitsborgerRapportService.ts). generateKwaliteitsborgerRapportHtml
 * bouwt het opleverdossier-rapport als HTML: samenvatting, discipline-overzicht,
 * risicobeoordeling, fotoverzicht en NEN-compliance. Een fout in de aggregatie
 * laat verkeerde tellingen of een gemiste risico-bevinding in het opleverdossier
 * belanden. We borgen de aggregatie-/groepeer-/format-logica (interne helpers via
 * de generator), niet de CSS:
 *  - latestPerPoint dedupliceert per borgingspunt (laatste op timestamp);
 *  - totaal/akkoord/afgekeurd/review/pending + akkoord-% kloppen;
 *  - discipline-indeling incl. de 'overig'-fallback;
 *  - risicotabel bevat FAILED (Hoog) + NEEDS_REVIEW (Middel), leeg → meldingsblok;
 *  - NEN-tabel valt terug op de defaults en respecteert custom-invoer;
 *  - gevolgklasse-default en branding/projectnaam in de cover.
 *
 * De DOM-print/download-helpers worden bewust niet getest. TenantBrandingService
 * is gemockt → geen RN/opslag nodig → @jest-environment node.
 */

jest.mock('../TenantBrandingService', () => ({
  getBrandingSync: jest.fn(() => ({ companyName: 'Spee Test BV' })),
}));

import { getBrandingSync } from '../TenantBrandingService';
import {
  generateKwaliteitsborgerRapportHtml,
  type KwbEvidenceItem,
  type KwaliteitsborgerRapportOptions,
} from '../KwaliteitsborgerRapportService';

const ev = (
  over: Partial<KwbEvidenceItem> & Pick<KwbEvidenceItem, 'id' | 'inspectionPointId'>,
): KwbEvidenceItem => ({
  discipline: null,
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

const opts = (
  over: Partial<KwaliteitsborgerRapportOptions> = {},
): KwaliteitsborgerRapportOptions => ({
  projectName: 'Testproject',
  projectAddress: 'Teststraat 1',
  projectId: '104A',
  evidence: [],
  ...over,
});

const mixed: KwbEvidenceItem[] = [
  ev({ id: 'a1', inspectionPointId: 'A', discipline: 'constructie', aiStatus: 'PASSED', timestamp: '2026-06-01T08:00:00Z', fieldNote: 'oud' }),
  ev({ id: 'a2', inspectionPointId: 'A', discipline: 'constructie', aiStatus: 'PASSED', timestamp: '2026-06-02T08:00:00Z', fieldNote: 'nieuw' }),
  ev({ id: 'b1', inspectionPointId: 'B', discipline: 'installatie', aiStatus: 'FAILED', timestamp: '2026-06-01T09:00:00Z', aiNotes: 'lekkage' }),
  ev({ id: 'c1', inspectionPointId: 'C', discipline: 'bouwfysica', aiStatus: 'NEEDS_REVIEW', timestamp: '2026-06-01T09:00:00Z' }),
  ev({ id: 'd1', inspectionPointId: 'D', discipline: null, aiStatus: null, timestamp: null }),
];

beforeEach(() => {
  (getBrandingSync as jest.Mock).mockReturnValue({ companyName: 'Spee Test BV' });
});

describe('aggregatie en samenvatting', () => {
  const html = () => generateKwaliteitsborgerRapportHtml(opts({ evidence: mixed }));

  it('dedupliceert per borgingspunt en kiest de laatste evidence', () => {
    const out = html();
    expect((out.match(/bp-id">A</g) ?? []).length).toBe(1);
    expect(out).toContain('📝 nieuw');
    // 'oud' alleen als losse veldnotitie weren — 'inhoud' (NEN 2580) is legitiem.
    expect(out).not.toContain('📝 oud');
  });

  it('telt de statussen en berekent het akkoord-%', () => {
    const out = html();
    expect(out).toContain('color:#1d4ed8">4</div>'); // totaal
    expect(out).toContain('color:#059669">1</div>'); // akkoord
    expect(out).toContain('color:#dc2626">1</div>'); // afgekeurd
    expect(out).toContain('color:#d97706">1</div>'); // review
    expect(out).toContain('color:#374151">1</div>'); // pending
    expect(out).toContain('4 totaal · 1 akkoord · 25% voldoet');
  });
});

describe('discipline-indeling', () => {
  it('groepeert per discipline en gebruikt de overig-fallback', () => {
    const out = generateKwaliteitsborgerRapportHtml(opts({ evidence: mixed }));
    for (const label of ['Constructie', 'Installaties', 'Bouwfysica', 'Overig']) {
      expect(out).toContain(label);
    }
    // installatie heeft een FAILED-punt → waarschuwingskaart
    expect(out).toContain('disc-card-warn');
  });
});

describe('risicobeoordeling', () => {
  it('lijst FAILED (Hoog) en NEEDS_REVIEW (Middel)', () => {
    const out = generateKwaliteitsborgerRapportHtml(opts({ evidence: mixed }));
    expect(out).toContain('Risicobeoordeling (2 punten)');
    expect(out).toContain('>Hoog</strong>');
    expect(out).toContain('>Middel</strong>');
    expect(out).toContain('lekkage');
  });

  it('toont een geslaagd-melding wanneer er geen risico-items zijn', () => {
    const allPassed: KwbEvidenceItem[] = [
      ev({ id: 'p1', inspectionPointId: 'P1', aiStatus: 'PASSED', timestamp: '2026-06-01T08:00:00Z' }),
    ];
    const out = generateKwaliteitsborgerRapportHtml(opts({ evidence: allPassed }));
    expect(out).toContain('Risicobeoordeling (0 punten)');
    expect(out).toContain('Geen risico-items');
  });
});

describe('NEN-normen tabel', () => {
  it('valt terug op de standaard NEN-set wanneer niets is meegegeven', () => {
    const out = generateKwaliteitsborgerRapportHtml(opts({ evidence: [] }));
    expect(out).toContain('NEN 1006');
    expect(out).toContain('Drinkwaterinstallaties');
    expect(out).toContain('Te controleren');
  });

  it('respecteert custom NEN-invoer met status en opmerking', () => {
    const out = generateKwaliteitsborgerRapportHtml(
      opts({
        evidence: [],
        nenStandards: [
          { code: 'NEN 9999', omschrijving: 'Testnorm', gecontroleerd: true, opmerking: 'akkoord bevonden' },
        ],
      }),
    );
    expect(out).toContain('NEN 9999');
    expect(out).toContain('Gecontroleerd');
    expect(out).toContain('akkoord bevonden');
  });
});

describe('cover en defaults', () => {
  it('gebruikt Gevolgklasse 1 als default en zet projectnaam + branding', () => {
    const out = generateKwaliteitsborgerRapportHtml(opts({ evidence: [] }));
    expect(out).toContain('Kwaliteitsborger Rapport — Testproject');
    expect(out).toContain('Gevolgklasse 1');
    expect(out).toContain('Spee Test BV');
  });

  it('respecteert een meegegeven gevolgklasse', () => {
    const out = generateKwaliteitsborgerRapportHtml(
      opts({ evidence: [], gevolgklasse: 'Gevolgklasse 3' }),
    );
    expect(out).toContain('Gevolgklasse 3');
  });

  it('vult een ontbrekende rapportdatum met de huidige datum (jaartal)', () => {
    const out = generateKwaliteitsborgerRapportHtml(opts({ evidence: [] }));
    expect(out).toContain(String(new Date().getFullYear()));
  });
});
