/**
 * WerkvoorbereiderDashboard — Workspace voor WV / Uitvoerder
 *
 * Tabs:
 *   📊 Dashboard   — stats + borgingspunt voortgangsraster + LIVE indicator
 *   📸 Bewijs      — foto-review met goedkeuren / afkeuren per item
 *   ✅ Checklist   — dagelijkse controlelijst per borgingspunt
 *
 * Realtime: Supabase postgres_changes → toast + live indicator
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import SignaturePad from '../components/SignaturePad';
import DossierExportModal from '../components/DossierExportModal';
import FloorPlanViewer from '../components/FloorPlanViewer';
import TenantBrandMark from '../components/TenantBrandMark';
import { getBrandingSync } from '../services/TenantBrandingService';
import QRStickerSheet from '../components/QRStickerSheet';
import TaskAssignmentPanel from '../components/TaskAssignmentPanel';
import RapportagePanel from '../components/RapportagePanel';
import type { ReviewStatus, StoredWkbEvidence } from '../types/Evidence';
import {
  approveEvidence,
  rejectEvidence,
  finalizeEvidence,
  reopenEvidence,
  reviewBadgeFor,
  isReviewLocked,
  type ReviewAction,
} from '../services/ReviewService';
import {
  uploadDossierHtml,
  exportDossierAsPdf,
  getOrCreateOpenDossier,
  attachEvidenceToDossier,
  lockDossier,
  type DossierSignatures,
  type DossierRow,
} from '../services/BorgingsDossierService';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme/ThemeProvider';
import { tokens } from '../theme/designTokens';
import EvidenceMapView from '../components/EvidenceMapView';
import { ProjectProgressBlock } from '../components/ProgressChart';
import { evidenceToCsv, downloadCsv, makeExportFilename, type ExportEvidenceRow } from '../services/ExportService';
import NotificatiePanel from '../components/NotificatiePanel';
import EvidenceComments from '../components/EvidenceComments';
import { DiagnoseSidePanel } from '../components/ui/DiagnoseSidePanel';
import { DossierActionModal } from '../components/ui/DossierActionModal';
import { shareViaWhatsApp } from '../services/ShareService';
import {
  getProjectComments,
  buildCommentCountMap,
  type EvidenceComment,
} from '../services/EvidenceCommentService';
import PWAInstallBanner from '../components/PWAInstallBanner';
import {
  getDocumentsForProject,
  openDocumentAsPrintablePdf,
  deleteDocument,
  type ProjectDocument,
} from '../services/BonScannerService';
import OfflineSyncBanner from '../components/OfflineSyncBanner';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useTranslation } from '../i18n';
import { EmptyProjectWizard } from '../components/ui/EmptyProjectWizard';
import {
  generateKeuringsrapportHtml,
  printKeuringsrapport,
  type KeuringsrapportEvidence,
} from '../services/KeuringsrapportService';
import { exportProjectAsZip, type ZipExportProgress } from '../services/ZipExportService';
import {
  isFolderSyncSupported,
  requestFolderAccess,
  unlinkFolder,
  getLinkedFolderName,
  syncToLocalFolder,
  type SyncEvidenceRow,
} from '../services/LocalFolderSyncService';
import {
  isOneDriveConfigured,
  connectOneDrive,
  disconnectOneDrive,
  getOneDriveAccountName,
  syncToOneDrive,
  type OneDriveEvidenceRow,
} from '../services/OneDriveSyncService';

// ─── Types ────────────────────────────────────────────────────────────────────

type AiStatus = 'PASSED' | 'FAILED' | 'NEEDS_REVIEW' | 'PENDING' | null;
type FilterStatus = 'alle' | 'review' | 'akkoord' | 'afgekeurd' | 'pending';
type WvTab = 'dashboard' | 'bewijs' | 'checklist' | 'kaart' | 'tekening' | 'stickers' | 'taken' | 'rapportage' | 'documenten';

interface EvidenceRow {
  id: string;
  project_id: string | null;
  inspection_point_id: string | null;
  media_uri: string | null;
  photo_uri: string | null;
  timestamp: string | null;
  ai_status: AiStatus;
  ai_notes: string | null;
  sync_status: string | null;
  user_id: string | null;
  latitude: number | null;
  longitude: number | null;
  field_note: string | null;
  floor_plan_id: string | null;
  pin_x: number | null;
  pin_y: number | null;
  review_status: ReviewStatus | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
}

interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

interface WerkvoorbereiderDashboardProps {
  projectId?: string;
  projectName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toBucket(status: AiStatus): 'akkoord' | 'review' | 'afgekeurd' | 'pending' {
  if (status === 'PASSED')       return 'akkoord';
  if (status === 'NEEDS_REVIEW') return 'review';
  if (status === 'FAILED')       return 'afgekeurd';
  return 'pending';
}

function fmtDate(ts: string | null): string {
  if (!ts) return '—';
  try {
    return new Intl.DateTimeFormat('nl-NL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(ts));
  } catch { return ts; }
}

function isToday(ts: string | null): boolean {
  if (!ts) return false;
  try { return new Date(ts).toDateString() === new Date().toDateString(); }
  catch { return false; }
}

function isStale(ts: string | null, status: AiStatus): boolean {
  if (status !== 'NEEDS_REVIEW' || !ts) return false;
  try { return Date.now() - new Date(ts).getTime() > 24 * 60 * 60 * 1000; }
  catch { return false; }
}

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: '1', label: 'Dagelijkse ronde inspectiepunten', done: false },
  { id: '2', label: 'Nieuwe bewijsstukken gecontroleerd', done: false },
  { id: '3', label: 'Vaklieden gebriefd op borgingspunten', done: false },
  { id: '4', label: 'Stopmoment bevestigd', done: false },
  { id: '5', label: 'Locatie GPS geverifieerd', done: false },
  { id: '6', label: 'Afwijkingen gerapporteerd', done: false },
];

const CHECKLIST_KEY = 'wkb_wv_checklist';

function loadChecklist(projectId: string): ChecklistItem[] {
  if (typeof window === 'undefined') return DEFAULT_CHECKLIST;
  try {
    const raw = window.localStorage.getItem(`${CHECKLIST_KEY}_${projectId}`);
    if (raw) return JSON.parse(raw) as ChecklistItem[];
  } catch { /* ignore */ }
  return DEFAULT_CHECKLIST.map(i => ({ ...i }));
}

