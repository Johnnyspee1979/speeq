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
}

const DATA_FILE = path.join(__dirname, '../../data/tenants.json');

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

  static async createTenant(data: Partial<TenantConfig>): Promise<TenantConfig> {
    const tenants = this._readTenants();
    
    if (tenants.some(t => t.companyId.toLowerCase() === data.companyId?.toLowerCase())) {
      throw new Error('Company ID already exists');
    }

    const newTenant: TenantConfig = {
      companyId: data.companyId || `tenant_${Date.now()}`,
      name: data.name || 'Nieuwe Klant',
      status: 'active',
      users: 0,
      createdAt: new Date().toISOString().split('T')[0] || new Date().toISOString(),
      supabaseUrl: data.supabaseUrl || '',
      supabaseAnonKey: data.supabaseAnonKey || ''
    };

    tenants.push(newTenant);
    this._writeTenants(tenants);
    return newTenant;
  }
}

module.exports = { TenantService };
