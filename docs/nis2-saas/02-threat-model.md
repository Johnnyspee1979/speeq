# SpeeSolutions NIS2 Compliance Dashboard — Threat Model (MVP v1.0)

> **Status:** Draft v0.1 — bij elke nieuwe feature opnieuw bijwerken
> **Scope:** Self-Assessment + Gap-Rapportage SaaS (MVP)
> **Methodiek:** STRIDE per asset/flow + risk-register (kans × impact)

---

## 1. Assets (wat beschermen we?)

| # | Asset | Gevoeligheid | Waarom belangrijk |
|---|---|---|---|
| A1 | Klant-organisatiegegevens (KvK, contact) | Laag-Midden | Identificeerbaar, AVG |
| A2 | Assessment-antwoorden | **Hoog** | Onthullen security-zwaktes van de klant. Goud voor aanvallers. |
| A3 | Bewijsmateriaal (uploads: beleid, screenshots, configs) | **Hoog** | Kan secrets, IP-ranges, namen bevatten |
| A4 | Gegenereerde rapporten (PDF) | **Hoog** | Samenvatting van A2/A3 in handzaam formaat |
| A5 | Audit-log | Midden-Hoog | Bewijs van onze zorgvuldigheid + klant-handelingen |
| A6 | User credentials + sessies | **Hoog** | Toegangspoort tot alles |
| A7 | Service-role / DB-credentials | **Kritiek** | Volledige bypass van tenant-isolatie |
| A8 | Source code + CI-secrets | **Kritiek** | Supply-chain compromise |
| A9 | Klant-betalingsgegevens (fase 2) | Hoog | PCI-scope vermijden via Stripe-hosted |
| A10 | Onze reputatie als security-vendor | **Existentieel** | Eén breach = einde bedrijf |

## 2. Trust boundaries

```
[Internet] ──┬─→ [Vercel Edge / Next.js] ──→ [Supabase API / Postgres / Storage]
             │
             ├─→ [Resend SMTP]
             ├─→ [Sentry ingestion]
             └─→ [Stripe (fase 2)]

[Developer laptop] ─→ [GitHub] ─→ [GitHub Actions] ─→ [Vercel deploy] / [Supabase migrate]
```

**Kritieke boundaries (= waar de meeste fouten zitten):**
1. Browser → Server Action / Route Handler — input validation, authz check
2. Next.js server → Supabase als `service_role` — alleen whitelisted operaties
3. Tenant A's sessie → tenant B's data — RLS is de enige echte muur
4. CI runner → Supabase prod — alleen via migratie-user, niet service-role
5. Dev laptop → prod — verboden direct; alleen via Supabase dashboard met MFA

## 3. Aanvallers (wie?)

| Naam | Motivatie | Capaciteit |
|---|---|---|
| **Ext-Opportunist** | Skids/automated bots | Laag — scant op CVE's, gestolen creds |
| **Ext-Targeted** | Concurrent / aanvaller die A2/A3 wil voor échte aanval op de MKB | Midden — kan phishing, social engineering |
| **Tenant-Insider** | Werknemer van klant A die data van klant B wil zien | Midden — heeft geldige sessie |
| **Customer-Malicious** | Klant die rapport vervalst voor eigen audit | Laag-Midden — toegang tot eigen data |
| **Insider (wij)** | Wijzelf — fout of slecht moment | Hoog (toegang) |
| **Supply-Chain** | Compromised npm dep / GitHub Action | Midden — eenmalig hoge impact |
| **AI-generated bug** | Claude (ik) introduceert subtiele vuln | Hoog kans — daarom SAST/review |

## 4. STRIDE — top threats voor MVP

> Risk-score = Kans (1-5) × Impact (1-5). Alles ≥ 12 = blocker voor go-live.

