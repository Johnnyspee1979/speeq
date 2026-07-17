# ADR 0001 — Fundament-besluiten: tenant-model, command center, hosting

- **Status:** geaccepteerd
- **Datum:** 17 juli 2026
- **Besluitnemer:** Johnny Spee
- **Aanleiding:** vier-kanten-analyse (`docs/strategie/2026-07-17-vierkanten-analyse.md`) — alle 16 zwaarste bevindingen geverifieerd tegen de code

## Context

Het doelbeeld is: één command center voor Spee Solutions (testen, ontwikkelen,
klanten installeren), per klant een workspace met precies de verkochte modules,
een app die met die workspace praat, op het fundament Supabase (veiligheid),
GitHub (updates) en Vercel (hosting).

De analyse liet zien dat het project op drie punten twee verhalen tegelijk
vertelde. Dit ADR maakt de keuzes definitief.

## Besluit 1 — Tenant-model: één gedeelde Supabase met RLS

**Gekozen:** logische multi-tenancy. Eén Supabase-project, elke datarij een
`tenant_id`, afgedwongen met restrictive RLS-policies (`tenant_fence_*`).

**Geschrapt:** de belofte "fysiek gescheiden Supabase-project per klant" uit
`docs/plans/2026-05-08-SaaS-Architecture-design.md`. De velden
`supabase_url`/`supabase_anon_key` op de `tenants`-rij blijven bestaan als
*optie* voor een toekomstig enterprise-tier, maar zijn geen actief pad; de
`pending`-provisioning-flow wordt niet verder gebouwd.

**Waarom:** de werkelijkheid ís al één gedeelde DB (master = tenant-project =
`kgiuavfvhtdgwuygbyzo`); per-klant projecten betekenen per-klant migraties,
backups, keys en kosten — onhoudbaar voor een eenmanszaak. RLS-isolatie is
aantoonbaar aanwezig; die reproduceerbaar maken (migraties!) is fase 2.

## Besluit 2 — Command center: het in-app MakerDashboardScreen

**Gekozen:** `frontend/src/screens/MakerDashboardScreen.tsx` (gatekeeper-view,
achter login + maker-e-mail-gate, met `MakerNewTenantScreen`-wizard en
`/api/maker/*`-backend) is hét command center en wordt in fase 5 uitgebouwd
(abonnementstatus, module-toggles, checkout-links, onboarding-checklist).

**Gearchiveerd** (zie `_archief/README.md`):
- `admin/` (speeq-cockpit) — kapot gedrift, geen auth, geen deploy;
- `MakerDashboard.tsx` v1 + de `/maker`-bypass-route in `App.tsx`.

**Waarom:** drie halve command centers onderhouden kan niet; de gatekeeper-
versie is de nieuwste, veiligste (JWT + e-mail-allowlist op de backend) en de
enige met een werkende onboarding-wizard. Later kan dit alsnog een aparte
web-app worden — dan door de bestaande schermen te verhuizen, niet door een
vierde versie te beginnen.

## Besluit 3 — Hosting: Railway voor de backend blijft

**Gekozen:** hybride. Frontend (en later www) op Vercel, backend-API op
Railway, data op Supabase. Geen migratie van de Express-API naar Vercel
Functions.

**Waarom:** de API gebruikt long-running werk (cron-jobs, PDF-generatie,
retry-jobs) dat slecht past op serverless; een migratie kost weken en levert
klanten niets op. "GitHub voor updates" wordt ingevuld met CI (testgate) en
auto-deploy naar Railway (fase 4), niet met een hosting-verhuizing.

## Gevolgen

1. Docs die per-klant-DB's beloven zijn hiermee historisch; nieuwe docs
   verwijzen naar dit ADR.
2. Fase 2 exporteert de live-only RLS-primitieven naar migraties en zet
   Supabase CLI + staging op.
3. Fase 4 dwingt entitlements server-side af (`requireFeature`, tenant-id uit
   de JWT i.p.v. de `x-company-id`-header).