function saveChecklist(projectId: string, items: ChecklistItem[]) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(`${CHECKLIST_KEY}_${projectId}`, JSON.stringify(items)); }
  catch { /* ignore */ }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WerkvoorbereiderDashboard({
  projectId = 'default',
  projectName = 'Project',
}: WerkvoorbereiderDashboardProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const isDark = theme.name === 'dark';
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [activeTab, setActiveTab] = useState<WvTab>('dashboard');
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);

  // Documenten laden zodra de tab geopend wordt
  useEffect(() => {
    if (activeTab !== 'documenten') return;
    if (!projectId) {
      setDocuments([]);
      return;
    }
    setDocumentsLoading(true);
    getDocumentsForProject(projectId)
      .then((docs) => {
        setDocuments(docs);
        setDocumentsLoading(false);
      })
      .catch(() => setDocumentsLoading(false));
  }, [activeTab, projectId]);
  const [evidence, setEvidence]   = useState<EvidenceRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<FilterStatus>('alle');
  const [isLive, setIsLive]       = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Checklist
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => loadChecklist(projectId));
  const [newTask, setNewTask]     = useState('');

  // ── ZIP export state ─────────────────────────────────────────────────────────
  const [zipProgress, setZipProgress] = useState<ZipExportProgress | null>(null);

  // ── Email dossier modal ───────────────────────────────────────────────────────
  const [emailModal, setEmailModal]         = useState(false);
  const [emailAddress, setEmailAddress]     = useState('');
  const [emailSending, setEmailSending]     = useState(false);
  const [emailMsg, setEmailMsg]             = useState<string | null>(null);
  const [sigPL, setSigPL]                   = useState<string | null>(null);   // projectleider handtekening
  const [sigPLNaam, setSigPLNaam]           = useState('');
  const [sigOG, setSigOG]                   = useState<string | null>(null);   // opdrachtgever handtekening
  const [sigOGNaam, setSigOGNaam]           = useState('');
  const [pdfLoading, setPdfLoading]         = useState(false);

  // ── Sprint 4 — Officieel WKB-rapport export modal ──────────────────────────
  const [exportModalVisible, setExportModalVisible] = useState(false);

  // ── Dossier lock (Sprint 3 — WKB juridische bewaarplicht) ──────────────────
  const [dossier, setDossier]               = useState<DossierRow | null>(null);
  const [lockConfirmModal, setLockConfirmModal] = useState(false);
  const [lockLoading, setLockLoading]       = useState(false);
  const [lockMsg, setLockMsg]               = useState<string | null>(null);
  const isDossierLocked = dossier?.status === 'LOCKED';

  // ── Opmerkingen ──────────────────────────────────────────────────────────────
  const [projectComments, setProjectComments] = useState<EvidenceComment[]>([]);
  const commentCountMap = useMemo(
    () => buildCommentCountMap(projectComments),
    [projectComments]
  );
  const reloadComments = useCallback(() => {
    getProjectComments(projectId).then(setProjectComments).catch(() => {});
  }, [projectId]);

  // ── PC-map sync state ─────────────────────────────────────────────────────────
  const [linkedFolder, setLinkedFolder]     = useState<string | null>(null);
  const [folderSyncing, setFolderSyncing]   = useState(false);
  const [folderSyncMsg, setFolderSyncMsg]   = useState<string | null>(null);
  const folderSyncSupported = isFolderSyncSupported();

  // ── OneDrive state ───────────────────────────────────────────────────────────
  const [oneDriveAccount, setOneDriveAccount] = useState<string | null>(null);
  const [oneDriveSyncing, setOneDriveSyncing] = useState(false);
  const [oneDriveMsg, setOneDriveMsg]         = useState<string | null>(null);
  const oneDriveReady = isOneDriveConfigured();

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(3200),
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToastMsg(null));
    toastTimer.current = setTimeout(() => setToastMsg(null), 4000);
  }, [toastAnim]);

  const fetchEvidence = useCallback(async (): Promise<EvidenceRow[]> => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('evidence')
        .select('id, project_id, inspection_point_id, media_uri, photo_uri, timestamp, ai_status, ai_notes, sync_status, user_id, latitude, longitude, field_note, floor_plan_id, pin_x, pin_y, review_status, reviewed_by, reviewed_at, review_note')
        .eq('project_id', projectId)
        .order('timestamp', { ascending: false })
        .limit(300);
      const rows = (data ?? []) as EvidenceRow[];
      setEvidence(rows);
      return rows;
    } catch { return []; }
    finally { setLoading(false); }
  }, [projectId]);

  // ── Folder sync helper ────────────────────────────────────────────────────────
  const runFolderSync = useCallback(async (rows: SyncEvidenceRow[], silent = false) => {
    if (!linkedFolder) return;
    setFolderSyncing(true);
    if (!silent) setFolderSyncMsg('📂 Synchroniseren naar PC-map…');
    const result = await syncToLocalFolder(projectId, projectName, rows);
    setFolderSyncing(false);
    if (result.noFolder)      { setLinkedFolder(null); return; }
    if (result.noPermission)  { setFolderSyncMsg('⚠️ Toegang geweigerd — koppel de map opnieuw.'); return; }
    if (result.notSupported)  return;
    if (!silent) {
      setFolderSyncMsg(`✅ ${result.synced} nieuw${result.synced !== 1 ? 'e' : ''} bestand${result.synced !== 1 ? 'en' : ''} gesynchroniseerd`);
      setTimeout(() => setFolderSyncMsg(null), 4000);
    }
  }, [linkedFolder, projectId, projectName]);

  useEffect(() => {
    void fetchEvidence();
    reloadComments();
    // Laad gekoppelde mapnaam + OneDrive account
    getLinkedFolderName(projectId).then(name => setLinkedFolder(name)).catch(() => {});
    if (oneDriveReady) {
      getOneDriveAccountName().then(name => setOneDriveAccount(name)).catch(() => {});
    }

    const channel = supabase
      .channel(`wv-dashboard-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'evidence' }, async () => {
        setIsLive(true);
        setLastUpdate(new Date().toLocaleTimeString('nl-NL', { timeStyle: 'short' }));
        showToast('📸 Nieuwe foto ontvangen');
        const updated = await fetchEvidence();
        // Auto-sync nieuwe foto naar PC-map + OneDrive
        if (updated && updated.length > 0) {
          void runFolderSync(updated as SyncEvidenceRow[], true);
          if (oneDriveAccount) {
            void syncToOneDrive(projectName, updated as OneDriveEvidenceRow[]);
          }
        }
      })
      .subscribe(() => setIsLive(true));
    return () => { supabase.removeChannel(channel); };
  }, [fetchEvidence, projectId, projectName, showToast, runFolderSync, reloadComments]);

  // Reset checklist when project changes
  useEffect(() => {
    setChecklist(loadChecklist(projectId));
  }, [projectId]);

  // ── Metrics ────────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const akkoord   = evidence.filter(e => toBucket(e.ai_status) === 'akkoord').length;
    const review    = evidence.filter(e => toBucket(e.ai_status) === 'review').length;
    const afgekeurd = evidence.filter(e => toBucket(e.ai_status) === 'afgekeurd').length;
    const vandaag   = evidence.filter(e => isToday(e.timestamp)).length;
    return { total: evidence.length, akkoord, review, afgekeurd, vandaag };
  }, [evidence]);

  // ── 7-daagse upload trend ─────────────────────────────────────────────────
  const trendDays = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      const label = d.toLocaleDateString('nl-NL', { weekday: 'short' });
      const count = evidence.filter(e => {
        if (!e.timestamp) return false;
        try { return new Date(e.timestamp).toDateString() === d.toDateString(); }
        catch { return false; }
      }).length;
      return { day: label, count };
    });
  }, [evidence]);

  // ── Categorie stats (borgingspunt-prefix als groep) ───────────────────────
  const categoryStats = useMemo(() => {
    const map = new Map<string, { passed: number; total: number }>();
    for (const e of evidence) {
      const raw = e.inspection_point_id ?? 'Overig';
      // Groep = tekens vóór eerste koppelteken of spatie (bijv. "S" uit "S-01")
      const cat = raw.split(/[-\s]/)[0] ?? raw;
      if (!map.has(cat)) map.set(cat, { passed: 0, total: 0 });
      const s = map.get(cat)!;
      s.total++;
      if (toBucket(e.ai_status) === 'akkoord') s.passed++;
    }
    return Array.from(map.entries())
      .map(([label, { passed, total }]) => ({ label, passed, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [evidence]);

  // ── Vakman statistieken ───────────────────────────────────────────────────
  const vakmanStats = useMemo(() => {
    const map = new Map<string, { total: number; akkoord: number; vandaag: number }>();
    for (const e of evidence) {
      const uid = e.user_id ?? 'onbekend';
      if (!map.has(uid)) map.set(uid, { total: 0, akkoord: 0, vandaag: 0 });
      const s = map.get(uid)!;
      s.total++;
      if (toBucket(e.ai_status) === 'akkoord') s.akkoord++;
      if (isToday(e.timestamp)) s.vandaag++;
    }
    return Array.from(map.entries())
      .map(([userId, stats]) => ({
        userId,
        label: userId.length > 20 ? userId.slice(0, 8) + '…' + userId.slice(-4) : userId,
        ...stats,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [evidence]);

  // ── Batch approve / reject ────────────────────────────────────────────────
  const batchApprove = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    setEvidence(prev => prev.map(e => ids.includes(e.id) ? { ...e, ai_status: 'PASSED' as AiStatus } : e));
    try { await supabase.from('evidence').update({ ai_status: 'PASSED' }).in('id', ids); }
    catch { void fetchEvidence(); }
  }, [fetchEvidence]);

  const batchReject = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    setEvidence(prev => prev.map(e => ids.includes(e.id) ? { ...e, ai_status: 'FAILED' as AiStatus } : e));
    try { await supabase.from('evidence').update({ ai_status: 'FAILED' }).in('id', ids); }
    catch { void fetchEvidence(); }
  }, [fetchEvidence]);

  // ── Borgingspunt grid ──────────────────────────────────────────────────────
  const borgingspuntGrid = useMemo(() => {
    const map = new Map<string, EvidenceRow[]>();
    for (const e of evidence) {
      const key = e.inspection_point_id ?? 'onbekend';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).map(([id, items]) => {
      const hasAfgekeurd = items.some(i => toBucket(i.ai_status) === 'afgekeurd');
      const hasReview    = items.some(i => toBucket(i.ai_status) === 'review');
      const hasAkkoord   = items.some(i => toBucket(i.ai_status) === 'akkoord');
      const bucket = hasAfgekeurd ? 'afgekeurd' : hasReview ? 'review' : hasAkkoord ? 'akkoord' : 'pending';
      return { id, count: items.length, bucket };
    }).sort((a, b) => {
      const order: Record<string, number> = { afgekeurd: 0, review: 1, pending: 2, akkoord: 3 };
      return order[a.bucket] - order[b.bucket];
    });
  }, [evidence]);

  // ── Filtered evidence ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (filter === 'alle') return evidence;
    return evidence.filter(e => toBucket(e.ai_status) === filter);
  }, [evidence, filter]);

  // ── Approve / Reject ────────────────────────────────────────────────────────
  const setStatus = useCallback(async (id: string, status: 'PASSED' | 'FAILED') => {
    // Optimistic update
    setEvidence(prev => prev.map(e => e.id === id ? { ...e, ai_status: status } : e));
    try {
      await supabase.from('evidence').update({ ai_status: status }).eq('id', id);
    } catch {
      // Revert on error
      void fetchEvidence();
    }
  }, [fetchEvidence]);

  // ── Review workflow (keurmeester / projectleider sign-off) ──────────────────
  const handleReviewAction = useCallback(async (
    id: string,
    action: ReviewAction,
    note?: string,
  ) => {
    const cloudRecordId = Number(id);
    if (!Number.isFinite(cloudRecordId)) {
      showToast('Kan review niet opslaan: ongeldig id');
      return;
    }
    // Optimistic update — bepaal target status uit action
    const targetStatus: ReviewStatus =
      action === 'APPROVE'  ? 'APPROVED'  :
      action === 'REJECT'   ? 'REJECTED'  :
      action === 'FINALIZE' ? 'FINALIZED' :
                              'PENDING_REVIEW';
    setEvidence(prev => prev.map(e => e.id === id ? {
      ...e,
      review_status: targetStatus,
      reviewed_at: new Date().toISOString(),
      review_note: note?.trim() ? note.trim() : e.review_note,
    } : e));
    try {
      if (action === 'APPROVE')  await approveEvidence(cloudRecordId, note);
      if (action === 'REJECT')   await rejectEvidence(cloudRecordId, note ?? '');
      if (action === 'FINALIZE') await finalizeEvidence(cloudRecordId);
      if (action === 'REOPEN')   await reopenEvidence(cloudRecordId);
      showToast(
        action === 'APPROVE'  ? '✅ Goedgekeurd' :
        action === 'REJECT'   ? '❌ Afgekeurd' :
        action === 'FINALIZE' ? '🔒 Definitief gemaakt' :
                                '⏳ Heropend in review'
      );
    } catch (err) {
      void fetchEvidence();
      showToast(err instanceof Error ? err.message : 'Review bijwerken mislukt');
    }
  }, [fetchEvidence, showToast]);

  // ── Bewerken (keyuser / projectleider / WV / admin) ─────────────────────────
  const editEvidence = useCallback(async (
    id: string,
    updates: { field_note?: string; inspection_point_id?: string; ai_status?: string }
  ) => {
    setEvidence(prev => prev.map(e => e.id === id ? { ...e, ...updates, ai_status: (updates.ai_status as EvidenceRow['ai_status']) ?? e.ai_status } : e));
    try {
      await supabase.from('evidence').update(updates).eq('id', id);
    } catch {
      void fetchEvidence();
    }
  }, [fetchEvidence]);

  // ── Checklist ──────────────────────────────────────────────────────────────
  const toggleCheck = useCallback((id: string) => {
    setChecklist(prev => {
      const next = prev.map(i => i.id === id ? { ...i, done: !i.done } : i);
      saveChecklist(projectId, next);
      return next;
    });
  }, [projectId]);

  const addTask = useCallback(() => {
    if (!newTask.trim()) return;
    setChecklist(prev => {
      const next = [...prev, { id: Date.now().toString(), label: newTask.trim(), done: false }];
      saveChecklist(projectId, next);
      return next;
    });
    setNewTask('');
  }, [newTask, projectId]);

  const removeTask = useCallback((id: string) => {
    setChecklist(prev => {
      const next = prev.filter(i => i.id !== id);
      saveChecklist(projectId, next);
      return next;
    });
  }, [projectId]);

  const resetChecklist = useCallback(() => {
    const fresh = DEFAULT_CHECKLIST.map(i => ({ ...i }));
    setChecklist(fresh);
    saveChecklist(projectId, fresh);
  }, [projectId]);

  // ── Email dossier handler ─────────────────────────────────────────────────────
  const handleEmailDossier = useCallback(async () => {
    if (!emailAddress.trim()) {
      setEmailMsg('⚠️ Vul een e-mailadres in.');
      return;
    }
    setEmailSending(true);
    setEmailMsg('📄 Dossier genereren en uploaden…');
    try {
      const sigs: DossierSignatures = {
        projectleider: sigPL ?? undefined,
        projectleiderNaam: sigPLNaam || undefined,
        opdrachtgever: sigOG ?? undefined,
        opdrachtgeverNaam: sigOGNaam || undefined,
        signedAt: (sigPL || sigOG) ? new Date().toISOString() : undefined,
      };
      // Zet EvidenceRow[] om naar StoredWkbEvidence compatibel formaat
      const evidenceForDossier = evidence.map(e => ({
        id: e.id,
        mediaUri: e.media_uri ?? e.photo_uri ?? '',
        inspectionPointId: e.inspection_point_id ?? 'onbekend',
        timestamp: e.timestamp ?? '',
        latitude: e.latitude ?? undefined,
        longitude: e.longitude ?? undefined,
        aiStatus: e.ai_status ?? undefined,
        aiNotes: e.ai_notes ?? undefined,
        syncStatus: (e.sync_status ?? 'SYNCED') as 'SYNCED' | 'PENDING' | 'FAILED',
        fieldNote: e.field_note ?? undefined,
      }));

      // Upload HTML naar Supabase Storage
      // @ts-ignore — vereenvoudigd type
      const publicUrl = await uploadDossierHtml(evidenceForDossier, projectId, projectName, {}, sigs);

      if (!publicUrl) {
        setEmailMsg('❌ Upload mislukt. Probeer opnieuw.');
        setEmailSending(false);
        return;
      }

      setEmailMsg('📧 E-mailprogramma openen…');

      const subject = encodeURIComponent(`WKB Borgingsdossier — ${projectName}`);
      const body = encodeURIComponent(
        `Geachte,\n\nHierbij het digitale borgingsdossier van project ${projectName}.\n\n` +
        `Bekijk of download het dossier via onderstaande link:\n${publicUrl}\n\n` +
        `Dit dossier bevat alle borgingspuntfoto's met GPS, tijdstempel en AI-validatie.\n\n` +
        `Met vriendelijke groet,\n${getBrandingSync().companyName ?? ''}`
      );

      window.open(`mailto:${emailAddress.trim()}?subject=${subject}&body=${body}`, '_self');
      setEmailMsg('✅ E-mailprogramma geopend! Controleer en verstuur de mail.');
    } catch (err) {
      setEmailMsg('❌ Er ging iets mis. Probeer opnieuw.');
      console.error(err);
    } finally {
      setEmailSending(false);
    }
  }, [emailAddress, evidence, projectId, projectName, sigPL, sigPLNaam, sigOG, sigOGNaam]);

  // ── PDF met handtekeningen exporteren ─────────────────────────────────────────
  const handlePdfWithSig = useCallback(async () => {
    setPdfLoading(true);
    try {
      const sigs: DossierSignatures = {
        projectleider: sigPL ?? undefined,
        projectleiderNaam: sigPLNaam || undefined,
        opdrachtgever: sigOG ?? undefined,
        opdrachtgeverNaam: sigOGNaam || undefined,
        signedAt: (sigPL || sigOG) ? new Date().toISOString() : undefined,
      };
      const evidenceForDossier = evidence.map(e => ({
        id: e.id,
        mediaUri: e.media_uri ?? e.photo_uri ?? '',
        inspectionPointId: e.inspection_point_id ?? 'onbekend',
        timestamp: e.timestamp ?? '',
        latitude: e.latitude ?? undefined,
        longitude: e.longitude ?? undefined,
        aiStatus: e.ai_status ?? undefined,
        aiNotes: e.ai_notes ?? undefined,
        syncStatus: (e.sync_status ?? 'SYNCED') as 'SYNCED' | 'PENDING' | 'FAILED',
        fieldNote: e.field_note ?? undefined,
      }));
      // @ts-ignore
      await exportDossierAsPdf(evidenceForDossier, projectId, projectName, {}, sigs);
    } finally {
      setPdfLoading(false);
    }
  }, [evidence, projectId, projectName, sigPL, sigPLNaam, sigOG, sigOGNaam]);

  // ── Keuringsrapport genereren ─────────────────────────────────────────────
  const handleKeuringsrapport = useCallback(() => {
    const ev: KeuringsrapportEvidence[] = evidence.map(e => ({
      id: e.id,
      inspectionPointId: e.inspection_point_id,
      mediaUri: e.media_uri ?? e.photo_uri ?? null,
      timestamp: e.timestamp,
      aiStatus: e.ai_status,
      aiNotes: e.ai_notes,
      fieldNote: e.field_note,
      userId: e.user_id,
      latitude: e.latitude,
      longitude: e.longitude,
    }));
    const html = generateKeuringsrapportHtml({
      projectName,
      projectId,
      evidence: ev,
      signatures: {
        kwaliteitsborger: sigPL ?? null,
        uitvoerder: sigOG ?? null,
        datum: new Intl.DateTimeFormat('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date()),
      },
      kwaliteitsborger: sigPLNaam || undefined,
      uitvoerder: sigOGNaam || undefined,
    });
    printKeuringsrapport(html);
  }, [evidence, projectId, projectName, sigPL, sigOG, sigPLNaam, sigOGNaam]);

  // ── Dossier laden / aanmaken bij project-wissel ─────────────────────────────
  useEffect(() => {
    let cancelled = false;
    if (!projectId) return;
    getOrCreateOpenDossier(projectId)
      .then(d => { if (!cancelled) setDossier(d); })
      .catch(err => console.warn('Dossier laden mislukt:', err));
    return () => { cancelled = true; };
  }, [projectId]);

  // ── Lock-handler: dossier afsluiten (ONOMKEERBAAR) ──────────────────────────
  const handleLockDossier = useCallback(async () => {
    if (!dossier) {
      setLockMsg('❌ Geen dossier gevonden voor dit project.');
      return;
    }
    if (dossier.status === 'LOCKED') {
      setLockMsg('🔒 Dossier is al afgesloten.');
      return;
    }
    setLockLoading(true);
    setLockMsg(null);
    try {
      // 1. Koppel alle nog niet-gekoppelde evidence aan dit dossier
      const attached = await attachEvidenceToDossier(dossier.id, projectId);

      // 2. Lock het dossier (server-side trigger maakt evidence read-only)
      const result = await lockDossier(dossier.id, {
        signedByPl: sigPLNaam || null,
        signedByOg: sigOGNaam || null,
      });

      if (!result.success) {
        setLockMsg(`❌ ${result.error ?? 'Afsluiten mislukt.'}`);
        return;
      }

      // 3. UI bijwerken
      setDossier({ ...dossier, status: 'LOCKED', lockedAt: new Date().toISOString() });
      setLockMsg(`✅ Dossier afgesloten — ${attached} bewijs${attached === 1 ? '' : 'sen'} read-only gemaakt.`);
      setTimeout(() => setLockConfirmModal(false), 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLockMsg(`❌ ${msg}`);
    } finally {
      setLockLoading(false);
    }
  }, [dossier, projectId, sigPLNaam, sigOGNaam]);

  const checkDone = checklist.filter(i => i.done).length;

  // ── Tab config ─────────────────────────────────────────────────────────────
  const TABS: { id: WvTab; label: string; badge?: number }[] = [
    { id: 'dashboard', label: `📊 ${t('nav.dashboard')}` },
    { id: 'bewijs',    label: `📸 ${t('nav.bewijs')}`,    badge: metrics.review > 0 ? metrics.review : undefined },
    { id: 'checklist', label: `✅ ${t('nav.checklist')}`, badge: checklist.filter(i => !i.done).length || undefined },
    { id: 'kaart',     label: `🗺️ ${t('nav.kaart')}` },
    { id: 'tekening',  label: `📐 ${t('nav.tekening')}` },
    { id: 'documenten', label: `📄 Bonnen` },
    { id: 'stickers',   label: `🏷️ ${t('nav.stickers')}` },
    { id: 'taken',      label: `📋 ${t('nav.taken')}` },
    { id: 'rapportage', label: `📑 ${t('nav.rapportage')}` },
  ];

  return (
    <View style={[st.root, { backgroundColor: theme.colors.background }]}>

      {/* ── Offline sync banner ── */}
      <OfflineSyncBanner theme={theme} />

      {/* ── PWA installatie banner ── */}
      <PWAInstallBanner theme={theme} />

      {/* ── Toast ── */}
      {toastMsg ? (
        <Animated.View
          style={[st.toast, { opacity: toastAnim, transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] }]}
          pointerEvents="none"
        >
          <Text style={st.toastText}>{toastMsg}</Text>
        </Animated.View>
      ) : null}

      <ScrollView
        style={st.scroll}
        contentContainerStyle={[st.content, { padding: (['kaart', 'tekening', 'stickers', 'taken'] as WvTab[]).includes(activeTab) ? 0 : isDesktop ? 28 : 16, maxWidth: (['kaart', 'tekening', 'stickers', 'taken'] as WvTab[]).includes(activeTab) ? undefined : 1000, alignSelf: (['kaart', 'tekening', 'stickers', 'taken'] as WvTab[]).includes(activeTab) ? undefined : 'center', width: '100%' }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={activeTab !== 'kaart' && activeTab !== 'bewijs'}
      >

        {/* ── Header ── */}
        <View style={[st.headerCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderWarm }]}>
          <View style={st.headerTop}>
            <TenantBrandMark size="md" showName={false} theme={theme} />
            <View style={{ flex: 1 }}>
              {/* Two-Font System — Bold + Italic Playfair via theme.typography */}
              <Text
                style={[
                  st.projectTitle,
                  {
                    color: theme.colors.textPrimary,
                    fontFamily: 'Georgia, "Playfair Display", serif',
                    fontWeight: '700',
                    fontStyle: 'italic',
                    fontSize: 28,
                    lineHeight: 34,
                    letterSpacing: -0.5,
                  },
                ]}
                numberOfLines={1}
              >
                {projectName}
              </Text>
              <Text style={[st.projectRole, { color: theme.colors.textSecondary }]}>
                Werkvoorbereider / Uitvoerder
              </Text>
            </View>
            {/* Notificatie centrum */}
            <NotificatiePanel projectId={projectId} theme={theme} />

            {/* LIVE pill */}
            <View style={[st.livePill, { backgroundColor: isLive ? 'rgba(5,150,105,0.12)' : theme.colors.borderWarm }]}>
              <View style={[st.liveDot, { backgroundColor: isLive ? theme.colors.statusSuccess : theme.colors.textSecondary }]} />
              <Text style={[st.liveText, { color: isLive ? theme.colors.statusSuccess : theme.colors.textSecondary }]}>
                {isLive ? `${t('vak.live')}${lastUpdate ? `  ·  ${lastUpdate}` : ''}` : t('vak.connecting')}
              </Text>
            </View>

            {/* Taalwisselaar */}
            <LanguageSwitcher theme={theme} />

            {/* 📧 Mail dossier knop */}
            <TouchableOpacity
              onPress={() => { setEmailModal(true); setEmailMsg(null); }}
              style={[st.zipBtn, { backgroundColor: 'rgba(37,99,235,0.1)', borderColor: 'rgba(37,99,235,0.35)' }]}
              activeOpacity={0.7}
            >
              <Text style={[st.zipBtnText, { color: theme.colors.textPrimary }]}>{t('header.mail')}</Text>
            </TouchableOpacity>

            {/* ✍️ Ondertekenen knop */}
            <TouchableOpacity
              onPress={() => { setEmailModal(true); setEmailMsg(null); }}
              style={[st.zipBtn, { backgroundColor: (sigPL || sigOG) ? 'rgba(5,150,105,0.1)' : theme.colors.surface, borderColor: (sigPL || sigOG) ? 'rgba(5,150,105,0.4)' : theme.colors.borderWarm }]}
              activeOpacity={0.7}
            >
              <Text style={[st.zipBtnText, { color: (sigPL || sigOG) ? theme.colors.statusSuccess : theme.colors.textSecondary }]}>
                {(sigPL || sigOG) ? t('header.signed') : t('header.sign')}
              </Text>
            </TouchableOpacity>

            {/* 🔒 Dossier afsluiten knop (Sprint 3) */}
            <TouchableOpacity
              onPress={() => { setLockConfirmModal(true); setLockMsg(null); }}
              disabled={isDossierLocked || !dossier}
              style={[st.zipBtn, {
                backgroundColor: isDossierLocked ? 'rgba(120,120,120,0.15)' : 'rgba(220,38,38,0.1)',
                borderColor: isDossierLocked ? theme.colors.borderWarm : 'rgba(220,38,38,0.4)',
                opacity: dossier ? 1 : 0.5,
              }]}
              activeOpacity={0.7}
            >
              <Text style={[st.zipBtnText, { color: isDossierLocked ? theme.colors.textSecondary : theme.colors.statusWarning }]}>
                {isDossierLocked ? '🔒 Afgesloten' : '🔒 Afsluiten'}
              </Text>
            </TouchableOpacity>

            {/* Keuringsrapport knop */}
            <TouchableOpacity
              onPress={handleKeuringsrapport}
              style={[st.zipBtn, { backgroundColor: 'rgba(124,58,237,0.1)', borderColor: 'rgba(124,58,237,0.35)' }]}
              activeOpacity={0.7}
            >
              <Text style={[st.zipBtnText, { color: theme.colors.textPrimary }]}>{t('header.rapport')}</Text>
            </TouchableOpacity>

            {/* ZIP download knop */}
            <TouchableOpacity
              onPress={() => {
                if (zipProgress && zipProgress.phase !== 'klaar' && zipProgress.phase !== 'fout') return;
                setZipProgress({ phase: 'ophalen', current: 0, total: 0, message: 'Bezig…' });
                exportProjectAsZip(projectId, projectName, setZipProgress).catch(() => {
                  setZipProgress({ phase: 'fout', current: 0, total: 0, message: 'Download mislukt.' });
                });
              }}
              style={[st.zipBtn, { backgroundColor: theme.colors.accent + '18', borderColor: theme.colors.accent + '40' }]}
              activeOpacity={0.7}
            >
              <Text style={[st.zipBtnText, { color: theme.colors.accent }]}>
                {zipProgress && zipProgress.phase !== 'klaar' && zipProgress.phase !== 'fout'
                  ? `⏳ ${zipProgress.current}/${zipProgress.total}`
                  : '📥 ZIP'}
              </Text>
            </TouchableOpacity>

            {/* PC-map koppelen knop */}
            {folderSyncSupported && (
              <TouchableOpacity
                onPress={async () => {
                  if (linkedFolder) {
                    // Al gekoppeld → handmatige sync starten
                    setFolderSyncing(true);
                    setFolderSyncMsg('📂 Synchroniseren…');
                    await runFolderSync(evidence as SyncEvidenceRow[]);
                  } else {
                    // Nog niet gekoppeld → map kiezen
                    const name = await requestFolderAccess(projectId);
                    if (name) {
                      setLinkedFolder(name);
                      setFolderSyncMsg(`✅ Map "${name}" gekoppeld — synchroniseren…`);
                      // Direct eerste sync
                      void syncToLocalFolder(projectId, projectName, evidence as SyncEvidenceRow[]).then(r => {
                        setFolderSyncMsg(`✅ "${name}" gekoppeld · ${r.synced} bestanden gesynchroniseerd`);
                        setTimeout(() => setFolderSyncMsg(null), 5000);
                      });
                    }
                  }
                }}
                style={[st.zipBtn, {
                  backgroundColor: linkedFolder ? 'rgba(5,150,105,0.1)' : theme.colors.surface,
                  borderColor: linkedFolder ? 'rgba(5,150,105,0.4)' : theme.colors.borderWarm,
                }]}
                activeOpacity={0.7}
              >
                <Text style={[st.zipBtnText, { color: linkedFolder ? theme.colors.statusSuccess : theme.colors.textSecondary }]}>
                  {folderSyncing ? '⏳' : linkedFolder ? `📁 ${linkedFolder.slice(0, 12)}` : '📁 PC-map'}
                </Text>
              </TouchableOpacity>
            )}
            {linkedFolder && (
              <TouchableOpacity
                onPress={() => { unlinkFolder(projectId).then(() => { setLinkedFolder(null); setFolderSyncMsg(null); }); }}
                style={{ padding: 4 }}
                activeOpacity={0.7}
              >
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>✕</Text>
              </TouchableOpacity>
            )}

            {/* OneDrive knop */}
            {oneDriveReady ? (
              <TouchableOpacity
                onPress={async () => {
                  if (oneDriveAccount) {
                    // Al ingelogd → handmatige sync
                    setOneDriveSyncing(true);
                    setOneDriveMsg('☁️ Synchroniseren naar OneDrive…');
                    const result = await syncToOneDrive(
                      projectName,
                      evidence as OneDriveEvidenceRow[],
                      (done, total) => setOneDriveMsg(`☁️ OneDrive ${done}/${total}…`)
                    );
                    setOneDriveSyncing(false);
                    if (result.ok) {
                      setOneDriveMsg(`✅ ${result.synced} bestanden naar OneDrive`);
                      setTimeout(() => setOneDriveMsg(null), 5000);
                    } else if (result.authFailed) {
                      setOneDriveMsg('⚠️ Sessie verlopen — koppel opnieuw');
                      setOneDriveAccount(null);
                    }
                  } else {
                    // Nog niet ingelogd → login
                    setOneDriveMsg('☁️ Microsoft login opent…');
                    const account = await connectOneDrive();
                    if (account) {
                      setOneDriveAccount(account);
                      setOneDriveMsg(`✅ "${account}" gekoppeld — synchroniseren…`);
                      setOneDriveSyncing(true);
                      const result = await syncToOneDrive(projectName, evidence as OneDriveEvidenceRow[]);
                      setOneDriveSyncing(false);
                      if (result.ok) {
                        setOneDriveMsg(`✅ OneDrive gekoppeld · ${result.synced} bestanden gesynchroniseerd`);
                        setTimeout(() => setOneDriveMsg(null), 6000);
                      }
                    } else {
                      setOneDriveMsg(null);
                    }
                  }
                }}
                style={[st.zipBtn, {
                  backgroundColor: oneDriveAccount ? 'rgba(0,120,212,0.1)' : theme.colors.surface,
                  borderColor:     oneDriveAccount ? 'rgba(0,120,212,0.4)' : theme.colors.borderWarm,
                }]}
                activeOpacity={0.7}
              >
                <Text style={[st.zipBtnText, { color: oneDriveAccount ? theme.colors.textPrimary : theme.colors.textSecondary }]}>
                  {oneDriveSyncing ? '⏳' : oneDriveAccount ? `☁️ OneDrive` : '☁️ OneDrive'}
                </Text>
              </TouchableOpacity>
            ) : (
              // Niet geconfigureerd → setup knop
              <TouchableOpacity
                onPress={() => setOneDriveMsg('setup')}
                style={[st.zipBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderWarm, opacity: 0.6 }]}
                activeOpacity={0.7}
              >
                <Text style={[st.zipBtnText, { color: theme.colors.textSecondary }]}>☁️ OneDrive</Text>
              </TouchableOpacity>
            )}
            {oneDriveAccount && (
              <TouchableOpacity
                onPress={() => { disconnectOneDrive().then(() => { setOneDriveAccount(null); setOneDriveMsg(null); }); }}
                style={{ padding: 4 }}
                activeOpacity={0.7}
              >
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Stats strip */}
          <View style={[st.statsStrip, { borderTopColor: theme.colors.borderWarm }]}>
            {[
              { label: t('dash.total'),    value: metrics.total,    color: theme.colors.textPrimary },
              { label: t('dash.today'),    value: metrics.vandaag,  color: theme.colors.accent },
              { label: t('dash.approved'), value: metrics.akkoord,  color: theme.colors.statusSuccess },
              { label: t('dash.review'),   value: metrics.review,   color: metrics.review > 0 ? '#d97706' : theme.colors.textSecondary },
              { label: t('dash.rejected'), value: metrics.afgekeurd,color: metrics.afgekeurd > 0 ? theme.colors.statusWarning : theme.colors.textSecondary },
            ].map(s => (
              <View key={s.label} style={st.statItem}>
                <Text style={[st.statNum, { color: s.color }]}>{s.value}</Text>
                <Text style={[st.statLabel, { color: theme.colors.textSecondary }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ZIP voortgang banner */}
        {zipProgress && zipProgress.phase !== 'klaar' && zipProgress.phase !== 'fout' && (
          <View style={[st.zipBanner, { backgroundColor: theme.colors.accent + '12', borderColor: theme.colors.accent + '30' }]}>
            <ActivityIndicator size="small" color={theme.colors.accent} />
            <Text style={[st.zipBannerText, { color: theme.colors.accent }]}>{zipProgress.message}</Text>
          </View>
        )}
        {zipProgress?.phase === 'klaar' && (
          <View style={[st.zipBanner, { backgroundColor: 'rgba(5,150,105,0.1)', borderColor: 'rgba(5,150,105,0.3)' }]}>
            <Text style={[st.zipBannerText, { color: theme.colors.statusSuccess }]}>{zipProgress.message}</Text>
            <TouchableOpacity onPress={() => setZipProgress(null)}>
              <Text style={{ color: theme.colors.statusSuccess, fontWeight: '700', fontSize: 14 }}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        {zipProgress?.phase === 'fout' && (
          <View style={[st.zipBanner, { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)' }]}>
            <Text style={[st.zipBannerText, { color: theme.colors.statusWarning }]}>❌ {zipProgress.message}</Text>
            <TouchableOpacity onPress={() => setZipProgress(null)}>
              <Text style={{ color: theme.colors.statusWarning, fontWeight: '700', fontSize: 14 }}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* OneDrive banner + setup modal */}
        {oneDriveMsg === 'setup' && (
          <View style={[st.zipBanner, { backgroundColor: 'rgba(0,120,212,0.08)', borderColor: 'rgba(0,120,212,0.3)', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }]}>
            <Text style={{ color: theme.colors.textPrimary, fontWeight: '800', fontSize: 13 }}>☁️ OneDrive instellen — 3 stappen</Text>
            <Text style={{ color: theme.colors.textPrimary, fontSize: 12 }}>
              {'1. Ga naar portal.azure.com → App registrations → New registration\n'}
              {'2. Naam: "SpeeQ" · Redirect URI: ' + window.location.origin + '\n'}
              {'3. Kopieer de Application (client) ID → stuur naar je developer'}
            </Text>
            <TouchableOpacity
              onPress={() => { window.open('https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/CreateApplicationBlade', '_blank'); }}
              style={{ backgroundColor: theme.colors.textPrimary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Open Azure Portal →</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setOneDriveMsg(null)} style={{ position: 'absolute', top: 10, right: 10 }}>
              <Text style={{ color: theme.colors.textSecondary, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        {oneDriveMsg && oneDriveMsg !== 'setup' && (
          <View style={[st.zipBanner, {
            backgroundColor: oneDriveMsg.startsWith('✅') ? 'rgba(0,120,212,0.08)' : 'rgba(0,120,212,0.05)',
            borderColor:     oneDriveMsg.startsWith('✅') ? 'rgba(0,120,212,0.3)'  : 'rgba(0,120,212,0.15)',
          }]}>
            {oneDriveSyncing && <ActivityIndicator size="small" color="#0078D4" />}
            <Text style={[st.zipBannerText, { color: oneDriveMsg.startsWith('⚠️') ? '#d97706' : theme.colors.textPrimary }]}>{oneDriveMsg}</Text>
            {!oneDriveSyncing && (
              <TouchableOpacity onPress={() => setOneDriveMsg(null)}>
                <Text style={{ color: theme.colors.textSecondary, fontWeight: '700', fontSize: 14 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* PC-map sync banner */}
        {folderSyncMsg && (
          <View style={[st.zipBanner, {
            backgroundColor: folderSyncMsg.startsWith('✅') ? 'rgba(5,150,105,0.08)' :
                              folderSyncMsg.startsWith('⚠️') ? 'rgba(217,119,6,0.08)' :
                              theme.colors.surface,
            borderColor: folderSyncMsg.startsWith('✅') ? 'rgba(5,150,105,0.25)' :
                         folderSyncMsg.startsWith('⚠️') ? 'rgba(217,119,6,0.25)' :
                         theme.colors.borderWarm,
          }]}>
            {folderSyncing && <ActivityIndicator size="small" color={theme.colors.accent} />}
            <Text style={[st.zipBannerText, {
              color: folderSyncMsg.startsWith('✅') ? theme.colors.statusSuccess :
                     folderSyncMsg.startsWith('⚠️') ? '#d97706' :
                     theme.colors.textPrimary,
            }]}>{folderSyncMsg}</Text>
            {!folderSyncing && (
              <TouchableOpacity onPress={() => setFolderSyncMsg(null)}>
                <Text style={{ color: theme.colors.textSecondary, fontWeight: '700', fontSize: 14 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Tabs ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[st.tabRow, { borderBottomColor: theme.colors.borderWarm }]}
          contentContainerStyle={{ flexDirection: 'row' }}
        >
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[st.tabItem, activeTab === tab.id && st.tabItemActive]}
              onPress={() => {
                // Refresh evidence wanneer de gebruiker terugkomt naar bewijs/dashboard
                if (tab.id === 'bewijs' || tab.id === 'dashboard') {
                  void fetchEvidence();
                }
                setActiveTab(tab.id);
              }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[st.tabLabel, { color: activeTab === tab.id ? theme.colors.accent : theme.colors.textSecondary }]}>
                  {tab.label}
                </Text>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <View style={[st.tabBadge, { backgroundColor: activeTab === tab.id ? theme.colors.accent : '#d97706' }]}>
                    <Text style={st.tabBadgeText}>{tab.badge}</Text>
                  </View>
                )}
              </View>
              {activeTab === tab.id && <View style={[st.tabUnderline, { backgroundColor: theme.colors.accent }]} />}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Tab: Dashboard ── */}
        {activeTab === 'dashboard' && (
          <DashboardTab
            borgingspuntGrid={borgingspuntGrid}
            loading={loading}
            metrics={metrics}
            theme={theme}
            onGotoReview={() => { setActiveTab('bewijs'); setFilter('review'); }}
            categoryStats={categoryStats}
            trendDays={trendDays}
            vakmanStats={vakmanStats}
          />
        )}

        {/* ── Tab: Bewijs ── */}
        {activeTab === 'bewijs' && (
          <BewijsTab
            evidence={filtered}
            allEvidence={evidence}
            filter={filter}
            setFilter={setFilter}
            metrics={metrics}
            loading={loading}
            theme={theme}
            isDark={isDark}
            onApprove={(id) => setStatus(id, 'PASSED')}
            onReject={(id) => setStatus(id, 'FAILED')}
            onBulkApprove={batchApprove}
            onBulkReject={batchReject}
            onEdit={editEvidence}
            onReview={handleReviewAction}
            projectId={projectId}
            commentCountMap={commentCountMap}
          />
        )}

        {/* ── Tab: Checklist ── */}
        {activeTab === 'checklist' && (
          <ChecklistTab
            checklist={checklist}
            newTask={newTask}
            setNewTask={setNewTask}
            onToggle={toggleCheck}
            onRemove={removeTask}
            onAdd={addTask}
            onReset={resetChecklist}
            done={checkDone}
            theme={theme}
          />
        )}

        {/* ── Tab: GPS Kaart ── */}
        {activeTab === 'kaart' && (
          <View style={{ height: Math.max(height - 180, 500) }}>
            <EvidenceMapView />
          </View>
        )}

        {/* ── Tab: Bouwtekening ── */}
        {activeTab === 'tekening' && (() => {
          const evidenceForViewer: StoredWkbEvidence[] = evidence.map(e => ({
            id: e.id,
            projectId: e.project_id ?? '',
            inspectionPointId: e.inspection_point_id ?? '',
            mediaUri: e.media_uri ?? e.photo_uri ?? '',
            timestamp: e.timestamp ?? new Date().toISOString(),
            latitude: e.latitude ?? 0,
            longitude: e.longitude ?? 0,
            gpsAccuracy: null,
            exifHash: '',
            exifVerified: false,
            fieldNote: e.field_note ?? null,
            syncStatus: 'SYNCED' as const,
            aiStatus: (e.ai_status ?? 'PENDING') as StoredWkbEvidence['aiStatus'],
            aiNotes: e.ai_notes ?? null,
            floorPlanId: e.floor_plan_id ?? null,
            pinX: e.pin_x ?? null,
            pinY: e.pin_y ?? null,
          }));
          return (
            <FloorPlanViewer
              projectId={projectId ?? ''}
              evidence={evidenceForViewer}
              theme={theme}
            />
          );
        })()}

        {/* ── Tab: Bonnen / Documenten ── */}
        {activeTab === 'documenten' && (
          <View style={{ padding: isDesktop ? 28 : 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: theme.colors.textPrimary }}>
                📄 Bonnen & documenten ({documents.length})
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (!projectId) return;
                  setDocumentsLoading(true);
                  getDocumentsForProject(projectId)
                    .then((d) => { setDocuments(d); setDocumentsLoading(false); })
                    .catch(() => setDocumentsLoading(false));
                }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: theme.colors.borderWarm,
                }}
              >
                <Text style={{ color: theme.colors.textPrimary, fontWeight: '600' }}>🔄 Ververs</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ color: theme.colors.textSecondary, marginBottom: 16, fontSize: 13 }}>
              Bonnen, leveringsbrieven, certificaten en facturen die door de uitvoerder zijn gescand.
              Klik op een rij om de PDF te bekijken en goed te keuren.
            </Text>

            {documentsLoading ? (
              <ActivityIndicator size="large" color={theme.colors.accent} style={{ marginTop: 40 }} />
            ) : documents.length === 0 ? (
              <View
                style={{
                  padding: 40,
                  backgroundColor: theme.colors.surface,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.colors.borderWarm,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 48, marginBottom: 12 }}>📂</Text>
                <Text style={{ color: theme.colors.textPrimary, fontWeight: '700', fontSize: 16 }}>
                  Nog geen bonnen gescand
                </Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                  Zodra de uitvoerder op de telefoon een bon scant, verschijnt deze hier voor controle.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {documents.map((doc) => (
                  <View
                    key={doc.id}
                    style={{
                      flexDirection: isDesktop ? 'row' : 'column',
                      gap: 14,
                      padding: 14,
                      backgroundColor: theme.colors.surface,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: theme.colors.borderWarm,
                    }}
                  >
                    <Image
                      source={{ uri: doc.photoUrl }}
                      style={{ width: isDesktop ? 140 : '100%', height: isDesktop ? 100 : 180, borderRadius: 8 }}
                      resizeMode="cover"
                    />
                    <View style={{ flex: 1, justifyContent: 'space-between' }}>
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <View
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 3,
                              borderRadius: 12,
                              backgroundColor: theme.colors.accent + '22',
                            }}
                          >
                            <Text style={{ color: theme.colors.accent, fontSize: 11, fontWeight: '800' }}>
                              {doc.docType}
                            </Text>
                          </View>
                          <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                            {new Date(doc.createdAt).toLocaleString('nl-NL')}
                          </Text>
                        </View>
                        <Text style={{ color: theme.colors.textPrimary, fontWeight: '700', fontSize: 15, marginTop: 6 }}>
                          {doc.title ?? '— Geen titel —'}
                        </Text>
                        {doc.detectedFields && Object.keys(doc.detectedFields).length > 0 && (
                          <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 4 }} numberOfLines={2}>
                            {Object.entries(doc.detectedFields).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                          </Text>
                        )}
                      </View>

                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        <TouchableOpacity
                          onPress={() => openDocumentAsPrintablePdf(doc)}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 8,
                            backgroundColor: theme.colors.accent,
                          }}
                        >
                          <Text style={{ color: '#fff', fontWeight: '700' }}>📄 PDF bekijken</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => window.open(doc.photoUrl, '_blank')}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: theme.colors.borderWarm,
                          }}
                        >
                          <Text style={{ color: theme.colors.textPrimary, fontWeight: '600' }}>🔍 Origineel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={async () => {
                            if (!window.confirm(`Weet je zeker dat je "${doc.title ?? doc.docType}" wilt verwijderen?`)) return;
                            await deleteDocument(doc.id);
                            setDocuments((cur) => cur.filter((d) => d.id !== doc.id));
                          }}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: '#fca5a5',
                          }}
                        >
                          <Text style={{ color: theme.colors.statusWarning, fontWeight: '600' }}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Tab: QR-stickers ── */}
        {activeTab === 'stickers' && (
          <QRStickerSheet
            projectId={projectId ?? ''}
            projectName={projectName ?? 'Project'}
            theme={theme}
          />
        )}

        {/* ── Tab: Taakverdeling ── */}
        {activeTab === 'taken' && (
          <TaskAssignmentPanel
            projectId={projectId ?? ''}
            theme={theme}
          />
        )}

        {/* ── Tab: Rapportage ── */}
        {activeTab === 'rapportage' && (
          <RapportagePanel
            projectId={projectId ?? ''}
            projectName={projectName ?? 'Project'}
            evidence={evidence}
            theme={theme}
          />
        )}

      </ScrollView>

      {/* ── Email + Handtekening Modal ── */}
      <Modal
        visible={emailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEmailModal(false)}
      >
        <View style={[emailSt.modalRoot, { backgroundColor: theme.colors.background }]}>
          {/* Header */}
          <View style={[emailSt.modalHeader, { borderBottomColor: theme.colors.borderWarm }]}>
            <Text style={[emailSt.modalTitle, { color: theme.colors.textPrimary }]}>
              📧 Dossier ondertekenen & mailen
            </Text>
            <TouchableOpacity onPress={() => { setEmailModal(false); setEmailMsg(null); }} style={emailSt.closeBtn}>
              <Text style={[emailSt.closeBtnText, { color: theme.colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={emailSt.modalScroll} contentContainerStyle={emailSt.modalContent} showsVerticalScrollIndicator={false}>

            {/* Handtekening projectleider */}
            <View style={[emailSt.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderWarm }]}>
              <Text style={[emailSt.sectionTitle, { color: theme.colors.textSecondary }]}>HANDTEKENING PROJECTLEIDER</Text>
              <TextInput
                style={[emailSt.nameInput, { borderColor: theme.colors.borderWarm, color: theme.colors.textPrimary, backgroundColor: theme.colors.background }]}
                value={sigPLNaam}
                onChangeText={setSigPLNaam}
                placeholder="Naam projectleider"
                placeholderTextColor={theme.colors.textSecondary + '88'}
              />
              {sigPL ? (
                <View>
                  <Image source={{ uri: sigPL }} style={emailSt.sigPreview} resizeMode="contain" />
                  <TouchableOpacity onPress={() => setSigPL(null)} style={emailSt.clearSigBtn}>
                    <Text style={[emailSt.clearSigText, { color: theme.colors.statusWarning }]}>Handtekening wissen</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <SignaturePad
                  onSave={(dataUrl) => setSigPL(dataUrl)}
                  label=""
                  subLabel="Teken met muis of vinger"
                  theme={theme}
                />
              )}
            </View>

            {/* Handtekening opdrachtgever */}
            <View style={[emailSt.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderWarm }]}>
              <Text style={[emailSt.sectionTitle, { color: theme.colors.textSecondary }]}>HANDTEKENING OPDRACHTGEVER</Text>
              <TextInput
                style={[emailSt.nameInput, { borderColor: theme.colors.borderWarm, color: theme.colors.textPrimary, backgroundColor: theme.colors.background }]}
                value={sigOGNaam}
                onChangeText={setSigOGNaam}
                placeholder="Naam opdrachtgever"
                placeholderTextColor={theme.colors.textSecondary + '88'}
              />
              {sigOG ? (
                <View>
                  <Image source={{ uri: sigOG }} style={emailSt.sigPreview} resizeMode="contain" />
                  <TouchableOpacity onPress={() => setSigOG(null)} style={emailSt.clearSigBtn}>
                    <Text style={[emailSt.clearSigText, { color: theme.colors.statusWarning }]}>Handtekening wissen</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <SignaturePad
                  onSave={(dataUrl) => setSigOG(dataUrl)}
                  label=""
                  subLabel="Teken met muis of vinger"
                  theme={theme}
                />
              )}
            </View>

            {/* Acties: PDF of Mailen */}
            <View style={[emailSt.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderWarm }]}>
              <Text style={[emailSt.sectionTitle, { color: theme.colors.textSecondary }]}>EXPORTEREN</Text>

              {/* PDF downloaden */}
              <TouchableOpacity
                style={[emailSt.actionBtn, { backgroundColor: theme.colors.accent + '18', borderColor: theme.colors.accent + '40' }]}
                onPress={handlePdfWithSig}
                disabled={pdfLoading}
                activeOpacity={0.8}
              >
                {pdfLoading
                  ? <ActivityIndicator size="small" color={theme.colors.accent} />
                  : <Text style={[emailSt.actionBtnText, { color: theme.colors.accent }]}>📄 PDF opslaan / Afdrukken</Text>
                }
              </TouchableOpacity>

              {/* Sprint 4 — Officieel WKB-rapport (3 formats) */}
              <TouchableOpacity
                style={[emailSt.actionBtn, { backgroundColor: '#11182710', borderColor: '#11182740' }]}
                onPress={() => setExportModalVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={[emailSt.actionBtnText, { color: '#111827' }]}>
                  📑 Officieel WKB-rapport (Gemeente / Borger)
                </Text>
              </TouchableOpacity>

              {/* E-mail verzenden */}
              <Text style={[emailSt.fieldLabel, { color: theme.colors.textSecondary }]}>E-MAILADRES ONTVANGER</Text>
              <TextInput
                style={[emailSt.emailInput, { borderColor: theme.colors.borderWarm, color: theme.colors.textPrimary, backgroundColor: theme.colors.background }]}
                value={emailAddress}
                onChangeText={setEmailAddress}
                placeholder="opdrachtgever@bedrijf.nl"
                placeholderTextColor={theme.colors.textSecondary + '88'}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />

              <TouchableOpacity
                style={[emailSt.actionBtn, emailSt.actionBtnPrimary]}
                onPress={handleEmailDossier}
                disabled={emailSending}
                activeOpacity={0.8}
              >
                {emailSending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={[emailSt.actionBtnText, { color: '#fff' }]}>📧 Dossier per mail versturen</Text>
                }
              </TouchableOpacity>

              {emailMsg ? (
                <View style={[emailSt.msgBanner, {
                  backgroundColor: emailMsg.startsWith('✅') ? 'rgba(5,150,105,0.1)' :
                                   emailMsg.startsWith('❌') ? 'rgba(239,68,68,0.08)' :
                                   theme.colors.accent + '12',
                  borderColor: emailMsg.startsWith('✅') ? 'rgba(5,150,105,0.3)' :
                               emailMsg.startsWith('❌') ? 'rgba(239,68,68,0.25)' :
                               theme.colors.accent + '30',
                }]}>
                  <Text style={[emailSt.msgText, {
                    color: emailMsg.startsWith('✅') ? theme.colors.statusSuccess :
                           emailMsg.startsWith('❌') ? theme.colors.statusWarning :
                           theme.colors.accent,
                  }]}>{emailMsg}</Text>
                </View>
              ) : null}
            </View>

          </ScrollView>
        </View>
      </Modal>

      {/* ── Dossier Lock bevestigings-modal (Sprint 3) ── */}
      <Modal
        visible={lockConfirmModal}
        animationType="fade"
        transparent
        onRequestClose={() => !lockLoading && setLockConfirmModal(false)}
      >
        <View style={lockSt.backdrop}>
          <View style={[lockSt.dialog, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderWarm }]}>
            <Text style={[lockSt.title, { color: theme.colors.textPrimary }]}>
              🔒 Dossier afsluiten?
            </Text>

            <Text style={[lockSt.body, { color: theme.colors.textSecondary }]}>
              Je staat op het punt het WKB-borgingsdossier af te sluiten. Dit is verplicht
              vóór oplevering volgens de juridische bewaarplicht.
            </Text>

            <View style={[lockSt.warnBox, { backgroundColor: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.35)' }]}>
              <Text style={[lockSt.warnTitle, { color: theme.colors.statusWarning }]}>⚠️ Onomkeerbaar</Text>
              <Text style={[lockSt.warnBody, { color: theme.colors.statusWarning }]}>
                • Alle bewijzen worden read-only.{'\n'}
                • Foto's, opmerkingen en statussen kunnen niet meer gewijzigd worden.{'\n'}
                • Deze actie kan niet ongedaan gemaakt worden.
              </Text>
            </View>

            {(sigPLNaam || sigOGNaam) ? (
              <Text style={[lockSt.signed, { color: theme.colors.textSecondary }]}>
                Ondertekend door: {sigPLNaam || '—'}{sigOGNaam ? ` & ${sigOGNaam}` : ''}
              </Text>
            ) : (
              <Text style={[lockSt.signed, { color: '#d97706' }]}>
                ℹ️ Tip: onderteken het dossier eerst (zie "{t('header.sign')}") voordat je afsluit.
              </Text>
            )}

            {lockMsg ? (
              <View style={[lockSt.msgBanner, {
                backgroundColor: lockMsg.startsWith('✅') ? 'rgba(5,150,105,0.1)' : 'rgba(239,68,68,0.08)',
                borderColor:     lockMsg.startsWith('✅') ? 'rgba(5,150,105,0.3)' : 'rgba(239,68,68,0.25)',
              }]}>
                <Text style={[lockSt.msgText, { color: lockMsg.startsWith('✅') ? theme.colors.statusSuccess : theme.colors.statusWarning }]}>{lockMsg}</Text>
              </View>
            ) : null}

            <View style={lockSt.buttonRow}>
              <TouchableOpacity
                onPress={() => setLockConfirmModal(false)}
                disabled={lockLoading}
                style={[lockSt.btn, lockSt.btnGhost, { borderColor: theme.colors.borderWarm }]}
                activeOpacity={0.7}
              >
                <Text style={[lockSt.btnText, { color: theme.colors.textSecondary }]}>Annuleren</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleLockDossier}
                disabled={lockLoading || isDossierLocked}
                style={[lockSt.btn, lockSt.btnDanger]}
                activeOpacity={0.85}
              >
                {lockLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={[lockSt.btnText, { color: '#fff' }]}>🔒 Definitief afsluiten</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sprint 4 — Officieel WKB-rapport export */}
      <DossierExportModal
        visible={exportModalVisible}
        onClose={() => setExportModalVisible(false)}
        evidence={evidence.map((e: any) => ({
          id: e.id,
          projectId,
          inspectionPointId: e.inspection_point_id ?? 'onbekend',
          mediaUri: e.media_uri ?? e.photo_uri ?? '',
          timestamp: e.timestamp ?? '',
          latitude: e.latitude ?? null,
          longitude: e.longitude ?? null,
          gpsAccuracy: e.gps_accuracy ?? null,
          exifHash: e.exif_hash ?? null,
          exifVerified: e.exif_verified ?? null,
          aiStatus: e.ai_status ?? null,
          aiNotes: e.ai_notes ?? null,
          aiConfidence: e.ai_confidence ?? null,
          fieldNote: e.field_note ?? null,
          floorPlanId: e.floor_plan_id ?? null,
          pinX: e.pin_x ?? null,
          pinY: e.pin_y ?? null,
          syncStatus: (e.sync_status ?? 'SYNCED') as any,
          weatherLabel: e.weather_label ?? null,
        }))}
        projectId={projectId}
        projectName={projectName}
        signatures={{
          projectleider: sigPL ?? undefined,
          projectleiderNaam: sigPLNaam || undefined,
          opdrachtgever: sigOG ?? undefined,
          opdrachtgeverNaam: sigOGNaam || undefined,
          signedAt: (sigPL || sigOG) ? new Date().toISOString() : undefined,
        }}
      />

    </View>
  );
}

// ─── Tab: Dashboard ───────────────────────────────────────────────────────────

interface DashboardTabProps {
  borgingspuntGrid: { id: string; count: number; bucket: string }[];
  loading: boolean;
  metrics: { total: number; akkoord: number; review: number; afgekeurd: number; vandaag: number };
  theme: { colors: Record<string, string> };
  onGotoReview: () => void;
  categoryStats: { label: string; passed: number; total: number }[];
  trendDays: { day: string; count: number }[];
  vakmanStats: { userId: string; label: string; total: number; akkoord: number; vandaag: number }[];
}

function DashboardTab({ borgingspuntGrid, loading, metrics, theme, onGotoReview, categoryStats, trendDays, vakmanStats }: DashboardTabProps) {
  if (loading) {
    return <View style={tabSt.centered}><ActivityIndicator size="large" color={theme.colors.accent} /></View>;
  }

  if (borgingspuntGrid.length === 0) {
    return (
      <View style={tabSt.emptyBox}>
        <EmptyProjectWizard />
      </View>
    );
  }

  const needsReview = borgingspuntGrid.filter(b => b.bucket === 'review').length;

  return (
    <View style={{ gap: 20 }}>
      {needsReview > 0 && (
        <TouchableOpacity
          style={[tabSt.reviewBanner, { backgroundColor: 'rgba(217,119,6,0.1)', borderColor: '#d97706' }]}
          onPress={onGotoReview}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: 20 }}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#92400e', fontWeight: '800', fontSize: 14 }}>
              {needsReview} borgingspunt{needsReview !== 1 ? 'en' : ''} wacht{needsReview === 1 ? '' : 'en'} op review
            </Text>
            <Text style={{ color: '#b45309', fontSize: 12, marginTop: 2 }}>
              Tik om naar Bewijs te gaan →
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* 📊 Voortgangsgrafiek */}
      <ProjectProgressBlock
        total={metrics.total}
        passed={metrics.akkoord}
        review={metrics.review}
        failed={metrics.afgekeurd}
        pending={metrics.total - metrics.akkoord - metrics.review - metrics.afgekeurd}
        vandaag={metrics.vandaag}
        categoryStats={categoryStats}
        trendDays={trendDays}
        theme={theme as Parameters<typeof ProjectProgressBlock>[0]['theme']}
      />

      <Text style={[tabSt.sectionTitle, { color: theme.colors.textSecondary }]}>
        BORGINGSPUNTEN VOORTGANG
      </Text>

      <View style={tabSt.borgingGrid}>
        {borgingspuntGrid.map(({ id, count, bucket }) => {
          const cfg = bucketConfig(bucket);
          return (
            <View key={id} style={[tabSt.borgingCell, { backgroundColor: cfg.bg }]}>
              <Text style={[tabSt.borgingIcon, { color: cfg.text }]}>{cfg.icon}</Text>
              <Text style={[tabSt.borgingId, { color: cfg.text }]} numberOfLines={2}>{id}</Text>
              <Text style={[tabSt.borgingCount, { color: cfg.text }]}>{count} foto{count !== 1 ? "'s" : ''}</Text>
            </View>
          );
        })}
      </View>

      {/* Vakman statistieken */}
      {vakmanStats.length > 0 && (
        <>
          <Text style={[tabSt.sectionTitle, { color: theme.colors.textSecondary, marginTop: 8 }]}>
            VAKMENSEN — UPLOADS
          </Text>
          <View style={[tabSt.vakmanCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderWarm }]}>
            {vakmanStats.map((v, i) => {
              const pct = v.total > 0 ? Math.round((v.akkoord / v.total) * 100) : 0;
              const maxTotal = vakmanStats[0].total;
              const barW = maxTotal > 0 ? (v.total / maxTotal) * 100 : 0;
              return (
                <View key={v.userId} style={[tabSt.vakmanRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.borderWarm }]}>
                  <View style={[tabSt.vakmanRank, { backgroundColor: i === 0 ? theme.colors.accent + '20' : theme.colors.borderWarm + '40' }]}>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: i === 0 ? theme.colors.accent : theme.colors.textSecondary }}>
                      {i + 1}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.textPrimary }} numberOfLines={1}>
                        {v.label}
                      </Text>
                      <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                        {v.total} foto{v.total !== 1 ? "'s" : ''}{v.vandaag > 0 ? ` · ${v.vandaag} vandaag` : ''}
                      </Text>
                    </View>
                    <View style={[tabSt.vakmanBar, { backgroundColor: theme.colors.borderWarm }]}>
                      <View style={[tabSt.vakmanBarFill, { width: `${barW}%` as `${number}%`, backgroundColor: theme.colors.accent + '50' }]} />
                      <View style={[tabSt.vakmanBarFill, {
                        position: 'absolute', left: 0,
                        width: `${(v.akkoord / (vakmanStats[0].total || 1)) * 100}%` as `${number}%`,
                        backgroundColor: theme.colors.statusSuccess,
                      }]} />
                    </View>
                    <Text style={{ fontSize: 10, color: pct >= 80 ? theme.colors.statusSuccess : pct >= 40 ? '#d97706' : theme.colors.textSecondary, fontWeight: '700' }}>
                      {pct}% akkoord
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

function bucketConfig(bucket: string) {
  switch (bucket) {
    case 'akkoord':   return { bg: 'rgba(5,150,105,0.1)',   text: tokens.forest, icon: '✓' };
    case 'review':    return { bg: 'rgba(245,158,11,0.12)', text: '#92400e', icon: '⚠' };
    case 'afgekeurd': return { bg: 'rgba(239,68,68,0.1)',   text: tokens.terracotta, icon: '✗' };
    default:          return { bg: 'rgba(148,163,184,0.1)', text: tokens.inkSoft, icon: '○' };
  }
}

// ─── Tab: Bewijs ──────────────────────────────────────────────────────────────

interface BewijsTabProps {
  evidence: EvidenceRow[];
  allEvidence: EvidenceRow[];
  filter: FilterStatus;
  setFilter: (f: FilterStatus) => void;
  metrics: { total: number; akkoord: number; review: number; afgekeurd: number; vandaag: number };
  loading: boolean;
  theme: { colors: Record<string, string> };
  isDark: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onBulkApprove: (ids: string[]) => Promise<void>;
  onBulkReject: (ids: string[]) => Promise<void>;
  onEdit: (id: string, updates: { field_note?: string; inspection_point_id?: string; ai_status?: string }) => void;
  onReview: (id: string, action: ReviewAction, note?: string) => Promise<void>;
  projectId: string;
  commentCountMap: Map<string, number>;
}

const FILTERS: { id: FilterStatus; label: string }[] = [
  { id: 'alle',      label: 'Alle' },
  { id: 'review',    label: '⚠ Review' },
  { id: 'akkoord',   label: '✓ Akkoord' },
  { id: 'afgekeurd', label: '✗ Afgekeurd' },
  { id: 'pending',   label: '○ Pending' },
];

function BewijsTab({ evidence, allEvidence, filter, setFilter, metrics, loading, theme, isDark, onApprove, onReject, onBulkApprove, onBulkReject, onEdit, onReview, projectId, commentCountMap }: BewijsTabProps) {
  const [reviewRejectId, setReviewRejectId] = useState<string | null>(null);
  const [reviewRejectNote, setReviewRejectNote] = useState('');
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [commentsOpenId, setCommentsOpenId] = useState<string | null>(null);
  /**
   * 5-Card Rule (Johnny 24 mei): minstens 5 evidence-kaarten zichtbaar zonder
   * scrollen. Daarom verbergen we secundaire acties (WhatsApp, Beoordelen,
   * Comments, Edit) standaard achter "⋯ Meer". Alleen ✓ Goed + ✗ Afkeur + ⋯
   * staan inline. Per-card toggle: open/sluit met dezelfde knop.
   */
  const [moreActionsId, setMoreActionsId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFieldNote, setEditFieldNote] = useState('');
  const [editPointId, setEditPointId] = useState('');
  const [editStatus, setEditStatus] = useState<string>('');

  // Laag 2 — Diagnose zijpaneel state. Standaard verborgen, schuift in op klik.
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRow | null>(null);

  // Laag 3 — taakgerichte actie-modal. Isoleert beoordeling van de lijst.
  const [actionTarget, setActionTarget] = useState<EvidenceRow | null>(null);

  // Adapter: map EvidenceRow → DiagnoseSidePanel shape.
  const sidePanelItem = useMemo(() => {
    if (!selectedEvidence) return null;
    const bucket = toBucket(selectedEvidence.ai_status);
    const status: 'success' | 'warning' | 'neutral' =
      bucket === 'akkoord' ? 'success' : bucket === 'review' || bucket === 'afgekeurd' ? 'warning' : 'neutral';
    const statusLabel =
      bucket === 'akkoord' ? 'Goedgekeurd'
      : bucket === 'review' ? 'Review nodig'
      : bucket === 'afgekeurd' ? 'Afgekeurd'
      : 'Openstaand';
    const gps =
      selectedEvidence.latitude != null && selectedEvidence.longitude != null
        ? `${selectedEvidence.latitude.toFixed(5)}, ${selectedEvidence.longitude.toFixed(5)}`
        : null;
    return {
      status,
      statusLabel,
      aiReason: selectedEvidence.ai_notes ?? null,
      timestamp: selectedEvidence.timestamp ? fmtDate(selectedEvidence.timestamp) : null,
      gps,
      uploadedBy: selectedEvidence.user_id ?? null,
    };
  }, [selectedEvidence]);

  // Advanced search filter
  const displayed = useMemo(() => {
    if (!searchQuery && !dateFrom && !dateTo) return evidence;
    const q = searchQuery.toLowerCase();
    return evidence.filter(e => {
      if (q && !e.inspection_point_id?.toLowerCase().includes(q) &&
          !e.field_note?.toLowerCase().includes(q) &&
          !e.ai_notes?.toLowerCase().includes(q)) return false;
      if (dateFrom && e.timestamp && e.timestamp < dateFrom) return false;
      if (dateTo && e.timestamp && e.timestamp > dateTo + 'T23:59:59') return false;
      return true;
    });
  }, [evidence, searchQuery, dateFrom, dateTo]);

  const hasActiveSearch = !!(searchQuery || dateFrom || dateTo);

  const clearSearch = useCallback(() => {
    setSearchQuery(''); setDateFrom(''); setDateTo('');
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAllReview = useCallback(() => {
    setSelectedIds(new Set(evidence.filter(e => toBucket(e.ai_status) === 'review').map(e => e.id)));
  }, [evidence]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleBulkApprove = useCallback(async () => {
    setBatchBusy(true);
    await onBulkApprove(Array.from(selectedIds));
    setSelectedIds(new Set());
    setBatchBusy(false);
  }, [selectedIds, onBulkApprove]);

  const handleBulkReject = useCallback(async () => {
    setBatchBusy(true);
    await onBulkReject(Array.from(selectedIds));
    setSelectedIds(new Set());
    setBatchBusy(false);
  }, [selectedIds, onBulkReject]);

  const handleCsvExport = useCallback(() => {
    const rows: ExportEvidenceRow[] = allEvidence.map(e => ({
      id: e.id,
      projectId: e.project_id,
      inspectionPointId: e.inspection_point_id,
      timestamp: e.timestamp,
      aiStatus: e.ai_status,
      aiNotes: e.ai_notes,
      fieldNote: e.field_note,
      userId: e.user_id,
      latitude: e.latitude,
      longitude: e.longitude,
      mediaUri: e.media_uri ?? e.photo_uri,
      floorPlanId: e.floor_plan_id,
      pinX: e.pin_x,
      pinY: e.pin_y,
    }));
    downloadCsv(evidenceToCsv(rows), makeExportFilename(projectId, 'csv'));
  }, [allEvidence, projectId]);

  const reviewCount = evidence.filter(e => toBucket(e.ai_status) === 'review').length;

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  useKeyboardShortcuts([
    {
      key: 'a',
      handler: () => { if (selectedIds.size > 0) void handleBulkApprove(); },
      description: 'Geselecteerde foto\'s goedkeuren',
    },
    {
      key: 'r',
      handler: () => { if (selectedIds.size > 0) void handleBulkReject(); },
      description: 'Geselecteerde foto\'s afkeuren',
    },
    {
      key: 'Escape',
      handler: clearSelection,
      description: 'Selectie wissen',
    },
  ], selectedIds.size > 0);

  // ListHeaderComponent — alle UI bovenaan de bewijslijst.
  // Gerendered ÉÉN keer door FlatList, niet per evidence-item.
  const renderListHeader = () => (
    <View style={{ gap: 12, marginBottom: 12 }}>
      {/* Bewijs header: CSV export + batch selectie snelkoppelingen */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <TouchableOpacity
          onPress={handleCsvExport}
          style={[tabSt.filterChip, { backgroundColor: 'rgba(5,150,105,0.1)', borderColor: 'rgba(5,150,105,0.3)' }]}
          activeOpacity={0.8}
        >
          <Text style={{ color: theme.colors.statusSuccess, fontSize: 12, fontWeight: '800' }}>📊 CSV exporteren</Text>
        </TouchableOpacity>
        {reviewCount > 0 && selectedIds.size === 0 && (
          <TouchableOpacity
            onPress={selectAllReview}
            style={[tabSt.filterChip, { backgroundColor: 'rgba(217,119,6,0.1)', borderColor: 'rgba(217,119,6,0.3)' }]}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#d97706', fontSize: 12, fontWeight: '800' }}>☑ {reviewCount} review selecteren</Text>
          </TouchableOpacity>
        )}
        {selectedIds.size > 0 && (
          <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '700', flex: 1 }}>
            {selectedIds.size} geselecteerd
          </Text>
        )}
      </View>

      {/* Batch actie balk */}
      {selectedIds.size > 0 && (
        <View style={[tabSt.batchBar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderWarm }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
              {selectedIds.size} foto{selectedIds.size !== 1 ? "'s" : ''} geselecteerd
            </Text>
            <Text style={{ color: theme.colors.textSecondary + '88', fontSize: 10, marginTop: 2 }}>
              A = goedkeuren · R = afkeuren · Esc = wissen
            </Text>
          </View>
          <TouchableOpacity
            style={[tabSt.approveBtn, { opacity: batchBusy ? 0.5 : 1 }]}
            onPress={handleBulkApprove}
            disabled={batchBusy}
            activeOpacity={0.8}
          >
            <Text style={tabSt.approveBtnText}>✓ Alles goedkeuren</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[tabSt.rejectBtn, { borderColor: theme.colors.statusWarning, opacity: batchBusy ? 0.5 : 1 }]}
            onPress={handleBulkReject}
            disabled={batchBusy}
            activeOpacity={0.8}
          >
            <Text style={[tabSt.rejectBtnText, { color: theme.colors.statusWarning }]}>✗ Alles afkeuren</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={clearSelection} style={{ padding: 6 }}>
            <Text style={{ color: theme.colors.textSecondary, fontWeight: '700' }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Zoeken toggle */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TouchableOpacity
          onPress={() => setShowSearch(v => !v)}
          style={[tabSt.filterChip, {
            backgroundColor: (showSearch || hasActiveSearch) ? theme.colors.accent + '15' : theme.colors.surface,
            borderColor: hasActiveSearch ? theme.colors.accent : theme.colors.borderWarm,
          }]}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: 12, fontWeight: '800', color: hasActiveSearch ? theme.colors.accent : theme.colors.textSecondary }}>
            🔍 Zoeken{hasActiveSearch ? ` (actief)` : ''}
          </Text>
        </TouchableOpacity>
        {hasActiveSearch && (
          <TouchableOpacity onPress={clearSearch} style={{ padding: 4 }}>
            <Text style={{ fontSize: 12, color: theme.colors.statusWarning, fontWeight: '700' }}>✕ Wissen</Text>
          </TouchableOpacity>
        )}
        {hasActiveSearch && (
          <Text style={{ fontSize: 12, color: theme.colors.textSecondary, flex: 1, textAlign: 'right' }}>
            {displayed.length} resultaten
          </Text>
        )}
      </View>

      {/* Zoekpaneel */}
      {showSearch && (
        <View style={[tabSt.searchPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderWarm }]}>
          <TextInput
            style={[tabSt.searchInput, { color: theme.colors.textPrimary, borderColor: theme.colors.borderWarm, backgroundColor: theme.colors.background, outlineStyle: 'none' } as ReturnType<typeof StyleSheet.create>[string]]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Borgingspunt, notitie of AI-bevinding..."
            placeholderTextColor={theme.colors.textSecondary + '88'}
            autoCorrect={false}
          />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: 120 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: theme.colors.textSecondary, marginBottom: 4, letterSpacing: 1 }}>DATUM VAN</Text>
              <TextInput
                style={[tabSt.searchInput, { color: theme.colors.textPrimary, borderColor: theme.colors.borderWarm, backgroundColor: theme.colors.background, outlineStyle: 'none' } as ReturnType<typeof StyleSheet.create>[string]]}
                value={dateFrom}
                onChangeText={setDateFrom}
                placeholder="2026-05-01"
                placeholderTextColor={theme.colors.textSecondary + '88'}
              />
            </View>
            <View style={{ flex: 1, minWidth: 120 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: theme.colors.textSecondary, marginBottom: 4, letterSpacing: 1 }}>DATUM TOT</Text>
              <TextInput
                style={[tabSt.searchInput, { color: theme.colors.textPrimary, borderColor: theme.colors.borderWarm, backgroundColor: theme.colors.background, outlineStyle: 'none' } as ReturnType<typeof StyleSheet.create>[string]]}
                value={dateTo}
                onChangeText={setDateTo}
                placeholder="2026-05-31"
                placeholderTextColor={theme.colors.textSecondary + '88'}
              />
            </View>
          </View>
        </View>
      )}

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexShrink: 0 }}>
        <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
          {FILTERS.map(f => {
            const count = f.id === 'alle' ? metrics.total
              : f.id === 'akkoord'   ? metrics.akkoord
              : f.id === 'review'    ? metrics.review
              : f.id === 'afgekeurd' ? metrics.afgekeurd
              : 0;
            const isActive = filter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[
                  tabSt.filterChip,
                  { backgroundColor: isActive ? theme.colors.accent : theme.colors.surface, borderColor: isActive ? theme.colors.accent : theme.colors.borderWarm },
                ]}
                onPress={() => setFilter(f.id)}
              >
                <Text style={[tabSt.filterChipText, { color: isActive ? '#fff' : theme.colors.textPrimary }]}>
                  {f.label}
                </Text>
                {count > 0 && (
                  <Text style={[tabSt.filterChipCount, { color: isActive ? 'rgba(255,255,255,0.8)' : theme.colors.textSecondary }]}>
                    {count}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );

  // ListEmptyComponent — loading- of empty-state binnen FlatList rendering.
  const renderListEmpty = () => {
    if (loading) {
      return <View style={tabSt.centered}><ActivityIndicator color={theme.colors.accent} /></View>;
    }
    return (
      <View style={tabSt.emptyBox}>
        <Text style={{ fontSize: 40 }}>{hasActiveSearch ? '🔍' : '📭'}</Text>
        <Text style={[tabSt.emptyTitle, { color: theme.colors.textPrimary }]}>
          {hasActiveSearch ? 'Geen resultaten' : filter === 'alle' ? 'Nog geen bewijsstukken' : `Geen ${filter} items`}
        </Text>
        <Text style={[tabSt.emptyBody, { color: theme.colors.textSecondary }]}>
          {hasActiveSearch
            ? 'Pas je zoekterm of datum aan.'
            : filter === 'alle'
              ? 'Vaklieden uploaden foto\'s via de app. Ze verschijnen hier zodra ze binnenkomen.'
              : 'Alle foto\'s in deze categorie zijn verwerkt.'}
        </Text>
      </View>
    );
  };

  // renderEvidenceCard — één evidence-item. Closure-state (expandedId,
  // selectedIds, editingId, …) zit in BewijsTab-scope, dus geen extra props nodig.
  const renderEvidenceCard = ({ item }: { item: EvidenceRow }) => {
    const bucket   = toBucket(item.ai_status);
    const cfg      = bucketConfig(bucket);
    const uri      = item.media_uri ?? item.photo_uri ?? null;
    const isOpen   = expandedId === item.id;
    const stale    = isStale(item.timestamp, item.ai_status);

    const isSelected = selectedIds.has(item.id);

    return (
      <View
        style={[tabSt.evidenceCard, {
          marginBottom: 8,
          backgroundColor: isSelected ? theme.colors.accent + '08' : theme.colors.surface,
          borderColor: isSelected ? theme.colors.accent : isOpen ? theme.colors.accent : stale ? theme.colors.statusWarning : bucket === 'review' ? '#d97706' : theme.colors.borderWarm,
        }]}
      >
                {/* Collapsed rij */}
                <TouchableOpacity
                  style={tabSt.evidenceRow}
                  onPress={() => setExpandedId(isOpen ? null : item.id)}
                  activeOpacity={0.75}
                >
                  {/* Selectie checkbox */}
                  <TouchableOpacity
                    style={[tabSt.checkBox, {
                      borderColor: isSelected ? theme.colors.accent : theme.colors.borderWarm,
                      backgroundColor: isSelected ? theme.colors.accent : 'transparent',
                      width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                    }]}
                    onPress={() => toggleSelect(item.id)}
                    activeOpacity={0.7}
                  >
                    {isSelected && <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>✓</Text>}
                  </TouchableOpacity>
                  {/* Thumbnail */}
                  <View style={{ position: 'relative', flexShrink: 0 }}>
                    {uri
                      ? <Image source={{ uri }} style={tabSt.thumb} resizeMode="cover" />
                      : <View style={[tabSt.thumbEmpty, { backgroundColor: theme.colors.borderWarm }]}><Text style={{ fontSize: 20 }}>📷</Text></View>
                    }
                    {/* Sync dot */}
                    <View style={[tabSt.syncDot, {
                      backgroundColor: item.sync_status === 'SYNCED' ? theme.colors.statusSuccess : item.sync_status === 'FAILED' ? theme.colors.statusWarning : '#d97706',
                      borderColor: isDark ? '#111' : '#fff',
                    }]} />
                  </View>

                  {/* Info */}
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[tabSt.evidencePid, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                      {item.inspection_point_id ?? '—'}
                    </Text>
                    <Text style={[tabSt.evidenceMeta, { color: theme.colors.textSecondary }]}>
                      🕐 {fmtDate(item.timestamp)}
                    </Text>
                    {item.latitude != null && (
                      <Text style={[tabSt.evidenceMeta, { color: theme.colors.textSecondary }]}>
                        📍 {item.latitude.toFixed(4)}, {item.longitude?.toFixed(4)}
                      </Text>
                    )}
                    {item.field_note ? (
                      <Text style={[tabSt.evidenceMeta, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                        📝 {item.field_note}
                      </Text>
                    ) : null}
                  </View>

                  {/* Status badge */}
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View style={[tabSt.statusBadge, { backgroundColor: cfg.bg }]}>
                      <Text style={[tabSt.statusBadgeText, { color: cfg.text }]}>
                        {cfg.icon} {bucket.charAt(0).toUpperCase() + bucket.slice(1)}
                      </Text>
                    </View>
                    {/* Review badge — keurmeester workflow, los van AI-status */}
                    {(() => {
                      const rb = reviewBadgeFor(item.review_status);
                      return (
                        <View style={[tabSt.statusBadge, { backgroundColor: rb.bg }]}>
                          <Text style={[tabSt.statusBadgeText, { color: rb.fg }]}>
                            {rb.emoji} {rb.label}
                          </Text>
                        </View>
                      );
                    })()}
                    {stale && (
                      <View style={[tabSt.statusBadge, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                        <Text style={[tabSt.statusBadgeText, { color: theme.colors.statusWarning }]}>⏰ 24u+</Text>
                      </View>
                    )}
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>{isOpen ? '▲' : '▼'}</Text>
                  </View>
                </TouchableOpacity>

                {/* Primary actierij — alleen ✓ Goed + ✗ Afkeur + ⋯ Meer.
                    Per "5-Card Rule" (Johnny 24 mei): kleine inline rij zodat
                    minimaal 5 evidence-kaarten zichtbaar zijn zonder scrollen.
                    Secundaire acties (WhatsApp / Beoordelen / 💬 / ✏️) zitten
                    achter ⋯ Meer (default dicht). */}
                <View style={[tabSt.actionRow, { borderTopColor: theme.colors.borderWarm }]}>
                  <TouchableOpacity
                    style={[tabSt.approveBtn, { opacity: bucket === 'akkoord' ? 0.45 : 1 }]}
                    onPress={() => onApprove(item.id)}
                    disabled={bucket === 'akkoord'}
                    activeOpacity={0.8}
                  >
                    <Text style={tabSt.approveBtnText}>✓ Goed</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[tabSt.rejectBtn, { opacity: bucket === 'afgekeurd' ? 0.45 : 1, borderColor: theme.colors.borderWarm }]}
                    onPress={() => onReject(item.id)}
                    disabled={bucket === 'afgekeurd'}
                    activeOpacity={0.8}
                  >
                    <Text style={[tabSt.rejectBtnText, { color: theme.colors.statusWarning }]}>✗ Afkeur</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[tabSt.rejectBtn, {
                      borderColor: moreActionsId === item.id ? theme.colors.accent + '60' : theme.colors.borderWarm,
                      backgroundColor: moreActionsId === item.id ? theme.colors.accent + '10' : 'transparent',
                    }]}
                    onPress={() => setMoreActionsId(prev => prev === item.id ? null : item.id)}
                    activeOpacity={0.8}
                    accessibilityLabel={moreActionsId === item.id ? 'Meer acties verbergen' : 'Meer acties tonen'}
                  >
                    <Text style={{ fontSize: 12, color: moreActionsId === item.id ? theme.colors.accent : theme.colors.textSecondary, fontWeight: '800' }}>
                      ⋯ Meer
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ marginLeft: 'auto' as unknown as number, padding: 8 }}
                    onPress={() => setExpandedId(isOpen ? null : item.id)}
                    accessibilityLabel={isOpen ? 'Details inklappen' : 'Details uitklappen'}
                  >
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                      {isOpen ? '▲' : '▼'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Secundaire actierij — alleen zichtbaar via "⋯ Meer" toggle */}
                {moreActionsId === item.id ? (
                  <View style={[tabSt.actionRow, { borderTopColor: theme.colors.borderWarm }]}>
                    <TouchableOpacity
                      style={[tabSt.rejectBtn, { borderColor: 'rgba(37,211,102,0.4)', backgroundColor: 'rgba(37,211,102,0.08)' }]}
                      onPress={() => shareViaWhatsApp({
                        projectId,
                        taskTitle: item.inspection_point_id ?? 'Borgingspunt',
                        inspectionPointId: item.inspection_point_id ?? item.id,
                        timestamp: item.timestamp ?? new Date().toISOString(),
                        latitude: item.latitude ?? 0,
                        longitude: item.longitude ?? 0,
                        evidenceId: item.id,
                      })}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: '#25D366', fontSize: 12, fontWeight: '800' }}>📱 WhatsApp</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[tabSt.rejectBtn, {
                        borderColor: theme.colors.borderWarm,
                        backgroundColor: 'transparent',
                      }]}
                      onPress={() => setSelectedEvidence(item)}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 12, color: theme.colors.textPrimary, fontWeight: '700' }}>
                        🔍 Diagnose
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[tabSt.rejectBtn, {
                        borderColor: theme.colors.borderWarm,
                        backgroundColor: 'transparent',
                      }]}
                      onPress={() => setActionTarget(item)}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 12, color: theme.colors.textPrimary, fontWeight: '700' }}>
                        🔨 Beoordelen
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[tabSt.rejectBtn, {
                        borderColor: commentsOpenId === item.id ? theme.colors.accent + '60' : theme.colors.borderWarm,
                        backgroundColor: commentsOpenId === item.id ? theme.colors.accent + '10' : 'transparent',
                      }]}
                      onPress={() => {
                        setCommentsOpenId(prev => prev === item.id ? null : item.id);
                        if (expandedId !== item.id) setExpandedId(item.id);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 12, color: commentsOpenId === item.id ? theme.colors.accent : theme.colors.textSecondary, fontWeight: '800' }}>
                        💬{(commentCountMap.get(item.id) ?? 0) > 0 ? ` ${commentCountMap.get(item.id)}` : ''}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[tabSt.rejectBtn, {
                        borderColor: editingId === item.id ? theme.colors.accent + '60' : theme.colors.borderWarm,
                        backgroundColor: editingId === item.id ? theme.colors.accent + '10' : 'transparent',
                      }]}
                      onPress={() => {
                        if (editingId === item.id) {
                          setEditingId(null);
                        } else {
                          setEditingId(item.id);
                          setEditFieldNote(item.field_note ?? '');
                          setEditPointId(item.inspection_point_id ?? '');
                          setEditStatus(item.ai_status ?? 'PENDING');
                          if (expandedId !== item.id) setExpandedId(item.id);
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 12, color: editingId === item.id ? theme.colors.accent : theme.colors.textSecondary }}>✏️ Bewerk</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* Uitgebreid */}
                {isOpen && (
                  <View style={[tabSt.expanded, { borderTopColor: theme.colors.borderWarm }]}>
                    {uri && <Image source={{ uri }} style={tabSt.thumbLarge} resizeMode="contain" />}
                    <View style={{ gap: 6, marginTop: 10 }}>
                      {item.ai_notes ? (
                        <View style={[tabSt.infoRow, { backgroundColor: cfg.bg }]}>
                          <Text style={[tabSt.infoLabel, { color: cfg.text }]}>AI notitie</Text>
                          <Text style={[tabSt.infoValue, { color: cfg.text }]}>{item.ai_notes}</Text>
                        </View>
                      ) : null}
                      {item.user_id ? (
                        <View style={tabSt.infoRow}>
                          <Text style={[tabSt.infoLabel, { color: theme.colors.textSecondary }]}>Geüpload door</Text>
                          <Text style={[tabSt.infoValue, { color: theme.colors.textPrimary }]}>{item.user_id}</Text>
                        </View>
                      ) : null}
                      {item.latitude != null && item.longitude != null && (
                        <View style={tabSt.infoRow}>
                          <Text style={[tabSt.infoLabel, { color: theme.colors.textSecondary }]}>GPS</Text>
                          <Text style={[tabSt.infoValue, { color: theme.colors.textPrimary }]}>
                            {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                          </Text>
                        </View>
                      )}
                    </View>
                    {/* Inline bewerken */}
                    {editingId === item.id && (
                      <View style={[tabSt.editBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.accent + '40' }]}>
                        <Text style={[tabSt.editTitle, { color: theme.colors.accent }]}>✏️ BEWERKEN</Text>
                        {/* Borgingspunt */}
                        <Text style={[tabSt.editLabel, { color: theme.colors.textSecondary }]}>Borgingspunt ID</Text>
                        {/* @ts-ignore web TextInput */}
                        <input
                          value={editPointId}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditPointId(e.target.value)}
                          style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: `1px solid ${theme.colors.borderWarm}`, background: theme.colors.surface, color: theme.colors.textPrimary, fontSize: 13, outline: 'none', marginBottom: 8 }}
                        />
                        {/* Feedback notitie */}
                        <Text style={[tabSt.editLabel, { color: theme.colors.textSecondary }]}>WV feedback / notitie</Text>
                        {/* @ts-ignore web textarea */}
                        <textarea
                          value={editFieldNote}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditFieldNote(e.target.value)}
                          rows={3}
                          style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: `1px solid ${theme.colors.borderWarm}`, background: theme.colors.surface, color: theme.colors.textPrimary, fontSize: 13, resize: 'vertical', outline: 'none', marginBottom: 8, fontFamily: 'inherit' }}
                        />
                        {/* Status */}
                        <Text style={[tabSt.editLabel, { color: theme.colors.textSecondary }]}>Status</Text>
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' as 'wrap' }}>
                          {(['PASSED', 'NEEDS_REVIEW', 'FAILED', 'PENDING'] as const).map(s => (
                            <TouchableOpacity
                              key={s}
                              onPress={() => setEditStatus(s)}
                              style={[tabSt.statusChip, {
                                backgroundColor: editStatus === s ? theme.colors.accent : theme.colors.surface,
                                borderColor: editStatus === s ? theme.colors.accent : theme.colors.borderWarm,
                              }]}
                            >
                              <Text style={{ fontSize: 11, fontWeight: '700', color: editStatus === s ? '#fff' : theme.colors.textSecondary }}>
                                {s === 'PASSED' ? '✓ Akkoord' : s === 'FAILED' ? '✗ Afgekeurd' : s === 'NEEDS_REVIEW' ? '⚠ Review' : '○ Pending'}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity
                            style={[tabSt.approveBtn, { flex: 1 }]}
                            onPress={() => {
                              onEdit(item.id, {
                                field_note: editFieldNote.trim() || (null as unknown as string),
                                inspection_point_id: editPointId.trim() || (item.inspection_point_id ?? ''),
                                ai_status: editStatus,
                              });
                              setEditingId(null);
                            }}
                          >
                            <Text style={tabSt.approveBtnText}>Opslaan</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[tabSt.rejectBtn, { flex: 1, borderColor: theme.colors.borderWarm }]}
                            onPress={() => setEditingId(null)}
                          >
                            <Text style={[tabSt.rejectBtnText, { color: theme.colors.textSecondary }]}>Annuleren</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {/* Review workflow — keurmeester / projectleider sign-off */}
                    {(() => {
                      const locked = isReviewLocked(item.review_status);
                      const isApproved = item.review_status === 'APPROVED';
                      const isRejected = item.review_status === 'REJECTED';
                      const isPending  = item.review_status === 'PENDING_REVIEW' || item.review_status == null;
                      const busy = reviewBusyId === item.id;
                      const rb = reviewBadgeFor(item.review_status);
                      return (
                        <View style={[tabSt.editBox, { backgroundColor: theme.colors.background, borderColor: rb.fg + '40' }]}>
                          <Text style={[tabSt.editTitle, { color: rb.fg }]}>
                            {rb.emoji} REVIEW · {rb.label.toUpperCase()}
                          </Text>
                          {item.reviewed_at && (
                            <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 6 }}>
                              Laatste beslissing: {fmtDate(item.reviewed_at)}
                              {item.reviewed_by ? ` · door ${item.reviewed_by.slice(0, 8)}…` : ''}
                            </Text>
                          )}
                          {item.review_note && (
                            <Text style={{ fontSize: 12, color: theme.colors.textPrimary, marginBottom: 8, fontStyle: 'italic' }}>
                              💬 {item.review_note}
                            </Text>
                          )}
                          {locked ? (
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              <View style={[tabSt.approveBtn, { flex: 1, backgroundColor: 'rgba(15,118,110,0.15)' }]}>
                                <Text style={[tabSt.approveBtnText, { color: theme.colors.statusSuccess }]}>🔒 Vergrendeld</Text>
                              </View>
                            </View>
                          ) : reviewRejectId === item.id ? (
                            <View>
                              <Text style={[tabSt.editLabel, { color: theme.colors.textSecondary }]}>Reden van afkeuring (verplicht)</Text>
                              {/* @ts-ignore web textarea */}
                              <textarea
                                value={reviewRejectNote}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReviewRejectNote(e.target.value)}
                                rows={2}
                                placeholder="Bijv. 'Foto is onscherp, EXIF mist tijdstempel'"
                                style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: `1px solid ${theme.colors.borderWarm}`, background: theme.colors.surface, color: theme.colors.textPrimary, fontSize: 13, resize: 'vertical', outline: 'none', marginBottom: 8, fontFamily: 'inherit' }}
                              />
                              <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity
                                  style={[tabSt.rejectBtn, { flex: 1, opacity: busy || !reviewRejectNote.trim() ? 0.5 : 1, borderColor: theme.colors.statusWarning }]}
                                  disabled={busy || !reviewRejectNote.trim()}
                                  onPress={async () => {
                                    setReviewBusyId(item.id);
                                    await onReview(item.id, 'REJECT', reviewRejectNote);
                                    setReviewBusyId(null);
                                    setReviewRejectId(null);
                                    setReviewRejectNote('');
                                  }}
                                  activeOpacity={0.8}
                                >
                                  <Text style={[tabSt.rejectBtnText, { color: theme.colors.statusWarning }]}>✗ Bevestig afkeuring</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[tabSt.rejectBtn, { flex: 1, borderColor: theme.colors.borderWarm }]}
                                  onPress={() => { setReviewRejectId(null); setReviewRejectNote(''); }}
                                  activeOpacity={0.8}
                                >
                                  <Text style={[tabSt.rejectBtnText, { color: theme.colors.textSecondary }]}>Annuleren</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : (
                            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                              {isPending && (
                                <TouchableOpacity
                                  style={[tabSt.approveBtn, { flex: 1, minWidth: 110, opacity: busy ? 0.5 : 1 }]}
                                  disabled={busy}
                                  onPress={async () => {
                                    setReviewBusyId(item.id);
                                    await onReview(item.id, 'APPROVE');
                                    setReviewBusyId(null);
                                  }}
                                  activeOpacity={0.8}
                                >
                                  <Text style={tabSt.approveBtnText}>✅ Goedkeuren</Text>
                                </TouchableOpacity>
                              )}
                              {(isPending || isApproved) && (
                                <TouchableOpacity
                                  style={[tabSt.rejectBtn, { flex: 1, minWidth: 110, borderColor: theme.colors.statusWarning, opacity: busy ? 0.5 : 1 }]}
                                  disabled={busy}
                                  onPress={() => { setReviewRejectId(item.id); setReviewRejectNote(''); }}
                                  activeOpacity={0.8}
                                >
                                  <Text style={[tabSt.rejectBtnText, { color: theme.colors.statusWarning }]}>❌ Afkeuren</Text>
                                </TouchableOpacity>
                              )}
                              {isApproved && (
                                <TouchableOpacity
                                  style={[tabSt.approveBtn, { flex: 1, minWidth: 110, backgroundColor: theme.colors.statusSuccess, opacity: busy ? 0.5 : 1 }]}
                                  disabled={busy}
                                  onPress={async () => {
                                    setReviewBusyId(item.id);
                                    await onReview(item.id, 'FINALIZE');
                                    setReviewBusyId(null);
                                  }}
                                  activeOpacity={0.8}
                                >
                                  <Text style={tabSt.approveBtnText}>🔒 Definitief maken</Text>
                                </TouchableOpacity>
                              )}
                              {isRejected && (
                                <TouchableOpacity
                                  style={[tabSt.rejectBtn, { flex: 1, minWidth: 110, borderColor: theme.colors.accent, opacity: busy ? 0.5 : 1 }]}
                                  disabled={busy}
                                  onPress={async () => {
                                    setReviewBusyId(item.id);
                                    await onReview(item.id, 'REOPEN');
                                    setReviewBusyId(null);
                                  }}
                                  activeOpacity={0.8}
                                >
                                  <Text style={[tabSt.rejectBtnText, { color: theme.colors.accent }]}>↩️ Heropenen</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })()}

                    {/* Opmerkingen thread */}
                    {commentsOpenId === item.id && (
                      <EvidenceComments
                        evidenceId={item.id}
                        projectId={projectId}
                        role="WV"
                        theme={theme as Parameters<typeof EvidenceComments>[0]['theme']}
                      />
                    )}
                  </View>
                )}
              </View>
    );
  };

  // FlatList als root van de bewijs-tab. De outer ScrollView in de host heeft
  // `scrollEnabled={false}` voor bewijs, zodat FlatList z'n eigen viewport-
  // tracking krijgt en grote Wkb-dossiers virtualized rendert.
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={loading ? [] : displayed}
        keyExtractor={(item) => item.id}
        renderItem={renderEvidenceCard}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderListEmpty}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        // Verplichte performance-props voor grote Wkb-dossiers
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews={true}
      />

      {/* Laag 2 — Diagnose zijpaneel. Absolute overlay, behoudt lijstcontext. */}
      <DiagnoseSidePanel
        evidenceItem={sidePanelItem}
        onClose={() => setSelectedEvidence(null)}
      />

      {/* Laag 3 — Actie-modal voor taakgerichte beoordeling */}
      <DossierActionModal
        visible={actionTarget !== null}
        evidenceItem={
          actionTarget
            ? { id: actionTarget.id, title: actionTarget.inspection_point_id ?? 'bewijsstuk' }
            : null
        }
        onClose={() => setActionTarget(null)}
        onApprove={(id) => {
          onApprove(id);
          setActionTarget(null);
        }}
        onReject={(id) => {
          onReject(id);
          setActionTarget(null);
        }}
      />
    </View>
  );
}

// ─── Tab: Checklist ───────────────────────────────────────────────────────────

interface ChecklistTabProps {
  checklist: ChecklistItem[];
  newTask: string;
  setNewTask: (v: string) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onReset: () => void;
  done: number;
  theme: { colors: Record<string, string> };
}

function ChecklistTab({ checklist, newTask, setNewTask, onToggle, onRemove, onAdd, onReset, done, theme }: ChecklistTabProps) {
  const pct = checklist.length > 0 ? Math.round((done / checklist.length) * 100) : 0;
  const allDone = done === checklist.length && checklist.length > 0;

  return (
    <View style={{ gap: 16 }}>
      {/* Voortgang */}
      <View style={[tabSt.checkHeader, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderWarm }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: '800', fontSize: 15 }}>
            Dagelijkse controlelijst
          </Text>
          <Text style={{ color: allDone ? theme.colors.statusSuccess : theme.colors.textSecondary, fontWeight: '700', fontSize: 13 }}>
            {done}/{checklist.length} gedaan {allDone ? '🎉' : ''}
          </Text>
        </View>
        <View style={[tabSt.progressBg, { backgroundColor: theme.colors.borderWarm }]}>
          <View style={[tabSt.progressFill, { width: `${pct}%` as `${number}%`, backgroundColor: allDone ? theme.colors.statusSuccess : theme.colors.accent }]} />
        </View>
        {allDone && (
          <Text style={{ color: theme.colors.statusSuccess, fontSize: 12, fontWeight: '700', marginTop: 8, textAlign: 'center' }}>
            ✓ Alle controlepunten afgevinkt — goed werk!
          </Text>
        )}
      </View>

      {/* Taken */}
      <View style={{ gap: 6 }}>
        {checklist.map(item => (
          <View
            key={item.id}
            style={[tabSt.checkItem, {
              backgroundColor: item.done ? 'rgba(5,150,105,0.08)' : theme.colors.surface,
              borderColor: item.done ? 'rgba(5,150,105,0.25)' : theme.colors.borderWarm,
            }]}
          >
            <TouchableOpacity
              style={[tabSt.checkBox, { borderColor: item.done ? theme.colors.statusSuccess : theme.colors.borderWarm, backgroundColor: item.done ? theme.colors.statusSuccess : 'transparent' }]}
              onPress={() => onToggle(item.id)}
              activeOpacity={0.7}
            >
              {item.done && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>✓</Text>}
            </TouchableOpacity>
            <Text style={[tabSt.checkLabel, {
              color: item.done ? theme.colors.textSecondary : theme.colors.textPrimary,
              textDecorationLine: item.done ? 'line-through' : 'none',
            }]}>
              {item.label}
            </Text>
            <TouchableOpacity onPress={() => onRemove(item.id)} style={{ padding: 6 }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 14 }}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Toevoegen */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          style={[tabSt.taskInput, { flex: 1, color: theme.colors.textPrimary, borderColor: theme.colors.borderWarm, backgroundColor: theme.colors.surface, outlineStyle: 'none' } as ReturnType<typeof StyleSheet.create>[string]]}
          value={newTask}
          onChangeText={setNewTask}
          placeholder="Nieuwe taak toevoegen..."
          placeholderTextColor={theme.colors.textSecondary + '88'}
          onSubmitEditing={onAdd}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[tabSt.addTaskBtn, { backgroundColor: newTask.trim() ? theme.colors.accent : theme.colors.borderWarm }]}
          onPress={onAdd}
          disabled={!newTask.trim()}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>＋</Text>
        </TouchableOpacity>
      </View>

      {/* Reset */}
      <TouchableOpacity
        style={[tabSt.resetBtn, { borderColor: theme.colors.borderWarm }]}
        onPress={onReset}
      >
        <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
          ↺ Lijst resetten voor nieuwe dag
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root:        { flex: 1 },
  scroll:      { flex: 1 },
  content:     { paddingBottom: 60 },

  // Toast
  toast: {
    position: 'absolute', top: 12, alignSelf: 'center', zIndex: 999,
    backgroundColor: '#111', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  toastText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Header card
  headerCard: { borderRadius: 16, borderWidth: 1, marginBottom: 16, overflow: 'hidden' },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, flexWrap: 'wrap' },
  projectTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  projectRole: { fontSize: 12, fontWeight: '600', marginTop: 2 },

  // LIVE pill
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },

  // ZIP knop + banner
  zipBtn:       { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  zipBtnText:   { fontSize: 11, fontWeight: '800' },
  zipBanner:    { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 10 },
  zipBannerText:{ flex: 1, fontSize: 12, fontWeight: '600' },

  // Stats strip
  statsStrip: { flexDirection: 'row', borderTopWidth: 1 },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 2 },
  statNum: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  statLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Tabs
  tabRow: { borderBottomWidth: 1, marginBottom: 16 },
  tabItem: { paddingHorizontal: 16, paddingVertical: 10, position: 'relative' },
  tabItemActive: {},
  tabLabel: { fontSize: 14, fontWeight: '700' },
  tabBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, minWidth: 18, alignItems: 'center' },
  tabBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  tabUnderline: { position: 'absolute', bottom: -1, left: 16, right: 16, height: 2, borderRadius: 1 },
});

const tabSt = StyleSheet.create({
  centered: { paddingVertical: 48, alignItems: 'center' },
  emptyBox: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  emptyBody: { fontSize: 13, textAlign: 'center', maxWidth: 320, lineHeight: 20 },

  reviewBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },

  sectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },

  borgingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  borgingCell: { borderRadius: 12, padding: 12, minWidth: 100, maxWidth: 160, alignItems: 'center', gap: 4 },
  borgingIcon: { fontSize: 16, fontWeight: '800' },
  borgingId: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  borgingCount: { fontSize: 10, marginTop: 2 },

  batchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, padding: 10, flexWrap: 'wrap' },
  searchPanel: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 10 },
  searchInput: { height: 40, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, fontSize: 13 },
  vakmanCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  vakmanRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  vakmanRank: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  vakmanBar: { height: 6, borderRadius: 3, overflow: 'hidden', position: 'relative' },
  vakmanBarFill: { height: 6, borderRadius: 3 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  filterChipText: { fontSize: 13, fontWeight: '700' },
  filterChipCount: { fontSize: 11, fontWeight: '700' },

  evidenceCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  evidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  thumb: { width: 56, height: 56, borderRadius: 10 },
  thumbEmpty: { width: 56, height: 56, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  thumbLarge: { width: '100%', height: 220, borderRadius: 10, backgroundColor: '#000' },
  syncDot: { position: 'absolute', bottom: 2, right: 2, width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },
  evidencePid: { fontSize: 13, fontWeight: '700' },
  evidenceMeta: { fontSize: 11 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: 1 },
  approveBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: 'rgba(5,150,105,0.12)' },
  approveBtnText: { color: tokens.forest, fontWeight: '800', fontSize: 13 },
  rejectBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  rejectBtnText: { fontWeight: '800', fontSize: 13 },

  expanded: { borderTopWidth: 1, padding: 12, gap: 8 },
  editBox: { borderRadius: 10, borderWidth: 1, padding: 12, gap: 4 },
  editTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6 },
  editLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  infoRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 8, borderRadius: 8 },
  infoLabel: { fontSize: 11, fontWeight: '700', width: 100 },
  infoValue: { flex: 1, fontSize: 12 },

  // Checklist
  checkHeader: { borderRadius: 14, borderWidth: 1, padding: 14 },
  progressBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, padding: 12 },
  checkBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkLabel: { flex: 1, fontSize: 14 },
  taskInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  addTaskBtn: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  resetBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
});

