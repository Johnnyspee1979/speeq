import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { INSPECTION_PRESETS, PROJECT_PRESETS } from '../config/presets';
import type {
  EvidenceSyncStatus,
  StoredWkbEvidence,
  WkbEvidence,
} from '../types/Evidence';

export type Evidence = StoredWkbEvidence;
export type PresetType = 'project' | 'inspection';

export type PresetRow = {
  type: PresetType;
  value: string;
};

export type DsoLogRow = {
  id?: number;
  reference_id: string;
  status: string;
  created_at: string;
};

export type PunchlistSyncStatus = 'PENDING' | 'SYNCED';
export type SyncQueueStatus = 'PENDING' | 'FAILED';

export type StoredPunchlistItem = {
  id: string;
  title: string;
  checked: boolean;
  updatedAt: string | null;
  syncStatus: PunchlistSyncStatus;
};

export type StoredGereedmeldingItem = {
  id: string;
  title: string;
  checked: boolean;
  updatedAt: string | null;
  syncStatus: PunchlistSyncStatus;
};

export type StoredConsumerDossierItem = {
  id: string;
  title: string;
  checked: boolean;
  updatedAt: string | null;
  syncStatus: PunchlistSyncStatus;
};

export type ConsumerDossierDocumentCategory =
  | 'AS_BUILT'
  | 'MATERIALS'
  | 'USAGE_FUNCTIONS'
  | 'MANUALS'
  | 'MAINTENANCE'
  | 'WARRANTIES'
  | 'CONTRACT_DEVIATIONS';

export type StoredConsumerDossierDocument = {
  id: string;
  requirementId: string;
  title: string;
  category: ConsumerDossierDocumentCategory;
  referenceValue: string;
  notes: string;
  updatedAt: string | null;
  syncStatus: PunchlistSyncStatus;
};

type EvidenceRow = {
  id?: number;
  evidence_id?: string | null;
  project_id?: string | null;
  inspection_point_id?: string | null;
  media_uri?: string | null;
  photo_uri?: string | null;
  timestamp: string;
  latitude: number;
  longitude: number;
  gps_accuracy?: number | null;
  exif_hash?: string | null;
  exif_verified?: number | null;
  user_id?: string | null;
  field_note?: string | null;
  stop_moment_confirmed?: number | null;
  measurement_tool_confirmed?: number | null;
  location_verified?: number | null;
  location_spoof_risk?: string | null;
  location_security_message?: string | null;
  sync_status?: EvidenceSyncStatus | null;
  synced?: number | null;
  ai_status?: StoredWkbEvidence['aiStatus'] | null;
  ai_confidence?: number | null;
  ai_notes?: string | null;
  cloud_record_id?: number | null;
  etage?: string | null;
  huisnummer?: string | null;
  ruimtenummer?: string | null;
  binnenbuiten?: string | null;
  locatie_detail?: string | null;
  weather_label?: string | null;
  floor_plan_id?: string | null;
  pin_x?: number | null;
  pin_y?: number | null;
  review_status?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
};

type PunchlistRow = {
  item_id: string;
  title: string;
  checked: number;
  updated_at?: string | null;
  sync_status?: PunchlistSyncStatus | null;
};

type GereedmeldingRow = {
  item_id: string;
  title: string;
  checked: number;
  updated_at?: string | null;
  sync_status?: PunchlistSyncStatus | null;
};

type ConsumerDossierRow = {
  item_id: string;
  title: string;
  checked: number;
  updated_at?: string | null;
  sync_status?: PunchlistSyncStatus | null;
};

type ConsumerDossierDocumentRow = {
  document_id: string;
  requirement_id: string;
  title: string;
  category: ConsumerDossierDocumentCategory;
  reference_value?: string | null;
  notes?: string | null;
  updated_at?: string | null;
  sync_status?: PunchlistSyncStatus | null;
};

type WebStore = {
  getItem<T>(key: string): Promise<T | null>;
  setItem<T>(key: string, value: T): Promise<T>;
};

type WebDatabaseState = {
  evidence: StoredWkbEvidence[];
  syncQueue: SyncQueueEntry[];
  presets: PresetRow[];
  dsoLogs: DsoLogRow[];
  punchlistByProject: Record<string, StoredPunchlistItem[]>;
  gereedmeldingByProject: Record<string, StoredGereedmeldingItem[]>;
  consumerDossierByProject: Record<string, StoredConsumerDossierItem[]>;
  consumerDossierDocumentsByProject: Record<string, StoredConsumerDossierDocument[]>;
  nextEvidenceRowId: number;
  nextDsoLogId: number;
};

type SyncQueueEntry = {
  evidenceRowId: number;
  evidenceId: string;
  status: SyncQueueStatus;
  retryCount: number;
  lastError: string | null;
  lastAttemptAt: string | null;
  updatedAt: string;
};

type DatabaseAdapter = {
  initDatabase(): Promise<void>;
  saveEvidenceLocally(evidence: WkbEvidence): Promise<number | undefined>;
  getAllEvidence(): Promise<StoredWkbEvidence[]>;
  getUnsyncedEvidence(): Promise<StoredWkbEvidence[]>;
  markEvidenceSyncedWithCloudId(
    rowId: number,
    cloudRecordId: number | null
  ): Promise<void>;
  markEvidenceSyncFailed(rowId: number): Promise<void>;
  updateEvidenceAiStatus(
    rowId: number,
    status: StoredWkbEvidence['aiStatus'],
    confidence: StoredWkbEvidence['aiConfidence'],
    notes: StoredWkbEvidence['aiNotes']
  ): Promise<void>;
  updateEvidenceAiStatusByCloudId(
    cloudRecordId: number,
    status: StoredWkbEvidence['aiStatus'],
    confidence: StoredWkbEvidence['aiConfidence'],
    notes: StoredWkbEvidence['aiNotes']
  ): Promise<void>;
  getProjectPresets(): Promise<string[]>;
  getInspectionPresets(): Promise<string[]>;
  addPreset(type: PresetType, value: string): Promise<void>;
  removePreset(type: PresetType, value: string): Promise<void>;
  getAllPresets(): Promise<PresetRow[]>;
  getPunchlistItems(projectId: string): Promise<StoredPunchlistItem[]>;
  savePunchlistItems(
    projectId: string,
    items: Array<Pick<StoredPunchlistItem, 'id' | 'title' | 'checked'>>
  ): Promise<string>;
  getGereedmeldingItems(projectId: string): Promise<StoredGereedmeldingItem[]>;
  saveGereedmeldingItems(
    projectId: string,
    items: Array<Pick<StoredGereedmeldingItem, 'id' | 'title' | 'checked'>>
  ): Promise<string>;
  getConsumerDossierItems(projectId: string): Promise<StoredConsumerDossierItem[]>;
  saveConsumerDossierItems(
    projectId: string,
    items: Array<Pick<StoredConsumerDossierItem, 'id' | 'title' | 'checked'>>
  ): Promise<string>;
  getConsumerDossierDocuments(
    projectId: string
  ): Promise<StoredConsumerDossierDocument[]>;
  saveConsumerDossierDocuments(
    projectId: string,
    items: Array<
      Pick<
        StoredConsumerDossierDocument,
        'id' | 'requirementId' | 'title' | 'category' | 'referenceValue' | 'notes'
      >
    >
  ): Promise<string>;
  markPunchlistItemsSynced(projectId: string): Promise<void>;
  markGereedmeldingItemsSynced(projectId: string): Promise<void>;
  markConsumerDossierItemsSynced(projectId: string): Promise<void>;
  markConsumerDossierDocumentsSynced(projectId: string): Promise<void>;
  insertDsoLog(entry: DsoLogRow): Promise<void>;
  getDsoLogs(): Promise<DsoLogRow[]>;
};

