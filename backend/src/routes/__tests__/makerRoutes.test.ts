/**
 * Tests voor makerRoutes — borgt de auth-wiring op de Maker-only endpoints.
 *
 * Security-garantie: zowel /send-welcome-email als /create-keyuser draaien met
 * service_role-rechten (mail versturen resp. auth-account + profiles-rij maken).
 * Ze MOETEN achter requireAuth zitten; de extra Maker-email-gate (isMakerEmail)
 * zit ín de handler. We booten geen server en voegen geen supertest toe; we
 * inspecteren de Express-router-stack (zelfde patroon als tenant.routes.test).
 */

const router = require('../makerRoutes');

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

describe('makerRoutes auth-wiring', () => {
  it('beschermt POST /send-welcome-email met requireAuth', () => {
    expect(findRoute('post', '/send-welcome-email')).toContain('requireAuth');
  });

  it('beschermt POST /create-keyuser met requireAuth', () => {
    expect(findRoute('post', '/create-keyuser')).toContain('requireAuth');
  });
});
