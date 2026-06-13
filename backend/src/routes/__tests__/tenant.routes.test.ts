/**
 * Tests voor tenant.routes — borgt WELKE routes auth vereisen.
 *
 * Security-garantie: de resolve-route is publiek (login heeft 'm nodig vóór er
 * een sessie is), maar het opvragen van ALLE tenants (incl. Supabase-connect-
 * gegevens) en het aanmaken/wijzigen van tenants moet achter auth zitten.
 *
 * We booten geen server en voegen geen supertest toe; we inspecteren de
 * Express-router-stack en controleren of de requireAuth-middleware op de juiste
 * routes staat.
 */

const router = require('../tenant.routes');

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: { name: string } }>;
  };
};

const findRoute = (method: string, path: string) => {
  const layer = (router.stack as Layer[]).find(
    (l) => l.route?.path === path && l.route?.methods?.[method.toLowerCase()]
  );
  if (!layer?.route) {
    throw new Error(`Route ${method} ${path} niet gevonden`);
  }
  return layer.route.stack.map((s) => s.handle.name);
};

describe('tenant.routes auth-wiring', () => {
  it('houdt GET /resolve/:companyId publiek (geen requireAuth)', () => {
    const handlers = findRoute('get', '/resolve/:companyId');
    expect(handlers).not.toContain('requireAuth');
  });

  it('beschermt GET / (lijst van alle tenants) met requireAuth', () => {
    expect(findRoute('get', '/')).toContain('requireAuth');
  });

  it('beschermt POST / (tenant aanmaken) met requireAuth', () => {
    expect(findRoute('post', '/')).toContain('requireAuth');
  });

  it('beschermt PUT /:companyId (tenant wijzigen) met requireAuth', () => {
    expect(findRoute('put', '/:companyId')).toContain('requireAuth');
  });
});
