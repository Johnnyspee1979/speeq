/**
 * KypService — read-only planning-sync tussen SpeeQ en KYP.
 *
 * Doel: de planning/mijlpalen uit KYP zichtbaar maken in het
 * WerkvoorbereiderDashboard, gekoppeld aan SpeeQ-projecten.
 *
 * V1 is uitsluitend LEZEN uit KYP (geen terugschrijven). De flow:
 *   1. KEYUSER/ADMIN voert het KYP access-token in (kyp_integration_config).
 *   2. Per SpeeQ-project wordt een KYP-project gekoppeld (kyp_project_mapping).
 *   3. Bij openen van de planning-kaart halen we de fases/activiteiten op,
 *      bepalen de status (gepland | afgerond | te_laat) en cachen die lokaal
 *      (kyp_planning_cache) zodat de UI ook offline iets toont.
 *
 * Het token staat per tenant in de tenant-eigen Supabase achter RLS — nooit in
 * code/git, nooit in de master-DB. Deze service leest het token alleen wanneer
 * het nodig is voor een directe KYP-call en houdt het niet langer vast dan dat.
 *
 * Bron: officiële KYP Swagger (https://kyp.nl/swagger/swagger.json).
 * Zie docs/integraties/KYP-API.md voor het onderzoek.
 */

import { supabase } from '../lib/supabase';

const DEFAULT_BASE_URL = 'https://kyp.nl/rest';

// ── KYP API-types (relevant deel van het datamodel) ─────────────────────────

/** Een project zoals KYP het teruggeeft op GET /projects. */
export interface KypProject {
  id: number;
  name: string;
  status?: string;
  start?: string;
  end?: string;
}

/** Een activiteit/mijlpaal binnen een fase (GET /projects/{id}/phases). */
export interface KypActivity {
  id: number;
  name: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  dateFinished?: string | null;
  responsible?: string;
  phaseName?: string;
}

/** Een planning-fase met geneste activiteiten. */
export interface KypPhase {
  id: number;
  name: string;
  type?: string;
  activities?: KypActivity[];
}

/** Status die we als StatusPill tonen. */
export type KypMilestoneStatus = 'gepland' | 'afgerond' | 'te_laat';

/** Eén platgeslagen mijlpaal zoals SpeeQ die toont en cachet. */
export interface KypMilestone {
  kypProjectId: number;
  phaseName: string | null;
  activityId: number | null;
  activityName: string | null;
  startDate: string | null;
  endDate: string | null;
  dateFinished: string | null;
  responsible: string | null;
  status: KypMilestoneStatus;
}

/** Config-rij uit kyp_integration_config. */
export interface KypConfig {
  token: string;
  baseUrl: string;
  isActive: boolean;
}

/** Generiek resultaat-type — spiegelt de conventie van andere services. */
export type Result<T = void> =
  | ({ ok: true } & (T extends void ? {} : { data: T }))
  | { ok: false; error: string };

// ── Status-bepaling ─────────────────────────────────────────────────────────

/**
 * Bepaal de mijlpaal-status puur uit de KYP-velden.
 *  - dateFinished gevuld         → afgerond
 *  - endDate vóór vandaag, niet af → te_laat
 *  - anders                       → gepland
 *
 * `today` is injecteerbaar zodat tests deterministisch zijn.
 */
export function computeMilestoneStatus(
  activity: Pick<KypActivity, 'endDate' | 'dateFinished'>,
  today: Date = new Date(),
): KypMilestoneStatus {
  if (activity.dateFinished) return 'afgerond';

  if (activity.endDate) {
    const end = new Date(activity.endDate);
    if (!Number.isNaN(end.getTime())) {
      // Vergelijk op kalenderdag, niet op tijdstip.
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      const todayDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );
      if (endDay.getTime() < todayDay.getTime()) return 'te_laat';
    }
  }
  return 'gepland';
}

// ── Config lezen ────────────────────────────────────────────────────────────

/**
 * Lees de actieve KYP-config (token + base-url) uit de tenant-DB.
 * Returnt null als er geen (actieve) config of token is.
 */
export async function getKypConfig(): Promise<KypConfig | null> {
  const { data, error } = await supabase
    .from('kyp_integration_config')
    .select('kyp_token, base_url, is_active')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  if (!data.kyp_token) return null;

  return {
    token: data.kyp_token as string,
    baseUrl: (data.base_url as string) || DEFAULT_BASE_URL,
    isActive: !!data.is_active,
  };
}