const isWeb = Platform.OS === 'web';
const DB_NAME = 'wkb_evidence.db';
const WEB_DATABASE_NAME = 'wkb-snap-sync';
const WEB_STORE_NAME = 'wkb_database';
const WEB_STATE_KEY = 'state';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let webStorePromise: Promise<WebStore> | null = null;
let watermelonInitPromise: Promise<boolean> | null = null;

const getDefaultPresetRows = (): PresetRow[] => [
  ...PROJECT_PRESETS.map((value) => ({ type: 'project' as const, value })),
  ...INSPECTION_PRESETS.map((value) => ({ type: 'inspection' as const, value })),
];

const sortPresetRows = (rows: PresetRow[]) =>
  [...rows].sort(
    (a, b) => a.type.localeCompare(b.type) || a.value.localeCompare(b.value)
  );

const sortEvidenceNewestFirst = (rows: StoredWkbEvidence[]) =>
  [...rows].sort(
    (a, b) =>
      b.timestamp.localeCompare(a.timestamp) || (b.rowId ?? 0) - (a.rowId ?? 0)
  );

const sortEvidenceOldestFirst = (rows: StoredWkbEvidence[]) =>
  [...rows].sort(
    (a, b) =>
      a.timestamp.localeCompare(b.timestamp) || (a.rowId ?? 0) - (b.rowId ?? 0)
  );

const sortLogsNewestFirst = (rows: DsoLogRow[]) =>
  [...rows].sort(
    (a, b) =>
      b.created_at.localeCompare(a.created_at) || (b.id ?? 0) - (a.id ?? 0)
  );

const sortSyncQueueOldestFirst = (rows: SyncQueueEntry[]) =>
  [...rows].sort(
    (a, b) =>
      a.updatedAt.localeCompare(b.updatedAt) || a.evidenceRowId - b.evidenceRowId
  );

const normalizeEvidence = (evidence: StoredWkbEvidence): StoredWkbEvidence => ({
  rowId: evidence.rowId,
  id: evidence.id,
  projectId: evidence.projectId,
  inspectionPointId: evidence.inspectionPointId,
  mediaUri: evidence.mediaUri,
  timestamp: evidence.timestamp,
  latitude: evidence.latitude,
  longitude: evidence.longitude,
  gpsAccuracy: evidence.gpsAccuracy ?? null,
  exifHash: evidence.exifHash,
  exifVerified: Boolean(evidence.exifVerified),
  userId: evidence.userId ?? null,
  fieldNote: evidence.fieldNote ?? null,
  stopMomentConfirmed:
    typeof evidence.stopMomentConfirmed === 'boolean'
      ? evidence.stopMomentConfirmed
      : null,
  measurementToolConfirmed:
    typeof evidence.measurementToolConfirmed === 'boolean'
      ? evidence.measurementToolConfirmed
      : null,
  locationVerified:
    typeof evidence.locationVerified === 'boolean' ? evidence.locationVerified : null,
  locationSpoofRisk: evidence.locationSpoofRisk ?? null,
  locationSecurityMessage: evidence.locationSecurityMessage ?? null,
  syncStatus: evidence.syncStatus,
  aiStatus: evidence.aiStatus ?? 'PENDING',
  aiConfidence: evidence.aiConfidence ?? null,
  aiNotes: evidence.aiNotes ?? null,
  cloudRecordId: evidence.cloudRecordId ?? null,
  floorPlanId: evidence.floorPlanId ?? null,
  pinX: evidence.pinX ?? null,
  pinY: evidence.pinY ?? null,
  huisnummer: evidence.huisnummer ?? null,
  reviewStatus: evidence.reviewStatus ?? null,
  reviewedBy: evidence.reviewedBy ?? null,
  reviewedAt: evidence.reviewedAt ?? null,
  reviewNote: evidence.reviewNote ?? null,
});

const normalizePunchlistItem = (
  item: StoredPunchlistItem
): StoredPunchlistItem => ({
  id: item.id,
  title: item.title,
  checked: Boolean(item.checked),
  updatedAt: item.updatedAt ?? null,
  syncStatus: item.syncStatus === 'SYNCED' ? 'SYNCED' : 'PENDING',
});

const normalizeGereedmeldingItem = (
  item: StoredGereedmeldingItem
): StoredGereedmeldingItem => ({
  id: item.id,
  title: item.title,
  checked: Boolean(item.checked),
  updatedAt: item.updatedAt ?? null,
  syncStatus: item.syncStatus === 'SYNCED' ? 'SYNCED' : 'PENDING',
});

const normalizeConsumerDossierItem = (
  item: StoredConsumerDossierItem
): StoredConsumerDossierItem => ({
  id: item.id,
  title: item.title,
  checked: Boolean(item.checked),
  updatedAt: item.updatedAt ?? null,
  syncStatus: item.syncStatus === 'SYNCED' ? 'SYNCED' : 'PENDING',
});

const normalizeConsumerDossierDocument = (
  item: StoredConsumerDossierDocument
): StoredConsumerDossierDocument => ({
  id: item.id,
  requirementId: item.requirementId,
  title: item.title,
  category: item.category,
  referenceValue: item.referenceValue ?? '',
  notes: item.notes ?? '',
  updatedAt: item.updatedAt ?? null,
  syncStatus: item.syncStatus === 'SYNCED' ? 'SYNCED' : 'PENDING',
});

const normalizeSyncQueueEntry = (entry: SyncQueueEntry): SyncQueueEntry => ({
  evidenceRowId: entry.evidenceRowId,
  evidenceId: entry.evidenceId,
  status: entry.status === 'FAILED' ? 'FAILED' : 'PENDING',
  retryCount: Number.isFinite(entry.retryCount) ? entry.retryCount : 0,
  lastError: entry.lastError ?? null,
  lastAttemptAt: entry.lastAttemptAt ?? null,
  updatedAt: entry.updatedAt,
});

const buildDefaultWebState = (): WebDatabaseState => ({
  evidence: [],
  syncQueue: [],
  presets: sortPresetRows(getDefaultPresetRows()),
  dsoLogs: [],
  punchlistByProject: {},
  gereedmeldingByProject: {},
  consumerDossierByProject: {},
  consumerDossierDocumentsByProject: {},
  nextEvidenceRowId: 1,
  nextDsoLogId: 1,
});

