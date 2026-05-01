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
      console.warn('⚠️ Supabase niet geconfigureerd in backend, auth verificatie wordt overgeslagen.');
      req.user = { id: 'mock-user', role: 'KWALITEITSBORGER' };
      return next();
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