### T1 — Cross-tenant data leakage (Information Disclosure)
- **Vector:** ontbrekende of foute RLS-policy, `service_role` lekt naar browser, JOIN omzeilt RLS, view zonder `security_invoker`.
- **Impact:** 5 — bedrijfs-einde
- **Kans:** 4 — RLS is foutgevoelig, vooral met AI-code
- **Score:** 20 ⛔
- **Mitigaties:**
  - RLS op élke domein-tabel, geen uitzonderingen.
  - Gedenormaliseerde `organization_id` voor één-niveau policy.
  - **Geautomatiseerde tenant-isolation test-suite in CI** (zie arch §11).
  - Code-review verplicht op elke SQL-migratie en elke `.from()`-call die `service_role` gebruikt.
  - Geen `SECURITY DEFINER` functies zonder uitdrukkelijke review.
  - Views: `WITH (security_invoker=true)`.

### T2 — Service-role key lekkage (EoP)
- **Vector:** committed naar git, in client-bundle, in Sentry-breadcrumb, in error-message, in `console.log`.
- **Impact:** 5 — volledige RLS-bypass
- **Kans:** 3
- **Score:** 15 ⛔
- **Mitigaties:**
  - Gitleaks pre-commit + CI.
  - Sentry `beforeSend` strip Authorization-headers + env-keys uit context.
  - Server-only modules via Next.js `import "server-only"` op alles dat service-role aanraakt.
  - Roteer per kwartaal + bij elk personeels-event.
  - Audit-log op Supabase-niveau geactiveerd voor service-role gebruik.

### T3 — Account takeover (Spoofing)
- **Vector:** phishing van klant-admin, hergebruikt wachtwoord, magic-link onderschept (email-account compromise), session-token gestolen via XSS.
- **Impact:** 4 (tenant-bound)
- **Kans:** 4 (klanten zijn MKB, awareness laag)
- **Score:** 16 ⛔
- **Mitigaties:**
  - **MFA verplicht voor `owner` + `admin`.** Geen ontsnapping.
  - HIBP-check op nieuwe wachtwoorden + zxcvbn ≥ 3.
  - Magic links: 10 min geldig, single-use, gebonden aan UA-prefix.
  - HttpOnly + Secure + SameSite=Lax cookies.
  - Strict CSP (`default-src 'self'`, geen `unsafe-inline`).
  - Audit-log toont alle logins (IP, UA) zichtbaar voor klant.

### T4 — Malicious file upload (Tampering / Code Execution)
- **Vector:** upload van bewijsbestand met embedded macro / SVG met script / oversized file / path-traversal in filename.
- **Impact:** 3-4 (tenant-bound tenzij we het renderen)
- **Kans:** 3
- **Score:** 12 ⚠️
- **Mitigaties:**
  - **MIME-allowlist:** alleen `application/pdf`, `image/png`, `image/jpeg`, `application/vnd.openxmlformats-officedocument.*`, `text/plain`.
  - Max 20 MB per file, max 100 files per assessment, max 1 GB per organisatie.
  - **Server-side MIME-sniffing** (niet vertrouwen op extension/header).
  - SHA256 berekend + opgeslagen.
  - Filename wordt **niet** in storage-path gebruikt — UUID als storage path, originele naam alleen in DB-kolom.
  - Download met `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`.
  - **Geen** server-side rendering, preview of OCR in MVP.
  - Virus-scan (ClamAV via Edge Function) → fase 1.5, niet blocker MVP maar wel in roadmap.

### T5 — PDF-rapport misbruik (Repudiation / Fraud)
- **Vector:** klant past PDF aan en presenteert als "SpeeSolutions verklaart dat wij compliant zijn".
- **Impact:** 4 (reputatie + juridisch)
- **Kans:** 3
- **Score:** 12 ⚠️
- **Mitigaties:**
  - PDF-tekst expliciet: *"Dit is een self-assessment readiness-rapport, geen audit-verklaring. SpeeSolutions B.V. is niet aansprakelijk voor de juistheid van door de klant aangeleverde antwoorden."*
  - Cryptografische **hash** (SHA256) in PDF-footer + **verificatie-URL** `app.speesolutions.com/r/<id>/verify` toont metadata + hash.
  - Watermerk met organisatie-naam + datum + assessment-ID op elke pagina.
  - Geen woord "compliant" of "gecertificeerd" in template — alleen "readiness", "zelfevaluatie", "voorbereid".

