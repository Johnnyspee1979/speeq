/**
 * @jest-environment node
 *
 * Gedrag-tests voor de native WatermelonDB-fabriek (database/watermelon.ts).
 * getWatermelonDatabase() moet op web bewust gooien (geen SQLiteAdapter) en op
 * native één Database opbouwen met de juiste schema/migraties/modelClasses, en die
 * daarna cachen. Een regressie zou de adapter dubbel opbouwen of het verkeerde
 * schema meegeven. We borgen dit met volledig gemockte zware deps:
 *  - op web gooit hij en bouwt hij géén Database;
 *  - op native bouwt hij de SQLiteAdapter met wkbSchema + wkbMigrations en de
 *    Database met die adapter + [Evidence], en hergebruikt hij de instance.
 *
 * @nozbe/watermelondb (+ sqlite-adapter), Evidence, schema, migrations en
 * react-native zijn gemockt → geen native runtime → @jest-environment node.
 */

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('@nozbe/watermelondb', () => ({
  Database: jest.fn().mockImplementation((cfg: unknown) => ({ __db: true, cfg })),
}));
jest.mock('@nozbe/watermelondb/adapters/sqlite', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((cfg: unknown) => ({ __adapter: true, cfg })),
}));
jest.mock('../Evidence', () => ({ __esModule: true, default: class FakeEvidence {} }));
jest.mock('../schema', () => ({ wkbSchema: { __schema: true } }));
jest.mock('../migrations', () => ({ wkbMigrations: { __migrations: true } }));

import { Platform } from 'react-native';
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import Evidence from '../Evidence';
import { getWatermelonDatabase } from '../watermelon';

const setOS = (os: string) => {
  (Platform as unknown as { OS: string }).OS = os;
};

beforeEach(() => {
  (Database as jest.Mock).mockClear();
  (SQLiteAdapter as unknown as jest.Mock).mockClear();
});

describe('getWatermelonDatabase op web', () => {
  it('gooit en bouwt geen Database', () => {
    setOS('web');
    expect(() => getWatermelonDatabase()).toThrow(/native/i);
    expect(Database as jest.Mock).not.toHaveBeenCalled();
  });
});

describe('getWatermelonDatabase op native', () => {
  it('bouwt de adapter + database correct en cachet de instance', () => {
    setOS('ios');
    const db1 = getWatermelonDatabase();
    const db2 = getWatermelonDatabase();

    // Zelfde instance → maar één keer opgebouwd.
    expect(db1).toBe(db2);
    expect(SQLiteAdapter as unknown as jest.Mock).toHaveBeenCalledTimes(1);
    expect(Database as jest.Mock).toHaveBeenCalledTimes(1);

    // Adapter krijgt het Wkb-schema + migraties.
    expect(SQLiteAdapter as unknown as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        schema: { __schema: true },
        migrations: { __migrations: true },
        jsi: true,
      }),
    );

    // Database krijgt de adapter + het Evidence-model.
    expect(Database as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        adapter: expect.objectContaining({ __adapter: true }),
        modelClasses: [Evidence],
      }),
    );
  });
});
