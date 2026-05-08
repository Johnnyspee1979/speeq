export interface TenantConfig {
  companyId: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

class TenantService {
  static async resolveTenant(companyId: string): Promise<TenantConfig> {
    if (companyId.toLowerCase() === 'demo') {
      return {
        companyId: 'demo',
        supabaseUrl: process.env.SUPABASE_URL || 'https://kgiuavfvhtdgwuygbyzo.supabase.co',
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnaXVhdmZ2aHRkZ3d1eWdieXpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MzgzOTMsImV4cCI6MjA5MzAxNDM5M30.ezL6iv8bSXM4ZNZwtiesYdgiirUPKzh3fhu18HvLMpc'
      };
    }
    throw new Error('Tenant not found');
  }
}

module.exports = { TenantService };
