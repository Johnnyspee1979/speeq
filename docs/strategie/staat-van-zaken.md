# STAAT VAN ZAKEN — SPEEQ WKB PLATFORM (peildatum 2026-05-20)

> **Doel van dit document:** geef NotebookLM (orchestrator-laag) een feitelijk overzicht van wat al gebouwd is, zodat het géén instructies meer schrijft voor werk dat klaar is. Laat NotebookLM zelf bepalen welke vervolgstappen nog nodig zijn op basis van wat hieronder ontbreekt.

---

## 1. PROJECT-CONTEXT
SpeeQ is een B2B-SaaS voor de Wet Kwaliteitsborging voor het Bouwen (Wkb). Eigenaar: Johnny Spee, Spee Solutions (Den Haag). Doelgroep: MKB-aannemers (5–50 medewerkers). Tech-stack: React Native Web (Expo), Vercel (Edge), Supabase (PostgreSQL). Repository: `Johnnyspee1979/speeq`, main-branch deployed continu via Vercel-integratie.

## 2. PRODUCTIE-STAAT — WAT DRAAIT LIVE
- **PR #6 gemerged** (commit `14b4ec1`, 17 mei 2026): "Warm Minimal design system + Progressive Disclosure 3-lagen". Live op `speeq-wkb-tool.vercel.app`.
- Auto-deploy via git-push naar `main`. Geen handmatige `npx vercel --prod` nodig.
- RLS-migratie productie-actief (per merge PR #6).
- Vercel-alias `speeq-wkb-tool.vercel.app` aan productie gekoppeld.

## 3. DESIGN SYSTEM — AL AF
Bestand: `frontend/src/theme/designTokens.ts`. Geëxporteerd als `designTokens` + legacy alias `tokens`. Toegankelijk via `useTheme()` hook.

**Kleur-tokens (bestaan al, geen actie meer nodig):**
- `background` #FBF6EE, `backgroundAlt` #F3EDE2, `surface` #EADBC7, `surfaceAlt` #D8D1C7
- `textPrimary` #2B2B2B, `textSecondary` #2F2A25, `textMuted` #575B5F
- `statusSuccess` #1F4D3A, `statusSuccessAlt` #568203, `statusWarning` #F88363, `statusWarningAlt` #FF5733
- `borderWarm` #C9B099, `borderWarmAlt` #D7C2AA

**Typografie (Two-Font System, al af):**
- `headline` Playfair-Italic 32/40
- `sectionTitle` Inter-SemiBold 20/28
- `bodyData` Inter-Regular 16/24
- `caption` Inter-Medium 12/16

**Spacing tokens (al af):** s1–s8 (4, 8, 12, 16, 20, 24, 28, 32). **Radius tokens (al af):** sm/md/lg/xl/pill.

## 4. UI PRIMITIVES — AL AF
Map: `frontend/src/components/ui/`. Allemaal bestaan, allemaal in productie:
- `PageHeader.tsx` (title + optionele `rightAction` ReactNode)
- `PrimaryButton.tsx` (`label` + `loading` + `size: 'sm'|'md'`)
- `SecondaryButton.tsx` (`title` + `disabled`)
- `StatusPill.tsx` (`status: 'success'|'warning'|'neutral'` + `label`)
- `EmptyState.tsx`
- `DiagnoseSidePanel.tsx`
- `DossierActionModal.tsx`
- `OrganizationSwitcherModal.tsx` (legacy, vervangen door direct-row-switch in MakerDashboard)
- `AdminOnly.tsx`
- `AiMetadataBlock.tsx`

**NIET opnieuw bouwen.** Alleen via Edit aanpassen indien strikt nodig.

## 5. SCHERMEN — WARM MINIMAL STATUS

| Scherm | Status | Bron |
|---|---|---|
| BorgingsDossier / Evidence-cards | ✅ live | PR #6 |
| WerkvoorbereiderDashboard (5-card rule) | ✅ live | PR #6 |
| MakerDashboard | 🟡 PR #10 open | delta wacht op merge |
| TenantBrandingScreen | 🟡 PR #8 open | delta wacht op merge |
| TenantFeaturesScreen (KEYUSER moduletoggle) | 🟡 PR #9 open | nieuw scherm + delta |
| TeamBeheerScreen (FlatList scroll-root) | 🟡 PR #7 open | wacht op merge |

## 6. OPEN PR'S — WACHTEN OP KLIK-TEST + MERGE
- **#7** `claude/team-flatlist` — TeamBeheerScreen FlatList + perf-props 10/10/true
- **#8** `claude/branding-delta` — TenantBrandingScreen tokens + PageHeader + PrimaryButton
- **#9** `claude/tenant-features` — TenantFeaturesScreen + service + hook + Warm Minimal delta
- **#10** `claude/maker-delta` — MakerDashboard direct-row-switch + setBrandingFromMaster + Warm Minimal delta

Geen merge zonder klik-test op de Vercel PR-preview.

## 7. BACKEND & DATA — AL AF
- **Tabellen:** `tenants`, `projects`, `evidence`, `tenant_features` (met `active_modules` JSONB + `branding_colors` JSONB), `tenant_branding`.
- **RLS:** Actief op alle tabellen via `get_user_enrolled_organization_ids()` securitydefiner-functie. `auth.uid()` → organisatie-lookup live in DB, geen JWT-claims.
- **Multi-tenant model:** Master-DB met master-`tenants`-rij per klant; per-klant eigen Supabase-instance in Frankfurt. Switch via `setTenantConfig({companyId, supabaseUrl, supabaseAnonKey})`.
- **Synchrone tenant-lookup:** `getActiveTenantId()` in `config/tenant.ts` (cache + `localStorage('wkb_active_tenant_id')`).

## 8. SERVICES & HOOKS — AL AF
- `TenantBrandingService.ts`: `getBranding`, `uploadLogo` (2MB validatie), `setCompanyName`, `setPrimaryColor`, `resetBranding`, **`setBrandingFromMaster`** (cache priming pre-reload).
- `TenantFeaturesService.ts`: `getTenantFeatures`, `setTenantFeature`, met audit-trail (`'SPEE'|'KEYUSER'`).
- `MakerService.ts`: `signInMaker`, `signOutMaker`, `listTenants`, `createTenant`, `updateTenant`, `deleteTenant`.
- `useTenantBranding()` hook: real-time React Context.
- `useTenantFeature()` hook + `refreshTenantFeatures()` global cache invalidation.
- `useWkbAuth()` hook met rollen.

## 9. ROL-MODEL — AL AF
`WkbUserRole` enum in `types/Auth.ts`: `ADMIN`, `KEYUSER` (per-tenant admin), `KWALITEITSBORGER`, `AANNEMER`, `WERKVOORBEREIDER`, `VOORMAN`, `VAKMAN`, `ONDERAANNEMER`. Maker-account `johnny@speesolutions.com` met master-DB-toegang.

## 10. WORKFLOW — GELDEND
- **Delta-refactor per scherm**, géén letterlijke vervanging van 300–1700-regel bestanden door 100-regel stubs.
- **Eén PR per scherm**, scope smal.
- **`tsc --noEmit` clean** vóór commit.
- **Klik-test op Vercel PR-preview** vóór `gh pr merge <n> --squash --delete-branch`.
- **Geen WIP-commits zonder akkoord** (untracked of `M` files in `git status` blijven van Johnny).
- **Function-hoisting truc** voor renderMember bij FlatList-refactors (declareer `function renderMember(...)` ná de return — JSX hoeft niet verplaatst te worden).

## 11. LOKALE WIP — NOG NIET OP MAIN
In Johnny's hoofd-worktree zijn deze files `modified` of `untracked`:
- `frontend/App.tsx` (routing rond slug-detection + localStorage tenant-id)
- `frontend/src/services/ProjectService.ts` (tenant-id filter wiring)
- `frontend/src/services/BorgingsDossierService.ts` (tenant-id filtering)
- `frontend/src/services/MakerService.ts` (kleine tweak)
- `frontend/src/components/layout/ResponsiveLayout.tsx`
- `frontend/src/context/ProjectContext.tsx`
- `frontend/src/assets/tenants/` (logo-assets)

Deze blokkeren een `git pull --ff-only` in z'n hoofd-worktree. Niet automatisch committen.

## 12. WAT JE NIET HOEFT TE INSTRUEREN
Vraag Claude Code NOOIT meer om dit te bouwen — het bestaat al en blind opnieuw bouwen wist productie-features uit:
- `designTokens.ts` (alle kleuren + typografie + spacing)
- `PageHeader.tsx`, `PrimaryButton.tsx`, `SecondaryButton.tsx`, `StatusPill.tsx`, `EmptyState.tsx`
- RLS-policies op `tenants`/`projects`/`evidence`/`tenant_features`
- `KEYUSER` rol in `WkbUserRole`
- `getActiveTenantId()` helper
- `setBrandingFromMaster()` helper
- `useTenantBranding`, `useTenantFeature`, `useWkbAuth` hooks
- Vercel auto-deploy pipeline
- Multi-tenant routing via `?t=<slug>` query-param
- Warm Minimal styling op WerkvoorbereiderDashboard

## 13. WAT MOGELIJK NOG ONTBREEKT (voor NotebookLM-beslissing)
Op basis van bovenstaande staat van zaken zijn er nog onbeantwoorde gebieden — laat NotebookLM bepalen welke prioriteit krijgt:
- **Routing-laag wiring** voor `wkb_active_tenant_id` localStorage (in user's WIP, nog niet op main).
- **Klik-test + merge cadans** voor PR's #7/#8/#9/#10.
- **Schermen die mogelijk nog niet Warm Minimal zijn**: login-flows, project-detail-pages, evidence-upload-flow, KiK-koppeling-config.
- **PDF-exports** (borgingsdossier) — onbekend of die het tokens-systeem hanteren.
- **i18n / meertaligheid** — momenteel alleen NL.
- **Mobile-specifieke optimalisaties** (camera-quick-capture, GPS-permission-flow).
- **AI-precheck module** — schakelbaar via tenant_features, maar implementatie-staat onduidelijk.
- **Onboarding-flow** voor nieuwe KEYUSER-accounts (eerste-login experience).

---

NotebookLM: gebruik bovenstaande staat van zaken als feitelijke basis. Schrijf alleen instructies voor gebieden in sectie 13 of nieuw gevallen — herhaal nooit instructies voor secties 3–10.
