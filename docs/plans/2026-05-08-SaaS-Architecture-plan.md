# SpeeQ SaaS Infrastructure Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Transform the hardcoded Wkb-snap app into a dynamic multi-instance SaaS tool called "Structura Wkb" controlled by "SpeeQ".

**Architecture:** We will implement a dynamic Supabase initialization layer in the frontend. Instead of reading `.env` variables statically at build time for the database connection, the app will require a `Tenant ID` on startup, fetch the credentials, and initialize the Supabase client at runtime.

**Tech Stack:** React Native (Expo), Supabase JS Client, Expo Secure Store, Node.js (Backend).

---

### Task 1: Rename the App to Structura Wkb
**Files:**
- Modify: `frontend/app.json`
- Modify: `frontend/package.json`

**Step 1: Update app.json naming**
Change `"name": "wkb-snap-sync"` to `"name": "Structura Wkb"` and update the slug/bundleIdentifier accordingly.

**Step 2: Update package.json naming**
Change the project name in `package.json` to reflect the new brand.

**Step 3: Commit**
```bash
git add frontend/app.json frontend/package.json
git commit -m "chore: rebrand app to Structura Wkb"
```

---

### Task 2: Create Dynamic Supabase Client Logic
**Files:**
- Create: `frontend/src/config/tenant.ts`
- Modify: `frontend/src/config/supabase.ts` (or wherever the client is initialized)

**Step 1: Write Tenant Configuration Service**
Create a service that allows setting and getting the dynamic `supabaseUrl` and `supabaseKey` using `expo-secure-store` or local storage so the app remembers the tenant.

**Step 2: Refactor Supabase Initialization**
Modify the current Supabase initialization. Instead of a singleton created immediately on file load, export a function `initSupabase(url, key)` that returns the client, or proxy the client to wait for tenant initialization.

**Step 3: Commit**
```bash
git add frontend/src/config/
git commit -m "feat: implement dynamic tenant-based supabase client initialization"
```

---

### Task 3: Build the Tenant Login Screen
**Files:**
- Create/Modify: `frontend/src/screens/TenantLoginScreen.tsx`
- Modify: `frontend/App.tsx`

**Step 1: Create Login UI**
Create a screen asking for a "Bedrijfs-ID" (Company ID) and an access code. 

**Step 2: Wire up the mock validation**
For now, hardcode a mock validation that accepts ID "demo" and sets the dynamic Supabase keys to the existing `.env` values, so the app still works during development.

**Step 3: Update App.tsx routing**
Make `TenantLoginScreen` the initial route if no tenant configuration is found in local storage.

**Step 4: Commit**
```bash
git add frontend/src/screens/ frontend/App.tsx
git commit -m "feat: add tenant login screen and routing"
```
