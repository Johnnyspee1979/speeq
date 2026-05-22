# SpeeQ — Dual-Mode Architectuur

> **Wat dit is:** ontwerp-document voor het naast elkaar laten draaien van Cloud-First mode (huidige stack) en Offline-First mode (lokale stack) — klant kiest per tenant.
> **Versie:** 1.0 · 2026-05-22 · scoping vóór bouw

---

## 1. Uitgangspunt

Klant kiest per tenant of hij **Cloud-mode** (huidig, alles cloud) of **Offline-mode** (alles lokaal, sync wanneer netwerk) draait. Toggle in `tenant_features.offline_mode_enabled` (boolean, default false).

Twee modes parallel — niemand wordt gedwongen, beide ondersteund.

## 2. De twee modes naast elkaar

### Cloud-Mode (default — bestaande architectuur)

```
Vakman opent app
   ↓
Frontend (React Native Web) maakt foto
   ↓
Direct upload naar Supabase Storage (per-klant DB in Frankfurt)
   ↓
Backend trigger: AI-precheck via OpenAI Vision
   ↓
Werkvoorbereider beoordeelt in dashboard
   ↓
End-of-project: PDF-export via backend (cloud)
   ↓
Optioneel: KiK-koppeling via backend
```

**Vereist:** continue internet. Werkt nu, in productie sinds mei 2026.

### Offline-Mode (nieuw — opt-in)

```
Vakman opent app (mogelijk in kelder, zonder netwerk)
   ↓
Frontend maakt foto
   ↓
Lokale opslag: IndexedDB (web) / SQLite (native)
   ↓
Lokale AI-precheck: TensorFlow Lite model on-device
   ↓
Foto + metadata in lokale sync-queue
   ↓
[geen netwerk] → wacht
[netwerk terug] → batch-upload + sync-resolution
   ↓
Werkvoorbereider beoordeelt (synct ook offline, conflict-resolution)
   ↓
End-of-project: lokale PDF-generatie (zonder backend)
   ↓
KiK-koppeling: ALLEEN cloud — wacht tot netwerk
```

**Vereist:** eenmalige initial-sync (10-20 MB modellen). Daarna autonoom.

## 3. Architectuur-laag-splitsing

| Laag | Cloud-mode | Offline-mode | Hergebruik? |
|---|---|---|---|
| **UI (React Native)** | Bestaand | Bestaand met enkele state-extra's | 95% ✅ |
| **State management** | React Context + Supabase hooks | React Context + Repository pattern | 70% ✅ |
| **Data layer** | Supabase client direct | Repository abstraction → SQLite of Supabase | nieuw 🆕 |
| **Storage** | Supabase Storage cloud | expo-file-system + Supabase sync | nieuw 🆕 |
| **AI-precheck** | OpenAI Vision API (cloud) | TensorFlow Lite on-device | nieuw 🆕 |
| **PDF-export** | Backend Node.js | pdf-lib client-side | nieuw 🆕 |
| **KiK-koppeling** | Backend (cloud-only) | Cloud-only (wacht op netwerk) | 100% ✅ |
| **Auth** | Supabase Auth (cloud) | Cached JWT + offline-grace | 80% ✅ |
| **Sync-engine** | n.v.t. | CRDT (Yjs) of LWW + vector-clocks | helemaal nieuw 🆕 |

## 4. Het kritieke Repository-pattern

Frontend code mag NIET meer direct `supabase.from('evidence')` aanroepen. Alle data-toegang gaat via een `EvidenceRepository`:

```typescript
interface EvidenceRepository {
  save(evidence: Evidence): Promise<void>;
  list(projectId: string): Promise<Evidence[]>;
  get(id: string): Promise<Evidence | null>;
}

// Twee implementaties:
class CloudEvidenceRepository implements EvidenceRepository { ... }
class LocalEvidenceRepository implements EvidenceRepository { ... }

// Wordt gekozen op basis van tenant_features.offline_mode_enabled
const repo = useEvidenceRepository();
```

Schermen weten NIET in welke mode ze draaien — het repository regelt het. Dat is de scheidings-lijn.

## 5. Sync-strategie (Offline-mode)

**Drie sync-momenten:**