### T6 — Supply-chain compromise (Tampering)
- **Vector:** kwaadaardige npm-update (typosquatting, account-takeover van maintainer), gecompromitteerde GitHub Action.
- **Impact:** 5
- **Kans:** 2
- **Score:** 10 ⚠️
- **Mitigaties:**
  - `package-lock.json` committed, `npm ci` in build.
  - Dependabot + Snyk wekelijks, security updates auto-PR.
  - GitHub Actions vastgepind op SHA (`uses: actions/checkout@<sha>`), niet `@v4`.
  - Minimal-deps policy: elke nieuwe dep vereist PR-review met *"waarom geen standard library?"*-vraag.
  - `npm audit --audit-level=high` blokt CI.
  - Branch protection + signed commits (`commit.gpgsign=true`).

### T7 — AI-generated vulnerability (Tampering / EoP)
- **Vector:** Claude schrijft auth-flow met subtiele bug, RLS-policy met logica-fout, server action zonder authz-check, regex DoS, prototype pollution.
- **Impact:** varieert (3-5)
- **Kans:** 4 — bekend zwak punt van LLM-code
- **Score:** 16 ⛔
- **Mitigaties:**
  - **Semgrep** met Next.js + OWASP + Supabase rulesets verplicht groen.
  - **Manual review** verplicht op alle PRs die raken aan: `auth/`, `db/policies/`, `app/api/`, `lib/server-only/`, `migrations/`.
  - Threat-model-driven testcases per feature: schrijf eerst de aanvalstest, dan pas de code.
  - Geen nieuwe crypto, geen eigen JWT-parsing, geen handgeschreven CSRF.
  - Bij twijfel: 2 onafhankelijke AI-runs vergelijken + dan mens.

### T8 — DoS / cost-attack (DoS)
- **Vector:** ongeauthenticeerde signup-flood, PDF-generatie-spam (CPU + Supabase egress), file-upload tot quota-burst.
- **Impact:** 3 (downtime + bill)
- **Kans:** 3
- **Score:** 9
- **Mitigaties:**
  - Rate limiting per IP (signup, login, magic-link, PDF-render) via Upstash Ratelimit op Edge.
  - Hcaptcha op signup en password-reset.
  - PDF-generatie per organisatie: max 10/dag op MVP-tier.
  - Supabase + Vercel **usage-alerts** op 50/75/90% van budget.
  - Hard caps op storage (zie T4).

### T9 — Repudiation / audit-gap (Repudiation)
- **Vector:** klant claimt *"wij hebben dat antwoord nooit gegeven"* of *"jullie hebben ons bewijs gewijzigd"*.
- **Impact:** 3
- **Kans:** 3
- **Score:** 9
- **Mitigaties:**
  - `audit_log` append-only (geen UPDATE/DELETE permissies voor app-user).
  - HMAC-signed log entries (per-day rolling key) → fase 1.5.
  - SHA256 op alle evidence-files, getoond aan klant.
  - Klant kan eigen audit-log exporteren (JSON).

### T10 — AVG-overtreding (Compliance)
- **Vector:** geen geldige verwerkersgrondslag, data buiten EU, geen retentie, geen DPIA, geen DPA-template.
- **Impact:** 4 (AP-boete + reputatie)
- **Kans:** 3
- **Score:** 12 ⚠️
- **Mitigaties:**
  - **Vóór eerste betalende klant:** DPIA afgerond, DPA-template juridisch gereviewd, sub-processor-lijst gepubliceerd, retentie-cron werkend, ROPA bijgehouden.
  - Cookie-banner alleen waar nodig (Plausible cookieless = niet nodig).
  - PII-minimalisatie: geen geboortedatum, geen BSN, geen werknemerslijsten.
  - **Geen** Sentry-events met PII (scrubbing geverifieerd in test).

