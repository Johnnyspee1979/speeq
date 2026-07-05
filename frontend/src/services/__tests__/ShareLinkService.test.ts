import {
  type RandomBytesFn,
  DEFAULT_GELDIGHEID_DAGEN,
  beoordeelDeellink,
  berekenVervaldatum,
  bouwDeelUrl,
  genereerDeeltoken,
} from '../ShareLinkService';

// Deterministische RNG voor narekenbare tokens.
const vasteBytes: RandomBytesFn = (n) =>
  Promise.resolve(Uint8Array.from(Array.from({ length: n }, (_, i) => i)));

describe('ShareLinkService — token', () => {
  it('genereert een 256-bit hex-token (64 tekens)', async () => {
    const token = await genereerDeeltoken(vasteBytes);
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]+$/);
    // 0,1,2,... → 000102...
    expect(token.startsWith('000102')).toBe(true);
  });
});

describe('ShareLinkService — vervaldatum', () => {
  it('default is aanmaak + 14 dagen', () => {
    expect(DEFAULT_GELDIGHEID_DAGEN).toBe(14);
    expect(berekenVervaldatum('2026-06-01T00:00:00.000Z')).toBe(
      '2026-06-15T00:00:00.000Z'
    );
  });

  it('respecteert een afwijkende geldigheidsduur', () => {
    expect(berekenVervaldatum('2026-06-01T00:00:00.000Z', 7)).toBe(
      '2026-06-08T00:00:00.000Z'
    );
  });
});

describe('ShareLinkService — beoordeelDeellink', () => {
  it('geldig binnen de termijn en niet ingetrokken', () => {
    const o = beoordeelDeellink(
      { expiresAt: '2026-06-15T00:00:00.000Z', revokedAt: null },
      '2026-06-10T00:00:00.000Z'
    );
    expect(o.geldig).toBe(true);
    expect(o.reden).toBe('GELDIG');
  });

  it('verlopen na de vervaldatum', () => {
    const o = beoordeelDeellink(
      { expiresAt: '2026-06-15T00:00:00.000Z', revokedAt: null },
      '2026-06-16T00:00:00.000Z'
    );
    expect(o.geldig).toBe(false);
    expect(o.reden).toBe('VERLOPEN');
    expect(o.boodschap).toContain('verlopen');
  });

  it('ingetrokken wint van verlopen', () => {
    const o = beoordeelDeellink(
      { expiresAt: '2026-06-15T00:00:00.000Z', revokedAt: '2026-06-05T00:00:00.000Z' },
      '2026-06-20T00:00:00.000Z'
    );
    expect(o.reden).toBe('INGETROKKEN');
    expect(o.geldig).toBe(false);
  });

  it('vervaldatum-grens telt als verlopen (>=)', () => {
    const o = beoordeelDeellink(
      { expiresAt: '2026-06-15T00:00:00.000Z', revokedAt: null },
      '2026-06-15T00:00:00.000Z'
    );
    expect(o.geldig).toBe(false);
    expect(o.reden).toBe('VERLOPEN');
  });
});

describe('ShareLinkService — bouwDeelUrl', () => {
  it('bouwt een nette deel-URL en ontdubbelt de slash', () => {
    expect(bouwDeelUrl('https://speeq.app/', 'abc')).toBe(
      'https://speeq.app/deel/abc'
    );
    expect(bouwDeelUrl('https://speeq.app', 'abc')).toBe(
      'https://speeq.app/deel/abc'
    );
  });
});
