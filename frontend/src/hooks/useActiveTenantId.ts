// useActiveTenantId — bepaalt het actieve tenant_id voor de TenantProvider.
//
// Bron van waarheid: `profiles.tenant_id WHERE id = auth.uid()`. Dit is exact
// hetzelfde pad als de PostgreSQL `get_user_enrolled_organization_ids()`
// functie, zodat frontend en RLS dezelfde tenant zien.
//
// Voor de Maker-route (geen Supabase auth-session) returnt deze hook null —
// de TenantProvider valt dan terug op de basis-designTokens.

import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export function useActiveTenantId(): string | null {
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    let isMounted = true;

    const load = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) {
          if (isMounted) setTenantId(null);
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', userId)
          .maybeSingle();

        if (isMounted) {
          setTenantId(error || !data ? null : (data.tenant_id as string | null));
        }
      } catch {
        if (isMounted) setTenantId(null);
      }
    };

    void load();

    // Reageer op login/logout en tenant-switches ("Open als klant").
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      void load();
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return tenantId;
}