const ensureWebState = (
  rawState?: Partial<WebDatabaseState> | null
): WebDatabaseState => {
  const defaults = buildDefaultWebState();
  const presetMap = new Map<string, PresetRow>();
  const presetSource =
    Array.isArray(rawState?.presets) && rawState.presets.length > 0
      ? rawState.presets
      : defaults.presets;

  for (const preset of presetSource) {
    if ((preset.type === 'project' || preset.type === 'inspection') && preset.value) {
      presetMap.set(`${preset.type}:${preset.value}`, {
        type: preset.type,
        value: preset.value,
      });
    }
  }

  const evidence = Array.isArray(rawState?.evidence)
    ? rawState.evidence.map(normalizeEvidence)
    : defaults.evidence;
  const dsoLogs = Array.isArray(rawState?.dsoLogs)
    ? rawState.dsoLogs.map((entry) => ({
        id: typeof entry.id === 'number' ? entry.id : undefined,
        reference_id: entry.reference_id,
        status: entry.status,
        created_at: entry.created_at,
      }))
    : defaults.dsoLogs;
  const syncQueue = Array.isArray(rawState?.syncQueue)
    ? rawState.syncQueue
        .filter(
          (entry) =>
            typeof entry?.evidenceRowId === 'number' &&
            typeof entry?.evidenceId === 'string' &&
            typeof entry?.updatedAt === 'string'
        )
        .map((entry) => normalizeSyncQueueEntry(entry as SyncQueueEntry))
    : defaults.syncQueue;

  const punchlistByProject = Object.fromEntries(
    Object.entries(rawState?.punchlistByProject ?? {}).map(([projectId, items]) => [
      projectId,
      Array.isArray(items)
        ? items.map(normalizePunchlistItem).sort((a, b) => a.id.localeCompare(b.id))
        : [],
    ])
  );

  const gereedmeldingByProject = Object.fromEntries(
    Object.entries(rawState?.gereedmeldingByProject ?? {}).map(
      ([projectId, items]) => [
        projectId,
        Array.isArray(items)
          ? items
              .map(normalizeGereedmeldingItem)
              .sort((a, b) => a.id.localeCompare(b.id))
          : [],
      ]
    )
  );

  const consumerDossierByProject = Object.fromEntries(
    Object.entries(rawState?.consumerDossierByProject ?? {}).map(
      ([projectId, items]) => [
        projectId,
        Array.isArray(items)
          ? items
              .map(normalizeConsumerDossierItem)
              .sort((a, b) => a.id.localeCompare(b.id))
          : [],
      ]
    )
  );

  const consumerDossierDocumentsByProject = Object.fromEntries(
    Object.entries(rawState?.consumerDossierDocumentsByProject ?? {}).map(
      ([projectId, items]) => [
        projectId,
        Array.isArray(items)
          ? items
              .map(normalizeConsumerDossierDocument)
              .sort((a, b) => a.id.localeCompare(b.id))
          : [],
      ]
    )
  );

  const maxEvidenceRowId = evidence.reduce(
    (current, item) => Math.max(current, item.rowId ?? 0),
    0
  );
  const maxDsoLogId = dsoLogs.reduce(
    (current, item) => Math.max(current, item.id ?? 0),
    0
  );

  return {
    evidence,
    syncQueue: sortSyncQueueOldestFirst(syncQueue),
    presets: sortPresetRows(Array.from(presetMap.values())),
    dsoLogs: sortLogsNewestFirst(dsoLogs),
    punchlistByProject,
    gereedmeldingByProject,
    consumerDossierByProject,
    consumerDossierDocumentsByProject,
    nextEvidenceRowId: Math.max(rawState?.nextEvidenceRowId ?? 1, maxEvidenceRowId + 1),
    nextDsoLogId: Math.max(rawState?.nextDsoLogId ?? 1, maxDsoLogId + 1),
  };
};

const getWebStore = async (): Promise<WebStore> => {
  if (!isWeb) {
    throw new Error('Web store kan alleen op web worden gebruikt.');
  }

  if (!webStorePromise) {
    webStorePromise = import('localforage').then(({ default: localforage }) =>
      localforage.createInstance({
        name: WEB_DATABASE_NAME,
        storeName: WEB_STORE_NAME,
      })
    );
  }

  return webStorePromise;
};

const readWebState = async (): Promise<WebDatabaseState> => {
  const store = await getWebStore();
  const state = await store.getItem<WebDatabaseState>(WEB_STATE_KEY);
  return ensureWebState(state);
};

const writeWebState = async (state: WebDatabaseState) => {
  const store = await getWebStore();
  const nextState = ensureWebState(state);
  await store.setItem(WEB_STATE_KEY, nextState);
};

const upsertSyncQueueEntry = (
  queue: SyncQueueEntry[],
  nextEntry: SyncQueueEntry
): SyncQueueEntry[] =>
  sortSyncQueueOldestFirst([
    normalizeSyncQueueEntry(nextEntry),
    ...queue.filter((entry) => entry.evidenceRowId !== nextEntry.evidenceRowId),
  ]);

const getDatabase = async () => {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DB_NAME);
  }

  return databasePromise;
};

const mapSyncStatus = (
  syncStatus?: EvidenceSyncStatus | null,
  synced?: number | null
): EvidenceSyncStatus => {
  if (syncStatus === 'SYNCED' || syncStatus === 'FAILED' || syncStatus === 'PENDING') {
    return syncStatus;
  }

  return synced ? 'SYNCED' : 'PENDING';
};

const mapLocationSpoofRisk = (
  value?: string | null
): StoredWkbEvidence['locationSpoofRisk'] => {
  const normalized = value?.trim().toUpperCase();

  if (normalized === 'LOW' || normalized === 'MEDIUM' || normalized === 'HIGH') {
    return normalized;
  }

  return null;
};

const mapRowToEvidence = (row: EvidenceRow): StoredWkbEvidence =>
  normalizeEvidence({
    rowId: row.id,
    id: row.evidence_id ?? `legacy-${row.id ?? Date.now()}`,
    projectId: row.project_id ?? 'onbekend',
    inspectionPointId: row.inspection_point_id ?? 'onbekend',
    mediaUri: row.media_uri ?? row.photo_uri ?? '',
    timestamp: row.timestamp,
    latitude: row.latitude,
    longitude: row.longitude,
    gpsAccuracy: row.gps_accuracy ?? null,
    exifHash: row.exif_hash ?? 'hash-niet-beschikbaar',
    exifVerified: Boolean(row.exif_verified),
    userId: row.user_id ?? null,
    fieldNote: row.field_note ?? null,
    stopMomentConfirmed:
      typeof row.stop_moment_confirmed === 'number'
        ? row.stop_moment_confirmed === 1
        : null,
    measurementToolConfirmed:
      typeof row.measurement_tool_confirmed === 'number'
        ? row.measurement_tool_confirmed === 1
        : null,
    locationVerified:
      typeof row.location_verified === 'number'
        ? row.location_verified === 1
        : null,
    locationSpoofRisk: mapLocationSpoofRisk(row.location_spoof_risk),
    locationSecurityMessage: row.location_security_message ?? null,
    syncStatus: mapSyncStatus(row.sync_status, row.synced),
    aiStatus: row.ai_status ?? 'PENDING',
    aiConfidence: row.ai_confidence ?? null,
    aiNotes: row.ai_notes ?? null,
    cloudRecordId: row.cloud_record_id ?? null,
    etage: row.etage ?? null,
    huisnummer: row.huisnummer ?? null,
    ruimtenummer: row.ruimtenummer ?? null,
    binnenbuiten: (row.binnenbuiten as 'BINNEN' | 'BUITEN' | null) ?? null,
    locatieDetail: row.locatie_detail ?? null,
    weatherLabel: row.weather_label ?? null,
    floorPlanId: row.floor_plan_id ?? null,
    pinX: row.pin_x ?? null,
    pinY: row.pin_y ?? null,
    reviewStatus: (row.review_status as WkbEvidence['reviewStatus']) ?? null,
    reviewedBy: row.reviewed_by ?? null,
    reviewedAt: row.reviewed_at ?? null,
    reviewNote: row.review_note ?? null,
  });

const mapRowToPunchlistItem = (row: PunchlistRow): StoredPunchlistItem =>
  normalizePunchlistItem({
    id: row.item_id,
    title: row.title,
    checked: row.checked === 1,
    updatedAt: row.updated_at ?? null,
    syncStatus: row.sync_status === 'SYNCED' ? 'SYNCED' : 'PENDING',
  });

const mapRowToGereedmeldingItem = (
  row: GereedmeldingRow
): StoredGereedmeldingItem =>
  normalizeGereedmeldingItem({
    id: row.item_id,
    title: row.title,
    checked: row.checked === 1,
    updatedAt: row.updated_at ?? null,
    syncStatus: row.sync_status === 'SYNCED' ? 'SYNCED' : 'PENDING',
  });

const mapRowToConsumerDossierItem = (
  row: ConsumerDossierRow
): StoredConsumerDossierItem =>
  normalizeConsumerDossierItem({
    id: row.item_id,
    title: row.title,
    checked: row.checked === 1,
    updatedAt: row.updated_at ?? null,
    syncStatus: row.sync_status === 'SYNCED' ? 'SYNCED' : 'PENDING',
  });

