/**
 * useOfflineMode — leest of de actieve tenant offline-modus heeft ingeschakeld.
 *
 * Convenience-wrapper rond useTenantFeature('offline_mode'). Schermen en
 * services gebruiken deze hook om te kiezen tussen cloud-first en
 * offline-first paden (zie EvidenceRepository / useEvidenceRepository).
 *
 * Bron-van-waarheid: tenant_features.feature_key = 'offline_mode'.
 * Default = aan (nieuwe tenants). Uitzetten kan via TenantFeaturesScreen (KEYUSER).
 */

import { useTenantFeature } from './useTenantFeature';

export function useOfflineMode(): boolean {
  return useTenantFeature('offline_mode');
}
