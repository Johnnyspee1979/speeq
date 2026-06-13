/**
 * makerRoutes — Maker-only endpoints voor klant-onboarding.
 *
 * POST /api/maker/send-welcome-email
 *   Body: { toEmail, toName, bedrijfsnaam, wachtwoord, loginUrl, accentKleur, logoUrl? }
 *   Auth: vereist JWT + check dat user.email = johnny@speesolutions.com (maker-only).
 *   Returns: { ok: true } of { ok: false, error: string }
 *
 * POST /api/maker/create-keyuser
 *   Body: { email, displayName, companyName, tenantId, password }
 *   Auth: maker-only (zelfde gate).
 *   Maakt de keyuser-auth-account + profiles-rij via de service_role admin-API.
 *   Vervangt de handmatige copy/paste-SQL uit MakerNewTenantScreen. Bij een
 *   mislukte profiles-insert wordt de zojuist gemaakte auth-user weer
 *   verwijderd (rollback) zodat er geen wees-account achterblijft.
 *   Returns: { ok: true, userId } of { ok: false, error: string }
 *
 * Stuurt branded welkom-mail via Resend (zie emailService.sendWelcomeEmail).
 */

import type { Request, Response } from 'express';

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../middleware/auth');
const { sendWelcomeEmail } = require('../services/emailService');
const { backendConfig, hasSupabaseConfig } = require('../config');

const router = express.Router();

const MAKER_EMAILS = new Set([
  'johnny@speesolutions.com',
  'johnny@speesolutions.nl',
]);

// Lazy service_role-client (bypasst RLS) — zelfde patroon als ocrRoutes.
let supabaseAdminClient: any = null;
const getSupabaseAdmin = () => {
  if (!hasSupabaseConfig()) {
    throw new Error('Supabase configuratie ontbreekt');
  }
  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(
      backendConfig.supabaseUrl,
      backendConfig.supabaseServiceKey
    );
  }
  return supabaseAdminClient;
};

const isMakerEmail = (req: Request): boolean => {
  const email = (req as Request & { user?: { email?: string } }).user?.email?.toLowerCase() ?? '';
  return MAKER_EMAILS.has(email);
};

router.post('/send-welcome-email', requireAuth, async (req: Request, res: Response) => {
  try {
    // Maker-only check — voorkomt dat een normale user de wizard misbruikt.
    const userEmail = (req as Request & { user?: { email?: string } }).user?.email?.toLowerCase() ?? '';
    if (!MAKER_EMAILS.has(userEmail)) {
      return res.status(403).json({ ok: false, error: 'Alleen de Maker mag welkom-mails versturen.' });
    }

    const {
      toEmail, toName, bedrijfsnaam, wachtwoord, loginUrl, accentKleur, logoUrl,
    } = (req.body ?? {}) as Record<string, unknown>;

    // Strikte validatie — geen lege of foute typen
    if (typeof toEmail !== 'string' || !toEmail.includes('@')) {
      return res.status(400).json({ ok: false, error: 'toEmail ontbreekt of ongeldig.' });
    }
    if (typeof toName !== 'string' || !toName.trim()) {
      return res.status(400).json({ ok: false, error: 'toName ontbreekt.' });
    }
    if (typeof bedrijfsnaam !== 'string' || !bedrijfsnaam.trim()) {
      return res.status(400).json({ ok: false, error: 'bedrijfsnaam ontbreekt.' });
    }
    if (typeof wachtwoord !== 'string' || wachtwoord.length < 6) {
      return res.status(400).json({ ok: false, error: 'wachtwoord ontbreekt of te kort.' });
    }
    if (typeof loginUrl !== 'string' || !loginUrl.startsWith('http')) {
      return res.status(400).json({ ok: false, error: 'loginUrl ontbreekt of ongeldig.' });
    }
    if (typeof accentKleur !== 'string' || !accentKleur.startsWith('#')) {
      return res.status(400).json({ ok: false, error: 'accentKleur moet een hex-code zijn.' });
    }

    const result = await sendWelcomeEmail({
      toEmail: toEmail.trim().toLowerCase(),
      toName: toName.trim(),
      bedrijfsnaam: bedrijfsnaam.trim(),
      wachtwoord,
      loginUrl,
      accentKleur,
      logoUrl: typeof logoUrl === 'string' && logoUrl.trim() ? logoUrl.trim() : null,
    });

    if (!result.ok) {
      return res.status(500).json(result);
    }
    return res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[makerRoutes] /send-welcome-email fout:', msg);
    return res.status(500).json({ ok: false, error: msg });
  }
});

