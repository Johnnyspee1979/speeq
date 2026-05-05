import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { WkbUser, WkbUserRole } from '../types/Auth';

type ProfileRow = {
  role?: WkbUserRole | null;
  company_name?: string | null;
  companyName?: string | null;
  display_name?: string | null;
  disciplines?: string[] | null;
  extra_task_ids?: string[] | null;
  project_ids?: string[] | null;
};

const mapProfileToUser = (
  authUser: { id: string; email?: string | null },
  profile: ProfileRow | null
): WkbUser => ({
  id: authUser.id,
  email: authUser.email ?? '',
  role: (profile?.role ?? 'ONDERAANNEMER') as WkbUserRole,
  displayName: profile?.display_name ?? null,
  companyName: profile?.company_name ?? profile?.companyName ?? 'Onbekend bedrijf',
  disciplines: profile?.disciplines ?? [],
  extraTaskIds: profile?.extra_task_ids ?? [],
  projectIds: profile?.project_ids ?? [],
});

export const useWkbAuth = () => {
  const [user, setUser] = useState<WkbUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCurrentUser = useCallback(async () => {
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const authUser = session?.user;

      if (!authUser) {
        setUser(null);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, company_name, display_name, disciplines, extra_task_ids, project_ids')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      setUser(mapProfileToUser(authUser, (profile ?? null) as ProfileRow | null));
    } catch (error) {
      console.warn('⚠️ Autorisatie fout of geen actieve sessie:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCurrentUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      setLoading(true);
      void loadCurrentUser();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadCurrentUser]);

  const [devUser, setDevUser] = useState<WkbUser | null>(null);

  const activeUser = devUser || user;

  const canApproveEvidence = () =>
    activeUser?.role === 'KWALITEITSBORGER' || activeUser?.role === 'AANNEMER';

  const isSubcontractor = () => activeUser?.role === 'ONDERAANNEMER';

  const enableDevBypass = () => {
    setDevUser({
      id: 'dev-bypass-user-123',
      email: 'arnold@combivo.nl',
      role: 'ADMIN',
      displayName: 'Arnold',
      companyName: 'Combivo',
      disciplines: [],
      extraTaskIds: [],
      projectIds: [],
    });
  };

  return { user: activeUser, loading, canApproveEvidence, isSubcontractor, enableDevBypass };
};
