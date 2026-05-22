# Offline-Mode — 8-weken Roadmap

> **Wat dit is:** sprint-roadmap voor het bouwen van de offline-mode parallel aan de huidige cloud-mode. Klant kiest via `tenant_features.offline_mode_enabled`.
> **Versie:** 1.0 · 2026-05-22
> **Voorwaarde:** je hebt `dual-mode-architectuur.md` gelezen.

---

## Realistic-check vooraf

**Budget:** 8 weken solo-werk (Johnny + Claude assistance). Engineering-vuistregel: 50% van timeline gaat naar onverwachte issues. Realistische bandbreedte = **8-12 weken**.

**Pomelli-launch impact:** Pomelli kan parallel draaien op de bestaande cloud-mode. Klanten die in cloud-mode tekenen krijgen geen offline tot week 8+. Klanten die offline willen → wachtlijst.

**Eerste-klant impact:** Eerste 1-3 klanten zullen waarschijnlijk cloud-mode kiezen (eenvoudiger setup, geen download). Offline = USP voor klant #4+.

## Feature-matrix per mode

| Feature | Cloud (nu) | Offline (nieuw) | Bouwen in week |
|---|---|---|---|
| **Foto-capture** | ✅ Direct upload | ✅ Lokaal queue + sync | 1-2 |
| **GPS-metadata** | ✅ Realtime | ✅ Lokaal | 1 |
| **KNMI-weer** | ✅ API-call | ✅ Cache 1×/dag | 2 |
| **Tijdstempel** | ✅ Server-time | ✅ Device-time + drift-correctie | 2 |
| **AI-precheck blur** | ✅ OpenAI Vision | ✅ TensorFlow Lite (lokaal) | 5 |
| **AI-precheck categorie** | ✅ OpenAI Vision | ✅ MobileNet (lokaal) | 5 |
| **AI semantisch begrip** | ✅ OpenAI | ❌ wacht op netwerk | n.v.t. |
| **Dashboard werkvoorbereider** | ✅ Realtime | ⚠️ Last-sync, indicator | 4 |
| **Status-mutaties (akkoord/afkeur)** | ✅ Realtime | ✅ Lokaal + sync | 3 |
| **Notities** | ✅ Realtime | ✅ Lokaal + LWW-conflict-resolution | 3 |
| **PDF-borgingsdossier** | ✅ Backend Node | ✅ pdf-lib client-side | 7 |
| **KiK-koppeling** | ✅ Backend | ❌ alleen cloud — wacht op netwerk | n.v.t. |
| **Auth / login** | ✅ Supabase | ✅ Cached JWT 30d offline-grace | 6 |
| **Branding/logo** | ✅ Cloud-fetch | ✅ Lokaal cache | 6 |
| **Tenant-switch (Maker)** | ✅ Direct | ❌ cloud-only (admin-flow) | n.v.t. |
| **Team-uitnodigen** | ✅ Supabase | ❌ wacht op netwerk | n.v.t. |
| **TenantFeatures toggle** | ✅ Cloud | ⚠️ Lokaal cache, sync 1×/uur | 6 |
| **TenantBranding edit** | ✅ Cloud | ❌ wacht op netwerk | n.v.t. |
| **Real-time presence** ("Jan kijkt mee") | ✅ Supabase Realtime | ❌ uitschakelen | n.v.t. |
| **OCR controlebon** | ⚠️ niet gebouwd | ⚠️ optioneel, week 7-8 | 7-8 |
| **Voice-meldingen TTS** | ⚠️ POC | ❌ cloud-only voorlopig | n.v.t. |

**Conclusie:** ~75% van features werkt in beide modes, 25% blijft cloud-only.

---

## Sprint-roadmap (8 weken)

### Week 1 — Foundation + Repository-pattern

**Doel:** alle data-access via repository's, voorbereiden op dual-mode.