1. **Op-start** — bij app-open: pull alle wijzigingen van laatste 7 dagen.
2. **Foreground-detectie** — netwerk-terug: process queue (FIFO, exponential backoff).
3. **Background-sync** — service worker (web) / background fetch (native).

**Conflict-resolution (twee vakmensen offline + zelfde controlemoment):**

| Conflict-type | Resolutie |
|---|---|
| Twee onafhankelijke foto's van zelfde moment | Beide bewaren — werkvoorbereider beslist |
| Twee edits van dezelfde notitie | Last-Write-Wins met vector-clock |
| Twee verschillende statusen (akkoord/afgekeurd) | Behoud beide, escaleer naar werkvoorbereider |
| Verwijderd offline + bewerkt cloud | Cloud wint (verwijdering rollback) |

## 6. Lokale AI — wat wèl, wat niet

**Wat kan offline (TensorFlow Lite, MobileNet-based):**

| Feature | Model-grootte | Inference-tijd | Battery-impact |
|---|---|---|---|
| Foto-helderheid (blur-detect) | 2 MB | 50ms | minimaal |
| Foto-categorisatie (fundering/wapening/etc.) | 8 MB | 200ms | klein |
| OCR voor controlebon-tekst | 12 MB | 400ms | matig |
| Object-detectie (helm, veiligheidsschoen op foto) | 15 MB | 300ms | matig |

**Wat kan NIET offline (cloud-only):**

- OpenAI Vision (semantische beschrijving)
- Whisper transcriptie (>50 MB lokaal, te zwaar)
- Aangepaste foto-validatie per Wkb-norm (vereist server-update)

**Compromis:** lokale AI doet "snelle filtering" (akkoord/twijfel/afkeur). Bij netwerk-terug: cloud-AI voegt rijkere analyse toe en kan lokale beslissing overrulen.

## 7. PDF-generatie (Offline-mode)

Backend Node.js doet nu de borgingsdossier-PDF. Voor offline-mode:

- **pdf-lib** in de browser/native — kan complete PDF's bouwen client-side
- Logo + branding-kleuren uit lokale tenant_branding cache
- Foto's en GPS uit lokale SQLite
- KNMI-weer offline cache (sync 1x per dag)
- Resultaat: PDF zonder server-call

Werkt zelfs op de bouwplaats zonder netwerk. Daarna sync zodra netwerk er weer is.

## 8. Storage-budgetten lokaal

| Data | Plek | Cap |
|---|---|---|
| Foto's (origineel) | expo-file-system | 1 GB per project, automatische opschoning na 30d cloud-sync |
| Foto-thumbnails | SQLite blob | 50 MB |
| Metadata + audit-trail | SQLite | 100 MB |
| TensorFlow modellen | App bundle | 40 MB eenmalig |
| Cached weer-data | SQLite | 5 MB |
| Cached branding/logo | expo-file-system | 10 MB |

**Totaal:** ~1.2 GB max per tenant. Op standaard 128GB-telefoon: geen probleem. Wel duidelijk in onboarding melden.

## 9. Wat klanten merken van de toggle

### Cloud-mode (zoals nu)

- ✅ Snelle setup, geen download
- ✅ Realtime sync met team
- ❌ Vereist internet
- ❌ AI-precheck duurt 2-4 sec

### Offline-mode (nieuw)

- ✅ Werkt altijd, ook in kelder
- ✅ Lokale AI = milliseconden response
- ✅ Battery iets minder dan cloud (geen radio)
- ❌ Initial download 40MB
- ❌ Sync-conflicten worden zichtbaar in UI
- ❌ Sommige features wachten op netwerk (KiK, advanced AI)

## 10. Migratie-impact op huidige codebase

| Onderdeel | Wijziging |
|---|---|
| `frontend/src/services/*` | Wrap in Repository-pattern |
| Alle `supabase.from(...)` calls in schermen | Verwijderen → vervangen door repo |
| `useEvidenceList()` etc. hooks | Conditional op `useOfflineMode()` |
| Backend services | Geen wijziging — blijven cloud-only |
| `tenant_features` table | Kolom `offline_mode_enabled` toevoegen |
| App-build | Twee bundles: cloud-only (kleiner) + offline-capable (groter) |

