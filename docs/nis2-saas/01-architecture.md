# SpeeSolutions NIS2 Compliance Dashboard — Architectuur (MVP v1.0)

> **Status:** Draft v0.1 — Lead Security Architect (AI-assisted, mens-gereviewd vereist)
> **Scope MVP:** NIS2 Self-Assessment + Gap-Rapportage voor MKB-directiekamer
> **Out of scope MVP:** externe scanning, phishing-simulatie, SSO/SAML, on-prem, mobile-apps
> **Doelgroep:** MKB-toeleveranciers (10–250 medewerkers) van NIS2-plichtige bedrijven, niet de essentiële/belangrijke entiteiten zelf

---

## 1. Product in één paragraaf

Een web-SaaS waarin een MKB-directie binnen ~60 minuten een gestructureerde NIS2-self-assessment doorloopt (gemapped op Art. 21 + relevante ISO27001 Annex A-controls), bewijsmateriaal upload en daarna een Gap-rapport en remediatie-roadmap als PDF downloadt. Het rapport draagt expliciet de naam *"NIS2 Compliance Readiness Assessment"* — geen audit-uitspraak.

## 2. Architectuurprincipes

1. **Tenant-isolatie is de hoogste prioriteit.** Eén bug = einde bedrijf.
2. **Monolithisch waar mogelijk.** Eén Next.js app + Supabase. Geen microservices, geen queue-systemen, geen Kafka. Schaalbaarheid komt later.
3. **Security-defaults aan, opt-out moet expliciet zijn.** MFA, HTTPS, RLS, audit-log, EU-region, encryptie at rest — niets daarvan is een feature flag.
4. **Server is de waarheid.** Geen security-checks in de client. RLS in Postgres is de échte boundary.
5. **AI-gegenereerde code wordt gevalideerd door SAST/SCA + mens.** Geen merge naar `main` zonder groene scans + handmatige review van auth/RLS/file/PDF-code.
6. **Geen feature voordat de threat-modelling-vraag is beantwoord:** *"hoe kan een andere tenant deze functie misbruiken?"*
7. **EU-only.** Data, infrastructuur en sub-processors EU-gevestigd. Geen US-region fallback.

## 3. High-level diagram

```
┌───────────────────────────────────────────────────────────────┐
│                       Vercel (EU region)                      │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Next.js 15 App Router                                  │  │
│  │   • Marketing (RSC, public)                             │  │
│  │   • App (RSC + Server Actions, auth-gated)              │  │
│  │   • Route Handlers (PDF-render, webhooks)               │  │
│  └──────────────────┬──────────────────────────────────────┘  │
└─────────────────────┼─────────────────────────────────────────┘
                      │ HTTPS + JWT (Supabase session)
                      │ NEVER service_role from browser
                      ▼
┌───────────────────────────────────────────────────────────────┐
│                   Supabase (EU region: eu-central-1)          │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│   │  Postgres    │  │  Auth        │  │  Storage         │    │
│   │  + RLS       │  │  (JWT + MFA) │  │  (encrypted)     │    │
│   └──────────────┘  └──────────────┘  └──────────────────┘    │
│   ┌──────────────────────────────────────────────────────┐    │
│   │  Edge Functions: virus-scan, webhook-secrets, PDF    │    │
│   └──────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────┘
        │                       │                        │
        ▼                       ▼                        ▼
   Resend (EU)             Sentry (EU)              Stripe (EU)
   transactional           error tracking           billing (fase 2)
   email only,             (PII scrubbed)
   GEEN phishing
```

## 4. Tech stack — definitieve keuzes voor MVP

