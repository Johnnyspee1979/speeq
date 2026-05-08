# SpeeQ Master Backend Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Build the SpeeQ Master Backend API that handles tenant resolution and connection provisioning for the Structura Wkb app.

**Architecture:** We will create a `TenantService` in the Node.js backend that resolves company credentials. We'll expose an endpoint `GET /api/v1/tenants/resolve/:companyId` which the frontend app will call during the login phase to receive its dedicated Supabase credentials.

**Tech Stack:** Node.js, Express, Jest, React Native.

---

### Task 1: Create Tenant Controller and Service

**Files:**
- Create: `backend/src/services/TenantService.ts`
- Create: `backend/src/routes/tenant.routes.ts`
- Modify: `backend/src/index.ts`
- Create: `backend/src/services/__tests__/TenantService.test.ts`

**Step 1: Write the failing service test**
Create `backend/src/services/__tests__/TenantService.test.ts`.
```typescript
import { TenantService } from '../TenantService';

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
```

**Step 2: Run test to verify it fails**
Run: `npm test src/services/__tests__/TenantService.test.ts`
Expected: FAIL (Cannot find module)

**Step 3: Implement TenantService**
Create `backend/src/services/TenantService.ts` with a hardcoded mock database for now containing the "demo" company.
```typescript
export interface TenantConfig {
  companyId: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export class TenantService {
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
```

**Step 4: Run test to verify it passes**
Run: `npm test src/services/__tests__/TenantService.test.ts`
Expected: PASS

**Step 5: Create Express Route**
Create `backend/src/routes/tenant.routes.ts`.
```typescript
import { Router } from 'express';
import { TenantService } from '../services/TenantService';

const router = Router();

router.get('/resolve/:companyId', async (req, res) => {
  try {
    const config = await TenantService.resolveTenant(req.params.companyId);
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(404).json({ success: false, error: 'Bedrijfs-ID onbekend' });
  }
});

export const tenantRoutes = router;
```

**Step 6: Mount the route**
Modify `backend/src/index.ts`. Add `import { tenantRoutes } from './routes/tenant.routes';` and `app.use('/api/v1/tenants', tenantRoutes);`

**Step 7: Commit**
```bash
git add backend/src/services/ backend/src/routes/ backend/src/index.ts
git commit -m "feat(backend): add tenant resolution API"
```

---

### Task 2: Refactor Frontend to use Master API

**Files:**
- Modify: `frontend/src/screens/TenantLoginScreen.tsx`

**Step 1: Update Frontend Login Logic**
Modify `TenantLoginScreen.tsx` to `fetch` from the Master Backend instead of using the local mock. Use `BACKEND_URL` from `../config/app`.

```typescript
// Replace handleLogin logic with:
const handleLogin = async () => {
  if (!companyId.trim()) {
    setError('Vul een Bedrijfs-ID in');
    return;
  }
  setLoading(true);
  setError('');

  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/tenants/resolve/${companyId}`);
    const result = await response.json();
    
    if (result.success) {
      const { supabaseUrl, supabaseAnonKey } = result.data;
      await setTenantConfig({ companyId, supabaseUrl, supabaseAnonKey });
      initSupabase(supabaseUrl, supabaseAnonKey);
      onLoginSuccess();
    } else {
      setError(result.error || 'Er ging iets mis.');
    }
  } catch (e) {
    setError('Kan de Master server niet bereiken.');
  } finally {
    setLoading(false);
  }
};
```

**Step 2: Commit**
```bash
git add frontend/src/screens/TenantLoginScreen.tsx
git commit -m "feat(frontend): fetch tenant credentials from SpeeQ Master Backend"
```
