/**
 * useTenantFeature — leest één feature-toggle voor de actieve tenant.
 *
 * Gebruik:
 *   const aiOn = useTenantFeature('ai_review');
 *   if (!aiOn) return null;   // verberg AI-knop
 *
 * Cached in-memory; herlaad gebeurt bij focus/mount van het scherm waar
 * je het gebruikt.
 */

import { useEffect, useState } from 'react';
import {
  getTenantFeatures,
  FEATURE_META,
  type FeatureKey,
} from '../services/TenantFeaturesService';

// Module-level cache + abonnees voor reactiviteit na een toggle.
let cache: Record<FeatureKey, boolean> | null = null;
const listeners = new Set<(c: Record<FeatureKey, boolean>) => void>();

function notify(next: Record<FeatureKey, boolean>) {
  cache = next;
  listeners.forEach(fn => fn(next));
}

export async function refreshTenantFeatures(): Promise<void> {
  const next = await getTenantFeatures();
  notify(next);
}

export function useTenantFeature(key: FeatureKey): boolean {
  const initial = cache?.[key] ?? FEATURE_META[key].defaultOn;
  const [val, setVal] = useState<boolean>(initial);

  useEffect(() => {
    const handler = (c: Record<FeatureKey, boolean>) => setVal(c[key]);
    listeners.add(handler);

    // Eerste fetch indien cache leeg
    if (!cache) void refreshTenantFeatures();
    else setVal(cache[key]);

    return () => { listeners.delete(handler); };
  }, [key]);

  return val;
}

/**
 * Hook voor alle features tegelijk — handig voor het toggle-scherm.
 */
export function useAllTenantFeatures(): {
  features: Record<FeatureKey, boolean>;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [features, setFeatures] = useState<Record<FeatureKey, boolean>>(
    cache ?? ({} as Record<FeatureKey, boolean>),
  );
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    const handler = (c: Record<FeatureKey, boolean>) => setFeatures(c);
    listeners.add(handler);
    if (!cache) {
      setLoading(true);
      void refreshTenantFeatures().finally(() => setLoading(false));
    }
    return () => { listeners.delete(handler); };
  }, []);

  return { features, loading, refresh: refreshTenantFeatures };
}
