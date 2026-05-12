// useTenantBranding — reageert op wijzigingen in de klant-branding.
//
// Doel: één regel in een component → krijgt logo + naam + accentkleur.
// Vangt automatisch nieuwe waarden op als iemand in de admin-screen iets
// upload.

import { useEffect, useState } from 'react';
import {
  getBranding,
  getBrandingSync,
  subscribeBranding,
  type TenantBranding,
} from '../services/TenantBrandingService';

export function useTenantBranding(): TenantBranding {
  const [branding, setBranding] = useState<TenantBranding>(getBrandingSync);

  useEffect(() => {
    // Eerste fetch op mount — vult cache + roept luisteraars aan
    void getBranding();
    return subscribeBranding(setBranding);
  }, []);

  return branding;
}
