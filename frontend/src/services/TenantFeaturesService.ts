/**
 * TenantFeaturesService — feature-toggles per klant (en optioneel per project).
 *
 * Drie-laagse overerving:
 *  - SPEE (jij) zet master-toggles per klant
 *  - KEYUSER (klant-admin) kiest binnen wat Spee heeft toegestaan
 *  - PROJECTLEIDER zet aan/uit per project (binnen wat keyuser toestaat)
 *
 * Deze service leest/schrijft naar de `tenant_features` tabel.
 * RLS in de DB regelt wie wat mag.
 */

import { supabase } from '../lib/supabase';
import { getActiveTenantId } from '../config/tenant';

// Vaste lijst — bron-van-waarheid voor wat we in de UI tonen.
export const FEATURE_KEYS = [
  'ai_review',
  'gps_tracking',
  'pdf_export',
  'qr_stickers',
  'floor_plan',
  'multilang',
  'offline_mode',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export interface FeatureMeta {
  key: FeatureKey;
  label: string;
  description: string;
  icon: string;
  defaultOn: boolean;
}

export const FEATURE_META: Record<FeatureKey, FeatureMeta> = {
  ai_review: {
    key: 'ai_review',
    label: 'AI-review',
    description: 'Automatische beoordeling van foto\'s op kwaliteit en goede oplevering.',
    icon: '🤖',
    defaultOn: true,
  },
  gps_tracking: {
    key: 'gps_tracking',
    label: 'GPS-tracking',
    description: 'Locatie vastleggen bij elke foto voor de kaart-weergave.',
    icon: '📍',
    defaultOn: true,
  },
  pdf_export: {
    key: 'pdf_export',
    label: 'PDF-export',
    description: 'Borgingsdossier downloaden als compleet PDF-rapport.',
    icon: '📄',
    defaultOn: true,
  },
  qr_stickers: {
    key: 'qr_stickers',
    label: 'QR-stickers',
    description: 'Printbare stickers genereren voor borgingspunten.',
    icon: '🏷️',
    defaultOn: true,
  },
  floor_plan: {
    key: 'floor_plan',
    label: 'Tekening-pinnen',
    description: 'Foto\'s vastpinnen op bouwtekeningen om locatie te tonen.',
    icon: '📐',
    defaultOn: true,
  },
  multilang: {
    key: 'multilang',
    label: 'Meertalig (NL/EN/DE)',
    description: 'Interface beschikbaar in Engels en Duits naast Nederlands.',
    icon: '🌐',
    defaultOn: false,
  },
  offline_mode: {
    key: 'offline_mode',
    label: 'Offline modus',
    description:
      'Werkt zonder netwerk — foto\'s, GPS en lokale AI-precheck draaien op het toestel. Sync zodra het netwerk er weer is. Vereist eenmalige download van AI-modellen (~40 MB).',
    icon: '📡',
    defaultOn: false,
  },
};

export interface TenantFeature {
  tenantId: string;
  projectId: string | null;
  featureKey: FeatureKey;
  enabled: boolean;
  setByRole: string | null;
  updatedAt: string | null;
}

/**
 * Laad alle features (bedrijfsbreed = project_id NULL) voor de actieve tenant.
 * Returnt een Record<FeatureKey, boolean> — niet-bestaande keys vallen terug
 * op `defaultOn`.
 */
export async function getTenantFeatures(
  tenantId?: string,
): Promise<Record<FeatureKey, boolean>> {
  const tid = tenantId ?? getActiveTenantId();
  const result: Record<FeatureKey, boolean> = {} as Record<FeatureKey, boolean>;

  // Start met defaults
  for (const k of FEATURE_KEYS) result[k] = FEATURE_META[k].defaultOn;
  if (!tid) return result;

  const { data, error } = await supabase
    .from('tenant_features')
    .select('feature_key, enabled')
    .eq('tenant_id', tid)
    .is('project_id', null);

  if (error || !data) return result;

  for (const row of data) {
    const key = row.feature_key as FeatureKey;
    if (FEATURE_KEYS.includes(key)) {
      result[key] = !!row.enabled;
    }
  }
  return result;
}

/**
 * Zet één feature aan/uit op tenant-niveau (bedrijfsbreed).
 * RLS bepaalt of de huidige user dit mag.
 */
export async function setTenantFeature(
  featureKey: FeatureKey,
  enabled: boolean,
  setByRole: 'SPEE' | 'KEYUSER' | 'PROJECTLEIDER' = 'KEYUSER',
  tenantId?: string,
): Promise<{ ok: boolean; error?: string }> {
  const tid = tenantId ?? getActiveTenantId();
  if (!tid) return { ok: false, error: 'Geen actieve tenant.' };

  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('tenant_features')
    .upsert(
      {
        tenant_id: tid,
        project_id: null,
        feature_key: featureKey,
        enabled,
        set_by: user?.id ?? null,
        set_by_role: setByRole,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,project_id,feature_key' },
    );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Lees één feature snel — handig voor UI-componenten die alleen één toggle nodig hebben.
 */
export async function isFeatureEnabled(
  featureKey: FeatureKey,
  tenantId?: string,
): Promise<boolean> {
  const all = await getTenantFeatures(tenantId);
  return all[featureKey];
}
