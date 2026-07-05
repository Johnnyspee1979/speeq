/**
 * @jest-environment node
 *
 * Gedrag-tests voor de app-config (config/app.ts). Deze module leest EXPO_PUBLIC_*
 * env-vars BIJ IMPORT en leidt daar de runtime-constanten uit af (backend-URL,
 * default-project, geofence-locatie/straal, WKB-projecteigenschappen). Een fout
 * in het parsen/normaliseren laat de app op de verkeerde backend praten of de
 * verkeerde WKB-aannames tonen. De parse-helpers zijn niet geëxporteerd; we
 * borgen hun contract via de geëxporteerde constanten, telkens met een verse
 * module-import per env-scenario (jest.isolateModules — geen React, dus veilig).
 *
 * We borgen:
 *  - statische constanten (APP_SCHEME, APP_TITLE);
 *  - defaults bij ongezette env (incl. de subtiele LOCATION-default 150, niet 25);
 *  - BACKEND_URL strip van trailing slashes;
 *  - PROJECT_LOCATION pas een object als ZOWEL lat als lon numeriek zijn;
 *  - normalizeProjectKind-synoniemen (VERBOUW/RENOVATIE → VERBOUW, onbekend →
 *    ONBEKEND) en parseOptionalBoolean (ja/nee/1/0/true/false → bool, rest → null);
 *  - getalsdefaults bij niet-numerieke invoer (?? fallback).
 *
 * Pure env-logica (geen RN/DOM) → @jest-environment node.
 */

type AppConfig = typeof import('../app');

const ENV_KEYS = [
  'EXPO_PUBLIC_BACKEND_URL',
  'EXPO_PUBLIC_DEFAULT_PROJECT_ID',
  'EXPO_PUBLIC_EXPO_PROJECT_ID',
  'EXPO_PUBLIC_PROJECT_LATITUDE',
  'EXPO_PUBLIC_PROJECT_LONGITUDE',
  'EXPO_PUBLIC_PROJECT_RADIUS_METERS',
  'EXPO_PUBLIC_LOCATION_MAX_ACCURACY_METERS',
  'EXPO_PUBLIC_WKB_PROJECT_KIND',
  'EXPO_PUBLIC_WKB_VERGUNNINGPLICHTIG',
  'EXPO_PUBLIC_WKB_ILLEGAL_EXISTING_BUILD',
  'EXPO_PUBLIC_WKB_KWALITEITSBORGER_INDEPENDENT',
  'EXPO_PUBLIC_PROJECT_NAME',
  'EXPO_PUBLIC_GEVOLGKLASSE',
  'EXPO_PUBLIC_KWALITEITSBORGER',
] as const;

const snapshot: Record<string, string | undefined> = {};

beforeAll(() => {
  for (const k of ENV_KEYS) snapshot[k] = process.env[k];
});

afterAll(() => {
  for (const k of ENV_KEYS) {
    if (snapshot[k] === undefined) delete process.env[k];
    else process.env[k] = snapshot[k];
  }
});

const load = (overrides: Record<string, string> = {}): AppConfig => {
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, overrides);
  let mod!: AppConfig;
  jest.isolateModules(() => {
    mod = require('../app') as AppConfig;
  });
  return mod;
};

describe('statische constanten', () => {
  it('exporteert vaste APP_SCHEME en APP_TITLE', () => {
    const c = load();
    expect(c.APP_SCHEME).toBe('wkb-snap-sync');
    expect(c.APP_TITLE).toBe('SpeeQ WKB');
  });
});

describe('defaults bij ongezette env', () => {
  it('gebruikt de gedocumenteerde standaardwaarden', () => {
    const c = load();
    expect(c.BACKEND_URL).toBe('http://localhost:3000');
    expect(c.DEFAULT_PROJECT_ID).toBe('104A');
    expect(c.EXPO_PROJECT_ID).toBe('');
    expect(c.DEFAULT_PROJECT_NAME).toBe('Wkb Dossier 104A');
    expect(c.DEFAULT_GEVOLGKLASSE).toBe('1');
    expect(c.PROJECT_RADIUS_METERS).toBe(250);
    // raw-default is '150' → parseNumber=150; de ?? 25 geldt alleen bij niet-numeriek
    expect(c.LOCATION_MAX_ACCURACY_METERS).toBe(150);
    expect(c.PROJECT_LOCATION).toBeNull();
    expect(c.WKB_PROJECT_KIND).toBe('NIEUWBOUW');
    expect(c.WKB_VERGUNNINGPLICHTIG).toBe(true);
    expect(c.WKB_ILLEGAL_EXISTING_BUILD).toBe(false);
    expect(c.WKB_KWALITEITSBORGER_INDEPENDENT).toBeNull();
    expect(c.WKB_KWALITEITSBORGER_ASSIGNED).toBe(false);
  });
});

