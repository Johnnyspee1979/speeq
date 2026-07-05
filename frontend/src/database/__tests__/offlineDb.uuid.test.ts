/**
 * @jest-environment node
 *
 * Gedrag-tests voor de UUID-generator van de offline-laag
 * (database/offlineDb.ts → generateEvidenceUuid). Deze functie levert de sync-
 * sleutels voor offline bewijzen; een botsing of een ongeldig formaat zou twee
 * foto's laten samenvallen of een rij onverstuurbaar maken. We borgen het
 * RFC4122-v4-contract zónder de zware opslag-init aan te raken:
 *  - met crypto.randomUUID delegeert hij naar de native generator;
 *  - zonder randomUUID bouwt de fallback een geldige v4-UUID (8-4-4-4-12, versie
 *    '4', variant [89ab]);
 *  - opeenvolgende waarden zijn uniek.
 *
 * react-native/localforage/offlineMigrations zijn gemockt zodat alleen de pure
 * generator wordt geladen → @jest-environment node. We testen getOfflineStorage
 * (localforage-init) hier bewust niet.
 */

jest.mock('react-native', () => ({ Platform: { OS: 'node' } }));
jest.mock('localforage', () => ({ __esModule: true, default: { createInstance: jest.fn() } }));
jest.mock('../offlineMigrations', () => ({ runOfflineMigrations: jest.fn() }));

import { generateEvidenceUuid } from '../offlineDb';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('generateEvidenceUuid — met crypto.randomUUID', () => {
  it('delegeert naar de native generator', () => {
    const spy = jest
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValue('11111111-1111-4111-8111-111111111111');
    expect(generateEvidenceUuid()).toBe('11111111-1111-4111-8111-111111111111');
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe('generateEvidenceUuid — fallback zonder randomUUID', () => {
  let savedDesc: PropertyDescriptor | undefined;

  beforeEach(() => {
    savedDesc = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    // Vervang crypto door een object zónder randomUUID → forceer de fallback-tak.
    Object.defineProperty(globalThis, 'crypto', {
      value: {},
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    if (savedDesc) Object.defineProperty(globalThis, 'crypto', savedDesc);
    else delete (globalThis as { crypto?: unknown }).crypto;
  });

  it('produceert een geldige v4-UUID van 36 tekens', () => {
    const uuid = generateEvidenceUuid();
    expect(uuid).toHaveLength(36);
    expect(uuid).toMatch(V4);
  });

  it('levert unieke waarden bij herhaalde aanroepen', () => {
    const set = new Set(Array.from({ length: 50 }, () => generateEvidenceUuid()));
    expect(set.size).toBe(50);
    for (const v of set) expect(v).toMatch(V4);
  });
});
