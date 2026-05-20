// useIsAdmin — centrale RBAC-check voor conditionele rendering van dev-info.
//
// Returnt true wanneer de actieve gebruiker een ontwikkelaars-/systeembeheerder-rol
// heeft (`ADMIN`) of expliciet het master-account `johnny@speesolutions.com` is.
// Voor alle andere rollen (Vakman, Werkvoorbereider, Kwaliteitsborger, etc.)
// is dit `false` zodat technische diagnostiek voor hen volledig verborgen blijft.

import { useWkbAuth } from './useWkbAuth';

const ADMIN_EMAIL = 'johnny@speesolutions.com';

export function useIsAdmin(): boolean {
  const { user } = useWkbAuth();
  if (!user) return false;
  return user.role === 'ADMIN' || user.email === ADMIN_EMAIL;
}
