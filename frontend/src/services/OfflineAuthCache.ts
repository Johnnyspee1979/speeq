/**
 * OfflineAuthCache — Week 6 van de Offline-Mode roadmap.
 *
 * JWT + refresh-token persistence met 30-dagen offline-grace.
 *
 * Doel: een klant in offline-mode kan tot 30 dagen na laatste cloud-contact
 * werken zonder uit te loggen. Bij netwerk-terug: refresh via Supabase.
 * Na 30 dagen zonder netwerk: forceer re-auth.
 *
 * NIET een vervanging van Supabase Auth — dit is een naast-cache die
 * naast `supabase.auth.getSession()` werkt voor de offline-edge case.
 *
 * Onderdeel van docs/strategie/dual-mode-architectuur.md (§9).
 */

import localforage from 'localforage';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CachedSession {
  /** Supabase JWT */
  accessToken: string;
  refreshToken: string;
  /** Unix-timestamp (ms) wanneer JWT verloopt */
  expiresAt: number;
  /** Unix-timestamp (ms) wanneer cache is geschreven */
  cachedAt: number;
  userId: string;
  email: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'speeq_offline_auth_cache';
const OFFLINE_GRACE_DAYS = 30;
const GRACE_MS = OFFLINE_GRACE_DAYS * 24 * 60 * 60 * 1000;

// ─── localforage instance ────────────────────────────────────────────────────

const authStore = localforage.createInstance({
  name: 'speeq_offline',
  storeName: 'auth_cache',
});

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Sla een Supabase-sessie op voor offline-gebruik. Aan te roepen na
 * iedere succesvolle login of token-refresh.
 */
export async function cacheSession(input: {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
  email: string | null;
}): Promise<void> {
  const payload: CachedSession = {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    expiresAt: input.expiresAt,
    cachedAt: Date.now(),
    userId: input.userId,
    email: input.email,
  };
  await authStore.setItem(STORAGE_KEY, payload);
}

/**
 * Lees de gecachede sessie. Returnt null als:
 *  - Geen cache ooit geschreven
 *  - Cache is ouder dan OFFLINE_GRACE_DAYS
 *
 * BELANGRIJK: deze methode controleert NIET of het JWT zelf verlopen is.
 * Dat is de taak van Supabase. Hier alleen: 'mag de klant offline nog door?'
 */
export async function readCachedSession(): Promise<CachedSession | null> {
  const cached = await authStore.getItem<CachedSession>(STORAGE_KEY);
  if (!cached) return null;

  const ageMs = Date.now() - cached.cachedAt;
  if (ageMs > GRACE_MS) {
    // Cache te oud — verwijder en forceer re-auth
    await authStore.removeItem(STORAGE_KEY);
    return null;
  }

  return cached;
}

/**
 * Hoe lang heeft de gecachede sessie nog tot offline-grace verloopt?
 * Returns milliseconden, of -1 als geen cache.
 */
export async function getGraceRemainingMs(): Promise<number> {
  const cached = await authStore.getItem<CachedSession>(STORAGE_KEY);
  if (!cached) return -1;
  return Math.max(0, GRACE_MS - (Date.now() - cached.cachedAt));
}

/**
 * Wis de cache — bv. bij expliciete logout.
 */
export async function clearCachedSession(): Promise<void> {
  await authStore.removeItem(STORAGE_KEY);
}

/**
 * Hulper om aan UI te tonen: "Offline beschikbaar tot 18 juni".
 */
export async function getGraceExpiryIso(): Promise<string | null> {
  const cached = await authStore.getItem<CachedSession>(STORAGE_KEY);
  if (!cached) return null;
  return new Date(cached.cachedAt + GRACE_MS).toISOString();
}