| Laag | Keuze | Reden | Bewust afgewezen |
|---|---|---|---|
| Frontend framework | **Next.js 15 (App Router)** | RSC = security boundary, server actions, mature ecosysteem, B2B-dashboard fit | Expo Web (mobile-first, niet nodig); SvelteKit (kleiner ecosysteem voor security-libs) |
| Hosting | **Vercel — Frankfurt (fra1)** | Bestaande relatie, EU edge, gratis hobby-tier voor staging | AWS Amplify (meer beheer); self-host (geen tijd) |
| Auth | **Supabase Auth** + MFA TOTP | JWT, magic links, password+MFA, audit-events | Auth0 (€), Clerk (US-data), custom (= bug factory) |
| DB | **Supabase Postgres — Frankfurt** | RLS native, JSONB, Postgres-volwassen, point-in-time restore | RDS (zelfbeheer), Firestore (geen RLS-equivalent) |
| Storage | **Supabase Storage** met RLS | Encrypted at rest, S3-compatibel, EU | S3 direct (extra IAM-werk), Cloudflare R2 (geen Postgres-RLS-integratie) |
| Email (transactional) | **Resend EU** | EU-region, simple API, EXPLICIET geen phishing-sim toegestaan in MVP | SendGrid (US), AWS SES (verbiedt phishing-sim ook) |
| PDF rendering | **@react-pdf/renderer** server-side | Deterministisch, geen browser-sandbox nodig, geen SSRF-vector | Puppeteer/Playwright (chrome attack surface, SSRF-risico) |
| ORM / DB-laag | **`@supabase/supabase-js`** + raw SQL voor migraties | Werkt mét RLS, geen client-side magic | Prisma (omzeilt RLS), Drizzle (RLS-integratie nog onvolwassen) |
| Migraties | **Supabase CLI** in git | Reproduceerbaar, code-reviewbaar | Hand-edits in dashboard (= geen audit-trail) |
| Validatie | **Zod** | Edge-to-DB schema-consistentie | Yup, Joi |
| Errors | **Sentry EU** (`de1.sentry.io`) | EU-region, PII-scrubbing aan | Datadog (US-default), Bugsnag |
| Analytics | **Plausible Cloud (EU)** | AVG-by-design, geen cookies | GA4 (DPA-issues), PostHog (US) |
| Secrets | **Vercel env + Supabase Vault** voor service-keys | Geen extra dienst, encrypted | Doppler/Infisical (later, als team groeit) |
| CI/CD | **GitHub Actions** | Bestaand, gratis tier ruim, ecosysteem | GitLab CI (migratie-cost) |
| SAST | **Semgrep** (free CE) | Custom rulesets, breed | SonarCloud (zwaarder) |
| SCA | **Dependabot + Snyk free** | Lockfile-monitoring | Renovate (overkill) |
| Secret scanning | **Gitleaks** pre-commit + CI | Voorkomt service_role leaks | trufflehog (overlap) |
| Tenant-isolatie tests | **Custom Postgres test suite** in CI | RLS-policies regression-testen | n.v.t. |
| Domeinen | Marketing: `speesolutions.com` · App: `app.speesolutions.com` | Sub-domein scheidt cookies/security context | Single domain (cookie-bleed risico) |

## 5. Tenant-model

**Definities:**
- **Organization** = klant-bedrijf (de MKB-onderneming die zich abonneert).
- **User** = natuurlijk persoon, kan lid zijn van **meerdere** organisaties (bv. een externe adviseur).
- **Membership** = (user, organization, role) — de enige plek waar tenant-toegang wordt bepaald.

**Rollen MVP:**
| Rol | Rechten |
|---|---|
| `owner` | Alles + facturering + organisatie verwijderen |
| `admin` | Alles binnen organisatie behalve facturering |
| `contributor` | Assessments invullen, bewijs uploaden |
| `viewer` | Read-only (voor auditor/leverancier in fase 2) |

**Tenant-isolatie regels (NIET ONDERHANDELBAAR):**
1. Elke domein-tabel heeft een `organization_id uuid NOT NULL` kolom.
2. Elke domein-tabel heeft een RLS-policy `USING (organization_id IN (SELECT organization_id FROM memberships WHERE user_id = auth.uid()))`.
3. `service_role` key wordt **nooit** in de frontend gebruikt, **nooit** in een Edge Function die door een gebruiker aanroepbaar is zonder server-side wrapping.
4. Cross-tenant-test-suite draait in CI: maakt twee tenants, probeert elke tabel cross-tenant te benaderen, faalt bij élke leak.
5. Geen `bypassrls`-rollen voor de applicatie-user. Migratie-user is apart.

## 6. Datamodel — kerntabellen (MVP)