describe('BACKEND_URL', () => {
  it('strip trailing slashes', () => {
    expect(load({ EXPO_PUBLIC_BACKEND_URL: 'https://api.x.com/' }).BACKEND_URL).toBe(
      'https://api.x.com',
    );
    expect(load({ EXPO_PUBLIC_BACKEND_URL: 'https://api.x.com///' }).BACKEND_URL).toBe(
      'https://api.x.com',
    );
  });
});

describe('PROJECT_LOCATION', () => {
  it('is een object alleen als lat én lon numeriek zijn', () => {
    expect(
      load({
        EXPO_PUBLIC_PROJECT_LATITUDE: '52.08',
        EXPO_PUBLIC_PROJECT_LONGITUDE: '4.31',
      }).PROJECT_LOCATION,
    ).toEqual({ latitude: 52.08, longitude: 4.31 });
  });

  it('is null als slechts één coördinaat gezet is', () => {
    expect(load({ EXPO_PUBLIC_PROJECT_LATITUDE: '52.08' }).PROJECT_LOCATION).toBeNull();
  });

  it('is null bij niet-numerieke coördinaten', () => {
    expect(
      load({
        EXPO_PUBLIC_PROJECT_LATITUDE: 'noord',
        EXPO_PUBLIC_PROJECT_LONGITUDE: 'oost',
      }).PROJECT_LOCATION,
    ).toBeNull();
  });
});

describe('WKB_PROJECT_KIND (normalizeProjectKind)', () => {
  it('mapt synoniemen naar VERBOUW', () => {
    for (const v of ['VERBOUW', 'renovatie', 'Renovation']) {
      expect(load({ EXPO_PUBLIC_WKB_PROJECT_KIND: v }).WKB_PROJECT_KIND).toBe('VERBOUW');
    }
  });

  it('mapt synoniemen naar NIEUWBOUW', () => {
    for (const v of ['nieuwbouw', 'NEW_BUILD', 'newbuild']) {
      expect(load({ EXPO_PUBLIC_WKB_PROJECT_KIND: v }).WKB_PROJECT_KIND).toBe('NIEUWBOUW');
    }
  });

  it('valt terug op ONBEKEND bij iets onbekends', () => {
    expect(load({ EXPO_PUBLIC_WKB_PROJECT_KIND: 'sloop' }).WKB_PROJECT_KIND).toBe('ONBEKEND');
  });
});

describe('parseOptionalBoolean (via WKB_VERGUNNINGPLICHTIG)', () => {
  it('herkent waar-synoniemen', () => {
    for (const v of ['true', '1', 'yes', 'ja', 'JA']) {
      expect(load({ EXPO_PUBLIC_WKB_VERGUNNINGPLICHTIG: v }).WKB_VERGUNNINGPLICHTIG).toBe(true);
    }
  });

  it('herkent onwaar-synoniemen', () => {
    for (const v of ['false', '0', 'no', 'nee', 'NEE']) {
      expect(load({ EXPO_PUBLIC_WKB_VERGUNNINGPLICHTIG: v }).WKB_VERGUNNINGPLICHTIG).toBe(false);
    }
  });

  it('geeft null bij onparseerbare waarde', () => {
    expect(load({ EXPO_PUBLIC_WKB_VERGUNNINGPLICHTIG: 'misschien' }).WKB_VERGUNNINGPLICHTIG).toBeNull();
  });
});

describe('getalsdefaults bij niet-numerieke invoer', () => {
  it('PROJECT_RADIUS_METERS valt terug op 250', () => {
    expect(load({ EXPO_PUBLIC_PROJECT_RADIUS_METERS: 'veel' }).PROJECT_RADIUS_METERS).toBe(250);
  });

  it('LOCATION_MAX_ACCURACY_METERS valt terug op 25', () => {
    expect(
      load({ EXPO_PUBLIC_LOCATION_MAX_ACCURACY_METERS: 'onnauwkeurig' })
        .LOCATION_MAX_ACCURACY_METERS,
    ).toBe(25);
  });
});

describe('WKB_KWALITEITSBORGER_ASSIGNED', () => {
  it('is waar zodra er een kwaliteitsborger is ingevuld', () => {
    expect(
      load({ EXPO_PUBLIC_KWALITEITSBORGER: 'Bouwgarant' }).WKB_KWALITEITSBORGER_ASSIGNED,
    ).toBe(true);
  });
});