### T11 — Insider threat (EoP)
- **Vector:** wijzelf maken fout met prod-data, kwaadaardige medewerker (fase 2), gecompromitteerde dev-laptop.
- **Impact:** 4
- **Kans:** 2
- **Score:** 8
- **Mitigaties:**
  - Geen prod-DB op laptops; alleen Supabase dashboard met MFA.
  - Aparte Supabase-projects voor `dev`, `staging`, `prod`.
  - Geen service-role in dev `.env`.
  - Alle prod-changes via PR met review.
  - Audit-log op Supabase dashboard activeren.

### T12 — Phishing-simulatie misbruik (out of MVP scope — risk-register staat al klaar voor fase 2)
- Niet van toepassing in MVP. Genoemd om expliciet te bevestigen: **versturen van email die op phishing lijkt is in v1.0 verboden**, ook intern, ook voor demo's, ook voor sales.

## 5. Risk register samengevat

| ID | Threat | Score | Status MVP-go-live |
|---|---|---|---|
| T1 | Cross-tenant leak | 20 | ⛔ Test-suite verplicht groen |
| T3 | Account takeover | 16 | ⛔ MFA verplicht voor admin/owner |
| T7 | AI-vuln in security-paths | 16 | ⛔ SAST groen + manual review |
| T2 | Service-role leak | 15 | ⛔ Gitleaks groen + Sentry-scrubbing geverifieerd |
| T4 | Malicious upload | 12 | ⚠️ MIME-allowlist + size cap + UUID paths |
| T5 | PDF-misbruik | 12 | ⚠️ Disclaimer + hash + watermerk in template |
| T10 | AVG-overtreding | 12 | ⚠️ DPIA + DPA + ROPA vóór eerste klant |
| T6 | Supply-chain | 10 | ⚠️ Lockfile + Snyk + pinned actions |
| T8 | DoS / cost | 9 | ✅ Rate limit + usage alerts |
| T9 | Audit-gap | 9 | ✅ Append-only audit log |
| T11 | Insider | 8 | ✅ Env-separation + MFA |

**Definitie van "klaar voor go-live met betalende klanten":**
- Alle ⛔-items afgevinkt en getoetst.
- Alle ⚠️-items afgevinkt of expliciet geaccepteerd in risk-acceptance log.
- Externe pentest gepland (kan ná soft-launch maar vóór tweede klant).

## 6. Bewust geaccepteerde risico's

| Risico | Reden | Hercheck |
|---|---|---|
| Geen externe pentest vóór bouw | €0 budget, BAV/T&C als buffer | Bij MRR > €2k of bij 5e klant — wat eerder is |
| Geen virus-scan op uploads in v1.0 | MIME-allowlist + geen rendering server-side dempt risico voldoende voor MVP | Vóór phishing-feature (fase 2) |
| Geen HMAC-signed audit-log in v1.0 | Append-only DB-permissies geven al sterke garantie | Bij eerste enterprise-klantvraag |
| Geen SSO/SAML | Buiten MKB-scope | Bij eerste enterprise-deal |
| Geen 24/7 monitoring | Eenmans-startup, niet realistisch | Bij eerste 10 klanten — overweeg PagerDuty |

## 7. Review-cadans

- **Per PR:** mini-threat-model in PR-description voor features die raken aan: auth, RLS, uploads, PDF, billing.
- **Per maand:** dependency-review, audit-log spot-check, Sentry-trends.
- **Per kwartaal:** dit document opnieuw doorlopen, scores updaten, geaccepteerde risico's herchecken.
- **Bij incident:** post-mortem + threat-model update binnen 7 dagen.

---

*Vorig deliverable:* architectuur (`01-architecture.md`).
*Volgend deliverable:* Postgres-schema + RLS-policies + tenant-isolation test-suite als eerste PR.
