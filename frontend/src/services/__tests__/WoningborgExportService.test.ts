import {
  type CheckpointMapping,
  type Controlepunt,
  WONINGBORG_EXPORT_PROFIEL,
  bouwWoningborgExport,
  formatExportSamenvatting,
  mapStatus,
} from '../WoningborgExportService';

const GEN_AT = '2026-06-14T10:00:00.000Z';

const cp = (over: Partial<Controlepunt>): Controlepunt => ({
  controlepuntId: 'cp1',
  omschrijving: 'Fundering wapening',
  status: 'APPROVED',
  vastlegdatum: '2026-06-01',
  verantwoordelijke: 'J. Vakman',
  fotoReferenties: ['storage://foto/1.jpg'],
  ...over,
});

const mapping = (over: Partial<CheckpointMapping>): CheckpointMapping => ({
  speeqControlepuntId: 'cp1',
  woningborgCode: 'WB-100',
  woningborgOmschrijving: 'Wapening fundering',
  ...over,
});

describe('WoningborgExportService — mapStatus', () => {
  it('mapt SpeeQ-status naar Woningborg-status', () => {
    expect(mapStatus('APPROVED')).toBe('akkoord');
    expect(mapStatus('FINALIZED')).toBe('akkoord');
    expect(mapStatus('PENDING_REVIEW')).toBe('in_behandeling');
    expect(mapStatus('REJECTED')).toBe('afgekeurd');
    expect(mapStatus(null)).toBe('onbekend');
    expect(mapStatus('IETS_ANDERS')).toBe('onbekend');
  });
});

describe('WoningborgExportService — bouwWoningborgExport', () => {
  it('bevat profiel/versie en projectmeta', () => {
    const pakket = bouwWoningborgExport({ projectId: 'p1', naam: 'Woning 12' }, [], [], GEN_AT);
    expect(pakket.profiel).toBe(WONINGBORG_EXPORT_PROFIEL);
    expect(pakket.versie).toBe('1.0');
    expect(pakket.project).toEqual({ projectId: 'p1', naam: 'Woning 12', gegenereerdAt: GEN_AT });
  });

  it('exporteert een gemapt punt met Woningborg-code en status', () => {
    const pakket = bouwWoningborgExport(
      { projectId: 'p1' },
      [cp({})],
      [mapping({})],
      GEN_AT
    );
    expect(pakket.punten).toHaveLength(1);
    expect(pakket.punten[0]).toMatchObject({
      woningborgCode: 'WB-100',
      omschrijving: 'Wapening fundering',
      status: 'akkoord',
      vastlegdatum: '2026-06-01',
      verantwoordelijke: 'J. Vakman',
      fotoReferenties: ['storage://foto/1.jpg'],
    });
    expect(pakket.nietGemapt).toHaveLength(0);
  });

  it('valt terug op controlepunt-omschrijving als mapping er geen heeft', () => {
    const pakket = bouwWoningborgExport(
      { projectId: 'p1' },
      [cp({})],
      [mapping({ woningborgOmschrijving: null })],
      GEN_AT
    );
    expect(pakket.punten[0].omschrijving).toBe('Fundering wapening');
  });

  it('zet niet-gemapte controlepunten in nietGemapt (verdwijnen niet stil)', () => {
    const pakket = bouwWoningborgExport(
      { projectId: 'p1' },
      [cp({ controlepuntId: 'cp1' }), cp({ controlepuntId: 'cp2', omschrijving: 'Dakbedekking' })],
      [mapping({ speeqControlepuntId: 'cp1' })],
      GEN_AT
    );
    expect(pakket.punten).toHaveLength(1);
    expect(pakket.nietGemapt).toEqual([{ controlepuntId: 'cp2', omschrijving: 'Dakbedekking' }]);
  });

  it('lege foto-referenties default naar lege array', () => {
    const pakket = bouwWoningborgExport(
      { projectId: 'p1' },
      [cp({ fotoReferenties: undefined })],
      [mapping({})],
      GEN_AT
    );
    expect(pakket.punten[0].fotoReferenties).toEqual([]);
  });
});

describe('WoningborgExportService — samenvatting', () => {
  it('telt geëxporteerde punten en niet-gemapte', () => {
    const pakket = bouwWoningborgExport(
      { projectId: 'p1' },
      [cp({ controlepuntId: 'cp1' }), cp({ controlepuntId: 'cp2' })],
      [mapping({ speeqControlepuntId: 'cp1' })],
      GEN_AT
    );
    expect(formatExportSamenvatting(pakket)).toBe('1 punt geëxporteerd · 1 niet gemapt');
  });
});
