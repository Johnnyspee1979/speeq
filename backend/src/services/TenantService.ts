const { getSupabaseAdminClient } = require('./supabaseAdmin');

import type { AbonnementStatus, TenantAbonnement } from './entitlementService';

/** Velden die de webhook op een tenant wegschrijft. */
export interface AbonnementUpdate {
  status: AbonnementStatus;
  plan?: string | null;
  geldigTot?: string | null;
  proefEindigtAt?: string | null;
  lsCustomerId?: string | null;
  lsSubscriptionId?: string | null;
}

export interface TenantConfig {
  companyId: string;
  name: string;
  status: string;
  users: number;
  createdAt: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Sprint 5 — admin contact (verkoop/ondersteuning) */
  adminEmail?: string;
  /** Sprint 5 — provisioning state ('pending' tot Supabase instance is gekoppeld) */
  provisioningStatus?: 'pending' | 'provisioned';
}

/**
 * Sprint 5 — input voor het aanmaken van een nieuwe tenant.
 * Volstaat met companyName + adminEmail; supabase-velden mogen leeg
 * blijven en worden later (handmatig) ingevuld bij provisioning.
 */
export interface CreateTenantInput {
  companyName: string;
  adminEmail: string;
  /** Optionele override; als leeg wordt automatisch een slug gegenereerd. */
  companyId?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

const TABLE = 'tenants';

// ── slug-helpers ──────────────────────────────────────────────────────────
function slugifyCompanyName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || `tenant-${Date.now().toString(36)}`;
}

