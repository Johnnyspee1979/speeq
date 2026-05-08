const fs = require('fs');
const path = require('path');

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

const DATA_FILE = path.join(__dirname, '../../data/tenants.json');

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

class TenantService {
  static _readTenants(): TenantConfig[] {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (err) {
      console.error('Error reading tenants file', err);
    }
    return [];
  }

  static _writeTenants(tenants: TenantConfig[]) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(tenants, null, 2), 'utf8');
  }

  static async resolveTenant(companyId: string): Promise<TenantConfig> {
    const tenants = this._readTenants();
    const tenant = tenants.find(t => t.companyId.toLowerCase() === companyId.toLowerCase());

    if (tenant) {
      if (tenant.status !== 'active') {
        throw new Error('Dit account is niet actief. Neem contact op met Spee Solutions.');
      }
      return tenant;
    }

    // Fallback for demo if missing in JSON
    if (companyId.toLowerCase() === 'demo') {
      return {
        companyId: 'demo',
        name: 'Demo Bouwgroep BV',
        status: 'active',
        users: 3,
        createdAt: '2026-01-15',
        supabaseUrl: process.env.SUPABASE_URL || 'https://kgiuavfvhtdgwuygbyzo.supabase.co',
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnaXVhdmZ2aHRkZ3d1eWdieXpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MzgzOTMsImV4cCI6MjA5MzAxNDM5M30.ezL6iv8bSXM4ZNZwtiesYdgiirUPKzh3fhu18HvLMpc'
      };
    }
    throw new Error('Bedrijfs-ID niet gevonden. Controleer je licentie.');
  }

  static async getAllTenants(): Promise<TenantConfig[]> {
    return this._readTenants();
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
    const tenants = this._readTenants();
    const taken = new Set(tenants.map(t => t.companyId.toLowerCase()));

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

    tenants.push(newTenant);
    this._writeTenants(tenants);
    return newTenant;
  }

  /**
   * Sprint 5 — update een bestaande tenant (bv. om Supabase-creds in te
   * vullen na handmatige provisioning, of status te wijzigen).
   */
  static async updateTenant(
    companyId: string,
    patch: Partial<TenantConfig>
  ): Promise<TenantConfig> {
    const tenants = this._readTenants();
    const idx = tenants.findIndex(
      t => t.companyId.toLowerCase() === companyId.toLowerCase()
    );
    if (idx === -1) throw new Error(`Tenant "${companyId}" niet gevonden.`);

    const current = tenants[idx]!;
    // companyId mag niet gewijzigd worden — anders breken bestaande logins
    const { companyId: _ignored, ...allowed } = patch;
    const merged: TenantConfig = { ...current, ...allowed };

    if (merged.supabaseUrl && merged.supabaseAnonKey) {
      merged.provisioningStatus = 'provisioned';
    } else if (!merged.provisioningStatus) {
      merged.provisioningStatus = 'pending';
    }

    tenants[idx] = merged;
    this._writeTenants(tenants);
    return merged;
  }
}

module.exports = { TenantService };
