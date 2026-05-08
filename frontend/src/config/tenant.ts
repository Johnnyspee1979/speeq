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
  if (activeTenant) return activeTenant;
  const config = await localforage.getItem<TenantConfig>(TENANT_KEY);
  if (config) activeTenant = config;
  return activeTenant;
};

export const clearTenantConfig = async () => {
  activeTenant = null;
  await localforage.removeItem(TENANT_KEY);
};

export const hasTenantConfig = () => {
  return activeTenant !== null;
};
