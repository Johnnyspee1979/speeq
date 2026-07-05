/**
 * Unit-tests voor EdgeAIValidation — de lokale (on-device) scherpte-heuristiek
 * `checkImageSharpnessLocal`. Puur en deterministisch: geen imports, geen I/O.
 *
 * De regel: scherp genoeg = genoeg signaal (genormaliseerde lengte >= 120.000)
 * ÉN voldoende textuur (transitie-ratio over de eerste 6000 tekens > 0,72).
 * We borgen beide poorten plus de lege/whitespace-randgevallen, en dat
 * whitespace eerst wordt weggestript.
 */

import { checkImageSharpnessLocal } from '../EdgeAIValidation';

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('checkImageSharpnessLocal', () => {
  it('geeft false bij een lege string', async () => {
    await expect(checkImageSharpnessLocal('')).resolves.toBe(false);
  });

  it('geeft false bij alleen whitespace (na strippen leeg)', async () => {
    await expect(checkImageSharpnessLocal('   \n\t  ')).resolves.toBe(false);
  });

  it('geeft true bij genoeg signaal én hoge textuur', async () => {
    // 120.000 tekens, sterk wisselend → textuur-ratio ~1,0 en lengte-gate gehaald
    const sharp = 'ab'.repeat(60_000);
    await expect(checkImageSharpnessLocal(sharp)).resolves.toBe(true);
  });

  it('geeft false bij genoeg signaal maar lage textuur', async () => {
    // 120.000 identieke tekens → 0 transities → ratio 0
    const flat = 'a'.repeat(120_000);
    await expect(checkImageSharpnessLocal(flat)).resolves.toBe(false);
  });

  it('geeft false bij hoge textuur maar te weinig signaal (<120k)', async () => {
    // 119.998 tekens: textuur hoog, maar onder de lengte-drempel
    const tooShort = 'ab'.repeat(59_999);
    expect(tooShort.length).toBeLessThan(120_000);
    await expect(checkImageSharpnessLocal(tooShort)).resolves.toBe(false);
  });

  it('stript whitespace voordat de lengte wordt gemeten', async () => {
    // Met spaties is de ruwe lengte > 120k, maar genormaliseerd net te kort →
    // bewijst dat whitespace niet meetelt voor de signaal-gate.
    const withSpaces = 'a b'.repeat(59_999); // 179.997 ruw, 119.998 genormaliseerd
    expect(withSpaces.length).toBeGreaterThan(120_000);
    await expect(checkImageSharpnessLocal(withSpaces)).resolves.toBe(false);
  });
});