// ── Lage-niveau KYP-fetch ───────────────────────────────────────────────────

/**
 * Eén geauthenticeerde GET naar de KYP-REST-API.
 * Gooit nooit — geeft altijd een Result terug.
 */
async function kypGet<T>(
  baseUrl: string,
  token: string,
  path: string,
): Promise<Result<T>> {
  const url = `${baseUrl.replace(/\/+$/, '')}${path}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: 'KYP-token geweigerd (401/403). Controleer het token en de Projectmanager-rol.' };
    }
    if (!res.ok) {
      return { ok: false, error: `KYP gaf status ${res.status}.` };
    }

    const data = (await res.json()) as T;
    return { ok: true, data } as Result<T>;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'onbekende netwerkfout';
    return { ok: false, error: `KYP onbereikbaar: ${msg}` };
  }
}

// ── Publieke API-calls ──────────────────────────────────────────────────────

/**
 * Test of een token werkt: probeer de projectenlijst op te halen.
 * Geeft het aantal projecten terug bij succes.
 */
export async function pingApi(
  token: string,
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<Result<{ projectCount: number }>> {
  const res = await kypGet<KypProject[]>(baseUrl, token, '/projects');
  if (!res.ok) return res;
  const list = Array.isArray(res.data) ? res.data : [];
  return { ok: true, data: { projectCount: list.length } };
}

/** Haal de lijst KYP-projecten op (voor de koppel-dropdown). */
export async function getProjects(
  token: string,
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<Result<KypProject[]>> {
  const res = await kypGet<KypProject[]>(baseUrl, token, '/projects');
  if (!res.ok) return res;
  return { ok: true, data: Array.isArray(res.data) ? res.data : [] };
}

/**
 * Haal de mijlpalen (fases→activiteiten, platgeslagen) van één KYP-project op
 * en bepaal per activiteit de status.
 */
export async function getProjectMilestones(
  token: string,
  kypProjectId: number,
  baseUrl: string = DEFAULT_BASE_URL,
  today: Date = new Date(),
): Promise<Result<KypMilestone[]>> {
  const res = await kypGet<KypPhase[]>(
    baseUrl,
    token,
    `/projects/${kypProjectId}/phases`,
  );
  if (!res.ok) return res;

  const phases = Array.isArray(res.data) ? res.data : [];
  const milestones: KypMilestone[] = [];

  for (const phase of phases) {
    const activities = Array.isArray(phase.activities) ? phase.activities : [];
    for (const act of activities) {
      milestones.push({
        kypProjectId,
        phaseName: phase.name ?? act.phaseName ?? null,
        activityId: act.id ?? null,
        activityName: act.name ?? null,
        startDate: act.startDate ?? null,
        endDate: act.endDate ?? null,
        dateFinished: act.dateFinished ?? null,
        responsible: act.responsible ?? null,
        status: computeMilestoneStatus(act, today),
      });
    }
  }

  return { ok: true, data: milestones };
}

// ── Project-koppeling ───────────────────────────────────────────────────────

/** Lees de KYP-koppeling voor één SpeeQ-project (of null). */
export async function getProjectMapping(
  speeqProjectId: string,
): Promise<{ kypProjectId: number; kypProjectName: string | null } | null> {
  const { data, error } = await supabase
    .from('kyp_project_mapping')
    .select('kyp_project_id, kyp_project_name')
    .eq('speeq_project_id', speeqProjectId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    kypProjectId: data.kyp_project_id as number,
    kypProjectName: (data.kyp_project_name as string) ?? null,
  };
}

// ── Config & koppeling schrijven ────────────────────────────────────────────

/**
 * Sla het KYP-token + base-url op (één actieve config-rij per tenant).
 * RLS staat dit alleen toe voor ADMIN. Het token wordt nooit gelogd.
 */
export async function saveKypConfig(
  token: string,
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<Result> {
  const trimmed = token.trim();
  if (!trimmed) return { ok: false, error: 'Token mag niet leeg zijn.' };

  const { data: { user } } = await supabase.auth.getUser();

  // Bestaande config?  → update; anders insert. Eén actieve rij volstaat.
  const { data: existing } = await supabase
    .from('kyp_integration_config')
    .select('id')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = {
    kyp_token: trimmed,
    base_url: baseUrl || DEFAULT_BASE_URL,
    is_active: true,
    updated_by: user?.id ?? null,
    updated_at: new Date().toISOString(),
  };

  const query = existing?.id
    ? supabase.from('kyp_integration_config').update(payload).eq('id', existing.id)
    : supabase.from('kyp_integration_config').insert(payload);

  const { error } = await query;
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Koppel een SpeeQ-project aan een KYP-project (één koppeling per SpeeQ-project).
 * RLS staat dit toe voor ADMIN + WERKVOORBEREIDER.
 */
export async function saveProjectMapping(
  speeqProjectId: string,
  kypProjectId: number,
  kypProjectName?: string | null,
): Promise<Result> {
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from('kyp_project_mapping').upsert(
    {
      speeq_project_id: speeqProjectId,
      kyp_project_id: kypProjectId,
      kyp_project_name: kypProjectName ?? null,
      created_by: user?.id ?? null,
    },
    { onConflict: 'speeq_project_id' },
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Sync naar cache ─────────────────────────────────────────────────────────

/**
 * Haal de planning van een gekoppeld SpeeQ-project live uit KYP, bereken de
 * statussen en schrijf ze naar kyp_planning_cache (vervangt de oude cache van
 * dat project). Returnt het aantal weggeschreven mijlpalen.
 *
 * Stale-while-revalidate: de UI toont eerst getCachedPlanning(), roept hierna
 * deze sync aan, en herlaadt de cache als het klaar is.
 */
export async function syncProjectPlanning(
  speeqProjectId: string,
): Promise<Result<{ count: number }>> {
  const config = await getKypConfig();
  if (!config) {
    return { ok: false, error: 'Geen actief KYP-token ingesteld.' };
  }

  const mapping = await getProjectMapping(speeqProjectId);
  if (!mapping) {
    return { ok: false, error: 'Dit project is nog niet aan een KYP-project gekoppeld.' };
  }

  const milestonesRes = await getProjectMilestones(
    config.token,
    mapping.kypProjectId,
    config.baseUrl,
  );
  if (!milestonesRes.ok) return milestonesRes;

  const milestones = milestonesRes.data;
  const syncedAt = new Date().toISOString();

  const rows = milestones.map((m) => ({
    speeq_project_id: speeqProjectId,
    kyp_project_id: m.kypProjectId,
    phase_name: m.phaseName,
    activity_id: m.activityId,
    activity_name: m.activityName,
    start_date: m.startDate,
    end_date: m.endDate,
    date_finished: m.dateFinished,
    responsible: m.responsible,
    status: m.status,
    synced_at: syncedAt,
  }));

  // Vervang de cache van dit project: eerst weg, dan opnieuw.
  const del = await supabase
    .from('kyp_planning_cache')
    .delete()
    .eq('speeq_project_id', speeqProjectId);
  if (del.error) return { ok: false, error: del.error.message };

  if (rows.length > 0) {
    const ins = await supabase.from('kyp_planning_cache').insert(rows);
    if (ins.error) return { ok: false, error: ins.error.message };
  }

  return { ok: true, data: { count: rows.length } };
}

// ── Cache lezen ─────────────────────────────────────────────────────────────

/**
 * Lees de gecachte planning van een SpeeQ-project (geordend op startdatum).
 * Dit is wat de UI standaard toont — geen KYP-call nodig.
 */
export async function getCachedPlanning(
  speeqProjectId: string,
): Promise<KypMilestone[]> {
  const { data, error } = await supabase
    .from('kyp_planning_cache')
    .select(
      'kyp_project_id, phase_name, activity_id, activity_name, start_date, end_date, date_finished, responsible, status',
    )
    .eq('speeq_project_id', speeqProjectId)
    .order('start_date', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    kypProjectId: row.kyp_project_id as number,
    phaseName: (row.phase_name as string) ?? null,
    activityId: (row.activity_id as number) ?? null,
    activityName: (row.activity_name as string) ?? null,
    startDate: (row.start_date as string) ?? null,
    endDate: (row.end_date as string) ?? null,
    dateFinished: (row.date_finished as string) ?? null,
    responsible: (row.responsible as string) ?? null,
    status: (row.status as KypMilestoneStatus) ?? 'gepland',
  }));
}
