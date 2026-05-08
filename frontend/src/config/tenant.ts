import localforage from 'localforage';

const TENANT_KEY = 'speeq_tenant_config';

export interface TenantConfig {
  companyId: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

let activeTenant: TenantConfig | null = null;

export const setTenantConfig = async (config: TenantConfig) => {
  activeTenant = config;
  await localforage.setItem(TENANT_KEY, config);
};

export const getTenantConfig = async (): Promise<TenantConfig | null> => {
  // 1. In-memory cache (snelst)
  if (activeTenant) return activeTenant;

  // 2. Opgeslagen config (localforage — werkt op web + native)
  const stored = await localforage.getItem<TenantConfig>(TENANT_KEY);
  if (stored) {
    activeTenant = stored;
    return activeTenant;
  }

  // 3. Fallback op Expo env vars (Vercel-deploy / development)
  //    Als EXPO_PUBLIC_SUPABASE_URL gezet is, sla TenantLoginScreen over.
  const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const envKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (envUrl && envKey) {
    return { companyId: 'env', supabaseUrl: envUrl, supabaseAnonKey: envKey };
  }

  return null;
};

export const clearTenantConfig = async () => {
  activeTenant = null;
  await localforage.removeItem(TENANT_KEY);
};

/** Synchrone check — alleen betrouwbaar ná een eerdere getTenantConfig()-aanroep */
export const hasTenantConfig = () => activeTenant !== null;
