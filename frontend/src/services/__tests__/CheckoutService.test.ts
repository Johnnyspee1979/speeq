import {
  PLANNEN,
  bouwCheckoutUrl,
  herkenInterval,
  herkenPlan,
  jaarPrijs,
  planBySleutel,
} from '../CheckoutService';

describe('CheckoutService — plannen', () => {
  it('kent basis, professional en enterprise', () => {
    expect(PLANNEN.map((p) => p.sleutel)).toEqual(['basis', 'professional', 'enterprise']);
  });

  it('enterprise loopt via contact, basis/professional via checkout', () => {
    expect(planBySleutel('enterprise')?.viaContact).toBe(true);
    expect(planBySleutel('basis')?.viaContact).toBe(false);
    expect(planBySleutel('professional')?.viaContact).toBe(false);
  });

  it('jaarprijs = 10× maandprijs (2 maanden gratis), null bij op-maat', () => {
    expect(jaarPrijs(planBySleutel('basis')!)).toBe(2990);
    expect(jaarPrijs(planBySleutel('professional')!)).toBe(5990);
    expect(jaarPrijs(planBySleutel('enterprise')!)).toBeNull();
  });
});

describe('CheckoutService — bouwCheckoutUrl', () => {
  it('zet tenant_id in custom data en e-mail vooraf', () => {
    const url = bouwCheckoutUrl({
      storeDomein: 'speesolutions',
      variantId: '123456',
      tenantId: 'combivo',
      email: 'jan@combivo.nl',
    });
    expect(url).toContain('https://speesolutions.lemonsqueezy.com/checkout/buy/123456');
    // URL-encoded: checkout[custom][tenant_id]=combivo
    expect(decodeURIComponent(url)).toContain('checkout[custom][tenant_id]=combivo');
    expect(decodeURIComponent(url)).toContain('checkout[email]=jan@combivo.nl');
  });

  it('werkt zonder e-mail', () => {
    const url = bouwCheckoutUrl({ storeDomein: 'speesolutions', variantId: '1', tenantId: 'x' });
    expect(url).not.toContain('checkout%5Bemail%5D');
  });

  it('normaliseert rommelige domein/variant-invoer', () => {
    const url = bouwCheckoutUrl({
      storeDomein: ' speesolutions/ ',
      variantId: '/9/',
      tenantId: 'combivo',
    });
    expect(url).toContain('https://speesolutions.lemonsqueezy.com/checkout/buy/9');
  });

  it('gooit bij ontbrekende verplichte velden', () => {
    expect(() => bouwCheckoutUrl({ storeDomein: '', variantId: '1', tenantId: 'x' })).toThrow();
    expect(() => bouwCheckoutUrl({ storeDomein: 's', variantId: '', tenantId: 'x' })).toThrow();
    expect(() => bouwCheckoutUrl({ storeDomein: 's', variantId: '1', tenantId: ' ' })).toThrow();
  });
});

describe('CheckoutService — herkenPlan / herkenInterval', () => {
  it('herkent het plan uit de variant-naam', () => {
    expect(herkenPlan('Basis (maandelijks)')).toBe('basis');
    expect(herkenPlan('Professional (jaarlijks)')).toBe('professional');
    expect(herkenPlan('Enterprise')).toBe('enterprise');
  });

  it('fail-safe naar null bij geen match', () => {
    expect(herkenPlan('Iets onbekends')).toBeNull();
    expect(herkenPlan(null)).toBeNull();
    expect(herkenPlan(undefined)).toBeNull();
  });

  it('herkent het interval', () => {
    expect(herkenInterval('Professional (jaarlijks)')).toBe('jaar');
    expect(herkenInterval('Basis (maandelijks)')).toBe('maand');
    expect(herkenInterval('Professional annual')).toBe('jaar');
    expect(herkenInterval(undefined)).toBe('maand');
  });
});
