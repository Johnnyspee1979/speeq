# SpeeQ — projectgeheugen voor Claude Code

Interne tool van Spee Solutions. Foto-gebaseerde **Wkb** (Wet kwaliteitsborging
bouw) bewijs- en dossier-app, multi-tenant. Vakman maakt foto's → AI valideert →
werkvoorbereider beoordeelt → dossier (consument + bevoegd gezag) → DSO/STAM-
melding bij bevoegd gezag.

## Stack
| Laag | Tech |
|---|---|
| Backend | Node.js + TypeScript + Express 5, op Railway |
| Frontend | React Native / Expo (draait ook als web/PWA) |
| Data | Supabase (Postgres + Storage); master `tenants`-DB + per-tenant DB's |
| AI | OpenAI Vision (backend), TensorFlow.js/MobileNet + Tesseract (frontend) |

## Starten (binnen 5 min)
```bash
# Backend (poort 4103)
cd backend && npm install && npm run dev      # ts-node + nodemon
#   build/prod: npm run build && npm run start:prod

# Frontend
cd frontend && npm install && npm run web     # of: npm run ios / android
```
Beide hebben een `.env` nodig (zie hieronder). Zonder Supabase-config weigert de
backend-auth nu bewust (fail-closed) — zet voor lokaal werken
`ALLOW_AUTH_BYPASS=true`.

## Env-vars (backend, `.env`)
Kern: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY`.
Integraties: `DIGIKOPPELING_API_URL/KEY` (DSO/STAM), `KIK_API_URL/KEY`,
`AFAS_*`, `EXACT_*`, `BCF_*`, `ELEVENLABS_API_KEY`, `PDF_SERVICES_CLIENT_ID/SECRET`.
Commerce: `LEMONSQUEEZY_WEBHOOK_SECRET` (signing secret voor de webhook).

Security-flags (alle **standaard uit**):
| Flag | Effect |
|---|---|
| `ALLOW_AUTH_BYPASS=true` | Sla auth over als Supabase niet geconfigureerd is. **Alleen lokaal.** |
| `ENABLE_QR_DEMO=true` | Zet de publieke `/qr` demo-pagina aan (toont demo-inloggegevens). |
| `ENFORCE_SUBSCRIPTION=true` | Zet de betaalmuur (`requireActiveSubscription`) aan op dossier-export + STAM. Standaard uit → no-op. Aanzetten = bewuste go-live-stap (zie `docs/commerce/lemon-squeezy-go-live.md`); frontend moet dan `x-company-id` meesturen. |

Frontend gebruikt `EXPO_PUBLIC_*` (o.a. `EXPO_PUBLIC_SUPABASE_URL/ANON_KEY`,
`BACKEND_URL`).

## Tests & checks
```bash
# Backend
cd backend && npm test                 # jest --runInBand
npx jest <naam> --runInBand --forceExit # gericht; --forceExit i.v.m. open handles
npm run typecheck                       # tsc --noEmit

