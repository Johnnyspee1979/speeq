/**
 * @jest-environment node
 *
 * Gedrag-tests voor de PRESET-tak van de web-adapter in database/database.ts
 * (getAllPresets / getProjectPresets / getInspectionPresets / addPreset /
 * removePreset op Platform.OS='web'). Presets zijn de vrije project- en
 * inspectie-labels die de vakman in de UI kiest; ze worden geseed uit
 * config/presets en daarna lokaal aangevuld. Een fout hier dupliceert labels,
 * verliest de standaardlijst of geeft ze ongesorteerd terug.
 *
 * We borgen het publieke contract via een in-memory localforage-shim (de web-
 * store schrijft één WebDatabaseState-blob):
 *  - een verse store seedt de defaults uit config/presets, type-dan-waarde
 *    gesorteerd;
 *  - get{Project,Inspection}Presets filteren op type en sorteren op waarde;
 *  - addPreset trimt, dedupliceert (type+waarde) en negeert lege invoer;
 *  - removePreset verwijdert exact één type+waarde-paar.
 *
 * react-native (Platform=web), expo-sqlite (top-level import, ongebruikt op web),
 * config/presets en localforage zijn gemockt → @jest-environment node.
 */

const mockRegistry = new Map<string, Map<string, unknown>>();
const mockStoreFor = (storeName: string): Map<string, unknown> => {
  if (!mockRegistry.has(storeName)) mockRegistry.set(storeName, new Map());
  return mockRegistry.get(storeName)!;
};

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('expo-sqlite', () => ({ __esModule: true, openDatabaseAsync: jest.fn() }));
jest.mock('../../config/presets', () => ({
  PROJECT_PRESETS: ['Zomerlust', 'Aanbouw'],
  INSPECTION_PRESETS: ['Metselwerk', 'Liggers'],
}));
jest.mock('localforage', () => ({
  __esModule: true,
  default: {
    createInstance: ({ storeName }: { name: string; storeName: string }) => ({
      async getItem<T>(key: string): Promise<T | null> {
        const m = mockStoreFor(storeName);
        return m.has(key) ? (m.get(key) as T) : null;
      },
      async setItem<T>(key: string, val: T): Promise<T> {
        mockStoreFor(storeName).set(key, val);
        return val;
      },
    }),
  },
}));

import {
  getAllPresets,
  getProjectPresets,
  getInspectionPresets,
  addPreset,
  removePreset,
} from '../database';

beforeEach(() => {
  mockRegistry.clear(); // verse web-store per test → defaults re-seeden
});

describe('web-adapter presets — defaults', () => {
  it('seedt de defaults uit config/presets, type-dan-waarde gesorteerd', async () => {
    const all = await getAllPresets();
    expect(all).toEqual([
      { type: 'inspection', value: 'Liggers' },
      { type: 'inspection', value: 'Metselwerk' },
      { type: 'project', value: 'Aanbouw' },
      { type: 'project', value: 'Zomerlust' },
    ]);
  });

  it('getProjectPresets / getInspectionPresets filteren op type en sorteren', async () => {
    expect(await getProjectPresets()).toEqual(['Aanbouw', 'Zomerlust']);
    expect(await getInspectionPresets()).toEqual(['Liggers', 'Metselwerk']);
  });
});

describe('web-adapter presets — addPreset', () => {
  it('voegt een nieuw, getrimd label toe en houdt de lijst gesorteerd', async () => {
    await addPreset('project', '  Dakkapel  ');
    expect(await getProjectPresets()).toEqual(['Aanbouw', 'Dakkapel', 'Zomerlust']);
  });

  it('dedupliceert een bestaand type+waarde-paar', async () => {
    await addPreset('project', 'Aanbouw');
    expect(await getProjectPresets()).toEqual(['Aanbouw', 'Zomerlust']);
  });

  it('negeert lege of whitespace-only invoer', async () => {
    await addPreset('project', '   ');
    expect(await getProjectPresets()).toEqual(['Aanbouw', 'Zomerlust']);
  });

  it('houdt types gescheiden (zelfde waarde, ander type mag)', async () => {
    await addPreset('inspection', 'Aanbouw');
    expect(await getInspectionPresets()).toEqual(['Aanbouw', 'Liggers', 'Metselwerk']);
    expect(await getProjectPresets()).toEqual(['Aanbouw', 'Zomerlust']);
  });
});

describe('web-adapter presets — removePreset', () => {
  it('verwijdert exact één type+waarde-paar', async () => {
    await removePreset('inspection', 'Liggers');
    expect(await getInspectionPresets()).toEqual(['Metselwerk']);
    // ander type met dezelfde naam blijft staan
    expect(await getProjectPresets()).toEqual(['Aanbouw', 'Zomerlust']);
  });

  it('is onschadelijk voor een onbekend paar', async () => {
    await removePreset('project', 'Bestaat-niet');
    expect(await getProjectPresets()).toEqual(['Aanbouw', 'Zomerlust']);
  });
});