```
organizations
  id (uuid, pk), name, kvk_number, created_at, plan_id, deleted_at

memberships
  user_id (fk auth.users), organization_id (fk), role (enum), created_at
  PRIMARY KEY (user_id, organization_id)

frameworks                        -- immutable, versioned
  id (uuid, pk), code (text), version (text), title, published_at
  UNIQUE (code, version)

framework_controls                -- de "vragen"
  id (uuid, pk), framework_id (fk), code (text), title, description,
  category, guidance_md, evidence_required (bool), display_order

assessments
  id (uuid, pk), organization_id (fk), framework_id (fk), title,
  started_at, completed_at, current_step, created_by

assessment_responses
  id (uuid, pk), assessment_id (fk), control_id (fk),
  organization_id (fk, denormalized voor RLS),
  status (enum: not_started|in_progress|implemented|not_applicable),
  maturity_level (smallint 0-5), notes_md, answered_by, answered_at

evidence_files
  id (uuid, pk), response_id (fk), organization_id (fk, denorm),
  storage_path, mime, size_bytes, sha256, uploaded_by, uploaded_at

reports
  id (uuid, pk), assessment_id (fk), organization_id (fk, denorm),
  storage_path (pdf), generated_at, hash_sha256, version

audit_log                         -- append-only
  id (bigserial, pk), organization_id (fk, nullable for global events),
  actor_user_id, action (text), target_type, target_id,
  ip_address (inet), user_agent (text), metadata (jsonb), occurred_at

invitations
  id (uuid, pk), organization_id (fk), email, role, token_hash,
  invited_by, expires_at, accepted_at
```

**Belangrijke design-keuzes:**
- `organization_id` wordt **gedenormaliseerd** in elke afgeleide tabel (responses, evidence, reports). Dit maakt RLS-policies eenvoudig (één-niveau check) en performant (geen joins in policy).
- `frameworks` en `framework_controls` zijn **immutable** en globaal (`organization_id` is `NULL`). Versionering via `(code, version)`.
- `audit_log` is **append-only** (geen UPDATE/DELETE-rechten voor app-user; alleen INSERT).
- `evidence_files.sha256` is verplicht — voor integriteitscheck en deduplicatie.

## 7. Authenticatie & autorisatie

- **Authenticatie:** Supabase Auth, email+password met **verplichte TOTP-MFA voor `owner` en `admin`**. Magic links toegestaan, maximaal 10 minuten geldig, single-use.
- **Sessie:** 8 uur idle timeout, 24 uur absolute timeout, rotated refresh tokens.
- **Wachtwoorden:** zxcvbn score ≥ 3, geen rotatie-eis (modern advies), `pwned-passwords` check tegen HIBP.
- **Autorisatie:** RLS in Postgres is de boundary. UI-checks zijn alleen UX, niet beveiliging. Server actions valideren rol opnieuw vóór state changes.
- **Service-role:** alleen in server-side Route Handlers, alleen voor expliciet whitelisted operaties (PDF-generatie, audit-log inserts). NOOIT als fallback.
- **Brute-force:** Supabase rate-limiting + Vercel WAF + applicatie-laag rate limit per IP en per email.

## 8. Secrets

| Soort secret | Opslag | Toegang |
|---|---|---|
| Supabase `anon` key | Vercel env (NEXT_PUBLIC_) | Browser OK |
| Supabase `service_role` | Vercel env (server-only) | Alleen Route Handlers |
| Resend API key | Vercel env (server-only) | Email-modules |
| Stripe secrets | Vercel env (server-only) | Billing-modules (fase 2) |
| DB-migratie credentials | GitHub Actions secret | CI-only, niet in dev `.env` |
| Webhook signing secrets | Supabase Vault | Edge Functions |

**Regels:**
- `.env.example` in git, `.env` in `.gitignore`, gitleaks blokkeert commits met secrets.
- Roteer service_role bij verdenking + ieder kwartaal.
- Geen secrets in Sentry breadcrumbs (PII-scrubbing op `Authorization`-header, etc.).

## 9. CI/CD pipeline (verplicht groen voor merge)

```
push → GitHub Actions:
  1. Install + typecheck (tsc --noEmit)
  2. Lint (eslint + prettier --check)
  3. Unit tests (vitest)
  4. SAST: Semgrep met OWASP + Supabase + Next.js rulesets
  5. SCA: npm audit --audit-level=high + Snyk test
  6. Secret scan: gitleaks
  7. Migratie-dry-run tegen ephemeral Postgres
  8. Tenant-isolatie test suite (zie §11)
  9. Build (next build)
  10. Preview deploy → Vercel preview env
```

Branch protection op `main`: required reviews ≥ 1 (mens), required checks = alle bovenstaande, geen force push.

## 10. Observability

- **Sentry EU** met `beforeSend` hook die PII strip (email, namen, IP). Sampling 100% errors, 10% traces.
- **Audit log** in DB voor security-relevante events (login, role-change, evidence-upload, report-generation, invite, settings-change).
- **Supabase logs** retentie verlengen naar 30 dagen (paid tier).
- **Status page** publiek (statuspage.io free of betterstack) zodra eerste klant live.
- **Geen** analytics-trackers met cookies in MVP. Plausible (cookieless) voor marketing-pagina alleen.

