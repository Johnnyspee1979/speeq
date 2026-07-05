/**
 * Unit-tests voor GemeenteRapportService — het formele Dossier Bevoegd Gezag
 * (gereedmelding, Wkb art. 2.17 / BKL art. 7.16). Juridisch gevoelig: de
 * samenvatting en het afwijkingenregister moeten kloppen.
 *
 * We mocken de branding en borgen de deterministische logica in
 * generateGemeenteRapportHtml:
 *   - latestPerPoint: per borgingspunt telt alleen de nieuwste registratie mee;
 *   - de telling (totaal/akkoord/afgekeurd/nader onderzoek/percentage);
 *   - het afwijkingenregister toont FAILED + NEEDS_REVIEW, met een expliciete
 *     "geen afwijkingen"-verklaring als alles akkoord is;
 *   - optionele covervelden (vergunningnummer) verschijnen alleen indien gezet;
 *   - projectnaam in de titel en de bedrijfsnaam uit de branding.
 */

jest.mock('../TenantBrandingService', () => ({
  getBrandingSync: () => ({ companyName: 'Spee Solutions' }),
}));

import {
  type GemeenteEvidenceItem,
  type GemeenteRapportOptions,
  generateGemeenteRapportHtml,
} from '../GemeenteRapportService';

const ev = (over: Partial<GemeenteEvidenceItem>): GemeenteEvidenceItem => ({
  id: 'e1',
  inspectionPointId: 'A',
  discipline: 'Constructie',
  mediaUri: null,
  timestamp: '2026-01-01T10:00:00Z',
  aiStatus: 'PASSED',
  aiNotes: null,
  fieldNote: null,
  userId: 'u1',
  ...over,
});

const opts = (over: Partial<GemeenteRapportOptions> = {}): GemeenteRapportOptions => ({
  projectName: 'Woning Spee',
  projectAddress: 'Voorbeeldstraat 1',
  initiatorName: 'Bouwgroep BV',
  projectId: 'p-42',
  evidence: [],
  ...over,
});

describe('generateGemeenteRapportHtml — telling & dedup', () => {
  it('telt alleen de nieuwste registratie per borgingspunt', () => {
    const html = generateGemeenteRapportHtml(
      opts({
        evidence: [
          ev({ id: '1', inspectionPointId: 'A', aiStatus: 'PASSED', timestamp: '2026-01-01T10:00:00Z' }),
          ev({ id: '2', inspectionPointId: 'A', aiStatus: 'FAILED', timestamp: '2026-01-02T10:00:00Z' }),
          ev({ id: '3', inspectionPointId: 'B', aiStatus: 'PASSED', timestamp: '2026-01-01T10:00:00Z' }),
          ev({ id: '4', inspectionPointId: 'C', aiStatus: 'NEEDS_REVIEW', timestamp: '2026-01-01T10:00:00Z' }),
        ],
      })
    );
    // A telt als FAILED (nieuwste), niet als PASSED → totaal 3, akkoord 1 → 33%
    expect(html).toContain('33%');
    // Afwijkingen = A (FAILED) + C (NEEDS_REVIEW)
    expect(html).toContain('Afwijkingen &amp; maatregelen (2)');
  });

  it('toont een expliciete "geen afwijkingen"-verklaring bij alles akkoord', () => {
    const html = generateGemeenteRapportHtml(
      opts({ evidence: [ev({ id: '1', inspectionPointId: 'A', aiStatus: 'PASSED' })] })
    );
    expect(html).toContain('Geen afwijkingen geconstateerd');
    expect(html).toContain('100%');
  });

  it('zet FAILED/NEEDS_REVIEW-bevindingen in het afwijkingenregister', () => {
    const html = generateGemeenteRapportHtml(
      opts({
        evidence: [
          ev({ id: '1', inspectionPointId: 'WAPENING-1', aiStatus: 'FAILED', aiNotes: 'te weinig dekking' }),
        ],
      })
    );
    expect(html).toContain('WAPENING-1');
    expect(html).toContain('te weinig dekking');
    expect(html).toContain('Afgekeurd');
  });
});

describe('generateGemeenteRapportHtml — covervelden & branding', () => {
  it('toont het vergunningnummer alleen als het is opgegeven', () => {
    const withPerm = generateGemeenteRapportHtml(opts({ vergunningNummer: 'OV-2026-99' }));
    expect(withPerm).toContain('Omgevingsvergunning');
    expect(withPerm).toContain('OV-2026-99');

    const without = generateGemeenteRapportHtml(opts());
    expect(without).toContain('niet opgegeven');
  });

  it('zet de projectnaam in de titel en de bedrijfsnaam in de tekst', () => {
    const html = generateGemeenteRapportHtml(opts());
    expect(html).toContain('<title>Dossier Bevoegd Gezag — Woning Spee</title>');
    expect(html).toContain('Spee Solutions');
  });
});