const mapRowToConsumerDossierDocument = (
  row: ConsumerDossierDocumentRow
): StoredConsumerDossierDocument =>
  normalizeConsumerDossierDocument({
    id: row.document_id,
    requirementId: row.requirement_id,
    title: row.title,
    category: row.category,
    referenceValue: row.reference_value ?? '',
    notes: row.notes ?? '',
    updatedAt: row.updated_at ?? null,
    syncStatus: row.sync_status === 'SYNCED' ? 'SYNCED' : 'PENDING',
  });

const seedPresetsIfEmpty = async (db: SQLite.SQLiteDatabase) => {
  const projectCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM presets WHERE type = ?;',
    ['project']
  );
  const inspectionCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM presets WHERE type = ?;',
    ['inspection']
  );

  if ((projectCount?.count ?? 0) === 0) {
    for (const value of PROJECT_PRESETS) {
      await db.runAsync('INSERT INTO presets (type, value) VALUES (?, ?);', [
        'project',
        value,
      ]);
    }
  }

  if ((inspectionCount?.count ?? 0) === 0) {
    for (const value of INSPECTION_PRESETS) {
      await db.runAsync('INSERT INTO presets (type, value) VALUES (?, ?);', [
        'inspection',
        value,
      ]);
    }
  }
};

const webAdapter: DatabaseAdapter = {
  async initDatabase() {
    const state = await readWebState();
    await writeWebState(state);
    console.log('✅ Lokale web database voor de Wkb is succesvol geïnitialiseerd.');
  },

  async saveEvidenceLocally(evidence) {
    const state = await readWebState();
    const existing = state.evidence.find((item) => item.id === evidence.id);
    const existingQueueEntry = state.syncQueue.find(
      (entry) => entry.evidenceId === evidence.id
    );
    const rowId = existing?.rowId ?? state.nextEvidenceRowId;
    const storedEvidence = normalizeEvidence({
      ...evidence,
      rowId,
      aiStatus: existing?.aiStatus ?? 'PENDING',
      aiConfidence: existing?.aiConfidence ?? null,
      aiNotes: existing?.aiNotes ?? null,
      cloudRecordId: existing?.cloudRecordId ?? null,
    });

    await writeWebState({
      ...state,
      evidence: [
        storedEvidence,
        ...state.evidence.filter((item) => item.id !== evidence.id),
      ],
      syncQueue: upsertSyncQueueEntry(state.syncQueue, {
        evidenceRowId: rowId,
        evidenceId: evidence.id,
        status: 'PENDING',
        retryCount: existingQueueEntry?.retryCount ?? 0,
        lastError: null,
        lastAttemptAt: existingQueueEntry?.lastAttemptAt ?? null,
        updatedAt: new Date().toISOString(),
      }),
      nextEvidenceRowId: existing ? state.nextEvidenceRowId : state.nextEvidenceRowId + 1,
    });

    console.log(`✅ Bewijs ${evidence.id} succesvol lokaal opgeslagen!`);
    return rowId;
  },

  async getAllEvidence() {
    const state = await readWebState();
    return sortEvidenceNewestFirst(state.evidence);
  },

  async getUnsyncedEvidence() {
    const state = await readWebState();
    const queuedEvidence = sortSyncQueueOldestFirst(state.syncQueue)
      .map((entry) =>
        state.evidence.find((item) => item.rowId === entry.evidenceRowId)
      )
      .filter(Boolean) as StoredWkbEvidence[];
    const remainingEvidence = sortEvidenceOldestFirst(
      state.evidence.filter(
        (item) =>
          item.syncStatus !== 'SYNCED' &&
          !state.syncQueue.some((entry) => entry.evidenceRowId === item.rowId)
      )
    );

    return [...queuedEvidence, ...remainingEvidence];
  },

  async markEvidenceSyncedWithCloudId(rowId, cloudRecordId) {
    const state = await readWebState();
    await writeWebState({
      ...state,
      evidence: state.evidence.map((item) =>
        item.rowId === rowId
          ? normalizeEvidence({
              ...item,
              syncStatus: 'SYNCED',
              cloudRecordId,
            })
          : item
      ),
      syncQueue: state.syncQueue.filter((entry) => entry.evidenceRowId !== rowId),
    });
  },

  async markEvidenceSyncFailed(rowId) {
    const state = await readWebState();
    const currentQueueEntry = state.syncQueue.find(
      (entry) => entry.evidenceRowId === rowId
    );
    const failedAt = new Date().toISOString();
    await writeWebState({
      ...state,
      evidence: state.evidence.map((item) =>
        item.rowId === rowId
          ? normalizeEvidence({
              ...item,
              syncStatus: 'FAILED',
            })
          : item
      ),
      syncQueue: upsertSyncQueueEntry(state.syncQueue, {
        evidenceRowId: rowId,
        evidenceId:
          currentQueueEntry?.evidenceId ??
          state.evidence.find((item) => item.rowId === rowId)?.id ??
          `legacy-${rowId}`,
        status: 'FAILED',
        retryCount: (currentQueueEntry?.retryCount ?? 0) + 1,
        lastError: 'Laatste synchronisatiepoging mislukt.',
        lastAttemptAt: failedAt,
        updatedAt: failedAt,
      }),
    });
  },

  async updateEvidenceAiStatus(rowId, status, confidence, notes) {
    const state = await readWebState();
    await writeWebState({
      ...state,
      evidence: state.evidence.map((item) =>
        item.rowId === rowId
          ? normalizeEvidence({
              ...item,
              aiStatus: status ?? 'PENDING',
              aiConfidence: confidence ?? null,
              aiNotes: notes ?? null,
            })
          : item
      ),
    });
  },

  async updateEvidenceAiStatusByCloudId(cloudRecordId, status, confidence, notes) {
    const state = await readWebState();
    await writeWebState({
      ...state,
      evidence: state.evidence.map((item) =>
        item.cloudRecordId === cloudRecordId
          ? normalizeEvidence({
              ...item,
              aiStatus: status ?? 'PENDING',
              aiConfidence: confidence ?? null,
              aiNotes: notes ?? null,
            })
          : item
      ),
    });
  },

  async getProjectPresets() {
    const state = await readWebState();
    return state.presets
      .filter((preset) => preset.type === 'project')
      .map((preset) => preset.value)
      .sort((a, b) => a.localeCompare(b));
  },

  async getInspectionPresets() {
    const state = await readWebState();
    return state.presets
      .filter((preset) => preset.type === 'inspection')
      .map((preset) => preset.value)
      .sort((a, b) => a.localeCompare(b));
  },

  async addPreset(type, value) {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return;
    }

    const state = await readWebState();
    const exists = state.presets.some(
      (preset) => preset.type === type && preset.value === trimmedValue
    );

    if (exists) {
      return;
    }

    await writeWebState({
      ...state,
      presets: [...state.presets, { type, value: trimmedValue }],
    });
  },

  async removePreset(type, value) {
    const state = await readWebState();
    await writeWebState({
      ...state,
      presets: state.presets.filter(
        (preset) => !(preset.type === type && preset.value === value)
      ),
    });
  },

  async getAllPresets() {
    const state = await readWebState();
    return sortPresetRows(state.presets);
  },

  async getPunchlistItems(projectId) {
    const state = await readWebState();
    return [...(state.punchlistByProject[projectId] ?? [])].sort((a, b) =>
      a.id.localeCompare(b.id)
    );
  },

  async savePunchlistItems(projectId, items) {
    const state = await readWebState();
    const updatedAt = new Date().toISOString();

    await writeWebState({
      ...state,
      punchlistByProject: {
        ...state.punchlistByProject,
        [projectId]: items
          .map((item) =>
            normalizePunchlistItem({
              id: item.id,
              title: item.title,
              checked: item.checked,
              updatedAt,
              syncStatus: 'PENDING',
            })
          )
          .sort((a, b) => a.id.localeCompare(b.id)),
      },
    });

    return updatedAt;
  },

  async getGereedmeldingItems(projectId) {
    const state = await readWebState();
    return [...(state.gereedmeldingByProject[projectId] ?? [])].sort((a, b) =>
      a.id.localeCompare(b.id)
    );
  },

  async saveGereedmeldingItems(projectId, items) {
    const state = await readWebState();
    const updatedAt = new Date().toISOString();

    await writeWebState({
      ...state,
      gereedmeldingByProject: {
        ...state.gereedmeldingByProject,
        [projectId]: items
          .map((item) =>
            normalizeGereedmeldingItem({
              id: item.id,
              title: item.title,
              checked: item.checked,
              updatedAt,
              syncStatus: 'PENDING',
            })
          )
          .sort((a, b) => a.id.localeCompare(b.id)),
      },
    });

    return updatedAt;
  },

  async getConsumerDossierItems(projectId) {
    const state = await readWebState();
    return [...(state.consumerDossierByProject[projectId] ?? [])].sort((a, b) =>
      a.id.localeCompare(b.id)
    );
  },

  async saveConsumerDossierItems(projectId, items) {
    const state = await readWebState();
    const updatedAt = new Date().toISOString();

    await writeWebState({
      ...state,
      consumerDossierByProject: {
        ...state.consumerDossierByProject,
        [projectId]: items
          .map((item) =>
            normalizeConsumerDossierItem({
              id: item.id,
              title: item.title,
              checked: item.checked,
              updatedAt,
              syncStatus: 'PENDING',
            })
          )
          .sort((a, b) => a.id.localeCompare(b.id)),
      },
    });

    return updatedAt;
  },

  async getConsumerDossierDocuments(projectId) {
    const state = await readWebState();
    return [...(state.consumerDossierDocumentsByProject[projectId] ?? [])].sort((a, b) =>
      a.id.localeCompare(b.id)
    );
  },

  async saveConsumerDossierDocuments(projectId, items) {
    const state = await readWebState();
    const updatedAt = new Date().toISOString();

    await writeWebState({
      ...state,
      consumerDossierDocumentsByProject: {
        ...state.consumerDossierDocumentsByProject,
        [projectId]: items
          .map((item) =>
            normalizeConsumerDossierDocument({
              id: item.id,
              requirementId: item.requirementId,
              title: item.title,
              category: item.category,
              referenceValue: item.referenceValue,
              notes: item.notes,
              updatedAt,
              syncStatus: 'PENDING',
            })
          )
          .sort((a, b) => a.id.localeCompare(b.id)),
      },
    });

    return updatedAt;
  },

  async markPunchlistItemsSynced(projectId) {
    const state = await readWebState();
    await writeWebState({
      ...state,
      punchlistByProject: {
        ...state.punchlistByProject,
        [projectId]: (state.punchlistByProject[projectId] ?? []).map((item) =>
          normalizePunchlistItem({
            ...item,
            syncStatus: 'SYNCED',
          })
        ),
      },
    });
  },

  async markGereedmeldingItemsSynced(projectId) {
    const state = await readWebState();
    await writeWebState({
      ...state,
      gereedmeldingByProject: {
        ...state.gereedmeldingByProject,
        [projectId]: (state.gereedmeldingByProject[projectId] ?? []).map((item) =>
          normalizeGereedmeldingItem({
            ...item,
            syncStatus: 'SYNCED',
          })
        ),
      },
    });
  },

  async markConsumerDossierItemsSynced(projectId) {
    const state = await readWebState();
    await writeWebState({
      ...state,
      consumerDossierByProject: {
        ...state.consumerDossierByProject,
        [projectId]: (state.consumerDossierByProject[projectId] ?? []).map((item) =>
          normalizeConsumerDossierItem({
            ...item,
            syncStatus: 'SYNCED',
          })
        ),
      },
    });
  },

  async markConsumerDossierDocumentsSynced(projectId) {
    const state = await readWebState();
    await writeWebState({
      ...state,
      consumerDossierDocumentsByProject: {
        ...state.consumerDossierDocumentsByProject,
        [projectId]: (state.consumerDossierDocumentsByProject[projectId] ?? []).map(
          (item) =>
            normalizeConsumerDossierDocument({
              ...item,
              syncStatus: 'SYNCED',
            })
        ),
      },
    });
  },

  async insertDsoLog(entry) {
    const state = await readWebState();
    const id = typeof entry.id === 'number' ? entry.id : state.nextDsoLogId;
    await writeWebState({
      ...state,
      dsoLogs: [
        {
          ...entry,
          id,
        },
        ...state.dsoLogs.filter((item) => item.id !== id),
      ],
      nextDsoLogId: Math.max(state.nextDsoLogId, id + 1),
    });
  },

  async getDsoLogs() {
    const state = await readWebState();
    return sortLogsNewestFirst(state.dsoLogs);
  },
};

