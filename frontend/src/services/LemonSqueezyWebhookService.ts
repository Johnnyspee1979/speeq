/**
 * LemonSqueezyWebhookService — vertaalt een ruwe Lemon-Squeezy-webhookpayload
 * naar een platte tenant-update die de backend op de master `tenants`-tabel
 * wegschrijft. Zuiver en zonder netwerk/DB: dit is alleen het *parsen* en
 * *normaliseren*. De échte endpoint (handtekening-verificatie + DB-write) is een
 * aparte, gated laag.
 *
 * Lemon Squeezy stuurt subscription-events met `meta.event_name` en
 * `data.attributes` (status, datums, customer-id). Bij checkout geven we onze
 * eigen tenant-id mee als `meta.custom_data.tenant_id`, zodat het event aan de
 * juiste tenant gekoppeld kan worden.
 *
 * Zie docs/commerce/abonnementen-entitlement.md.
 */

import { type AbonnementStatus, mapLemonSqueezyStatus } from './EntitlementService';

/** Subset van de Lemon-Squeezy-webhookpayload die we gebruiken. */
export interface LemonSqueezyWebhook {
  meta?: {
    event_name?: string | null;
    custom_data?: { tenant_id?: string | null } | null;
  } | null;
  data?: {
    id?: string | null;
    attributes?: {
      status?: string | null;
      variant_name?: string | null;
      customer_id?: number | string | null;
      renews_at?: string | null;
      ends_at?: string | null;
      trial_ends_at?: string | null;
    } | null;
  } | null;
}

/** Platte update voor de `tenants`-tabel. `tenantId` is null als niet meegegeven. */
export interface TenantAbonnementUpdate {
  tenantId: string | null;
  status: AbonnementStatus;
  plan: string | null;
  geldigTot: string | null;
  proefEindigtAt: string | null;
  lsCustomerId: string | null;
  lsSubscriptionId: string | null;
}

/** Events die we verwerken; andere events negeren we bewust. */
const RELEVANTE_EVENTS = new Set([
  'subscription_created',
  'subscription_updated',
  'subscription_cancelled',
  'subscription_resumed',
  'subscription_expired',
  'subscription_paused',
  'subscription_unpaused',
  'subscription_payment_failed',
  'subscription_payment_success',
  'subscription_payment_recovered',
]);

/** Hoort dit event-type tot de abonnement-events die we wegschrijven? */
export const isAbonnementEvent = (payload: LemonSqueezyWebhook): boolean =>
  RELEVANTE_EVENTS.has(String(payload?.meta?.event_name ?? ''));

const tekstOfNull = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

/**
 * Parset een webhookpayload naar een tenant-update. Status wordt fail-closed
 * genormaliseerd ('geen' bij onbekend). `geldigTot` neemt `ends_at` (bij
 * opgezegd) of anders `renews_at` — de eerstvolgende grens van de betaalde
 * periode.
 */
export const parseAbonnementWebhook = (
  payload: LemonSqueezyWebhook
): TenantAbonnementUpdate => {
  const attr = payload?.data?.attributes ?? {};
  const status = mapLemonSqueezyStatus(attr.status);
  const geldigTot = tekstOfNull(attr.ends_at) ?? tekstOfNull(attr.renews_at);

  return {
    tenantId: tekstOfNull(payload?.meta?.custom_data?.tenant_id),
    status,
    plan: tekstOfNull(attr.variant_name),
    geldigTot,
    proefEindigtAt: tekstOfNull(attr.trial_ends_at),
    lsCustomerId: tekstOfNull(attr.customer_id),
    lsSubscriptionId: tekstOfNull(payload?.data?.id),
  };
};
