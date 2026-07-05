/**
 * @jest-environment node
 *
 * Gedrag-tests voor de opslag-engine-selectie (database/storageEngine.ts). Deze
 * module bepaalt welke lokale store de offline-laag gebruikt (web-store vs SQLite)
 * op basis van het platform én de EXPO_PUBLIC_WKB_STORAGE_ENGINE-env. Een fout
 * laat de app op web de native Watermelon-migratie verwachten of toont een
 * verkeerd engine-label in de diagnostiek. We borgen de selectie- en label-logica:
 *  - normalizeRequestedEngine (via .requested): sqlite/watermelon (case-insensitive,
 *    getrimd) blijven behouden, al het andere valt terug op 'auto';
 *  - op web is active altijd 'web', met een fallbackReason alleen bij 'watermelon';
 *  - op native is active altijd 'sqlite', met een compat-reden alleen bij 'watermelon';
 *  - getStorageEngineLabel spiegelt dit ('Web store' / 'SQLite / Watermelon-ready'
 *    / 'SQLite').
 *
 * react-native is volledig gemockt tot { Platform: { OS } } → geen RN-runtime nodig
 * → @jest-environment node. Platform.OS en env worden per scenario gezet (lezing
 * gebeurt bij call-time, dus geen isolateModules nodig).
 */

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { Platform } from 'react-native';
import { getStorageEngineInfo, getStorageEngineLabel } from '../storageEngine';

const ENV_KEY = 'EXPO_PUBLIC_WKB_STORAGE_ENGINE';
let snapshot: string | undefined;

const setOS = (os: string) => {
  (Platform as unknown as { OS: string }).OS = os;
};

const setEngine = (value?: string) => {
  if (value === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = value;
};

beforeAll(() => {
  snapshot = process.env[ENV_KEY];
});

afterAll(() => {
  if (snapshot === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = snapshot;
  setOS('ios');
});

beforeEach(() => {
  setEngine(undefined);
  setOS('ios');
});

describe('normalizeRequestedEngine (via .requested)', () => {
  it('houdt sqlite en watermelon vast, case-insensitief en getrimd', () => {
    setEngine('sqlite');
    expect(getStorageEngineInfo().requested).toBe('sqlite');
    setEngine('  WATERMELON  ');
    expect(getStorageEngineInfo().requested).toBe('watermelon');
  });

  it('valt terug op auto bij ongezette of onbekende waarde', () => {
    expect(getStorageEngineInfo().requested).toBe('auto');
    setEngine('rocksdb');
    expect(getStorageEngineInfo().requested).toBe('auto');
  });
});

describe('getStorageEngineInfo op web', () => {
  beforeEach(() => setOS('web'));

  it('kiest altijd de web-store, zonder reden bij auto', () => {
    const info = getStorageEngineInfo();
    expect(info.active).toBe('web');
    expect(info.fallbackReason).toBeNull();
  });

  it('geeft een fallbackReason wanneer watermelon op web wordt gevraagd', () => {
    setEngine('watermelon');
    const info = getStorageEngineInfo();
    expect(info.active).toBe('web');
    expect(info.fallbackReason).toMatch(/web-store fallback/);
  });
});

describe('getStorageEngineInfo op native', () => {
  it('draait watermelon-verzoek op de SQLite-compat-laag met reden', () => {
    setEngine('watermelon');
    const info = getStorageEngineInfo();
    expect(info.active).toBe('sqlite');
    expect(info.fallbackReason).toMatch(/compatibiliteitslaag/);
  });

  it('gebruikt SQLite zonder reden bij sqlite of auto', () => {
    for (const engine of [undefined, 'sqlite']) {
      setEngine(engine);
      const info = getStorageEngineInfo();
      expect(info.active).toBe('sqlite');
      expect(info.fallbackReason).toBeNull();
    }
  });
});

describe('getStorageEngineLabel', () => {
  it('toont "Web store" op web', () => {
    setOS('web');
    expect(getStorageEngineLabel()).toBe('Web store');
  });

  it('toont het Watermelon-ready label op native bij watermelon', () => {
    setEngine('watermelon');
    expect(getStorageEngineLabel()).toBe('SQLite / Watermelon-ready');
  });

  it('toont "SQLite" op native bij sqlite of auto', () => {
    setEngine('sqlite');
    expect(getStorageEngineLabel()).toBe('SQLite');
    setEngine(undefined);
    expect(getStorageEngineLabel()).toBe('SQLite');
  });
});
