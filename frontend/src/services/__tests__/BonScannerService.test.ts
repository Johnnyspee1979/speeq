/**
 * Unit-tests voor BonScannerService — pure OCR-nabewerking: type-detectie en
 * veld-extractie van gescande bonnen/leveringsbrieven/certificaten.
 *
 * We mocken alleen de zware module-imports (Supabase-client + storageUrl) zodat
 * het laden geen netwerk raakt, en testen daarna de deterministische helpers:
 *   - detectDocType scoort op NL/EN-trefwoorden en valt terug op BON bij een
 *     bedrag/btw zonder duidelijk type;
 *   - extractFields haalt leverancier (kopregel), datum, bedrag, nummer eruit.
 */

jest.mock('../../lib/supabase', () => ({ supabase: {} }));
jest.mock('../../lib/storageUrl', () => ({
  resolveStorageUrl: (_b: unknown, p: string) => Promise.resolve(p),
}));

import { detectDocType, extractFields } from '../BonScannerService';

describe('detectDocType', () => {
  it('herkent een leveringsbon via trefwoorden', () => {
    expect(detectDocType('LEVERINGSBON\nPakbon nr 12')).toBe('LEVERINGSBON');
  });

  it('herkent een certificaat (KOMO/KIWA/ISO)', () => {
    expect(detectDocType('KOMO certificaat — attest ISO 9001')).toBe('CERTIFICAAT');
  });

  it('herkent een factuur via factuur/btw/iban', () => {
    expect(detectDocType('FACTUUR\nBTW 21%\nIBAN NL00')).toBe('FACTUUR');
  });

  it('valt terug op BON bij een bedrag zonder duidelijk type', () => {
    expect(detectDocType('Kassa\n€ 12,50 incl.')).toBe('BON');
  });

  it('geeft OVERIG bij neutrale tekst', () => {
    expect(detectDocType('willekeurige notitie zonder kenmerken')).toBe('OVERIG');
  });
});

describe('extractFields', () => {
  it('haalt leverancier (kopregel), datum, bedrag en nummer eruit', () => {
    const text = [
      'Bouwmarkt Spee BV',
      'Datum: 15-01-2026',
      'Totaal € 1.234,56',
      'Factuurnr: AB-12345',
    ].join('\n');
    const f = extractFields(text);
    expect(f.leverancier).toBe('Bouwmarkt Spee BV');
    expect(f.datum).toBe('15-01-2026');
    expect(f.bedrag).toBe('€ 1.234,56');
    expect(f.nummer).toBe('AB-12345');
  });

  it('neemt een te lange kopregel (>=60 tekens) niet als leverancier', () => {
    const longHeader = 'X'.repeat(65);
    const f = extractFields(`${longHeader}\n2e regel`);
    expect(f.leverancier).toBeUndefined();
  });

  it('laat ontbrekende velden weg', () => {
    const f = extractFields('Losse regel zonder datum of bedrag');
    expect(f.datum).toBeUndefined();
    expect(f.bedrag).toBeUndefined();
    expect(f.nummer).toBeUndefined();
    expect(f.leverancier).toBe('Losse regel zonder datum of bedrag');
  });

  it('accepteert dd/mm/yy datum-notatie', () => {
    const f = extractFields('kop\nbon van 3/2/26');
    expect(f.datum).toBe('3/2/26');
  });
});