- [ ] Add `offline_mode_enabled` kolom in `tenant_features` (migration)
- [ ] Create `EvidenceRepository` interface + `CloudEvidenceRepository` implementatie (wrap bestaande Supabase-calls)
- [ ] Migrate alle `supabase.from('evidence').*` in schermen naar repo-aanroepen
- [ ] Tests voor repository-interface
- [ ] `useOfflineMode()` hook (leest tenant_features)

**Deliverable:** alles werkt zoals voorheen, maar via repo. Geen visuele wijziging voor klant.

### Week 2 — Lokale storage + capture-engine

**Doel:** foto's lokaal opslaan + sync-queue (zonder UI nog).

- [ ] Install `expo-sqlite` + `expo-file-system`
- [ ] `LocalEvidenceRepository` implementatie (SQLite)
- [ ] Capture-flow: foto → lokale opslag + sync-queue tabel
- [ ] GPS + KNMI-weer cache (1×/dag refresh)
- [ ] MD5-dedupe bij heruploaden
- [ ] Unit-tests voor queue-operaties

**Deliverable:** foto's worden lokaal opgeslagen wanneer offline-mode aan staat. Sync-queue groeit, niets gebeurt nog met de queue.

### Week 3 — Sync-engine basics

**Doel:** queue verwerken zodra netwerk er is.

- [ ] Network-status detectie (online/offline events)
- [ ] Sync-worker: batch-upload foto's + metadata
- [ ] Exponential backoff bij fouten
- [ ] LWW (Last-Write-Wins) voor enkelvoudige conflict-velden
- [ ] Vector-clocks voor multi-user editing
- [ ] Bidirectional sync (cloud → local én local → cloud)
- [ ] Idempotency-keys op alle write-operations

**Deliverable:** offline-foto's syncen automatisch zodra netwerk er is. Geen UI nog.

### Week 4 — Conflict-resolution UI + Werkvoorbereider-dashboard

**Doel:** conflicten worden zichtbaar en oplosbaar.

- [ ] Conflict-detectie tijdens sync
- [ ] Conflict-resolution modal in dashboard
- [ ] "Last-sync"-indicator badge ("Bijgewerkt 12 min geleden")
- [ ] Sync-queue indicator ("3 foto's wachten")
- [ ] Auto-merge waar mogelijk (80% van cases)
- [ ] Handmatig review voor de andere 20%

**Deliverable:** werkvoorbereider ziet sync-status + lost conflicten op. Vakman ziet "wacht op netwerk" indicators.

### Week 5 — Lokale AI-precheck

**Doel:** AI-checks gebeuren on-device.

- [ ] Install `@tensorflow/tfjs-react-native` + delegates
- [ ] Train/bundle compact MobileNet voor foto-categorisatie (fundering/wapening/isolatie/etc.)
- [ ] Blur-detection model (~2MB)
- [ ] On-device inference flow: foto → blur-check + categorie → status
- [ ] Lokale beslissingen markeren ("lokaal beoordeeld" badge)
- [ ] Bij netwerk-terug: cloud-AI kan lokale beslissing aanvullen/overrulen

**Deliverable:** in offline-mode krijgt elke foto direct een lokale AI-status. Sneller dan cloud-mode (~200ms vs 2-4s).

### Week 6 — Auth + Branding offline

**Doel:** klant kan inloggen en gebrand draaien zonder netwerk.

- [ ] JWT-caching met 30-dagen offline-grace
- [ ] Refresh-token retry bij netwerk-terug
- [ ] Tenant-branding (logo + kleur + naam) lokaal cachen
- [ ] TenantFeatures-toggles lokaal cachen, sync 1×/uur
- [ ] Re-auth UI als grace verloopt
- [ ] Tests voor auth-edge-cases

**Deliverable:** offline-klant kan inloggen, ziet eigen branding, gebruikt features zoals normaal — zelfs zonder netwerk voor 30 dagen.

### Week 7 — PDF-borgingsdossier lokaal

**Doel:** dossier-export werkt offline.

- [ ] Install `pdf-lib`
- [ ] PDF-generator client-side: cover + index + foto-pagina's + GPS-kaart + audit-trail
- [ ] Branding (logo, kleur) uit lokale cache
- [ ] Bestand opslaan via expo-sharing
- [ ] Vergelijken met huidige backend-PDF (visueel + content-check)
- [ ] Fallback: als netwerk → backend doet 't (kwaliteits-baseline)