const nativeAdapter: DatabaseAdapter = {
  async initDatabase() {
    try {
      const db = await getDatabase();
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS evidence (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          evidence_id TEXT UNIQUE,
          project_id TEXT,
          inspection_point_id TEXT,
          media_uri TEXT,
          photo_uri TEXT,
          timestamp TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          gps_accuracy REAL,
          exif_hash TEXT,
          exif_verified INTEGER DEFAULT 0,
          user_id TEXT,
          field_note TEXT,
          stop_moment_confirmed INTEGER,
          measurement_tool_confirmed INTEGER,
          location_verified INTEGER,
          location_spoof_risk TEXT,
          location_security_message TEXT,
          sync_status TEXT DEFAULT 'PENDING',
          synced INTEGER DEFAULT 0,
          ai_status TEXT DEFAULT 'PENDING',
          ai_confidence REAL,
          ai_notes TEXT,
          cloud_record_id INTEGER,
          etage TEXT,
          ruimtenummer TEXT,
          binnenbuiten TEXT,
          locatie_detail TEXT,
          weather_label TEXT
        );
      `);
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS presets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          value TEXT NOT NULL,
          UNIQUE(type, value)
        );
      `);
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS dso_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          reference_id TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS sync_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          evidence_row_id INTEGER NOT NULL UNIQUE,
          evidence_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING',
          retry_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          last_attempt_at TEXT,
          updated_at TEXT NOT NULL
        );
      `);
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS punchlist_checks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT NOT NULL,
          item_id TEXT NOT NULL,
          title TEXT NOT NULL,
          checked INTEGER DEFAULT 0,
          updated_at TEXT NOT NULL,
          sync_status TEXT DEFAULT 'PENDING',
          UNIQUE(project_id, item_id)
        );
      `);
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS gereedmelding_checks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT NOT NULL,
          item_id TEXT NOT NULL,
          title TEXT NOT NULL,
          checked INTEGER DEFAULT 0,
          updated_at TEXT NOT NULL,
          sync_status TEXT DEFAULT 'PENDING',
          UNIQUE(project_id, item_id)
        );
      `);
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS consumer_dossier_checks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT NOT NULL,
          item_id TEXT NOT NULL,
          title TEXT NOT NULL,
          checked INTEGER DEFAULT 0,
          updated_at TEXT NOT NULL,
          sync_status TEXT DEFAULT 'PENDING',
          UNIQUE(project_id, item_id)
        );
      `);
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS consumer_dossier_documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT NOT NULL,
          document_id TEXT NOT NULL,
          requirement_id TEXT NOT NULL,
          title TEXT NOT NULL,
          category TEXT NOT NULL,
          reference_value TEXT DEFAULT '',
          notes TEXT DEFAULT '',
          updated_at TEXT NOT NULL,
          sync_status TEXT DEFAULT 'PENDING',
          UNIQUE(project_id, document_id)
        );
      `);

      const migrations = [
        'ALTER TABLE evidence ADD COLUMN evidence_id TEXT;',
        'ALTER TABLE evidence ADD COLUMN project_id TEXT;',
        'ALTER TABLE evidence ADD COLUMN inspection_point_id TEXT;',
        'ALTER TABLE evidence ADD COLUMN media_uri TEXT;',
        'ALTER TABLE evidence ADD COLUMN photo_uri TEXT;',
        'ALTER TABLE evidence ADD COLUMN gps_accuracy REAL;',
        'ALTER TABLE evidence ADD COLUMN exif_hash TEXT;',
        "ALTER TABLE evidence ADD COLUMN exif_verified INTEGER DEFAULT 0;",
        'ALTER TABLE evidence ADD COLUMN user_id TEXT;',
        'ALTER TABLE evidence ADD COLUMN field_note TEXT;',
        'ALTER TABLE evidence ADD COLUMN stop_moment_confirmed INTEGER;',
        'ALTER TABLE evidence ADD COLUMN measurement_tool_confirmed INTEGER;',
        'ALTER TABLE evidence ADD COLUMN location_verified INTEGER;',
        'ALTER TABLE evidence ADD COLUMN location_spoof_risk TEXT;',
        'ALTER TABLE evidence ADD COLUMN location_security_message TEXT;',
        "ALTER TABLE evidence ADD COLUMN sync_status TEXT DEFAULT 'PENDING';",
        "ALTER TABLE evidence ADD COLUMN ai_status TEXT DEFAULT 'PENDING';",
        'ALTER TABLE evidence ADD COLUMN ai_confidence REAL;',
        'ALTER TABLE evidence ADD COLUMN ai_notes TEXT;',
        'ALTER TABLE evidence ADD COLUMN cloud_record_id INTEGER;',
        'ALTER TABLE evidence ADD COLUMN synced INTEGER DEFAULT 0;',
        'ALTER TABLE evidence ADD COLUMN altitude REAL;',
        'ALTER TABLE evidence ADD COLUMN altitude_accuracy REAL;',
        'ALTER TABLE evidence ADD COLUMN etage TEXT;',
        'ALTER TABLE evidence ADD COLUMN ruimtenummer TEXT;',
        'ALTER TABLE evidence ADD COLUMN binnenbuiten TEXT;',
        'ALTER TABLE evidence ADD COLUMN locatie_detail TEXT;',
        'ALTER TABLE evidence ADD COLUMN weather_label TEXT;',
        'ALTER TABLE evidence ADD COLUMN floor_plan_id TEXT;',
        'ALTER TABLE evidence ADD COLUMN pin_x REAL;',
        'ALTER TABLE evidence ADD COLUMN pin_y REAL;',
        'ALTER TABLE evidence ADD COLUMN huisnummer TEXT;',
        'ALTER TABLE evidence ADD COLUMN review_status TEXT;',
        'ALTER TABLE evidence ADD COLUMN reviewed_by TEXT;',
        'ALTER TABLE evidence ADD COLUMN reviewed_at TEXT;',
        'ALTER TABLE evidence ADD COLUMN review_note TEXT;',
      ];

      for (const statement of migrations) {
        try {
          await db.execAsync(statement);
        } catch {
          // column already exists
        }
      }

      await db.execAsync(`
        UPDATE evidence
        SET media_uri = COALESCE(media_uri, photo_uri)
        WHERE media_uri IS NULL;
      `);
      await db.execAsync(`
        UPDATE evidence
        SET photo_uri = COALESCE(photo_uri, media_uri)
        WHERE photo_uri IS NULL;
      `);
      await db.execAsync(`
        UPDATE evidence
        SET sync_status = CASE
          WHEN sync_status IS NOT NULL THEN sync_status
          WHEN synced = 1 THEN 'SYNCED'
          ELSE 'PENDING'
        END
        WHERE sync_status IS NULL;
      `);
      await db.execAsync(`
        UPDATE evidence
        SET evidence_id = 'legacy-' || id
        WHERE evidence_id IS NULL;
      `);
      await db.execAsync(`
        INSERT OR IGNORE INTO sync_queue (
          evidence_row_id,
          evidence_id,
          status,
          retry_count,
          updated_at
        )
        SELECT
          id,
          evidence_id,
          CASE
            WHEN COALESCE(sync_status, 'PENDING') = 'FAILED' THEN 'FAILED'
            ELSE 'PENDING'
          END,
          0,
          COALESCE(timestamp, CURRENT_TIMESTAMP)
        FROM evidence
        WHERE COALESCE(sync_status, 'PENDING') != 'SYNCED';
      `);

      await seedPresetsIfEmpty(db);
      console.log('✅ Lokale SQLite database voor de Wkb is succesvol geïnitialiseerd.');
    } catch (error) {
      console.error('❌ Fout bij initialiseren Wkb Database:', error);
    }
  },

  async saveEvidenceLocally(evidence) {
    try {
      const db = await getDatabase();
      const queuedAt = new Date().toISOString();
      const result = await db.runAsync(
        `
          INSERT INTO evidence (
            evidence_id,
            project_id,
            inspection_point_id,
            media_uri,
            photo_uri,
            timestamp,
            latitude,
            longitude,
            gps_accuracy,
            altitude,
            altitude_accuracy,
            exif_hash,
            exif_verified,
            user_id,
            field_note,
            stop_moment_confirmed,
            measurement_tool_confirmed,
            location_verified,
            location_spoof_risk,
            location_security_message,
            sync_status,
            synced,
            etage,
            huisnummer,
            ruimtenummer,
            binnenbuiten,
            locatie_detail,
            weather_label,
            floor_plan_id,
            pin_x,
            pin_y,
            review_status,
            reviewed_by,
            reviewed_at,
            review_note
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          evidence.id,
          evidence.projectId,
          evidence.inspectionPointId,
          evidence.mediaUri,
          evidence.mediaUri,
          evidence.timestamp,
          evidence.latitude,
          evidence.longitude,
          evidence.gpsAccuracy,
          evidence.altitude ?? null,
          evidence.altitudeAccuracy ?? null,
          evidence.exifHash,
          evidence.exifVerified ? 1 : 0,
          evidence.userId ?? null,
          evidence.fieldNote ?? null,
          typeof evidence.stopMomentConfirmed === 'boolean'
            ? evidence.stopMomentConfirmed
              ? 1
              : 0
            : null,
          typeof evidence.measurementToolConfirmed === 'boolean'
            ? evidence.measurementToolConfirmed
              ? 1
              : 0
            : null,
          typeof evidence.locationVerified === 'boolean'
            ? evidence.locationVerified
              ? 1
              : 0
            : null,
          evidence.locationSpoofRisk ?? null,
          evidence.locationSecurityMessage ?? null,
          evidence.syncStatus,
          evidence.syncStatus === 'SYNCED' ? 1 : 0,
          evidence.etage ?? null,
          evidence.huisnummer ?? null,
          evidence.ruimtenummer ?? null,
          evidence.binnenbuiten ?? null,
          evidence.locatieDetail ?? null,
          evidence.weatherLabel ?? null,
          evidence.floorPlanId ?? null,
          evidence.pinX ?? null,
          evidence.pinY ?? null,
          evidence.reviewStatus ?? null,
          evidence.reviewedBy ?? null,
          evidence.reviewedAt ?? null,
          evidence.reviewNote ?? null,
        ]
      );

      if (typeof result.lastInsertRowId === 'number') {
        await db.runAsync(
          `
            INSERT INTO sync_queue (
              evidence_row_id,
              evidence_id,
              status,
              retry_count,
              last_error,
              last_attempt_at,
              updated_at
            ) VALUES (?, ?, 'PENDING', 0, NULL, NULL, ?)
            ON CONFLICT(evidence_row_id) DO UPDATE SET
              evidence_id = excluded.evidence_id,
              status = 'PENDING',
              last_error = NULL,
              updated_at = excluded.updated_at;
          `,
          [result.lastInsertRowId, evidence.id, queuedAt]
        );
      }

      console.log(`✅ Bewijs ${evidence.id} succesvol lokaal opgeslagen!`);
      return result.lastInsertRowId;
    } catch (error) {
      console.error('❌ Fout bij het lokaal opslaan van Wkb bewijs:', error);
      throw error;
    }
  },

  async getAllEvidence() {
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<EvidenceRow>(
        'SELECT * FROM evidence ORDER BY timestamp DESC'
      );
      return rows.map(mapRowToEvidence);
    } catch (error) {
      console.error('❌ Fout bij ophalen van Wkb-dossier:', error);
      return [];
    }
  },

  async getUnsyncedEvidence() {
    const db = await getDatabase();
    const rows = await db.getAllAsync<EvidenceRow>(
      `
        SELECT e.*
        FROM sync_queue q
        INNER JOIN evidence e ON e.id = q.evidence_row_id
        ORDER BY q.updated_at ASC, e.timestamp ASC;
      `
    );
    return rows.map(mapRowToEvidence);
  },

  async markEvidenceSyncedWithCloudId(rowId, cloudRecordId) {
    const db = await getDatabase();
    await db.runAsync(
      `
        UPDATE evidence
        SET synced = 1,
            sync_status = 'SYNCED',
            cloud_record_id = ?
        WHERE id = ?;
      `,
      [cloudRecordId, rowId]
    );
    await db.runAsync('DELETE FROM sync_queue WHERE evidence_row_id = ?;', [rowId]);
  },

  async markEvidenceSyncFailed(rowId) {
    const db = await getDatabase();
    const failedAt = new Date().toISOString();
    await db.runAsync(
      `
        UPDATE evidence
        SET synced = 0,
            sync_status = 'FAILED'
        WHERE id = ?;
      `,
      [rowId]
    );
    await db.runAsync(
      `
        UPDATE sync_queue
        SET status = 'FAILED',
            retry_count = retry_count + 1,
            last_error = 'Laatste synchronisatiepoging mislukt.',
            last_attempt_at = ?,
            updated_at = ?
        WHERE evidence_row_id = ?;
      `,
      [failedAt, failedAt, rowId]
    );
  },

  async updateEvidenceAiStatus(rowId, status, confidence, notes) {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE evidence SET ai_status = ?, ai_confidence = ?, ai_notes = ? WHERE id = ?;',
      [status ?? 'PENDING', confidence ?? null, notes ?? null, rowId]
    );
  },

  async updateEvidenceAiStatusByCloudId(cloudRecordId, status, confidence, notes) {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE evidence SET ai_status = ?, ai_confidence = ?, ai_notes = ? WHERE cloud_record_id = ?;',
      [status ?? 'PENDING', confidence ?? null, notes ?? null, cloudRecordId]
    );
  },

  async getProjectPresets() {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ value: string }>(
      'SELECT value FROM presets WHERE type = ? ORDER BY value ASC;',
      ['project']
    );
    return rows.map((row) => row.value);
  },

  async getInspectionPresets() {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ value: string }>(
      'SELECT value FROM presets WHERE type = ? ORDER BY value ASC;',
      ['inspection']
    );
    return rows.map((row) => row.value);
  },

  async addPreset(type, value) {
    const db = await getDatabase();
    await db.runAsync('INSERT OR IGNORE INTO presets (type, value) VALUES (?, ?);', [
      type,
      value,
    ]);
  },

  async removePreset(type, value) {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM presets WHERE type = ? AND value = ?;', [
      type,
      value,
    ]);
  },

  async getAllPresets() {
    const db = await getDatabase();
    return db.getAllAsync<PresetRow>(
      'SELECT type, value FROM presets ORDER BY type ASC, value ASC;'
    );
  },

  async getPunchlistItems(projectId) {
    const db = await getDatabase();
    const rows = await db.getAllAsync<PunchlistRow>(
      `
        SELECT item_id, title, checked, updated_at, sync_status
        FROM punchlist_checks
        WHERE project_id = ?
        ORDER BY item_id ASC;
      `,
      [projectId]
    );

    return rows.map(mapRowToPunchlistItem);
  },

  async savePunchlistItems(projectId, items) {
    const db = await getDatabase();
    const updatedAt = new Date().toISOString();

    for (const item of items) {
      await db.runAsync(
        `
          INSERT INTO punchlist_checks (
            project_id,
            item_id,
            title,
            checked,
            updated_at,
            sync_status
          ) VALUES (?, ?, ?, ?, ?, 'PENDING')
          ON CONFLICT(project_id, item_id) DO UPDATE SET
            title = excluded.title,
            checked = excluded.checked,
            updated_at = excluded.updated_at,
            sync_status = 'PENDING';
        `,
        [projectId, item.id, item.title, item.checked ? 1 : 0, updatedAt]
      );
    }

    return updatedAt;
  },

  async getGereedmeldingItems(projectId) {
    const db = await getDatabase();
    const rows = await db.getAllAsync<GereedmeldingRow>(
      `
        SELECT item_id, title, checked, updated_at, sync_status
        FROM gereedmelding_checks
        WHERE project_id = ?
        ORDER BY item_id ASC;
      `,
      [projectId]
    );

    return rows.map(mapRowToGereedmeldingItem);
  },

  async saveGereedmeldingItems(projectId, items) {
    const db = await getDatabase();
    const updatedAt = new Date().toISOString();

    for (const item of items) {
      await db.runAsync(
        `
          INSERT INTO gereedmelding_checks (
            project_id,
            item_id,
            title,
            checked,
            updated_at,
            sync_status
          ) VALUES (?, ?, ?, ?, ?, 'PENDING')
          ON CONFLICT(project_id, item_id) DO UPDATE SET
            title = excluded.title,
            checked = excluded.checked,
            updated_at = excluded.updated_at,
            sync_status = 'PENDING';
        `,
        [projectId, item.id, item.title, item.checked ? 1 : 0, updatedAt]
      );
    }

    return updatedAt;
  },

  async getConsumerDossierItems(projectId) {
    const db = await getDatabase();
    const rows = await db.getAllAsync<ConsumerDossierRow>(
      `
        SELECT item_id, title, checked, updated_at, sync_status
        FROM consumer_dossier_checks
        WHERE project_id = ?
        ORDER BY item_id ASC;
      `,
      [projectId]
    );

    return rows.map(mapRowToConsumerDossierItem);
  },

  async saveConsumerDossierItems(projectId, items) {
    const db = await getDatabase();
    const updatedAt = new Date().toISOString();

    for (const item of items) {
      await db.runAsync(
        `
          INSERT INTO consumer_dossier_checks (
            project_id,
            item_id,
            title,
            checked,
            updated_at,
            sync_status
          ) VALUES (?, ?, ?, ?, ?, 'PENDING')
          ON CONFLICT(project_id, item_id) DO UPDATE SET
            title = excluded.title,
            checked = excluded.checked,
            updated_at = excluded.updated_at,
            sync_status = 'PENDING';
        `,
        [projectId, item.id, item.title, item.checked ? 1 : 0, updatedAt]
      );
    }

    return updatedAt;
  },

  async getConsumerDossierDocuments(projectId) {
    const db = await getDatabase();
    const rows = await db.getAllAsync<ConsumerDossierDocumentRow>(
      `
        SELECT document_id, requirement_id, title, category, reference_value, notes, updated_at, sync_status
        FROM consumer_dossier_documents
        WHERE project_id = ?
        ORDER BY document_id ASC;
      `,
      [projectId]
    );

    return rows.map(mapRowToConsumerDossierDocument);
  },

  async saveConsumerDossierDocuments(projectId, items) {
    const db = await getDatabase();
    const updatedAt = new Date().toISOString();

    for (const item of items) {
      await db.runAsync(
        `
          INSERT INTO consumer_dossier_documents (
            project_id,
            document_id,
            requirement_id,
            title,
            category,
            reference_value,
            notes,
            updated_at,
            sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
          ON CONFLICT(project_id, document_id) DO UPDATE SET
            requirement_id = excluded.requirement_id,
            title = excluded.title,
            category = excluded.category,
            reference_value = excluded.reference_value,
            notes = excluded.notes,
            updated_at = excluded.updated_at,
            sync_status = 'PENDING';
        `,
        [
          projectId,
          item.id,
          item.requirementId,
          item.title,
          item.category,
          item.referenceValue,
          item.notes,
          updatedAt,
        ]
      );
    }

    return updatedAt;
  },

  async markPunchlistItemsSynced(projectId) {
    const db = await getDatabase();
    await db.runAsync(
      `
        UPDATE punchlist_checks
        SET sync_status = 'SYNCED'
        WHERE project_id = ?;
      `,
      [projectId]
    );
  },

  async markGereedmeldingItemsSynced(projectId) {
    const db = await getDatabase();
    await db.runAsync(
      `
        UPDATE gereedmelding_checks
        SET sync_status = 'SYNCED'
        WHERE project_id = ?;
      `,
      [projectId]
    );
  },

  async markConsumerDossierItemsSynced(projectId) {
    const db = await getDatabase();
    await db.runAsync(
      `
        UPDATE consumer_dossier_checks
        SET sync_status = 'SYNCED'
        WHERE project_id = ?;
      `,
      [projectId]
    );
  },

  async markConsumerDossierDocumentsSynced(projectId) {
    const db = await getDatabase();
    await db.runAsync(
      `
        UPDATE consumer_dossier_documents
        SET sync_status = 'SYNCED'
        WHERE project_id = ?;
      `,
      [projectId]
    );
  },

  async insertDsoLog(entry) {
    const db = await getDatabase();
    await db.runAsync(
      'INSERT INTO dso_log (reference_id, status, created_at) VALUES (?, ?, ?);',
      [entry.reference_id, entry.status, entry.created_at]
    );
  },

  async getDsoLogs() {
    const db = await getDatabase();
    return db.getAllAsync<DsoLogRow>(
      'SELECT * FROM dso_log ORDER BY created_at DESC;'
    );
  },
};