router.post('/create-keyuser', requireAuth, async (req: Request, res: Response) => {
  let createdUserId: string | null = null;
  try {
    // Maker-only check — alleen de Maker mag tenant-accounts provisionen.
    if (!isMakerEmail(req)) {
      return res.status(403).json({ ok: false, error: 'Alleen de Maker mag keyusers aanmaken.' });
    }

    const {
      email, displayName, companyName, tenantId, password,
    } = (req.body ?? {}) as Record<string, unknown>;

    // Strikte validatie — geen lege of foute typen.
    if (typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ ok: false, error: 'email ontbreekt of ongeldig.' });
    }
    if (typeof displayName !== 'string' || !displayName.trim()) {
      return res.status(400).json({ ok: false, error: 'displayName ontbreekt.' });
    }
    if (typeof companyName !== 'string' || !companyName.trim()) {
      return res.status(400).json({ ok: false, error: 'companyName ontbreekt.' });
    }
    if (typeof tenantId !== 'string' || !tenantId.trim()) {
      return res.status(400).json({ ok: false, error: 'tenantId ontbreekt.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ ok: false, error: 'password ontbreekt of te kort (min. 8 tekens).' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const supabase = getSupabaseAdmin();

    // 1. Auth-account aanmaken via service_role admin-API (vervangt INSERT auth.users).
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'KEYUSER',
        tenant_id: tenantId.trim(),
        display_name: displayName.trim(),
      },
      app_metadata: { provider: 'email', providers: ['email'] },
    });

    if (createError || !createData?.user?.id) {
      const msg = createError?.message ?? 'Auth-account aanmaken mislukt.';
      console.error('[makerRoutes] /create-keyuser auth-fout:', msg);
      return res.status(500).json({ ok: false, error: msg });
    }

    createdUserId = createData.user.id;

    // 2. profiles-rij aanmaken (vervangt de handmatige UUID-paste).
    const { error: profileError } = await supabase.from('profiles').insert({
      id: createdUserId,
      email: normalizedEmail,
      role: 'KEYUSER',
      display_name: displayName.trim(),
      company_name: companyName.trim(),
      tenant_id: tenantId.trim(),
    });

    if (profileError) {
      // Rollback — verwijder de zojuist gemaakte auth-user, geen wees-account.
      console.error('[makerRoutes] /create-keyuser profiles-fout, rollback:', profileError.message);
      await supabase.auth.admin.deleteUser(createdUserId).catch((rollbackErr: unknown) => {
        const rbMsg = rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr);
        console.error('[makerRoutes] /create-keyuser rollback mislukt:', rbMsg);
      });
      return res.status(500).json({ ok: false, error: `profiles-insert mislukt: ${profileError.message}` });
    }

    return res.json({ ok: true, userId: createdUserId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[makerRoutes] /create-keyuser fout:', msg);
    // Best-effort rollback bij onverwachte uitzondering na auth-create.
    if (createdUserId) {
      try {
        await getSupabaseAdmin().auth.admin.deleteUser(createdUserId);
      } catch {
        // rollback-fout al fataal genoeg; niets extra te doen.
      }
    }
    return res.status(500).json({ ok: false, error: msg });
  }
});

module.exports = router;
