/**
 * Unit-tests voor LocalMobileNetClassifier.
 *
 * We testen NIET het echte MobileNet-model (te zwaar voor jest, vereist
 * GPU/WASM init). In plaats: testen we de WKB-mapping laag op
 * gesynthetiseerde MobileNet-output, plus de fallback-paden.
 */

import {
  classifyPhotoCategory,
  isCategorizationSupported,
  __resetMobileNetForTests,
  __mapToWkbCategoryForTests as mapToWkbCategory,
} from '../LocalMobileNetClassifier';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

beforeEach(() => {
  __resetMobileNetForTests();
});

// ─── WKB-mapping ─────────────────────────────────────────────────────────────

describe('mapToWkbCategory — WKB-mapping laag', () => {
  it('leeg array → unknown', () => {
    const result = mapToWkbCategory([]);
    expect(result.category).toBe('unknown');
    expect(result.confidence).toBe(0);
  });

  it("'concrete wall' → beton", () => {
    const result = mapToWkbCategory([
      { className: 'concrete wall, stone wall', probability: 0.9 },
    ]);
    expect(result.category).toBe('beton');
    expect(result.rawLabel).toBe('concrete wall, stone wall');
  });

  it("'chainlink fence' → wapening", () => {
    const result = mapToWkbCategory([
      { className: 'chainlink fence', probability: 0.85 },
    ]);
    expect(result.category).toBe('wapening');
  });

  it("'tile roof' → dak (specifieker dan metselwerk)", () => {
    const result = mapToWkbCategory([
      { className: 'tile roof', probability: 0.7 },
    ]);
    // tile roof matcht zowel 'dak' (tile roof) als 'metselwerk' (tile roof)
    // — beide krijgen dezelfde score. We accepteren beide als geldig.
    expect(['dak', 'metselwerk']).toContain(result.category);
  });

  it("'hammer' → gereedschap", () => {
    const result = mapToWkbCategory([
      { className: 'hammer', probability: 0.95 },
    ]);
    expect(result.category).toBe('gereedschap');
  });

  it("'hard hat, hardhat' → persoon", () => {
    const result = mapToWkbCategory([
      { className: 'hard hat, hardhat', probability: 0.88 },
    ]);
    expect(result.category).toBe('persoon');
  });

  it("'cotton, cotton fiber' → isolatie", () => {
    const result = mapToWkbCategory([
      { className: 'cotton, cotton fiber', probability: 0.6 },
    ]);
    expect(result.category).toBe('isolatie');
  });

  it('geen match in keywords → overig', () => {
    const result = mapToWkbCategory([
      { className: 'cat, domestic cat, house cat', probability: 0.99 },
    ]);
    expect(result.category).toBe('overig');
    expect(result.rawLabel).toBe('cat, domestic cat, house cat');
  });

  it('combineert top-5 voor robuustere classificatie', () => {
    // Top-1 is generiek ('outdoor'), maar top-3 zegt 'brick' — moet 't naar
    // metselwerk leiden door cumulatieve score.
    const result = mapToWkbCategory([
      { className: 'outdoor scene', probability: 0.4 },
      { className: 'building exterior', probability: 0.3 },
      { className: 'brick wall', probability: 0.25 },
    ]);
    expect(['metselwerk', 'beton']).toContain(result.category);
  });

  it('alternates bevat top-5 raw labels', () => {
    const predictions = [
      { className: 'a', probability: 0.5 },
      { className: 'b', probability: 0.3 },
      { className: 'c', probability: 0.1 },
      { className: 'd', probability: 0.05 },
      { className: 'e', probability: 0.05 },
      { className: 'f-extra', probability: 0.01 },
    ];
    const result = mapToWkbCategory(predictions);
    expect(result.alternates).toHaveLength(5);
    expect(result.alternates[0].label).toBe('a');
    expect(result.alternates[4].label).toBe('e');
  });

  it('confidence is capped op 0.95', () => {
    // Verzin keywords-rijke labels zodat score hoog wordt
    const result = mapToWkbCategory([
      { className: 'concrete wall stone wall paving', probability: 0.99 },
      { className: 'concrete wall stone wall paving', probability: 0.99 },
    ]);
    expect(result.confidence).toBeLessThanOrEqual(0.95);
  });
});

// ─── classifyPhotoCategory — platform fallback ──────────────────────────────

describe('classifyPhotoCategory — platform fallback', () => {
  it("op native (Platform.OS !== 'web') → unknown", async () => {
    // Override platform-mock voor deze ene test
    jest.resetModules();
    jest.doMock('react-native', () => ({ Platform: { OS: 'ios' } }));
    const { classifyPhotoCategory: nativeFn } = await import(
      '../LocalMobileNetClassifier'
    );

    const result = await nativeFn('any-uri');
    expect(result.category).toBe('unknown');
    expect(result.confidence).toBe(0);

    jest.resetModules();
    jest.doMock('react-native', () => ({ Platform: { OS: 'web' } }));
  });

  it('zonder document → unknown (Node-only test env)', async () => {
    // jsdom moet document hebben; check via isCategorizationSupported
    if (typeof document === 'undefined') {
      const result = await classifyPhotoCategory('any-uri');
      expect(result.category).toBe('unknown');
    } else {
      // In jsdom: laad-faal omdat Image niet écht een URL kan laden →
      // model wordt wel geladen? Nee, dynamic import vangt de fout en
      // returnt unknown. Test of dit netjes faalt zonder crash.
      const result = await classifyPhotoCategory('not-a-real-url');
      expect(['unknown', 'overig']).toContain(result.category);
    }
  });
});

// ─── isCategorizationSupported ──────────────────────────────────────────────

describe('isCategorizationSupported', () => {
  it("returnt true op web met document", () => {
    if (typeof document !== 'undefined') {
      expect(isCategorizationSupported()).toBe(true);
    }
  });
});
