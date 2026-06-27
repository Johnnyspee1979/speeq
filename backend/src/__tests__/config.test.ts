/**
 * Tests voor de env-parsing in config.ts (backendConfig + hasSupabaseConfig/
 * hasAdobeConfig).
 *
 * Deze module zet rauwe environment-variabelen om naar getypte config. Een fout
 * hier zet bijvoorbeeld de auth-bypass per ongeluk aan, kiest de verkeerde poort,
 * of denkt dat Supabase/Adobe geconfigureerd is terwijl een sleutel ontbreekt —
 * met een onveilige of niet-startende backend tot gevolg.
 *
 * We borgen de pure helpers via hun zichtbare config-velden:
 *  - parseNumber: geldig getal → getal, NaN/ontbrekend → fallback;
 *  - parseBoolean: '1/true/yes/on' → true, '0/false/no/off' → false (case-
 *    insensitief + getrimd), onbekend/leeg → fallback;
 *  - normalizeEnv: production/prod → 'production', staging/stage/test →
 *    'staging', anders 'development', met fallback van APP_ENV naar NODE_ENV;
 *  - hasSupabaseConfig/hasAdobeConfig: alleen true als BEIDE velden gevuld zijn.
 *
 * dotenv is gemockt → het echte .env-bestand vervuilt de test niet; we sturen
 * process.env volledig zelf en herladen config per scenario via resetModules.
 */

jest.mock('dotenv', () => ({ config: jest.fn() }));

const KEYS = [
  'APP_ENV',
  'NODE_ENV',
  'PORT',
  'DKA_TIMEOUT_MS',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'ALLOW_AUTH_BYPASS',
  'ENABLE_QR_DEMO',
  'KIK_RETRY_ENABLED',
  'PDF_SERVICES_CLIENT_ID',
  'PDF_SERVICES_CLIENT_SECRET',
];

const load = (overrides: Record<string, string | undefined> = {}) => {
  for (const k of KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  jest.resetModules();
  return require('../config');
};

describe('config — parseNumber', () => {
  it('neemt een geldig getal over', () => {
    expect(load({ PORT: '8080' }).backendConfig.port).toBe(8080);
    expect(load({ DKA_TIMEOUT_MS: '500' }).backendConfig.dkaTimeoutMs).toBe(500);
  });

  it('valt terug op de default bij een niet-numerieke waarde', () => {
    expect(load({ PORT: 'niet-een-getal' }).backendConfig.port).toBe(4103);
  });

  it('gebruikt de default als de variabele ontbreekt', () => {
    expect(load({}).backendConfig.port).toBe(4103);
    expect(load({}).backendConfig.dkaTimeoutMs).toBe(10000);
  });
});

describe('config — parseBoolean', () => {
  it('herkent truthy-tokens (case-insensitief, getrimd)', () => {
    expect(load({ ALLOW_AUTH_BYPASS: 'true' }).backendConfig.allowAuthBypass).toBe(true);
    expect(load({ ALLOW_AUTH_BYPASS: ' ON ' }).backendConfig.allowAuthBypass).toBe(true);
    expect(load({ ALLOW_AUTH_BYPASS: '1' }).backendConfig.allowAuthBypass).toBe(true);
    expect(load({ ENABLE_QR_DEMO: 'YES' }).backendConfig.enableQrDemo).toBe(true);
  });

  it('herkent falsy-tokens', () => {
    expect(load({ KIK_RETRY_ENABLED: 'no' }).backendConfig.kikRetryEnabled).toBe(false);
    expect(load({ KIK_RETRY_ENABLED: 'off' }).backendConfig.kikRetryEnabled).toBe(false);
    expect(load({ KIK_RETRY_ENABLED: '0' }).backendConfig.kikRetryEnabled).toBe(false);
  });

  it('valt terug op de default bij onbekende of lege waarde', () => {
    // allowAuthBypass default false, kikRetryEnabled default true
    expect(load({ ALLOW_AUTH_BYPASS: 'misschien' }).backendConfig.allowAuthBypass).toBe(false);
    expect(load({}).backendConfig.allowAuthBypass).toBe(false);
    expect(load({}).backendConfig.kikRetryEnabled).toBe(true);
  });
});

describe('config — normalizeEnv', () => {
  it('mapt productie-aliassen naar production', () => {
    expect(load({ APP_ENV: 'production' }).backendConfig.appEnv).toBe('production');
    expect(load({ APP_ENV: 'prod' }).backendConfig.appEnv).toBe('production');
    expect(load({ APP_ENV: '  Production ' }).backendConfig.appEnv).toBe('production');
  });

  it('mapt staging-aliassen (staging/stage/test) naar staging', () => {
    expect(load({ APP_ENV: 'staging' }).backendConfig.appEnv).toBe('staging');
    expect(load({ APP_ENV: 'stage' }).backendConfig.appEnv).toBe('staging');
    expect(load({ APP_ENV: 'test' }).backendConfig.appEnv).toBe('staging');
  });

  it('valt van APP_ENV terug op NODE_ENV en uiteindelijk development', () => {
    expect(load({ NODE_ENV: 'production' }).backendConfig.appEnv).toBe('production');
    expect(load({}).backendConfig.appEnv).toBe('development');
    expect(load({ APP_ENV: 'iets-onbekends' }).backendConfig.appEnv).toBe('development');
  });
});

describe('config — hasSupabaseConfig / hasAdobeConfig', () => {
  it('hasSupabaseConfig vereist BEIDE velden', () => {
    expect(
      load({ SUPABASE_URL: 'u', SUPABASE_SERVICE_KEY: 'k' }).hasSupabaseConfig()
    ).toBe(true);
    expect(load({ SUPABASE_URL: 'u' }).hasSupabaseConfig()).toBe(false);
    expect(load({ SUPABASE_SERVICE_KEY: 'k' }).hasSupabaseConfig()).toBe(false);
    expect(load({}).hasSupabaseConfig()).toBe(false);
  });

  it('hasAdobeConfig vereist BEIDE velden', () => {
    expect(
      load({ PDF_SERVICES_CLIENT_ID: 'id', PDF_SERVICES_CLIENT_SECRET: 'sec' }).hasAdobeConfig()
    ).toBe(true);
    expect(load({ PDF_SERVICES_CLIENT_ID: 'id' }).hasAdobeConfig()).toBe(false);
    expect(load({}).hasAdobeConfig()).toBe(false);
  });
});