const adapter: DatabaseAdapter = isWeb ? webAdapter : nativeAdapter;

export const initDatabase = async () => adapter.initDatabase();

export const saveEvidenceLocally = async (evidence: WkbEvidence) =>
  adapter.saveEvidenceLocally(evidence);

export const insertEvidence = async (evidence: StoredWkbEvidence) =>
  saveEvidenceLocally({
    id: evidence.id,
    projectId: evidence.projectId,
    inspectionPointId: evidence.inspectionPointId,
    mediaUri: evidence.mediaUri,
    timestamp: evidence.timestamp,
    latitude: evidence.latitude,
    longitude: evidence.longitude,
    gpsAccuracy: evidence.gpsAccuracy,
    exifHash: evidence.exifHash,
    exifVerified: evidence.exifVerified,
    userId: evidence.userId ?? null,
    fieldNote: evidence.fieldNote ?? null,
    syncStatus: evidence.syncStatus,
  });

export const getAllEvidence = async (): Promise<StoredWkbEvidence[]> =>
  adapter.getAllEvidence();

export const getUnsyncedEvidence = async (): Promise<StoredWkbEvidence[]> =>
  adapter.getUnsyncedEvidence();

export const markEvidenceSyncedWithCloudId = async (
  rowId: number,
  cloudRecordId: number | null
) => adapter.markEvidenceSyncedWithCloudId(rowId, cloudRecordId);

