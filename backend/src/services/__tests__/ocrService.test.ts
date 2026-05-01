const {
  extractBetonkwaliteit,
  extractLeverdatum,
  extractMilieuklasse,
  extractVolume,
  normalizeWhitespace,
  validateBetonbonData,
} = require('../ocrService');

describe('ocrService', () => {
  it('extracts betonkwaliteit, milieuklasse, volume and leverdatum from raw OCR text', () => {
    const text = normalizeWhitespace(`
      Betoncentrale Utrecht
      Sterkteklasse C20/25
      Milieuklasse XC3
      Geleverd volume: 7,5 m3
      Leverdatum 14-03-2026
    `);

    expect(extractBetonkwaliteit(text)).toBe('C20/25');
    expect(extractMilieuklasse(text)).toBe('XC3');
    expect(extractVolume(text)).toBe('7.5');
    expect(extractLeverdatum(text)).toBe('14-03-2026');
  });

  it('flags missing OCR fields as dossier risks', () => {
    const validation = validateBetonbonData({
      betonkwaliteit: 'C20/25',
      milieuklasse: null,
      volumeKuub: '7.5',
      leverdatum: null,
      ruweTekst: 'C20/25 7,5 m3',
    });

    expect(validation.passed).toBe(false);
    expect(validation.missingFields).toEqual(
      expect.arrayContaining(['milieuklasse', 'leverdatum'])
    );
  });

  it('warns when OCR output conflicts with project specifications', () => {
    const validation = validateBetonbonData(
      {
        betonkwaliteit: 'C20/25',
        milieuklasse: 'XC2',
        volumeKuub: '5.0',
        leverdatum: '14-03-2026',
        ruweTekst: 'C20/25 XC2 5.0 m3 14-03-2026',
      },
      {
        expectedBetonkwaliteit: 'C25/30',
        expectedMilieuklasse: 'XC3',
        minVolumeKuub: 6,
      }
    );

    expect(validation.passed).toBe(false);
    expect(validation.matchedSpec).toBe(false);
    expect(validation.warnings).toEqual(
      expect.arrayContaining([
        'Betonkwaliteit wijkt af van projectspecificatie (C25/30).',
        'Milieuklasse wijkt af van projectspecificatie (XC3).',
        'Volume ligt onder minimum (6 m3).',
      ])
    );
  });
});