// ─── Email + Handtekening Modal Styles ────────────────────────────────────────

const emailSt = StyleSheet.create({
  modalRoot: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 16, fontWeight: '800' },
  closeBtn: { padding: 8 },
  closeBtnText: { fontSize: 18, fontWeight: '700' },
  modalScroll: { flex: 1 },
  modalContent: { padding: 20, gap: 14, paddingBottom: 48 },

  section: {
    borderRadius: 14, borderWidth: 1, padding: 16, gap: 10,
  },
  sectionTitle: {
    fontSize: 10, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase',
  },
  nameInput: {
    height: 44, borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, fontSize: 14,
  },
  sigPreview: {
    width: '100%', height: 100, borderRadius: 8,
    backgroundColor: tokens.cream, borderWidth: 1, borderColor: '#e5e5e5',
  },
  clearSigBtn: { alignSelf: 'flex-end', paddingVertical: 4 },
  clearSigText: { fontSize: 12, fontWeight: '700' },

  fieldLabel: {
    fontSize: 10, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', marginTop: 6,
  },
  emailInput: {
    height: 48, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, fontSize: 15,
  },
  actionBtn: {
    height: 48, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnPrimary: {
    backgroundColor: tokens.terracotta, borderColor: tokens.terracotta,
  },
  actionBtnText: { fontSize: 14, fontWeight: '800' },
  msgBanner: {
    borderRadius: 10, borderWidth: 1, padding: 12,
  },
  msgText: { fontSize: 13, fontWeight: '600' },
});

// ─── Dossier Lock dialog styles (Sprint 3) ───────────────────────────────────
const lockSt = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  dialog: {
    width: '100%', maxWidth: 460, borderRadius: 16, borderWidth: 1,
    padding: 22, gap: 14,
  },
  title: { fontSize: 18, fontWeight: '800' },
  body: { fontSize: 13, lineHeight: 19 },
  warnBox: {
    borderRadius: 10, borderWidth: 1, padding: 12, gap: 6,
  },
  warnTitle: { fontSize: 13, fontWeight: '800' },
  warnBody: { fontSize: 12, lineHeight: 18 },
  signed: { fontSize: 12, fontStyle: 'italic' },
  msgBanner: {
    borderRadius: 10, borderWidth: 1, padding: 10,
  },
  msgText: { fontSize: 13, fontWeight: '700' },
  buttonRow: {
    flexDirection: 'row', gap: 10, marginTop: 4,
  },
  btn: {
    flex: 1, height: 46, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  btnGhost: { borderWidth: 1, backgroundColor: 'transparent' },
  btnDanger: { backgroundColor: tokens.terracotta },
  btnText: { fontSize: 14, fontWeight: '800' },
});
