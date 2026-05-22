/**
 * OfflineBrandingCache — Week 6 van de Offline-Mode roadmap.
 *
 * Cached tenant-branding (logo + naam + primary color) lokaal zodat een
 * klant in offline-mode zijn eigen huisstijl ziet — geen flash naar
 * SpeeQ-default tijdens netwerk-onderbreking.
 *
 * Werkt naast `useTenantBranding()` / `TenantBrandingService` (cloud-fetch).
 * Bij offline-mode: leest deze cache vóór de netwerk-call. Bij netwerk
 * succes: cache wordt geüpdatet door de service zelf.
 *
 * Voor het LOGO: dataURL (base64) opgeslagen zodat geen HTTP-fetch nodig
 * is op de bouwplaats. Max 500 KB per logo.
 *
 * Onderdeel van docs/strategie/dual-mode-architectuur.md (§9).
 */

import localforage from 'localforage';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CachedBranding {
  /** Klant-naam, bv. "Bouwbedrijf Jansen B.V." */
  companyName: string | null;
  /** Logo als data-URL (base64). Null = geen logo. */
  logoDataUrl: string | null;
  /** Primary kleur (hex), bv. "#1F4D3A" */
  primaryColor: string | null;
  /** Unix-timestamp (ms) van laatste sync vanuit cloud */
  syncedAt: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'speeq_offline_branding_cache';
const MAX_LOGO_BYTES = 500_000; // 500 KB — data-URL met ~33% base64-overhead
const REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 1 uur — sync 1×/uur in offline-mode

// ─── localforage instance ────────────────────────────────────────────────────

const brandingStore = localforage.createInstance({
  name: 'speeq_offline',
  storeName: 'branding_cache',
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (blob.size > MAX_LOGO_BYTES) {
      console.warn(
        `[OfflineBrandingCache] logo te groot (${blob.size}B) — niet gecached`,
      );
      return null;
    }
    return new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Cache een nieuwe branding. Aan te roepen door TenantBrandingService
 * direct na een succesvolle fetch.
 *
 * Optioneel: als `logoUrl` een externe URL is, wordt 'm meteen als dataURL
 * binnengehaald + opgeslagen.
 */
export async function cacheBranding(input: {
  companyName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
}): Promise<void> {
  const logoDataUrl = input.logoUrl ? await fetchAsDataUrl(input.logoUrl) : null;
  const payload: CachedBranding = {
    companyName: input.companyName,
    logoDataUrl,
    primaryColor: input.primaryColor,
    syncedAt: Date.now(),
  };
  await brandingStore.setItem(STORAGE_KEY, payload);
}

/**
 * Lees de gecachede branding. Returnt null bij geen cache.
 *
 * Anders dan auth-cache heeft branding geen harde grace — een 6 maanden
 * oude branding is nog steeds beter dan SpeeQ-default. Bij netwerk-terug
 * synct hij vanzelf.
 */
export async function readCachedBranding(): Promise<CachedBranding | null> {
  return (await brandingStore.getItem<CachedBranding>(STORAGE_KEY)) ?? null;
}

/**
 * Hoe stale is de branding-cache? Returns milliseconden sinds laatste sync,
 * of -1 als nooit gecached.
 */
export async function getCacheAgeMs(): Promise<number> {
  const cached = await brandingStore.getItem<CachedBranding>(STORAGE_KEY);
  if (!cached) return -1;
  return Date.now() - cached.syncedAt;
}

/**
 * Moet de cache nu worden ververst? (1×/uur policy)
 */
export async function shouldRefresh(): Promise<boolean> {
  const age = await getCacheAgeMs();
  return age === -1 || age > REFRESH_INTERVAL_MS;
}

/**
 * Wis de cache — bv. bij tenant-switch of logout.
 */
export async function clearCachedBranding(): Promise<void> {
  await brandingStore.removeItem(STORAGE_KEY);
}
