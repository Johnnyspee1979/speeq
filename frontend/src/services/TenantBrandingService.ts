// TenantBrandingService — klant-logo + bedrijfsnaam per Supabase-tenant.
//
// Idee: elke klant heeft zijn eigen Supabase-project. Daarin staat één rij
// in `tenant_branding` (id=1) met de logo-URL en de bedrijfsnaam. Header-
// componenten en PDF-services lezen dit en vervangen daarmee het SpeeQ-logo.
//
// In-memory cache + localStorage zorgen dat headers niet flikkeren bij elke
// route-wissel. Bij `setLogo` / `setCompanyName` invalideren we de cache.

import { supabase } from '../lib/supabase';

const BUCKET = 'tenant-branding';
const STORAGE_KEY = 'wkb_tenant_branding_v1';

export interface TenantBranding {
  companyName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  updatedAt: string | null;
}

const EMPTY: TenantBranding = {
  companyName: null,
  logoUrl: null,
  primaryColor: null,
  updatedAt: null,
};

let cache: TenantBranding | null = null;
const listeners = new Set<(b: TenantBranding) => void>();

function readLocalCache(): TenantBranding | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TenantBranding;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocalCache(b: TenantBranding) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
  } catch {
    /* private browsing */
  }
}

function notify(b: TenantBranding) {
  cache = b;
  writeLocalCache(b);
  listeners.forEach(fn => fn(b));
}

export function subscribeBranding(fn: (b: TenantBranding) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Geeft de huidige branding terug. Snelste pad eerst (memory → localStorage),
 * daarna pas een DB-fetch. UI mag dit op elke render aanroepen.
 */
export async function getBranding(opts?: { force?: boolean }): Promise<TenantBranding> {
  if (!opts?.force && cache) return cache;
  if (!opts?.force) {
    const local = readLocalCache();
    if (local) cache = local;
  }

  try {
    const { data, error } = await supabase
      .from('tenant_branding')
      .select('company_name, logo_url, primary_color, updated_at')
      .eq('id', 1)
      .maybeSingle();

    if (error || !data) {
      // Geen rij = leeg, val terug op SpeeQ
      const merged = cache ?? EMPTY;
      notify(merged);
      return merged;
    }

    const next: TenantBranding = {
      companyName:  data.company_name  ?? null,
      logoUrl:      data.logo_url      ?? null,
      primaryColor: data.primary_color ?? null,
      updatedAt:    data.updated_at    ?? null,
    };
    notify(next);
    return next;
  } catch {
    return cache ?? readLocalCache() ?? EMPTY;
  }
}

/**
 * Snelle synchrone read voor componenten — geeft cache (kan null zijn bij
 * eerste render). Gebruik samen met `useTenantBranding` voor reactiviteit.
 */
export function getBrandingSync(): TenantBranding {
  if (cache) return cache;
  const local = readLocalCache();
  if (local) {
    cache = local;
    return local;
  }
  return EMPTY;
}

/**
 * Upload nieuw logo naar Storage en update `tenant_branding.logo_url`.
 * Geeft de publieke URL terug.
 */
export async function uploadLogo(file: File): Promise<string> {
  // Pad: logo-<timestamp>.<ext> — overschrijft niets bestaands, oude versies
  // blijven beschikbaar voor history/audit.
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const path = `logo-${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });

  if (uploadErr) {
    throw new Error(uploadErr.message || 'Upload mislukt');
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  await upsertBranding({ logo_url: publicUrl });
  return publicUrl;
}

/**
 * Werk de bedrijfsnaam bij (toont in header + PDF-cover).
 */
export async function setCompanyName(name: string): Promise<void> {
  await upsertBranding({ company_name: name.trim() || null });
}

/**
 * Werk de primaire kleur bij (CTA's, accenten in PDF).
 */
export async function setPrimaryColor(hex: string | null): Promise<void> {
  const clean = hex && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : null;
  await upsertBranding({ primary_color: clean });
}

/**
 * Reset alles naar SpeeQ-defaults — handig voor demo/admin.
 */
export async function resetBranding(): Promise<void> {
  await upsertBranding({
    company_name:  null,
    logo_url:      null,
    primary_color: null,
  });
}

async function upsertBranding(patch: Record<string, string | null>): Promise<void> {
  const user = (await supabase.auth.getUser()).data.user;
  const payload = {
    id: 1,
    ...patch,
    updated_at: new Date().toISOString(),
    updated_by: user?.id ?? null,
  };

  const { error } = await supabase
    .from('tenant_branding')
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    throw new Error(error.message || 'Branding opslaan mislukt');
  }

  // Verse fetch zodat luisteraars een complete branding-object krijgen
  await getBranding({ force: true });
}