**Risico:** 20+ schermen moeten Supabase-calls vervangen door repo-aanroepen. Dat is voorzichtig migrate-werk over 4-6 weken.

## 11. Risico-overzicht

| Risico | Kans | Impact | Mitigatie |
|---|---|---|---|
| Sync-conflicten frustreren gebruikers | Hoog | Matig | Glasheldere UI voor conflict-resolution + auto-merge bij 80% gevallen |
| TensorFlow Lite battery-drain | Matig | Matig | Inference alleen on-demand, niet continu |
| App-grootte schrikt af | Laag | Klein | Lokale modellen lazy-load na eerste capture |
| Klant kiest verkeerde mode | Laag | Laag | Beide modes runnen — switch toggle altijd mogelijk |
| Engineering-tijd 2× boven budget | Hoog | Hoog | 6-weken hard deadline per sprint, scope-cut bij vertraging |
| Backend-load valt weg = inefficient | Klein | Klein | Cloud-mode klanten blijven backend gebruiken |

## 12. Geïmplementeerde modules (status mei 2026)

| Module | PR | Doel |
|---|---|---|
| `database/offlineMigrations.ts` | #42 | SQLite migration-runner met `PRAGMA user_version` — schema-upgrades zonder klant-dataverlies |
| `services/EvidenceRepository.ts` (cloud + local) | sprint 1 | Dual-mode abstractie, schermen hebben geen `supabase.from()` meer |
| `services/OfflineSyncEngine.ts` | sprint 3 | Push-cyclus met LWW + exponential backoff |
| `services/OfflineCloudPuller.ts` | sprint 3 | Pull-cyclus met conflict-detectie via `client_version` |
| `services/OfflinePhotoStorage.ts` | sprint 2 | Platform-aware blob-storage (web: localforage; native: expo-file-system) |
| `services/OfflineAuthCache.ts` | sprint 6 | JWT + 30-dagen offline-grace |
| `services/OfflineBrandingCache.ts` | sprint 6 | Logo dataURL + 1u refresh-policy |
| `services/OfflineStorageCleanup.ts` | sprint 4 | 30d retention + 1000-foto hard-cap |
| `services/OfflineServiceWorkerBridge.ts` | #49 | SW Background Sync → OfflineSyncEngine bridge |
| `services/OfflineConflictResolver.ts` | #50 | `keep-local` / `accept-cloud` resolutie-acties |
| `services/OfflineRetryInsights.ts` | #52 | Read-only sync-queue inzicht, error-clustering |
| `services/LocalAIService.ts` | sprint 5 | Blur-detectie (Laplacian variance) |
| `services/LocalMobileNetClassifier.ts` | #53 | On-device foto-categorisatie, MobileNet v2, 13 WKB-buckets |
| `services/OfflineTelemetryAggregator.ts` | #56 | Snapshot van alle offline-metrics + health-score |
| `services/OfflineTelemetryBootstrap.ts` | #57 | Periodieke runner (1u) — wire-up van #56 |
| `components/ui/OfflineConflictResolutionModal.tsx` | #51 | Werkvoorbereider UI voor conflict-resolutie |
| `components/ui/OfflineConflictTrigger.tsx` | #51 | Floating "X conflicten" knop |
| `components/ui/OfflineRetryInsightsPanel.tsx` | #54 | Diagnose-modal (Ctrl+Shift+D) |
| `components/ui/OfflineRetryInsightsTrigger.tsx` | #54 | Toetsenbord-shortcut handler |
| `components/ui/OfflineStorageMeter.tsx` | sprint 8 | Lokale storage-meter in TenantFeaturesScreen |
| `components/ui/OfflineSyncFloatingBadge.tsx` | sprint 4 | Floating sync-status badge |
| `components/OfflineSyncBootstrap.tsx` | sprint 4 | Top-level lifecycle voor engine + SW bridge + telemetry |

**Test-coverage:** 248/248 groen — alle services unit-tested, UI-components rendering-tested via React-Native-testing patroon.

---

*Versie 1.1 · 2026-05-22 · Spee Solutions*
*Volgende stap: lees ook `offline-mode-roadmap.md` voor sprint-planning.*