function uniqueCompanyId(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── row ↔ config mapping (snake_case in DB, camelCase in app) ─────────────
function rowToConfig(row: any): TenantConfig {
  return {
    companyId: row.company_id,
    name: row.name,
    status: row.status,
    users: row.users ?? 0,
    createdAt:
      typeof row.created_at === 'string'
        ? row.created_at.split('T')[0] ?? row.created_at
        : new Date(row.created_at).toISOString().split('T')[0] ?? '',
    supabaseUrl: row.supabase_url ?? '',
    supabaseAnonKey: row.supabase_anon_key ?? '',
    adminEmail: row.admin_email ?? undefined,
    provisioningStatus: row.provisioning_status ?? 'pending',
  };
}

function configToRow(cfg: TenantConfig): Record<string, any> {
  return {
    company_id: cfg.companyId,
    name: cfg.name,
    status: cfg.status,
    users: cfg.users,
    created_at: cfg.createdAt,
    supabase_url: cfg.supabaseUrl,
    supabase_anon_key: cfg.supabaseAnonKey,
    admin_email: cfg.adminEmail ?? null,
    provisioning_status: cfg.provisioningStatus ?? 'pending',
  };
}

// Demo-fallback voor lokale dev / tests: als Supabase niet bereikbaar is
// of de tabel leeg is, retourneer de hard-coded demo zodat login blijft werken.
const DEMO_FALLBACK: TenantConfig = {
  companyId: 'demo',
  name: 'Demo Bouwgroep BV',
  status: 'active',
  users: 3,
  createdAt: '2026-01-15',
  supabaseUrl: process.env.SUPABASE_URL || 'https://kgiuavfvhtdgwuygbyzo.supabase.co',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnaXVhdmZ2aHRkZ3d1eWdieXpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MzgzOTMsImV4cCI6MjA5MzAxNDM5M30.ezL6iv8bSXM4ZNZwtiesYdgiirUPKzh3fhu18HvLMpc',
  adminEmail: 'demo@speesolutions.nl',
  provisioningStatus: 'provisioned',
};

class TenantService {
  static async _readAll(): Promise<TenantConfig[]> {
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase.from(TABLE).select('*');
      if (error) {
        console.error('[TenantService] read error', error);
        return [];
      }
      return (data ?? []).map(rowToConfig);
    } catch (err) {
      console.error('[TenantService] supabase unavailable', err);
      return [];
    }
  }

  static async resolveTenant(companyId: string): Promise<TenantConfig> {
    const id = companyId.toLowerCase();

    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .eq('company_id', id)
        .maybeSingle();

      if (error) {
        console.error('[TenantService] resolveTenant error', error);
      }

      if (data) {
        const cfg = rowToConfig(data);
        if (cfg.status !== 'active') {
          throw new Error('Dit account is niet actief. Neem contact op met Spee Solutions.');
        }
        return cfg;
      }
    } catch (err: any) {
      // Alleen swallowen als het een infra-fout is; status-fout doorgooien.
      if (err?.message?.includes('niet actief')) throw err;
      console.error('[TenantService] supabase unavailable, fallback', err);
    }

    // Fallback demo zodat lokaal/CI altijd werkt
    if (id === 'demo') return DEMO_FALLBACK;

    throw new Error('Bedrijfs-ID niet gevonden. Controleer je licentie.');
  }

  static async getAllTenants(): Promise<TenantConfig[]> {
    return this._readAll();
  }

  /**
   * Sprint 5 — maak een nieuwe tenant aan op basis van bedrijfsnaam +
   * admin-mail. companyId wordt automatisch gegenereerd als slug en
   * gegarandeerd uniek gemaakt. Supabase-velden mogen leeg blijven; de
   * tenant krijgt dan provisioningStatus = 'pending' tot ze handmatig
   * worden gekoppeld aan een Supabase instance.
   *
   * Backward compatible: accepteert nog steeds de oude shape
   *   { companyId, name, supabaseUrl, supabaseAnonKey }
   * via Partial<TenantConfig>.
   */
  static async createTenant(
    input: CreateTenantInput | Partial<TenantConfig>
  ): Promise<TenantConfig> {
    const existing = await this._readAll();
    const taken = new Set(existing.map(t => t.companyId.toLowerCase()));

    // Normaliseer beide input-shapes naar één object
    const companyName =
      (input as CreateTenantInput).companyName ??
      (input as Partial<TenantConfig>).name ??
      '';
    const adminEmail =
      (input as CreateTenantInput).adminEmail ??
      (input as any).adminEmail ??
      '';
    const explicitId =
      (input as CreateTenantInput).companyId ??
      (input as Partial<TenantConfig>).companyId;

    if (!companyName.trim()) {
      throw new Error('companyName is verplicht.');
    }
    if (!adminEmail.trim() || !EMAIL_RX.test(adminEmail.trim())) {
      throw new Error('Een geldig adminEmail-adres is verplicht.');
    }

    // companyId bepalen: expliciet meegegeven óf afleiden van naam
    let companyId: string;
    if (explicitId && explicitId.trim()) {
      const normalized = explicitId.trim().toLowerCase();
      if (taken.has(normalized)) {
        throw new Error(`Company ID "${normalized}" bestaat al.`);
      }
      companyId = normalized;
    } else {
      const base = slugifyCompanyName(companyName);
      companyId = uniqueCompanyId(base, taken);
    }

    const supabaseUrl = (input as any).supabaseUrl ?? '';
    const supabaseAnonKey = (input as any).supabaseAnonKey ?? '';
    const provisioningStatus: 'pending' | 'provisioned' =
      supabaseUrl && supabaseAnonKey ? 'provisioned' : 'pending';

    const newTenant: TenantConfig = {
      companyId,
      name: companyName.trim(),
      status: 'active',
      users: 0,
      createdAt: new Date().toISOString().split('T')[0] || new Date().toISOString(),
      supabaseUrl,
      supabaseAnonKey,
      adminEmail: adminEmail.trim().toLowerCase(),
      provisioningStatus,
    };

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .insert(configToRow(newTenant))
      .select()
      .single();

    if (error) {
      console.error('[TenantService] createTenant error', error);
      throw new Error(`Kon tenant niet aanmaken: ${error.message}`);
    }
    return rowToConfig(data);
  }

  /**
   * Sprint 5 — update een bestaande tenant (bv. om Supabase-creds in te
   * vullen na handmatige provisioning, of status te wijzigen).
   */
  static async updateTenant(
    companyId: string,
    patch: Partial<TenantConfig>
  ): Promise<TenantConfig> {
    const id = companyId.toLowerCase();
    const supabase = getSupabaseAdminClient();

    // companyId mag niet gewijzigd worden — anders breken bestaande logins
    const { companyId: _ignored, ...allowed } = patch;

    // Haal current op om provisioning-status te kunnen herberekenen
    const { data: current, error: fetchErr } = await supabase
      .from(TABLE)
      .select('*')
      .eq('company_id', id)
      .maybeSingle();

    if (fetchErr) throw new Error(`Kon tenant niet laden: ${fetchErr.message}`);
    if (!current) throw new Error(`Tenant "${companyId}" niet gevonden.`);

    const merged: TenantConfig = { ...rowToConfig(current), ...allowed };

    if (merged.supabaseUrl && merged.supabaseAnonKey) {
      merged.provisioningStatus = 'provisioned';
    } else if (!merged.provisioningStatus) {
      merged.provisioningStatus = 'pending';
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update(configToRow(merged))
      .eq('company_id', id)
      .select()
      .single();

    if (error) {
      console.error('[TenantService] updateTenant error', error);
      throw new Error(`Kon tenant niet bijwerken: ${error.message}`);
    }
    return rowToConfig(data);
  }

  /**
   * Leest de abonnementstatus van een tenant (voor de entitlement-gate).
   * Fail-closed: bij een onbekende tenant of infra-fout → status 'geen', zodat
   * de gate geen toegang geeft. (De `demo`-tenant geldt als actief voor lokaal.)
   */
  static async getAbonnement(companyId: string): Promise<TenantAbonnement> {
    const id = companyId.toLowerCase();
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from(TABLE)
        .select('abonnement_status, abonnement_plan, abonnement_geldig_tot')
        .eq('company_id', id)
        .maybeSingle();

      if (error) {
        console.error('[TenantService] getAbonnement error', error);
        if (id === 'demo') return { status: 'actief', plan: 'demo', geldigTot: null };
        return { status: 'geen', plan: null, geldigTot: null };
      }
      if (data) {
        return {
          status: (data.abonnement_status ?? 'geen') as AbonnementStatus,
          plan: data.abonnement_plan ?? null,
          geldigTot: data.abonnement_geldig_tot ?? null,
        };
      }
    } catch (err) {
      console.error('[TenantService] getAbonnement supabase unavailable', err);
    }
    if (id === 'demo') return { status: 'actief', plan: 'demo', geldigTot: null };
    return { status: 'geen', plan: null, geldigTot: null };
  }

  /**
   * Schrijft de abonnementvelden weg (door de geverifieerde webhook). Matcht op
   * company_id; valt terug op ls_subscription_id als de tenant-id ontbreekt of
   * niet gevonden wordt. Gooit als er geen rij gematcht kon worden.
   */
  static async updateAbonnement(
    tenantId: string | null,
    update: AbonnementUpdate
  ): Promise<void> {
    const supabase = getSupabaseAdminClient();
    const row = {
      abonnement_status: update.status,
      abonnement_plan: update.plan ?? null,
      abonnement_geldig_tot: update.geldigTot ?? null,
      proef_eindigt_at: update.proefEindigtAt ?? null,
      ls_customer_id: update.lsCustomerId ?? null,
      ls_subscription_id: update.lsSubscriptionId ?? null,
      abonnement_bijgewerkt_at: new Date().toISOString(),
    };

    if (tenantId && tenantId.trim()) {
      const { data, error } = await supabase
        .from(TABLE)
        .update(row)
        .eq('company_id', tenantId.trim().toLowerCase())
        .select('company_id');
      if (error) throw new Error(`Kon abonnement niet bijwerken: ${error.message}`);
      if (data && data.length > 0) return;
    }

    // Fallback: match op de subscription-id (bv. bij vervolg-events zonder custom_data).
    if (update.lsSubscriptionId) {
      const { data, error } = await supabase
        .from(TABLE)
        .update(row)
        .eq('ls_subscription_id', update.lsSubscriptionId)
        .select('company_id');
      if (error) throw new Error(`Kon abonnement niet bijwerken: ${error.message}`);
      if (data && data.length > 0) return;
    }

    throw new Error('Geen tenant gevonden voor dit abonnement-event.');
  }
}

module.exports = { TenantService };
