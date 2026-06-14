import { createHash } from 'crypto';
import {
  type EvidenceMeta,
  type SealedEntry,
  GENESIS_PREV_HASH,
  appendToChain,
  canonicalize,
  hashEvidence,
  verifyChain,
} from '../EvidenceSealService';

// Deterministische, echte SHA-256 zodat de tests narekenbaar en offline zijn —
// onafhankelijk van de expo-crypto runtime.
const sha256: (input: string) => Promise<string> = (input) =>
  Promise.resolve(createHash('sha256').update(input).digest('hex'));

const meta = (over: Partial<EvidenceMeta> = {}): EvidenceMeta => ({
  fileDigest: 'file-aaa',
  capturedAt: '2026-06-12T08:00:00.000Z',
  lat: 52.08,
  lng: 4.31,
  userId: 'user-1',
  controlepuntId: 'cp-1',
  ...over,
});

describe('EvidenceSealService — canonicalize', () => {
  it('is stabiel: zelfde inhoud → zelfde string ongeacht sleutel-volgorde', () => {
    const a = canonicalize(meta(), 'prev');
    const b = canonicalize(
      { controlepuntId: 'cp-1', capturedAt: '2026-06-12T08:00:00.000Z', userId: 'user-1', lng: 4.31, lat: 52.08, fileDigest: 'file-aaa' },
      'prev'
    );
    expect(a).toBe(b);
  });

  it('normaliseert ontbrekende velden naar null', () => {
    const s = canonicalize({ fileDigest: 'f', capturedAt: 't' }, '');
    expect(s).toContain('"lat":null');
    expect(s).toContain('"userId":null');
  });
});

describe('EvidenceSealService — keten opbouwen', () => {
  it('eerste stuk heeft genesis-prevHash en index 0', async () => {
    const e0 = await appendToChain([], meta(), sha256);
    expect(e0.chainIndex).toBe(0);
    expect(e0.prevHash).toBe(GENESIS_PREV_HASH);
    expect(e0.evidenceHash).toHaveLength(64); // sha256 hex
  });

  it('volgend stuk verwijst naar de hash van het vorige', async () => {
    const e0 = await appendToChain([], meta({ fileDigest: 'f0' }), sha256);
    const e1 = await appendToChain([e0], meta({ fileDigest: 'f1' }), sha256);
    expect(e1.chainIndex).toBe(1);
    expect(e1.prevHash).toBe(e0.evidenceHash);
  });

  it('hashEvidence is deterministisch', async () => {
    const h1 = await hashEvidence(meta(), 'prev', sha256);
    const h2 = await hashEvidence(meta(), 'prev', sha256);
    expect(h1).toBe(h2);
  });
});

describe('EvidenceSealService — verifyChain', () => {
  const bouwKeten = async (): Promise<SealedEntry[]> => {
    const e0 = await appendToChain([], meta({ fileDigest: 'f0' }), sha256);
    const e1 = await appendToChain([e0], meta({ fileDigest: 'f1' }), sha256);
    const e2 = await appendToChain([e0, e1], meta({ fileDigest: 'f2' }), sha256);
    return [e0, e1, e2];
  };

  it('een ongewijzigde keten is ongeschonden', async () => {
    const keten = await bouwKeten();
    const r = await verifyChain(keten, sha256);
    expect(r.ongeschonden).toBe(true);
    expect(r.stuks.every((s) => s.ongewijzigd)).toBe(true);
    expect(r.samenvatting).toContain('ongewijzigd');
  });

  it('detecteert een gewijzigd metadata-veld', async () => {
    const keten = await bouwKeten();
    // Manipuleer het GPS van stuk 1 zonder de hash te herberekenen.
    keten[1] = { ...keten[1], lat: 99.99 };
    const r = await verifyChain(keten, sha256);
    expect(r.ongeschonden).toBe(false);
    expect(r.stuks[1].ongewijzigd).toBe(false);
    expect(r.stuks[1].reden).toContain('gewijzigd');
  });

  it('detecteert een verwijderd stuk (keten verbroken)', async () => {
    const keten = await bouwKeten();
    const zonderMidden = [keten[0], keten[2]]; // stuk 1 weg
    const r = await verifyChain(zonderMidden, sha256);
    expect(r.ongeschonden).toBe(false);
    // Stuk dat nu op index 1 staat had index 2 → volgorde klopt niet.
    expect(r.stuks[1].ongewijzigd).toBe(false);
  });

  it('detecteert een vervangen bestand (andere fileDigest)', async () => {
    const keten = await bouwKeten();
    keten[2] = { ...keten[2], fileDigest: 'vervalst' };
    const r = await verifyChain(keten, sha256);
    expect(r.ongeschonden).toBe(false);
    expect(r.stuks[2].ongewijzigd).toBe(false);
  });

  it('lege keten is triviaal ongeschonden', async () => {
    const r = await verifyChain([], sha256);
    expect(r.ongeschonden).toBe(true);
  });
});