# Frontend
cd frontend && npm run typecheck
```

## Valkuilen (hard geleerd)
- **CommonJS + `verbatimModuleSyntax`**: backend-modules gebruiken
  `const x = require(...)` + `module.exports`, en `import type` voor types.
  Géén `export const` op waarde-niveau in deze modules → TS1287. Exporteer
  waarden via `module.exports`, types via `export type`.
- **macOS**: `timeout` bestaat niet standaard. Gebruik jest `--forceExit`.
- **Volledige `jest --runInBand` kan hangen** op open handles — `--forceExit`.
- **Geen `supertest`** als dependency. Voor route-tests: óf router-stack
  inspecteren, óf een wegwerp-Express-app + Node's globale `fetch`/`FormData`.
- **zsh expandt globs** zoals `*.ts` in bash-`grep`; gebruik de Grep-tool.

## Auth-model (kort)
- `backend/src/middleware/auth.ts` → `requireAuth`: verifieert Supabase-JWT,
  **fail-closed** bij ontbrekende config (503), tenzij `ALLOW_AUTH_BYPASS`.
- `backend/src/services/authContextService.ts`: rol + projecttoegang voor
  reviewacties (reviewers = AANNEMER, KWALITEITSBORGER).
- `backend/src/middleware/requireReviewer.ts`: rol-gate bóven `requireAuth`.
  Alleen reviewers mogen **exporteren/melden** → 403 NL anders. Toegepast op
  dossier-download/genereer (`bevoegd-gezag`, `consument(/export)`, `genereer`),
  `/api/stam/*`, `/api/dso/stam/submit` en legacy `/api/dossier/:id/export`.
  Status- en leesroutes blijven op alleen `requireAuth`. Respecteert de
  dev-bypass (rol komt dan van `requireAuth`). Rol-gebaseerd, niet
  project-ownership — wil je per-project, dan `assertProjectReviewAccess`.
- Beschermde mounts (`requireAuth`): `/api/wkb-evidence`, `/api/wkb-dossier`,
  `/api/kik`, `/api/integrations/kik`, `/api/stam`, `/api/integrations/bim`,
  `/api/wkb-ai/ocr`, `/api/review`, `/api/notifications`, `/api/voice`,
  `/api/maker` (laatste twee intern in de router). Inline beschermd:
  `/api/admin/ai-stats`, `/api/dossier/:projectId` (+`/export`),
  `/api/ai/validate`, `/api/dso/stam/submit`+`/status`. Tenant-write/list achter
  auth; `/api/v1/tenants/resolve` blijft publiek (login).
- Bewust **publiek/extern** gelaten: `/api/erp/afas`,
  `/api/integrations/erp|exact-online` (eigen API-key-auth),
  `/health`, `/api/health`, en `/qr` (achter `ENABLE_QR_DEMO`).
- **Project-scope** (naast rol): de gebruikte dossier-routes (`/api/wkb-dossier/*`:
  genereer, bevoegd-gezag, consument(/export)) én de inline `/api/dossier/:projectId`
  (+`/export`) roepen nu `assertProjectReviewAccess` aan — alleen eigenaar/
  kwaliteitsborger, niet elke reviewer. `/consument/status` blijft rol-open.
- `/api/integrations/dso` is **niet langer publiek**: nu achter `requireAuth` +
  `requireReviewer` (de eerder aangenomen "eigen API-key-auth" bestond niet in de
  handlers). De frontend gebruikt deze alias niet.
- `/api/kik` + `/api/integrations/kik` zijn **niet langer publiek** (zelfde gat:
  geen auth in de handlers): nu achter `requireAuth`. De frontend (`services/kik.ts`)
  stuurt de Supabase-JWT + `x-company-id` mee.

## Bekende open punten (zie hardening-rapport)
- ~~Dossier-export en DSO-meldingen zonder token~~ → **opgelost**: routes
  (`/api/wkb-dossier`, `/api/stam`, inline `/api/dso/stam/*`) zitten nu achter
  `requireAuth`; de frontend stuurt de Supabase-JWT mee (`services/dso.ts` +
  `services/dossierAuth.ts`). Web haalt PDF's als blob mét Bearer op (i.p.v.
  `window.open` zónder header), native geeft de header door aan
  `downloadAsync`. **Aanname:** downloads zijn login-only — géén deelbare
  login-loze links. Wil je die wél, dan zijn signed/getokende URLs nodig.
  De `/api/integrations/dso`-mount zit nu achter `requireAuth` + `requireReviewer`
  (was ongeauthenticeerd; iedereen kon STAM-meldingen indienen — audit jul '26).
- Anon-Supabase-keys staan als fallback in `frontend/src/lib/supabase.ts` en
  `MasterSupabase.ts` (publiek-by-design, maar idealiter env-only).
- Route-aliassen (`/api/integrations/kik|dso`, exact/erp) zijn ongebruikt door
  de frontend; mogelijk voor externe integraties — niet zomaar verwijderen.
