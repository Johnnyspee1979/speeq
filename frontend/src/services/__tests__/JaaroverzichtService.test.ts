import {
  bouwJaaroverzicht,
  lopendKalenderjaar,
  type Periode,
} from '../JaaroverzichtService';

const periode2026: Periode = { van: '2026-01-01', tot: '2026-12-31' };

const bron = {
  projecten: [
    { id: 'p1', opgeleverdAt: '2026-03-10' },
    { id: 'p2', opgeleverdAt: null }, // lopend, telt mee
    { id: 'p3', opgeleverdAt: '2025-12-30' }, // buiten periode
  ],
  controlepunten: [
    { id: 'c1', projectId: 'p1', vastgelegdAt: '2026-02-01T09:00:00Z', heeftFoto: true },
    { id: 'c2', projectId: 'p1', vastgelegdAt: '2026-02-15T09:00:00Z', heeftFoto: true },
    { id: 'c3', projectId: 'p2', vastgelegdAt: '2026-03-01T09:00:00Z', heeftFoto: false },
    { id: 'c4', projectId: 'p1', vastgelegdAt: '2025-11-01T09:00:00Z', heeftFoto: true }, // buiten
  ],
  dossiers: [
    { id: 'd1', soort: 'bevoegd-gezag', gegenereerdAt: '2026-04-01T09:00:00Z' },
    { id: 'd2', soort: 'consument', gegenereerdAt: '2026-04-01T09:30:00Z' },
  ],
};

describe('JaaroverzichtService — lopendKalenderjaar', () => {
  it('geeft 1 jan t/m 31 dec van het opgegeven jaar', () => {
    expect(lopendKalenderjaar(new Date('2026-06-14T00:00:00Z'))).toEqual({
      van: '2026-01-01',
      tot: '2026-12-31',
    });
  });
});

describe('JaaroverzichtService — bouwJaaroverzicht', () => {
  it('filtert op periode en berekent KPI\'s', () => {
    const o = bouwJaaroverzicht(bron, periode2026);
    expect(o.kpi.projecten).toBe(2); // p1 + p2 (p3 buiten)
    expect(o.kpi.controlepunten).toBe(3); // c4 buiten periode
    expect(o.kpi.fotos).toBe(2);
    expect(o.kpi.dossiers).toBe(2);
    expect(o.kpi.gemiddeldControlepuntenPerProject).toBe(1.5);
    expect(o.leeg).toBe(false);
  });

  it('maandtrend telt controlepunten per maand, oplopend gesorteerd', () => {
    const o = bouwJaaroverzicht(bron, periode2026);
    expect(o.maandtrend).toEqual([
      { maand: '2026-02', aantal: 2 },
      { maand: '2026-03', aantal: 1 },
    ]);
  });

  it('lege periode geeft nette nul-staat zonder crash', () => {
    const o = bouwJaaroverzicht(bron, { van: '2030-01-01', tot: '2030-12-31' });
    expect(o.leeg).toBe(true);
    expect(o.kpi.gemiddeldControlepuntenPerProject).toBe(0);
    expect(o.maandtrend).toEqual([]);
  });
});