export const markEvidenceSyncFailed = async (rowId: number) =>
  adapter.markEvidenceSyncFailed(rowId);

export const updateEvidenceAiStatus = async (
  rowId: number,
  status: StoredWkbEvidence['aiStatus'],
  confidence: StoredWkbEvidence['aiConfidence'],
  notes: StoredWkbEvidence['aiNotes']
) => adapter.updateEvidenceAiStatus(rowId, status, confidence, notes);

export const updateEvidenceAiStatusByCloudId = async (
  cloudRecordId: number,
  status: StoredWkbEvidence['aiStatus'],
  confidence: StoredWkbEvidence['aiConfidence'],
  notes: StoredWkbEvidence['aiNotes']
) =>
  adapter.updateEvidenceAiStatusByCloudId(
    cloudRecordId,
    status,
    confidence,
    notes
  );

export const getProjectPresets = async (): Promise<string[]> =>
  adapter.getProjectPresets();

export const getInspectionPresets = async (): Promise<string[]> =>
  adapter.getInspectionPresets();

export const addPreset = async (type: PresetType, value: string) =>
  adapter.addPreset(type, value);

export const removePreset = async (type: PresetType, value: string) =>
  adapter.removePreset(type, value);

export const getAllPresets = async (): Promise<PresetRow[]> =>
  adapter.getAllPresets();

