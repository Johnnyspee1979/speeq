/**
 * useSimpleMode — leest of de actieve tenant eenvoudige weergave wil.
 *
 * Convenience-wrapper rond useTenantFeature('simple_mode'). Wanneer aan:
 * verbergen we admin/dev-schermen (Modules, Presets, AI Model, Voice,
 * Conflict-UI, etc.) en tonen alleen de kern-flow:
 *
 *   Vakman (mobiel):    foto maken + recente foto's
 *   Werkvoorbereider:   inbox + beoordelen + dossier
 *
 * Bron-van-waarheid: tenant_features.feature_key = 'simple_mode'.
 * Default = uit (bestaande klanten blijven de volledige UI zien).
 *
 * Onderdeel van docs/strategie/speeq-simple.md.
 */

import { useTenantFeature } from './useTenantFeature';

export function useSimpleMode(): boolean {
  return useTenantFeature('simple_mode');
}
