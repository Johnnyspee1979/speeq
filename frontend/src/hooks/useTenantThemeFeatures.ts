// useTenantThemeFeatures — voedt direct de `tenantFeatures`-prop op de ThemeProvider.
//
// Mapt de bestaande TenantBranding (logo + primary_color uit
// `services/TenantBrandingService`) naar de Warm Minimal `TenantFeaturesPayload`
// shape, zodat de KEYUSER zijn kleur kan instellen en de hele app instant
// hertekent zonder dat er een page-refresh nodig is.
//
// Forward-compatible: zodra `tenant_branding.branding_colors` (JSONB) wordt
// toegevoegd kan dit hier zonder schema-wijzigingen aan de Provider worden
// uitgebreid.

import { useEffect, useMemo, useState } from 'react';

import {
  getBranding,
  getBrandingSync,
  subscribeBranding,
  type TenantBranding,
} from '../services/TenantBrandingService';
import type {
  TenantFeaturesPayload,
  TenantBrandingColors,
} from '../theme/ThemeProvider';

// Brug: TenantBranding → Warm Minimal kleurkeys.
function brandingToFeatures(branding: TenantBranding | null): TenantFeaturesPayload {
  if (!branding) return null;

  // 1) Volledige JSONB (toekomst): branding.brandingColors → direct doorgeven.
  const direct = (branding as unknown as { brandingColors?: TenantBrandingColors })
    .brandingColors;
  if (direct && Object.keys(direct).length > 0) {
    return { branding_colors: direct };
  }

  // 2) Brug-pad: alleen `primary_color` → map naar Warm Minimal accent.
  const primary = (branding as unknown as { primaryColor?: string | null }).primaryColor;
  if (primary) {
    return {
      branding_colors: {
        statusSuccess: primary,
      },
    };
  }

  return null;
}

export function useTenantThemeFeatures(): TenantFeaturesPayload {
  const [branding, setBranding] = useState<TenantBranding | null>(() => {
    try {
      return getBrandingSync();
    } catch {
      return null;
    }
  });

  useEffect(() => {
    void getBranding();
    return subscribeBranding(setBranding);
  }, []);

  return useMemo(() => brandingToFeatures(branding), [branding]);
}
