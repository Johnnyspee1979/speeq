import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth';

const {
  getAuthenticatedUserContext,
  isReviewerRole,
} = require('../services/authContextService');

// Rol-gate: alleen reviewers (AANNEMER, KWALITEITSBORGER) mogen dossiers
// exporteren of DSO/STAM-meldingen versturen. Draait NA requireAuth.
//
// - Lokale dev-bypass: requireAuth heeft dan req.user.role al gezet
//   (KWALITEITSBORGER); we hergebruiken die en slaan de DB-lookup over.
// - Normaal: de Supabase-user heeft geen rol; we halen die uit `profiles`
//   via getAuthenticatedUserContext (verifieert ook nogmaals het token).
const requireReviewer = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    let role: string | undefined = req.user?.role;

    if (!role) {
      const context = await getAuthenticatedUserContext(req.headers.authorization);
      role = context.role;
      req.user = {
        ...(req.user ?? {}),
        id: context.userId,
        email: context.email,
        role,
      };
    }

    if (!isReviewerRole(role)) {
      return res.status(403).json({
        error:
          'Alleen een aannemer of kwaliteitsborger mag dossiers exporteren of meldingen versturen.',
      });
    }

    next();
  } catch (error: any) {
    const statusCode = Number(error?.statusCode) || 500;
    return res.status(statusCode).json({
      error: error?.message ?? 'Rolcontrole mislukt.',
    });
  }
};

module.exports = {
  requireReviewer,
};
