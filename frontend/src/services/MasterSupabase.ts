/**
 * MasterSupabase — losse client naar het master-Supabase project.
 *
 * Achtergrond: de SpeeQ-tool gebruikt een runtime-Supabase-client die per
 * tenant geswitcht wordt. Voor het Maker-paneel moeten we ALTIJD bij de
 * master-registry kunnen (de `tenants` tabel) — los van welke klant er
 * op dat moment actief is. Vandaar een aparte, vaste client hier.
 *
 * Het master-project is identiek aan het default-tenant Supabase-project.
 * Alleen Johnny (johnny@speesolutions.nl) heeft via RLS lees/schrijf-rechten
 * op `public.tenants`.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Hard-coded — dit is het Spee Solutions master-project. Wijzig alleen
// hier als je later naar een gescheiden master-project migreert.
const MASTER_URL =
  process.env.EXPO_PUBLIC_MASTER_SUPABASE_URL ||
  'https://kgiuavfvhtdgwuygbyzo.supabase.co';
const MASTER_ANON =
  process.env.EXPO_PUBLIC_MASTER_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnaXVhdmZ2aHRkZ3d1eWdieXpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MzgzOTMsImV4cCI6MjA5MzAxNDM5M30.ezL6iv8bSXM4ZNZwtiesYdgiirUPKzh3fhu18HvLMpc';

let _client: SupabaseClient | null = null;

export function masterSupabase(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(MASTER_URL, MASTER_ANON, {
    auth: {
      // Sessie wel persisteren — Maker logt in en blijft ingelogd
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'speeq_maker_auth',
    },
  });
  return _client;
}
