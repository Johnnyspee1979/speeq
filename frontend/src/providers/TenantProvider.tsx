// frontend/src/providers/TenantProvider.tsx
//
// Async fetch van klant-branding uit Supabase tenant_features → injectie in
// ThemeProvider voor real-time hertekening van de hele app zodra een KEYUSER
// de kleuren aanpast.
//
// VEILIGHEID: deze datastroom is uitsluitend toegestaan omdat we op
// tenant_features de waterdichte PostgreSQL RLS hebben afgedwongen via
// `get_user_enrolled_organization_ids()`. Het tenant_id wordt NIET in JWT
// custom claims geïnjecteerd (voorkomt revocation lag) — de DB valideert
// elke fetch live tegen `auth.uid()` → enrolled organizations.

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ThemeProvider, type TenantFeaturesPayload } from '../theme/ThemeProvider';
import { OfflineSyncFloatingBadge } from '../components/ui/OfflineSyncFloatingBadge';
import { OfflineSyncBootstrap } from '../components/OfflineSyncBootstrap';

interface TenantProviderProps {
  children: React.ReactNode;
  activeTenantId: string | null;
}

export const TenantProvider = ({ children, activeTenantId }: TenantProviderProps) => {
  const [tenantFeatures, setTenantFeatures] = useState<TenantFeaturesPayload>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchTenantBranding = async () => {
      if (!activeTenantId) {
        if (isMounted) {
          setTenantFeatures(null);
          setLoading(false);
        }
        return;
      }

      // 1. Asynchrone data-fetch.
      // RLS + get_user_enrolled_organization_ids() blokkeren hier automatisch
      // elke illegale cross-tenant toegang op DB-niveau.
      const { data, error } = await supabase
        .from('tenant_features')
        .select('branding_colors')
        .eq('tenant_id', activeTenantId)
        .eq('feature_key', 'TENANT_BRANDING')
        .maybeSingle();

      if (!isMounted) return;
      if (!error && data) {
        setTenantFeatures(data as TenantFeaturesPayload);
      } else {
        setTenantFeatures(null);
      }
      setLoading(false);
    };

    void fetchTenantBranding();

    // 2. Real-time re-rendering: luister naar mutaties van een KEYUSER.
    // Zodra branding in het modules-scherm wordt aangepast, hertekent de
    // hele app instant zonder page-refresh.
    const subscription = supabase
      .channel(`public:tenant_features:${activeTenantId ?? 'none'}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tenant_features',
          filter: activeTenantId ? `tenant_id=eq.${activeTenantId}` : undefined,
        },
        (payload) => {
          if (!isMounted) return;
          const next = payload.new as { branding_colors?: unknown } | null;
          if (next && next.branding_colors !== undefined) {
            setTenantFeatures({ branding_colors: next.branding_colors as never });
          }
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(subscription);
    };
  }, [activeTenantId]);

  if (loading) {
    // Toon nooit dodelijke witte schermen of errors tijdens het laden.
    // Behoud visuele rust — ThemeProvider met designTokens-fallback.
    return (
      <ThemeProvider tenantFeatures={null}>
        {children}
        <OfflineSyncBootstrap />
        <OfflineSyncFloatingBadge />
      </ThemeProvider>
    );
  }

  // 3. Injecteer de cloud-gebaseerde data in de ThemeProvider.
  return (
    <ThemeProvider tenantFeatures={tenantFeatures}>
      {children}
      <OfflineSyncFloatingBadge />
    </ThemeProvider>
  );
};
