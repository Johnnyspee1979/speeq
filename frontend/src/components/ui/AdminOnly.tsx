// AdminOnly — declaratieve wrapper voor dev-info / technische diagnostiek.
//
// Toont children UITSLUITEND aan beheerders. Voor reguliere gebruikers
// (Vakman, Werkvoorbereider, Kwaliteitsborger, Opdrachtgever, enz.) wordt
// de subtree volledig niet gerenderd — geen leeg vlak, geen DOM-resten.
//
// Gebruik:
//   <AdminOnly>
//     <Text>GPS: 52.0908, 4.3008</Text>
//     <Text>SHA-256: …</Text>
//   </AdminOnly>

import React from 'react';
import { useIsAdmin } from '../../hooks/useIsAdmin';

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export const AdminOnly = ({ children, fallback = null }: Props) => {
  const isAdmin = useIsAdmin();
  if (!isAdmin) return <>{fallback}</>;
  return <>{children}</>;
};
