import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth';

// ─────────────────────────────────────────────────────────────────────────────
// requireActiveSubscription — betaalmuur voor betaalde acties.
// ─────────────────────────────────────────────────────────────────────────────
// Blokkeert een request (402) als de tenant geen actief abonnement (of lopende
// proef/grace) heeft. Draait NA requireAuth.
//
// Bewuste schakelaar: alleen actief als ENFORCE_SUBSCRIPTION=true. Standaard UIT,
// net als ALLOW_AUTH_BYPASS en ENABLE_QR_DEMO — zo sluit de muur nooit per
// ongeluk bestaande accounts buiten. Aanzetten = bewuste go-live-stap (zie
// docs/commerce/lemon-squeezy-go-live.md): zet de vlag aan én zorg dat de
// frontend de tenant meestuurt via de `x-company-id`-header.
//
// Fail-closed: staat de muur aan en is de tenant onbekend of zonder toegang →
// 402 (geen toegang).

const { TenantService } = require('../services/TenantService');
const { bepaalToegang } = require('../services/entitlementService');

const isEnforced = (): boolean =>
  String(process.env.ENFORCE_SUBSCRIPTION ?? '').toLowerCase() === 'true';

const resolveCompanyId = (req: AuthenticatedRequest): string | null => {
  const header = req.header('x-company-id');
  if (header && header.trim()) return header.trim();
  const user: any = req.user ?? {};
  return (
    user.companyId ??
    user.company_id ??
    user.app_metadata?.company_id ??
    user.user_metadata?.company_id ??
    null
  );
};

const requireActiveSubscription = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!isEnforced()) return next();

  try {
    const companyId = resolveCompanyId(req);
    if (!companyId) {
      return res.status(402).json({
        error: 'Geen actief abonnement gevonden. Sluit een abonnement af om verder te gaan.',
      });
    }

    const abonnement = await TenantService.getAbonnement(companyId);
    const besluit = bepaalToegang(abonnement);
    if (!besluit.toegang) {
      return res.status(402).json({
        error: `Geen toegang: ${besluit.reden} Sluit een abonnement af om verder te gaan.`,
        status: besluit.status,
      });
    }

    next();
  } catch (err: any) {
    console.error('[requireActiveSubscription] fout', err?.message ?? err);
    // Fail-closed bij een fout terwijl de muur aanstaat.
    return res.status(402).json({
      error: 'Abonnementstatus kon niet worden vastgesteld. Probeer het later opnieuw.',
    });
  }
};

module.exports = {
  requireActiveSubscription,
};