**Deliverable:** klant kan offline een complete PDF genereren. Identiek aan backend-versie.

### Week 8 — UI toggle, klant-onboarding, tests

**Doel:** klant ziet de keuze en kan switchen.

- [ ] TenantFeaturesScreen: toggle "Offline-modus inschakelen" met uitleg
- [ ] First-run wizard: download modellen (40MB) bij activatie
- [ ] Onboarding-tooltip "Offline werkt zoals u verwacht"
- [ ] End-to-end tests: kelder-simulatie (network off → werk → network on → sync)
- [ ] Performance-tests: batterij-impact 1 dag dragen
- [ ] Productie-flag: enable per-tenant, niet wereldwijd in één keer

**Deliverable:** offline-mode is selecteerbaar door klant. Werkt end-to-end.

---

## Kritieke risico's per sprint

| Week | Hoofdrisico | Mitigatie |
|---|---|---|
| 1 | Repository migration breekt bestaande features | Per-scherm tests, geleidelijke migratie |
| 2 | SQLite-performance bij grote datasets | Indexen + paginated queries |
| 3 | Sync-conflicts in edge-cases | LWW + vector-clocks, escaleer naar werkvoorbereider |
| 4 | Werkvoorbereider raakt verward door sync-UI | User-testing met 1 prospect |
| 5 | TensorFlow Lite battery-drain | Inference on-demand, niet continu |
| 6 | JWT expiry mid-project = data-verlies-risico | 30d grace + harde lockout daarna |
| 7 | pdf-lib output verschilt visueel van backend-PDF | Visual-diff tests + design-tokens-consistentie |
| 8 | Klant zet toggle om en raakt data kwijt | Stappen-wizard met confirm, eerst export aanbieden |

## Kosten-impact

**Engineering:**
- Solo-werk Johnny: 8 weken full-time (32 dagen) of 16 weken halftijd
- Met Claude assistance: ~30% efficiënter = 6-8 weken full-time

**Tools:**
- TensorFlow Lite modellen: gratis (open-source)
- expo-sqlite + expo-file-system: gratis
- pdf-lib: gratis (MIT)
- Extra Supabase Storage: gering (cache + sync queues)

**Indirect:**
- 8 weken geen nieuwe features op cloud-mode
- Mogelijk vertraging Pomelli-launch met 4-6 weken
- Eerste klant in cloud-mode = laagdrempelig
- Offline-mode = upsell voor klant #4+

**Niet-financiële kosten:**
- Code-complexiteit verdubbelt (twee paden)
- Onboarding-flow wordt complexer
- Support-vragen verdubbelen mogelijk (klanten verwarren modes)

## Wat NIET in deze roadmap zit

Volgende fasen (na week 8):

- Voice TTS/STT offline (vereist 50MB+ extra modellen)
- KiK-koppeling offline (extern systeem, kan niet)
- AI semantisch begrip offline (te zwaar voor mobile)
- Cross-device sync ("ik werk op tablet, andere kijkt op telefoon")

---

## Beslissing voor Johnny

**Beslis vandaag — eerlijk antwoord op 3 vragen:**

| Vraag | JA betekent | NEE betekent |
|---|---|---|
| 1. Is offline-mode echt een differentiator voor mij? | Bouwen heeft zin | Stoppen, focus op klant-binnenhalen |
| 2. Ben ik bereid 8 weken solo-engineering te investeren zonder gegarandeerde ROI? | Bouwen | Stoppen of opdelen |
| 3. Mag eerste-klant-launch met 4-6 weken vertragen voor deze feature? | Bouwen | Cloud-mode-only voor klant #1-3, dan offline |

**3× JA** → start week 1.
**1× NEE** → herzie scope of fase later.

---

*Versie 1.0 · 2026-05-22 · Spee Solutions*
*Lees parallel: `dual-mode-architectuur.md` voor de tech-laag.*
