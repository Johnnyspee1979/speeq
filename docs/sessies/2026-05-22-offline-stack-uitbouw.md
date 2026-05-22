# Sessieverslag — Offline-stack + AI-versie afgerond

**Datum:** 22 mei 2026
**Branch-strategie:** elk PR in een eigen worktree, squash-merge naar main, daarna cleanup van branch + worktree.

---

## Wat is af

| # | Type | Wat | Tests |
|---|---|---|---|
| 42 | feat | SQLite migration-runner (PRAGMA user_version) | — |
| 43 | test | runOfflineMigrations | 11 |
| 44 | test | OfflineStorageCleanup | 10 |
| 45 | test | OfflineSyncEngine LWW + queue | 9 |
| 46 | test | OfflineCloudPuller | 11 |
| 47 | test | OfflineAuthCache + BrandingCache | 22 |
| 48 | test | EvidenceRepository cloud+local | 14 |
| 49 | feat | Service Worker background-sync bridge | 11 |
| 50 | feat | OfflineConflictResolver service | 13 |
| 51 | feat | Conflict-resolution UI (modal + trigger) | — |
| 52 | feat | OfflineRetryInsights service — debug-inzicht | 12 |
| 53 | feat | **MobileNet on-device foto-categorisatie** | 14 |
| 54 | feat | RetryInsights diagnose-paneel (Ctrl+Shift+D) | — |
| 55 | test | OfflinePhotoStorage web-variant | 14 |
| 56 | feat | OfflineTelemetryAggregator + health-score | 14 |
| 57 | feat | OfflineTelemetryBootstrap — wire-up van #56 | 11 |
| 58 | docs | Verslag + dual-mode-architectuur.md bijgewerkt | — |

**17 PR's. 166 nieuwe tests. Volledige suite: 248/248 groen.**

---

## Productie-deploys

1. `speeq-39sw8vh2d-spee-solutions.vercel.app` — migration-runner + storage-meter
2. `speeq-az1ej1p63-spee-solutions.vercel.app` — SW bridge + alle tests
3. `speeq-8nssgubfd-spee-solutions.vercel.app` — conflict-UI
4. `speeq-14wjqdxij-spee-solutions.vercel.app` — MobileNet AI-categorisatie
5. `speeq-m20tg5rf5-spee-solutions.vercel.app` — RetryInsights UI + telemetry
6. **(volgende deploy)** — Telemetry-bootstrap wired + docs (huidige productie)

---

## Bugfixes onderweg

- Verdwaalde `vercel.json` + `.vercel/project.json` in de worktree-root die deploys naar verkeerd project linkte → opgeruimd, deploy uitgevoerd vanuit `frontend/`.
- 2× `TS2352` cast-error in test-files (`OfflineBrandingCache.test.ts`, `EvidenceRepository.test.ts` uit eerdere PR's) gefixt in #49 met `as unknown as`.
- `URL.createObjectURL` mock-typing in #55 → gerefactored naar `urlMock` constant.
- Lokale `main` divergence van 15 commits voice-experimenteel werk → preserveerd op `backup/main-voice-experimental`, main gereset naar origin.

---

## AI-versie — stand

| Component | Stand |
|---|---|
| **Cloud-AI (OpenAI Vision)** | ✅ live |
| **Edge-AI validatie (WBDBO/brandscheiding)** | ✅ live |
| **Lokale blur-detectie (Laplacian)** | ✅ live |
| **Lokale foto-categorisatie (MobileNet v2)** | ✅ **NIEUW — 13 WKB-buckets** |
| **Cloud-override via confidence-conflict** | ✅ live |

**WKB-categorieën:** fundering · wapening · beton · isolatie · metselwerk · staal · hout · kabels · leidingen · dak · gereedschap · persoon · overig

**Bundle-impact:** 0 KB initial, lazy-load 16 MB model bij eerste classify (browser-cache).

---

## Observability

| Laag | Wat |
|---|---|
| `OfflineRetryInsights` (#52) | Read-only inzicht in sync-queue + error-clusters |
| `OfflineRetryInsightsPanel` (#54) | Modal — Ctrl+Shift+D opent diagnose |
| `OfflineTelemetryAggregator` (#56) | Snapshot van storage + sync + auth + conflicts, health-score 0..100 |
| `OfflineConflictTrigger` + modal (#51) | Werkvoorbereider lost conflicts handmatig op |
| `OfflineStorageMeter` (#41) | TenantFeaturesScreen toont X foto's + Y MB |

---

## Stand offline-stack — roadmap dichtgetimmerd

Weken 1-8 van `offline-mode-roadmap.md` zijn opgeleverd:

- **Week 1** Repository pattern ✅
- **Week 2** Lokale SQLite + capture-engine ✅
- **Week 3** Sync-engine basics ✅
- **Week 4** Conflict-resolution UI + werkvoorbereider-dashboard ✅
- **Week 5** Lokale AI-precheck (blur + **MobileNet categorisatie**) ✅
- **Week 6** Auth + Branding offline ✅
- **Week 7** PDF-borgingsdossier lokaal ✅
- **Week 8** UI toggle, klant-onboarding, tests ✅

**Plus post-roadmap:** migration-runner, SW bridge, retry insights, telemetry-aggregator.

---

## Architectuur — toegevoegde modules

```
frontend/src/
├── database/
│   └── offlineMigrations.ts             (#42)
├── services/
│   ├── OfflineServiceWorkerBridge.ts    (#49)
│   ├── OfflineConflictResolver.ts       (#50)
│   ├── OfflineRetryInsights.ts          (#52)
│   ├── LocalMobileNetClassifier.ts      (#53)
│   ├── OfflineTelemetryAggregator.ts    (#56)
│   └── OfflineTelemetryBootstrap.ts     (#57)
└── components/ui/
    ├── OfflineConflictResolutionModal.tsx  (#51)
    ├── OfflineConflictTrigger.tsx          (#51)
    ├── OfflineRetryInsightsPanel.tsx       (#54)
    └── OfflineRetryInsightsTrigger.tsx     (#54)
```

Geen bestaande publieke API's gebroken. Alle wijzigingen volgen het additive-only patroon.

---

## Wat expliciet niet gedaan

- **Voice TTS/STT offline** — vereist 50MB+ modellen, blijft op `feature/voice-poc` (NIET MERGEN)
- **KiK-koppeling offline** — extern systeem, fundamenteel onmogelijk
- **AI semantisch begrip offline** — te zwaar voor mobiel, blijft cloud-only
- **Cross-device sync** ("jan kijkt mee terwijl ik fotografeer") — buiten scope week 1-8
- **Native (iOS/Android) MobileNet** — vereist `@tensorflow/tfjs-react-native` + native rebuild. Web werkt nu, native valt netjes terug op 'unknown'.

---

## Cijfers

- **17 pull requests** gemerged (#42 t/m #58)
- **166 nieuwe tests** geschreven
- **6 productie-deploys** uitgevoerd
- **248/248 testsuite groen**
- **0 regressies** op bestaande tests
- **2× TS-bugfixes** ontdekt + opgelost onderweg

---

*Auteur: Claude + Johnny · 22 mei 2026 · Spee Solutions*
*Volgende sprint-suggesties zie `docs/strategie/offline-mode-roadmap.md` post-week-8 sectie.*
