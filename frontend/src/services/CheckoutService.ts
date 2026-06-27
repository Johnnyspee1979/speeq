/**
 * CheckoutService — alles rond de Lemon-Squeezy-checkout, zuiver en
 * config-gedreven. Geen netwerk: deze service kent de plannen en bouwt een
 * checkout-URL met de juiste `tenant_id` in de custom data, zodat de webhook het
 * abonnement aan de juiste tenant kan koppelen (zie LemonSqueezyWebhookService).
 *
 * De échte store-domein en variant-id's komen uit env/config (Johnny maakt ze in
 * Lemon Squeezy aan) — deze service hardcodeert ze niet. Zie
 * docs/commerce/abonnementen-entitlement.md en docs/commerce/lemon-squeezy-go-live.md.
 */

export type PlanSleutel = 'basis' | 'professional' | 'enterprise';
export type Interval = 'maand' | 'jaar';

export interface Plan {
  sleutel: PlanSleutel;
  naam: string;
  /** Prijs per maand in hele euro's, excl. BTW. null = op maat (Enterprise). */
  prijsPerMaand: number | null;
  omschrijving: string;
  /** Enterprise loopt via contact, niet via self-service checkout. */
  viaContact: boolean;
}

export const PLANNEN: readonly Plan[] = [
  {
    sleutel: 'basis',
    naam: 'Basis',
    prijsPerMaand: 299,
    omschrijving: 'Voor de onafhankelijke aannemer of kleine projecten.',
    viaContact: false,
  },
  {
    sleutel: 'professional',
    naam: 'Professional',
    prijsPerMaand: 599,
    omschrijving: 'Voor middelgrote bouwbedrijven met eigen kwaliteitsborgers.',
    viaContact: false,
  },
  {
    sleutel: 'enterprise',
    naam: 'Enterprise',
    prijsPerMaand: null,
    omschrijving: 'On-premise of white-label; maatwerk en SLA.',
    viaContact: true,
  },
] as const;

export const planBySleutel = (sleutel: string): Plan | undefined =>
  PLANNEN.find((p) => p.sleutel === sleutel);

/**
 * Twee maanden gratis bij jaarbetaling (≈17% korting). Geeft het jaarbedrag
 * (10× de maandprijs) of null voor een op-maat-plan.
 */
export const jaarPrijs = (plan: Plan): number | null =>
  plan.prijsPerMaand === null ? null : plan.prijsPerMaand * 10;

export interface CheckoutInput {
  /** Bijv. 'speesolutions' → https://speesolutions.lemonsqueezy.com */
  storeDomein: string;
  /** De Lemon-Squeezy-variant-id van het gekozen plan + interval. */
  variantId: string;
  /** Onze interne tenant-id; komt terug in de webhook als custom_data.tenant_id. */
  tenantId: string;
  /** Optioneel vooraf invullen van het e-mailveld op de checkout. */
  email?: string | null;
}

const schoon = (v: string): string => v.trim().replace(/^\/+|\/+$/g, '');

/**
 * Bouwt een Lemon-Squeezy hosted-checkout-URL. De tenant-id gaat mee als
 * `checkout[custom][tenant_id]`, zodat het abonnement bij binnenkomst (webhook)
 * aan de juiste tenant gekoppeld wordt. Gooit bij ontbrekende verplichte velden.
 */
export const bouwCheckoutUrl = (input: CheckoutInput): string => {
  const domein = schoon(input.storeDomein ?? '');
  const variant = schoon(input.variantId ?? '');
  const tenant = (input.tenantId ?? '').trim();
  if (!domein) throw new Error('storeDomein is verplicht.');
  if (!variant) throw new Error('variantId is verplicht.');
  if (!tenant) throw new Error('tenantId is verplicht.');

  const url = new URL(`https://${domein}.lemonsqueezy.com/checkout/buy/${variant}`);
  url.searchParams.set('checkout[custom][tenant_id]', tenant);
  if (input.email && input.email.trim()) {
    url.searchParams.set('checkout[email]', input.email.trim());
  }
  return url.toString();
};

/**
 * Herkent uit een Lemon-Squeezy `variant_name` (bijv. "Professional
 * (jaarlijks)") welk intern plan het is. Fail-safe: null bij geen match — de
 * entitlement-laag blijft dan fail-closed.
 */
export const herkenPlan = (variantNaam: string | null | undefined): PlanSleutel | null => {
  const v = String(variantNaam ?? '').toLowerCase();
  if (v.includes('enterprise')) return 'enterprise';
  if (v.includes('professional')) return 'professional';
  if (v.includes('basis')) return 'basis';
  return null;
};

/** Leidt het interval af uit de variant-naam ('jaar' bij jaarlijks, anders 'maand'). */
export const herkenInterval = (variantNaam: string | null | undefined): Interval => {
  const v = String(variantNaam ?? '').toLowerCase();
  return /jaar|jaarlijks|annual|year/.test(v) ? 'jaar' : 'maand';
};
