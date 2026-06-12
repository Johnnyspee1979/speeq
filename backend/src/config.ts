require('dotenv').config();

const parseNumber = (rawValue: string | undefined, fallback: number) => {
  const parsed = Number(rawValue ?? String(fallback));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBoolean = (rawValue: string | undefined, fallback: boolean) => {
  if (!rawValue) {
    return fallback;
  }

  const normalized = rawValue.trim().toLowerCase();

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
};

const backendConfig = {
  port: parseNumber(process.env.PORT, 4103),
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY ?? '',
  // Expliciete, standaard-uitgeschakelde ontsnappingsklep voor lokale dev.
  // Wanneer Supabase niet geconfigureerd is, slaat de auth-middleware ALLEEN
  // over als dit bewust op true staat (ALLOW_AUTH_BYPASS=true in .env). In
  // productie (vlag afwezig) is auth fail-closed: ontbrekende config = 503,
  // nooit een stille mock-gebruiker.
  allowAuthBypass: parseBoolean(process.env.ALLOW_AUTH_BYPASS, false),
  dsoAdapterUrl:
    process.env.DIGIKOPPELING_API_URL ?? process.env.DSO_ADAPTER_URL ?? '',
  digikoppelingApiUrl:
    process.env.DIGIKOPPELING_API_URL ?? process.env.DSO_ADAPTER_URL ?? '',
  digikoppelingApiKey:
    process.env.DIGIKOPPELING_API_KEY ?? process.env.DSO_ADAPTER_CLIENT_ID ?? '',
  digikoppelingCertPath:
    process.env.DIGIKOPPELING_CERT_PATH ?? process.env.DSO_ADAPTER_CERT_ALIAS ?? '',
  dsoAdapterClientId: process.env.DSO_ADAPTER_CLIENT_ID ?? '',
  dsoAdapterCertAlias: process.env.DSO_ADAPTER_CERT_ALIAS ?? '',
  dsoEnvironment: process.env.DSO_ENV ?? 'LTO',
  dkaInternalUrl:
    process.env.DKA_INTERNAL_URL ?? process.env.DIGIKOPPELING_API_URL ?? '',
  dkaInternalApiKey:
    process.env.DKA_INTERNAL_API_KEY ?? process.env.DIGIKOPPELING_API_KEY ?? '',
  dkaTimeoutMs: parseNumber(process.env.DKA_TIMEOUT_MS, 10000),
  aiValidatorUrl: process.env.AI_VALIDATOR_URL ?? '',
  aiValidatorTimeoutMs: parseNumber(process.env.AI_VALIDATOR_TIMEOUT_MS, 8000),
  kikApiUrl: process.env.KIK_API_URL ?? process.env.KIK_API_BASE_URL ?? '',
  kikApiKey: process.env.KIK_API_KEY ?? process.env.KIK_API_TOKEN ?? '',
  kikTimeoutMs: parseNumber(process.env.KIK_TIMEOUT_MS, 10000),
  kikRetrySchedule: process.env.KIK_RETRY_SCHEDULE ?? '0 * * * *',
  kikRetryEnabled: parseBoolean(process.env.KIK_RETRY_ENABLED, true),
  appDeepLinkScheme: process.env.APP_DEEP_LINK_SCHEME ?? 'wkb-snap-sync',
  bcfServerUrl: process.env.BCF_SERVER_URL ?? '',
  bcfApiToken: process.env.BCF_API_TOKEN ?? '',
  bcfTimeoutMs: parseNumber(process.env.BCF_TIMEOUT_MS, 10000),
  exactDivisionId: process.env.EXACT_DIVISION_ID ?? '',
  afasEnvironmentId: process.env.AFAS_ENVIRONMENT_ID ?? '',
  afasToken: process.env.AFAS_TOKEN ?? '',
  afasTimeoutMs: parseNumber(process.env.AFAS_TIMEOUT_MS, 10000),
  exactTimeoutMs: parseNumber(process.env.EXACT_TIMEOUT_MS, 10000),
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  notificationFromEmail: process.env.NOTIFICATION_FROM_EMAIL ?? 'noreply@wkb.speesolutions.nl',
  // Ontvanger van technische alerts (bv. wanneer beide AI-providers falen en
  // de mock-fallback inspringt). Default naar de eigenaar zodat een stille
  // productie-degradatie niet onopgemerkt blijft.
  alertEmail: process.env.ALERT_EMAIL ?? 'johnny@speesolutions.com',
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY ?? '',
  // Adobe Document Generation API (dossiermotor)
  pdfServicesClientId: process.env.PDF_SERVICES_CLIENT_ID ?? '',
  pdfServicesClientSecret: process.env.PDF_SERVICES_CLIENT_SECRET ?? '',
  dossierTemplateBucket: process.env.DOSSIER_TEMPLATE_BUCKET ?? 'dossier-templates',
  dossierTemplatePath: process.env.DOSSIER_TEMPLATE_PATH ?? 'dossier-sjabloon.docx',
  dossierBucket: process.env.DOSSIER_BUCKET ?? 'dossiers',
  dossierRefreshEnabled: parseBoolean(process.env.DOSSIER_REFRESH_ENABLED, false),
  dossierRefreshSchedule: process.env.DOSSIER_REFRESH_SCHEDULE ?? '0 3 * * *',
};

const hasAdobeConfig = () =>
  Boolean(backendConfig.pdfServicesClientId && backendConfig.pdfServicesClientSecret);

const hasSupabaseConfig = () =>
  Boolean(backendConfig.supabaseUrl && backendConfig.supabaseServiceKey);

module.exports = {
  backendConfig,
  hasSupabaseConfig,
  hasAdobeConfig,
};
