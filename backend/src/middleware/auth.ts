import type { Request, Response, NextFunction } from 'express';
const { createClient } = require('@supabase/supabase-js');
const { backendConfig } = require('../config');

let supabase: any = null;

export interface AuthenticatedRequest extends Request {
  user?: any;
}

const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!backendConfig.supabaseUrl || !backendConfig.supabaseServiceKey) {
      // Fail-closed: zonder Supabase-config kan een token niet geverifieerd
      // worden. We laten alleen door als de dev expliciet de ontsnappingsklep
      // heeft aangezet; anders weigeren we (geen stille mock-gebruiker).
      if (backendConfig.allowAuthBypass) {
        console.warn(
          '⚠️ ALLOW_AUTH_BYPASS staat aan: auth-verificatie wordt overgeslagen (alleen voor lokale dev).'
        );
        req.user = { id: 'dev-bypass-user', role: 'KWALITEITSBORGER' };
        return next();
      }
      console.error('❌ Auth niet mogelijk: Supabase is niet geconfigureerd in de backend.');
      return res.status(503).json({
        error: 'Authenticatie is tijdelijk niet beschikbaar. Probeer het later opnieuw.',
      });
    }

    if (!supabase) {
      supabase = createClient(
        backendConfig.supabaseUrl,
        backendConfig.supabaseServiceKey
      );
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Missing token' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token', details: error?.message });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

module.exports = {
  requireAuth
};
