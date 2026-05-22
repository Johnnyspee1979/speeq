/**
 * MakerService — CRUD voor de tenants-registry (Johnny's klanten-lijst).
 *
 * Alle queries gaan via `masterSupabase()` — de losse client die altijd
 * naar de master-DB wijst, ongeacht welke tenant er actief is.
 */

import { masterSupabase } from './MasterSupabase';

export interface Tenant {
  companyId: string;          // PK
  name: string;
  displayName: string | null;
  slug: string | null;
  status: string | null;      // active / provisioning / disabled
  supabaseUrl: string;
  supabaseAnonKey: string;
  customDomain: string | null;
  adminEmail: string | null;
  contactPhone: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  pdfFooterText: string | null;
  users: number | null;
  notes: string | null;
  createdAt: string | null;
}

const MAKER_EMAIL = 'johnny@speesolutions.com';

export function isMakerEmail(email: string | null | undefined): boolean {
  return (email ?? '').toLowerCase().trim() === MAKER_EMAIL;
}

// ───────────────────────────── Auth ──────────────────────────────────────

export async function signInMaker(email: string, password: string) {
  const { data, error } = await masterSupabase().auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(error.message);
  if (!isMakerEmail(data.user?.email)) {
    await masterSupabase().auth.signOut();
    throw new Error('Geen toegang — alleen voor de maker.');
  }
  return data.user;
}

export async function signOutMaker() {
  await masterSupabase().auth.signOut();
}

export async function getMakerSessionEmail(): Promise<string | null> {
  const { data } = await masterSupabase().auth.getSession();
  const email = data.session?.user?.email ?? null;
  return isMakerEmail(email) ? email : null;
}

// ───────────────────────── Tenant-CRUD ───────────────────────────────────

function rowToTenant(row: Record<string, any>): Tenant {
  return {
    companyId:     row.company_id,
    name:          row.name,
    displayName:   row.display_name ?? null,
    slug:          row.slug ?? null,
    status:        row.status ?? null,
    supabaseUrl:   row.supabase_url ?? '',
    supabaseAnonKey: row.supabase_anon_key ?? '',
    customDomain:  row.custom_domain ?? null,
    adminEmail:    row.admin_email ?? null,
    contactPhone:  row.contact_phone ?? null,
    logoUrl:       row.logo_url ?? null,
    primaryColor:  row.primary_color ?? null,
    pdfFooterText: row.pdf_footer_text ?? null,
    users:         typeof row.users === 'number' ? row.users : null,
    notes:         row.notes ?? null,
    createdAt:     row.created_at ?? null,
  };
}

export async function listTenants(): Promise<Tenant[]> {
  const { data, error } = await masterSupabase()
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToTenant);
}

export interface NewTenantInput {
  name: string;
  slug?: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  customDomain?: string | null;
  adminEmail?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
}

export async function createTenant(input: NewTenantInput): Promise<Tenant> {
  // company_id is de PK — leid een nette slug-vorm af als die niet gegeven is
  const slug = (input.slug ?? input.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  const payload = {
    company_id:         slug || `tenant-${Date.now()}`,
    slug:               slug || null,
    name:               input.name.trim(),
    display_name:       input.name.trim(),
    status:             'active',
    supabase_url:       input.supabaseUrl.trim(),
    supabase_anon_key:  input.supabaseAnonKey.trim(),
    custom_domain:      input.customDomain?.trim() || null,
    admin_email:        input.adminEmail?.trim() || null,
    contact_phone:      input.contactPhone?.trim() || null,
    notes:              input.notes?.trim() || null,
    created_at:         new Date().toISOString(),
  };

  const { data, error } = await masterSupabase()
    .from('tenants')
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToTenant(data);
}

export async function updateTenant(
  companyId: string,
  patch: Partial<NewTenantInput> & { status?: string },
): Promise<Tenant> {
  const dbPatch: Record<string, any> = {};
  if (patch.name !== undefined)              dbPatch.name = patch.name.trim();
  if (patch.name !== undefined)              dbPatch.display_name = patch.name.trim();
  if (patch.slug !== undefined)              dbPatch.slug = patch.slug?.trim() || null;
  if (patch.supabaseUrl !== undefined)       dbPatch.supabase_url = patch.supabaseUrl.trim();
  if (patch.supabaseAnonKey !== undefined)   dbPatch.supabase_anon_key = patch.supabaseAnonKey.trim();
  if (patch.customDomain !== undefined)      dbPatch.custom_domain = patch.customDomain?.trim() || null;
  if (patch.adminEmail !== undefined)        dbPatch.admin_email = patch.adminEmail?.trim() || null;
  if (patch.contactPhone !== undefined)      dbPatch.contact_phone = patch.contactPhone?.trim() || null;
  if (patch.notes !== undefined)             dbPatch.notes = patch.notes?.trim() || null;
  if (patch.status !== undefined)            dbPatch.status = patch.status;

  const { data, error } = await masterSupabase()
    .from('tenants')
    .update(dbPatch)
    .eq('company_id', companyId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToTenant(data);
}

export async function deleteTenant(companyId: string): Promise<void> {
  const { error } = await masterSupabase()
    .from('tenants')
    .delete()
    .eq('company_id', companyId);

  if (error) throw new Error(error.message);
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const { data, error } = await masterSupabase()
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) return null;
  return data ? rowToTenant(data) : null;
}
