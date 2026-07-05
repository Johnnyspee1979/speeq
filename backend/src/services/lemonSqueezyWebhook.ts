// ─────────────────────────────────────────────────────────────────────────────
// lemonSqueezyWebhook (backend) — verificatie + parsen van Lemon-Squeezy-webhooks.
// ─────────────────────────────────────────────────────────────────────────────
// Lemon Squeezy ondertekent elke webhook met HMAC-SHA256 (hex) over de RUWE body,
// met het signing secret uit de store. De route moet dus de raw body doorgeven
// (express.raw), niet de geparste JSON. Spiegelt de geteste payload-mapper in
// frontend/src/services/LemonSqueezyWebhookService.ts.
//
// CommonJS-module: waarden via module.exports.

const crypto = require('crypto');

const { mapLemonSqueezyStatus } = require('./entitlementService');

import type { AbonnementStatus } from './entitlementService';

export interface TenantAbonnementUpdate {
  tenantId: string | null;
  status: AbonnementStatus;
  plan: string | null;
  geldigTot: string | null;
  proefEindigtAt: string | null;
  lsCustomerId: string | null;
  lsSubscriptionId: string | null;
}

const RELEVANTE_EVENTS = new Set<string>([
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

// Timing-safe vergelijking van de meegestuurde handtekening met onze eigen HMAC.
// Faalt veilig (false) bij ontbrekende input of lengteverschil.
const verifySignature = (
  rawBody: Buffer | string,
  signature: string | null | undefined,
  secret: string | null | undefined
): boolean => {
  if (!signature || !secret) return false;
  try {
    const digest = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    const a = Buffer.from(digest, 'utf8');
    const b = Buffer.from(String(signature), 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

const tekstOfNull = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

const isAbonnementEvent = (payload: any): boolean =>
  RELEVANTE_EVENTS.has(String(payload?.meta?.event_name ?? ''));

// Parset een (reeds geverifieerde) webhookpayload naar een platte tenant-update.
// geldigTot = ends_at (bij opzegging) of anders renews_at.
const parseWebhook = (payload: any): TenantAbonnementUpdate => {
  const attr = payload?.data?.attributes ?? {};
  return {
    tenantId: tekstOfNull(payload?.meta?.custom_data?.tenant_id),
    status: mapLemonSqueezyStatus(attr.status),
    plan: tekstOfNull(attr.variant_name),
    geldigTot: tekstOfNull(attr.ends_at) ?? tekstOfNull(attr.renews_at),
    proefEindigtAt: tekstOfNull(attr.trial_ends_at),
    lsCustomerId: tekstOfNull(attr.customer_id),
    lsSubscriptionId: tekstOfNull(payload?.data?.id),
  };
};

module.exports = {
  verifySignature,
  isAbonnementEvent,
  parseWebhook,
};