## 11. Tenant-isolatie test suite (verplicht in CI)

Een geautomatiseerde test die bij elke PR:
1. Twee organisaties + twee users met memberships maakt.
2. Vult tenant A met test-data (assessment, responses, evidence, report).
3. Probeert vanuit de sessie van tenant B élke `SELECT/UPDATE/DELETE` op tenant A's rijen.
4. Faalt als ook maar één rij zichtbaar of muteerbaar is.
5. Test ook storage paths (kan tenant B een file uit tenant A's storage-bucket downloaden?).
6. Test PDF-rapport-URLs (path-traversal).

Deze test mag **nooit** als "flaky" worden gemarkeerd of geskipped. Een rode tenant-isolation-test = automatische block op merge én notificatie naar CEO.

## 12. AVG / data-residency

- Alle data in EU. Supabase-project in `eu-central-1`. Resend EU. Sentry `de1.sentry.io`. Vercel functions in `fra1`.
- **Sub-processor lijst** gepubliceerd op `speesolutions.com/sub-processors` voor klanten.
- **DPA-template** beschikbaar als download + getekend per klant vóór go-live.
- **DPIA** (Data Protection Impact Assessment) uitgevoerd door CEO + risk-acceptance gedocumenteerd vóór eerste betalende klant.
- **Retentie:** klant-data 30 dagen na opzegging, dan harde delete (cron). Audit-log 7 jaar (bewijswaarde).
- **Data-export** per klant: één-klik JSON+PDF download (recht op dataportabiliteit).
- **Recht op verwijdering:** SLA 30 dagen, gedocumenteerd in audit-log.

## 13. Schaalbaarheid — wanneer waarover zorgen

| Fase | Aantal klanten | Bottleneck om naar te kijken | Actie |
|---|---|---|---|
| 0–10 | MVP | Geen, focus op stabiliteit | Supabase free/pro, Vercel hobby |
| 10–50 | Product-market fit | DB connection pooling, Storage egress | Supabase Pro, pgbouncer settings |
| 50–200 | Groei | PDF-generatie pieklasten, audit-log bloat | Background queue (Inngest of Supabase queues), audit-log partitioning |
| 200+ | Schaal | Read-replicas, multi-region staging | Architecture-review moment, niet vooruit ontwerpen |

**Bewust NIET vooruit ontworpen:** queues, microservices, multi-region writes, edge compute voor business logic, GraphQL. YAGNI.

## 14. Risk-acceptance log (CEO-besluiten)

| Datum | Risico | Besluit | Mitigatie |
|---|---|---|---|
| 2026-05-14 | Geen externe security review vóór bouw | CEO accepteert; vervangen door BAV + T&C's + SAST/SCA | Externe pentest **verplicht** vóór eerste betalende klant. €5k gereserveerd zodra MRR > €2k. |
| 2026-05-14 | AI schrijft significant deel van de code | Geaccepteerd | Semgrep + Snyk + Gitleaks + tenant-isolation-tests + manual review op auth/RLS/file/PDF-changes |
| 2026-05-14 | Geen phishing-simulatie in MVP | Geaccepteerd | Roadmap fase 2, niet eerder dan na pentest + DPA-uitbreiding + provider-keuze |

## 15. Open vragen voor CEO

1. **Repo-keuze:** nieuwe repo `speesolutions-nis2` of in deze repo onder `apps/nis2-dashboard/`? Mijn advies blijft: nieuwe repo (clean security boundary, eigen CI, eigen secrets).
2. **Domein:** `app.speesolutions.com` of aparte productnaam (`spee.security`, `compliancekompas.nl`, etc.)? Heeft impact op cookies/CSP.
3. **Framework-canon:** beginnen we met NIS2 Art. 21 (10 maatregelen) + ISO27001 Annex A subset, of pure NIS2? Zal de framework-tabel definiëren.
4. **Aantal vragen in MVP:** target 30–40 vragen, of dieper (60+)? Beïnvloedt "60 minuten"-belofte.
5. **Wie wordt menselijke reviewer** voor AI-output op auth/RLS/PDF-code? Als jij dat zelf doet: prima, maar dat moet **expliciet** worden vastgelegd.

---

*Volgend deliverable:* threat model (`02-threat-model.md`), dan database-migratie + RLS-policies in een PR.
