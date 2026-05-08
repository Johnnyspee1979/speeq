const { TenantService } = require('../TenantService');

describe('TenantService', () => {
  it('resolves the demo tenant correctly', async () => {
    const tenant = await TenantService.resolveTenant('demo');
    expect(tenant.companyId).toBe('demo');
    expect(tenant.supabaseUrl).toContain('supabase.co');
    expect(tenant.supabaseAnonKey).toBeDefined();
  });

  it('throws an error for unknown tenants', async () => {
    await expect(TenantService.resolveTenant('unknown')).rejects.toThrow('Tenant not found');
  });
});
