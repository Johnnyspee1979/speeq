export type WkbUserRole =
  | 'KEYUSER'           // Klant-admin: beheert binnen één tenant projectleiders + features + branding
  | 'ONDERAANNEMER'
  | 'AANNEMER'
  | 'KWALITEITSBORGER'
  | 'ADMIN'
  | 'WERKVOORBEREIDER'
  | 'OPDRACHTGEVER'
  | 'PROJECTLEIDER'
  | 'VOORMAN'
  | 'VAKMAN';

export interface WkbUser {
  id: string;
  email: string;
  role: WkbUserRole;
  displayName: string | null;
  companyName: string;
  /** Disciplines waartoe de gebruiker toegang heeft. Leeg = alles. */
  disciplines: string[];
  /** Losse borgingspunt-IDs die extra zijn toegewezen buiten de discipline. */
  extraTaskIds: string[];
  /** Project-IDs waarop deze gebruiker toegang heeft. Leeg = alles (admin/projectleider). */
  projectIds: string[];
}
