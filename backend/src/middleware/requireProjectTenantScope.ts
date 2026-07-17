/**
 * requireProjectTenantScope — tenant/project-hek voor schrijfroutes.
 *
 * Achter requireAuth kon élke ingelogde gebruiker bewijs uploaden of KiK-syncs
 * doen voor élk project_id (audit 17 jul '26). Deze middleware dwingt af dat:
 *   1. er een projectId in de request zit (params, body of evidenceData);
 *   2. het project bestaat;
 *   3. het project in de tenant van de ingelogde gebruiker valt
 *      (profiles.tenant_id === projects.tenant_id).
 *
 * Legacy-uitzondering: rijen van vóór het tenant-model hebben géén tenant_id.
 * Alleen als user én project *beide* geen tenant hebben, is dat een match
 * (single-tenant-installatie van vóór de tenants-migratie). Eén van de twee
 * leeg → 403, anders zou het hek omzeilbaar zijn via tenant-loze accounts.
 *
 * Dev-bypass: de synthetische 'dev-bypass-user' (ALLOW_AUTH_BYPASS, alleen
 * lokaal — zie middleware/auth.ts) heeft geen profiel en slaat de check over.
 *
 * Zet het gevonden project op req.projectTenantScope zodat de handler het
 * tenant_id kan meeschrijven zonder tweede query.
 */
import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth';

const { getSupabaseAdminClient } = require('../services/supabaseAdmin');

type ProjectTenantScope = {
  projectId: string;
  tenantId: string | null;
};

type ScopedRequest = AuthenticatedRequest & {
  projectTenantScope?: ProjectTenantScope;
};

const readTrimmedString = (value: unknown): string =>
  typeof value === 'string' && value.trim() ? value.trim() : '';

/**
 * Haalt het projectId uit de request: route-param, platte body-velden, of het
 * (eventueel nog als JSON-string verpakte) evidenceData-veld van de
 * multipart-upload. Een kapotte JSON-string is hier geen fout — de handler
 * geeft daar zijn eigen 400 op; wij vinden dan simpelweg geen projectId.
 */
const extractProjectId = (req: ScopedRequest): string => {
  const fromParams = readTrimmedString((req.params as Record<string, unknown>)?.projectId);
  if (fromParams) return fromParams;

  const body = (req.body ?? {}) as Record<string, unknown>;
  const fromBody =
    readTrimmedString(body.projectId) || readTrimmedString(body.project_id);
  if (fromBody) return fromBody;

  let evidenceData: unknown = body.evidenceData;
  if (typeof evidenceData === 'string' && evidenceData.trim()) {
    try {
      evidenceData = JSON.parse(evidenceData);
    } catch {
      return '';
    }
  }
  if (evidenceData && typeof evidenceData === 'object') {
    const nested = evidenceData as Record<string, unknown>;
    return (
      readTrimmedString(nested.projectId) || readTrimmedString(nested.project_id)
    );
  }

  return '';
};

// Postgres '22P02' = invalid text representation (bv. tekst waar een uuid
// moest). Behandel dat als 'project bestaat niet', niet als serverfout.
const isInvalidIdError = (error: { code?: string } | null | undefined) =>
  error?.code === '22P02';

const requireProjectTenantScope = async (
  req: ScopedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;
    if (!user?.id) {
      res.status(401).json({ error: 'Niet ingelogd.' });
      return;
    }

    // Lokale dev-ontsnappingsklep — zelfde gedachte als in auth.ts.
    if (user.id === 'dev-bypass-user') {
      next();
      return;
    }

    const projectId = extractProjectId(req);
    if (!projectId) {
      res.status(400).json({ error: 'projectId ontbreekt.' });
      return;
    }

    const supabase = getSupabaseAdminClient();

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      res.status(500).json({
        error: `Gebruikersprofiel kon niet worden gecontroleerd: ${profileError.message}`,
      });
      return;
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, tenant_id')
      .eq('id', projectId)
      .maybeSingle();

    if (projectError && !isInvalidIdError(projectError)) {
      res.status(500).json({
        error: `Project kon niet worden gecontroleerd: ${projectError.message}`,
      });
      return;
    }

    if (!project) {
      // Bewust dezelfde melding als bij 'geen toegang' — geen bestaan-lek.
      res.status(404).json({ error: 'Project niet gevonden of geen toegang.' });
      return;
    }

    const userTenantId = readTrimmedString(profile?.tenant_id) || null;
    const projectTenantId = readTrimmedString(project.tenant_id) || null;

    if (userTenantId !== projectTenantId) {
      res.status(403).json({ error: 'Geen toegang tot dit project.' });
      return;
    }

    req.projectTenantScope = { projectId, tenantId: projectTenantId };
    next();
  } catch (error: any) {
    console.error('requireProjectTenantScope fout:', error?.message ?? error);
    res.status(500).json({
      error: 'Interne serverfout bij projecttoegangscontrole.',
    });
  }
};

module.exports = {
  requireProjectTenantScope,
  // Los geëxporteerd voor gerichte tests.
  extractProjectId,
};

export type { ProjectTenantScope, ScopedRequest };
