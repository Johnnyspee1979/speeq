/**
 * Unit-tests voor aiValidationService — de (gesimuleerde) AI-wapeningscontrole
 * die bepaalt of een bewijsfoto het Dossier Bevoegd Gezag in mag.
 *
 * De status stuurt de review-flow aan (APPROVED vs. menselijke controle), dus het
 * beslisgedrag moet geborgd zijn:
 *   - inspectiepunt met "WAPENING" (genormaliseerd: trim + hoofdletters) →
 *     APPROVED met hoge confidence en de drie standaard-bevindingen;
 *   - elk ander punt → WARNING (vereist kwaliteitsborger).
 *
 * Fake timers zodat de interne sleep(1500) de test niet vertraagt.
 */

const { validateEvidenceWithAI } = require('../aiValidationService');

let logSpy: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  logSpy.mockRestore();
});

const run = async (punt: string) => {
  const p = validateEvidenceWithAI(Buffer.from('fake-image'), punt);
  await jest.advanceTimersByTimeAsync(1500);
  return p;
};

describe('validateEvidenceWithAI', () => {
  it('keurt een wapeningsinspectie goed met hoge confidence', async () => {
    const res = await run('WAPENING-FUNDERING');
    expect(res.status).toBe('APPROVED');
    expect(res.confidence).toBeGreaterThanOrEqual(0.9);
    expect(res.findings).toHaveLength(3);
  });

  it('normaliseert het inspectiepunt (trim + hoofdletters) vóór de match', async () => {
    const res = await run('  wapening-detail  ');
    expect(res.status).toBe('APPROVED');
  });

  it('geeft WARNING voor een niet-wapeningspunt (menselijke controle nodig)', async () => {
    const res = await run('GEVELAANSLUITING');
    expect(res.status).toBe('WARNING');
    expect(res.confidence).toBeLessThan(0.9);
    expect(res.findings).toHaveLength(1);
    expect(res.findings[0]).toMatch(/kwaliteitsborger/i);
  });
});