export const getPunchlistItems = async (
  projectId: string
): Promise<StoredPunchlistItem[]> => adapter.getPunchlistItems(projectId);

export const savePunchlistItems = async (
  projectId: string,
  items: Array<Pick<StoredPunchlistItem, 'id' | 'title' | 'checked'>>
) => adapter.savePunchlistItems(projectId, items);

export const getGereedmeldingItems = async (
  projectId: string
): Promise<StoredGereedmeldingItem[]> =>
  adapter.getGereedmeldingItems(projectId);

export const saveGereedmeldingItems = async (
  projectId: string,
  items: Array<Pick<StoredGereedmeldingItem, 'id' | 'title' | 'checked'>>
) => adapter.saveGereedmeldingItems(projectId, items);

export const getConsumerDossierItems = async (
  projectId: string
): Promise<StoredConsumerDossierItem[]> =>
  adapter.getConsumerDossierItems(projectId);

export const saveConsumerDossierItems = async (
  projectId: string,
  items: Array<Pick<StoredConsumerDossierItem, 'id' | 'title' | 'checked'>>
) => adapter.saveConsumerDossierItems(projectId, items);

export const getConsumerDossierDocuments = async (
  projectId: string
): Promise<StoredConsumerDossierDocument[]> =>
  adapter.getConsumerDossierDocuments(projectId);

export const saveConsumerDossierDocuments = async (
  projectId: string,
  items: Array<
    Pick<
      StoredConsumerDossierDocument,
      'id' | 'requirementId' | 'title' | 'category' | 'referenceValue' | 'notes'
    >
  >
) => adapter.saveConsumerDossierDocuments(projectId, items);

export const markPunchlistItemsSynced = async (projectId: string) =>
  adapter.markPunchlistItemsSynced(projectId);

export const markGereedmeldingItemsSynced = async (projectId: string) =>
  adapter.markGereedmeldingItemsSynced(projectId);

export const markConsumerDossierItemsSynced = async (projectId: string) =>
  adapter.markConsumerDossierItemsSynced(projectId);

export const markConsumerDossierDocumentsSynced = async (projectId: string) =>
  adapter.markConsumerDossierDocumentsSynced(projectId);

export const insertDsoLog = async (entry: DsoLogRow) =>
  adapter.insertDsoLog(entry);

export const getDsoLogs = async (): Promise<DsoLogRow[]> =>
  adapter.getDsoLogs();

export const initDB = initDatabase;

export const initWatermelonDatabase = async (): Promise<boolean> => {
  if (Platform.OS === 'web') {
    return false;
  }

  if (!watermelonInitPromise) {
    watermelonInitPromise = import('./watermelon')
      .then(({ getWatermelonDatabase }) => {
        void getWatermelonDatabase();
        return true;
      })
      .catch((error) => {
        console.warn(
          '⚠️ WatermelonDB kon nog niet native worden geactiveerd; de app blijft op de bestaande SQLite-laag draaien.',
          error
        );
        return false;
      });
  }

  return watermelonInitPromise;
};
