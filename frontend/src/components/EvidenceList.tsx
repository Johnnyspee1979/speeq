import React, { useDeferredValue, useEffect, useMemo, useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  useWindowDimensions,
  Modal,
  ScrollView,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  Evidence,
  getConsumerDossierDocuments,
  getConsumerDossierItems,
  getAllEvidence,
  getGereedmeldingItems,
  getPunchlistItems,
  updateEvidenceAiStatusByCloudId,
} from '../database/database';
import {
  BACKEND_URL,
  DEFAULT_GEVOLGKLASSE,
  DEFAULT_KWALITEITSBORGER,
} from '../config/app';
import { syncEvidenceToCloud } from '../services/sync';
import { submitStam, fetchStamStatus } from '../services/dso';
import { getDeviceType, isWeb } from '../lib/platform';
import { exportDossierAsPdf } from '../services/BorgingsDossierService';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import WkbCompliancePanel from './WkbCompliancePanel';
import WkbOfficialPanel from './WkbOfficialPanel';
import {
  buildWkbComplianceSnapshot,
  getEvidenceComplianceContext,
  isEvidenceReadyForCompliance,
  type StoredConsumerDossierDocument,
  type StoredConsumerDossierItem,
} from '../services/wkbCompliance';
import { useTheme } from '../theme/ThemeProvider';
import { useProject } from '../context/ProjectContext';

type StatusFilter = 'all' | 'offline' | 'cloud' | 'attention' | 'ready';

const isAiApproved = (status?: Evidence['aiStatus'] | null) =>
  ['APPROVED', 'OK', 'PASSED'].includes((status ?? '').toUpperCase());

const isEvidenceWkbReady = (item: Evidence) => isEvidenceReadyForCompliance(item);

const getSyncLabel = (item: Evidence) => {
  if (item.syncStatus === 'SYNCED') {
    return 'Cloud veilig';
  }

  if (item.syncStatus === 'FAILED') {
    return 'Sync mislukt';
  }

  return 'Alleen lokaal';
};

const getAiLabel = (item: Evidence) => {
  if (isAiApproved(item.aiStatus)) {
    return item.syncStatus === 'SYNCED' ? 'AI akkoord (Cloud) ✨' : 'AI akkoord (Edge) ★';
  }

  if ((item.aiStatus ?? '').toUpperCase() === 'NEEDS_REVIEW') {
    return 'Review nodig';
  }

  if ((item.aiStatus ?? '').toUpperCase() === 'FAILED') {
    return 'AI afgekeurd';
  }

  return 'AI pending';
};

export default function EvidenceList() {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const { activeProject } = useProject();
  const activeProjectId = activeProject.id;
  const activeProjectName = activeProject.name;
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isPdfLoading, setIsPdfLoading] = useState<boolean>(false);
  const [stamReference, setStamReference] = useState<string | null>(null);
  const [stamStatus, setStamStatus] = useState<string | null>(null);
  const [lastLiveUpdateAt, setLastLiveUpdateAt] = useState<string | null>(null);
  const [lastLiveUpdateId, setLastLiveUpdateId] = useState<string | null>(null);
  const [exportType, setExportType] = useState<'bevoegd-gezag' | 'consument'>(
    'bevoegd-gezag'
  );
  const [exportAannemer, setExportAannemer] = useState('');
  const [exportAdres, setExportAdres] = useState('');
  const [exportGevolgklasse, setExportGevolgklasse] = useState(DEFAULT_GEVOLGKLASSE);
  const [exportKwaliteitsborger, setExportKwaliteitsborger] = useState(
    DEFAULT_KWALITEITSBORGER
  );
  const [punchlistItems, setPunchlistItems] = useState<
    Awaited<ReturnType<typeof getPunchlistItems>>
  >([]);
  const [gereedmeldingItems, setGereedmeldingItems] = useState<
    Awaited<ReturnType<typeof getGereedmeldingItems>>
  >([]);
  const [consumerDossierItems, setConsumerDossierItems] = useState<
    StoredConsumerDossierItem[]
  >([]);
  const [consumerDossierDocuments, setConsumerDossierDocuments] = useState<
    StoredConsumerDossierDocument[]
  >([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<string | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deviceType = getDeviceType(width);
  const isWide = deviceType === 'DESKTOP';
  const isCompact = deviceType === 'MOBILE';
  const styles = useMemo(
    () => createStyles(theme, isWide, isCompact),
    [theme, isWide, isCompact]
  );

  const dossierMetrics = useMemo(() => {
    const syncedCount = evidenceList.filter((item) => item.syncStatus === 'SYNCED').length;
    const offlineCount = evidenceList.length - syncedCount;
    const attentionCount = evidenceList.filter((item) => !isAiApproved(item.aiStatus)).length;
    const readyCount = evidenceList.filter(isEvidenceWkbReady).length;

    return {
      total: evidenceList.length,
      synced: syncedCount,
      offline: offlineCount,
      attention: attentionCount,
      ready: readyCount,
    };
  }, [evidenceList]);

  const complianceSnapshot = useMemo(
    () =>
      buildWkbComplianceSnapshot({
        evidence: evidenceList,
        punchlistItems,
        gereedmeldingItems,
        consumerDossierItems,
        consumerDossierDocuments,
      }),
    [
      consumerDossierDocuments,
      consumerDossierItems,
      evidenceList,
      gereedmeldingItems,
      punchlistItems,
    ]
  );

  const filteredEvidence = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();

    return evidenceList.filter((item) => {
      const complianceContext = getEvidenceComplianceContext(item.inspectionPointId);
      const matchesFilter =
        statusFilter === 'all' ||
        (statusFilter === 'offline' && item.syncStatus !== 'SYNCED') ||
        (statusFilter === 'cloud' && item.syncStatus === 'SYNCED') ||
        (statusFilter === 'attention' && !isAiApproved(item.aiStatus)) ||
        (statusFilter === 'ready' && isEvidenceWkbReady(item));

      if (!matchesFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        item.projectId,
        item.inspectionPointId,
        item.aiStatus,
        item.aiNotes,
        item.fieldNote,
        item.ifcGuid,
        item.exifHash,
        item.timestamp,
        item.locationVerified ? 'locatie bevestigd' : 'locatie open',
        item.locationSpoofRisk,
        item.locationSecurityMessage,
        complianceContext.disciplineTitle,
        complianceContext.standards,
        complianceContext.stopMoment,
        complianceContext.requiresMeasurementTool
          ? 'meetmiddel vereist'
          : 'geen meetmiddel vereist',
        item.stopMomentConfirmed ? 'stopmoment bevestigd' : 'stopmoment open',
        item.measurementToolConfirmed ? 'meetmiddel bevestigd' : 'meetmiddel open',
        item.exifVerified ? 'exif verified' : 'exif ontbreekt',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [deferredSearchQuery, evidenceList, statusFilter]);

  useEffect(() => {
    void fetchData();

    if (!isSupabaseConfigured()) {
      return;
    }

    const evidenceSubscription = supabase
      .channel(`evidence-${activeProjectId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'evidence' },
        (payload) => {
          console.log('⚡ LIVE UPDATE VANUIT DE CLOUD ONTVANGEN:', payload);
          const nextRecord = (
            payload as {
              new?: {
                id?: number;
                project_id?: string | null;
                ai_status?: Evidence['aiStatus'];
                ai_confidence?: number | null;
                ai_notes?: string | null;
              };
            }
          ).new;

          if (nextRecord?.project_id && nextRecord.project_id !== activeProjectId) {
            return;
          }

          if (typeof nextRecord?.id === 'number') {
            void updateEvidenceAiStatusByCloudId(
              nextRecord.id,
              nextRecord.ai_status ?? 'PENDING',
              nextRecord.ai_confidence ?? null,
              nextRecord.ai_notes ?? null
            )
              .then(fetchData)
              .catch((error) => {
                console.error('❌ Live update lokaal verwerken faalde:', error);
              });
          }

          setLastLiveUpdateId(
            typeof nextRecord?.id === 'number' ? String(nextRecord.id) : null
          );
          setLastLiveUpdateAt(new Date().toISOString());
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(evidenceSubscription);
    };
  }, []);

  const fetchData = async () => {
    const [
      data,
      nextPunchlistItems,
      nextGereedmeldingItems,
      nextConsumerDossierItems,
      nextConsumerDossierDocuments,
    ] =
      await Promise.all([
        getAllEvidence(),
        getPunchlistItems(activeProjectId),
        getGereedmeldingItems(activeProjectId),
        getConsumerDossierItems(activeProjectId),
        getConsumerDossierDocuments(activeProjectId),
      ]);

    setEvidenceList(data);
    setPunchlistItems(nextPunchlistItems);
    setGereedmeldingItems(nextGereedmeldingItems);
    setConsumerDossierItems(nextConsumerDossierItems);
    setConsumerDossierDocuments(nextConsumerDossierDocuments);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncMessage('Voorbereiden Wkb-sync...');
    try {
      if (!isSupabaseConfigured()) {
        Alert.alert('Supabase ontbreekt', 'Vul eerst de Supabase omgevingsvariabelen in.');
        return;
      }

      const syncedCount = await syncEvidenceToCloud((msg) => setSyncMessage(msg));

      if (syncedCount > 0) {
        Alert.alert(
          'Wkb Sync Succesvol',
          `${syncedCount} bewijsstukken zijn cryptografisch veilig in de cloud gezet!`
        );
        await fetchData();
      } else {
        Alert.alert(
          'Dossier Up-to-date',
          'Al het bewijsmateriaal staat al veilig in de cloud.'
        );
      }
    } catch {
      Alert.alert(
        'Sync Mislukt',
        'Controleer de internetverbinding en probeer het opnieuw.'
      );
    } finally {
      setIsSyncing(false);
      setSyncMessage('');
    }
  };

  const handleSubmitStam = async () => {
    setIsSubmitting(true);
    try {
      if (!complianceSnapshot.bevoegdGezagReady) {
        Alert.alert(
          'STAM geblokkeerd',
          complianceSnapshot.issues[0]?.detail ??
            'Het dossier is nog niet klaar voor bevoegd gezag.'
        );
        return;
      }

      if (evidenceList.length === 0) {
        Alert.alert('Geen bewijs', 'Leg eerst minimaal één bewijsstuk vast.');
        return;
      }

      const payload = {
        project_id: activeProjectId,
        project_naam: activeProjectName,
        kwaliteitsborger: exportKwaliteitsborger || 'Onbekend',
        kwaliteitsborger_regnr: 'KB-DEMO-2026',
        type_melding: 'BOUWMELDING',
        verklaring_akkoord: true,
        bewijs: evidenceList.map((item) => ({
          id: item.id,
          photo_uri: item.mediaUri,
          latitude: item.latitude,
          longitude: item.longitude,
          timestamp: item.timestamp,
          inspection_point_id: item.inspectionPointId,
          exif_hash: item.exifHash,
        })),
      };

      const response = await submitStam(payload);
      const referenceId = response.dsoReferentieId ?? response.referenceId ?? null;
      setStamReference(referenceId);
      setStamStatus(response.status ?? null);
      Alert.alert('STAM ingediend', `Referentie: ${referenceId ?? 'onbekend'}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kon niet indienen bij DSO‑adapter.';
      Alert.alert('STAM mislukt', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckStamStatus = async () => {
    if (!stamReference) {
      Alert.alert('Geen referentie', 'Dien eerst een STAM in.');
      return;
    }
    try {
      const response = await fetchStamStatus(stamReference);
      setStamStatus(response.status ?? null);
      Alert.alert('STAM status', `Status: ${response.status ?? 'onbekend'}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kon STAM status niet ophalen.';
      Alert.alert('Status mislukt', message);
    }
  };

  const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        type: exportType,
        aannemer: exportAannemer,
        adres: exportAdres,
        gevolgklasse: exportGevolgklasse,
        kwaliteitsborger: exportKwaliteitsborger,
      });
      const exportBasePath =
        exportType === 'consument'
          ? `${BACKEND_URL}/api/wkb-dossier/consument/${activeProjectId}`
          : `${BACKEND_URL}/api/wkb-dossier/bevoegd-gezag/${activeProjectId}`;
      const exportUrl = `${exportBasePath}?${params.toString()}`;

      // Op web: open in nieuw tabblad (browser download)
      if (isWeb) {
        const available = await fetch(exportBasePath, { method: 'GET' })
          .then((r) => r.status < 500)
          .catch(() => false);

        if (!available) {
          Alert.alert(
            'Backend niet bereikbaar',
            `Start de backend lokaal of deploy naar Railway.\n\nVerwachte URL:\n${BACKEND_URL}`
          );
          return;
        }
        window.open(exportUrl, '_blank');
        return;
      }

      // Op native: download via FileSystem
      if (exportType === 'bevoegd-gezag' && !complianceSnapshot.bevoegdGezagReady) {
        Alert.alert(
          'Export geblokkeerd',
          complianceSnapshot.issues[0]?.detail ??
            'Maak eerst alle Wkb-blokkades vrij voor bevoegd gezag.'
        );
        return;
      }

      if (exportType === 'consument' && !complianceSnapshot.consumentReady) {
        Alert.alert(
          'Consumentendossier nog niet compleet',
          complianceSnapshot.issues.find((issue) =>
            [
              'consumer-dossier-incomplete',
              'consumer-documentation-missing',
              'consumer-evidence-missing',
              'punchlist-open',
            ].includes(issue.id)
          )?.detail ??
            'Rond eerst de consumentgerichte overdracht en oplevering af.'
        );
        return;
      }

      const baseDir =
        (FileSystem as unknown as { documentDirectory?: string; cacheDirectory?: string })
          .documentDirectory ??
        (FileSystem as unknown as { cacheDirectory?: string }).cacheDirectory ??
        '';
      const fileUri = `${baseDir}wkb-dossier-${activeProjectId}-${Date.now()}.pdf`;

      const download = await FileSystem.downloadAsync(exportUrl, fileUri);
      const canShare = await Sharing.isAvailableAsync();

      if (canShare) {
        await Sharing.shareAsync(download.uri);
      } else {
        Alert.alert('PDF gereed', `Bestand opgeslagen op: ${download.uri}`);
      }
    } catch {
      Alert.alert('PDF export mislukt', 'Controleer backend URL en probeer opnieuw.');
    } finally {
      setIsExporting(false);
    }
  };

  const renderEvidenceCard = ({ item }: { item: Evidence }) => {
    const dateObj = new Date(item.timestamp);
    const formattedDate = `${dateObj.toLocaleDateString('nl-NL')} ${dateObj.toLocaleTimeString('nl-NL')}`;
    const approved = isAiApproved(item.aiStatus);
    const isExpanded = expandedEvidenceId === item.id;
    const readyForDossier = isEvidenceWkbReady(item);
    const previewNote =
      item.fieldNote && item.fieldNote.length > 88
        ? `${item.fieldNote.slice(0, 88)}...`
        : item.fieldNote;
    const complianceContext = getEvidenceComplianceContext(item.inspectionPointId);

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() =>
          setExpandedEvidenceId((current) => (current === item.id ? null : item.id))
        }
      >
        <Image source={{ uri: item.mediaUri }} style={styles.thumbnail} />
        <View style={styles.infoContainer}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleBlock}>
              <Text style={styles.cardTitle}>{item.inspectionPointId}</Text>
              <Text style={styles.cardSubline}>
                {formattedDate} • {item.projectId}
              </Text>
            </View>
            <View
              style={[
                styles.readinessBadge,
                readyForDossier ? styles.readyBadge : styles.attentionBadge,
              ]}
            >
              <Text style={styles.readinessBadgeText}>
                {readyForDossier ? 'Wkb-proof' : 'Actie nodig'}
              </Text>
            </View>
          </View>

          <View style={styles.chipRow}>
            {complianceContext.disciplineTitle ? (
              <View style={[styles.detailChip, styles.contextChip]}>
                <Text style={styles.detailChipText}>{complianceContext.disciplineTitle}</Text>
              </View>
            ) : null}
            <View
              style={[
                styles.detailChip,
                item.syncStatus === 'SYNCED'
                  ? styles.chipSuccess
                  : item.syncStatus === 'FAILED'
                    ? styles.chipDanger
                    : styles.chipWarning,
              ]}
            >
              <Text style={styles.detailChipText}>{getSyncLabel(item)}</Text>
            </View>
            <View
              style={[
                styles.detailChip,
                item.exifVerified ? styles.chipSuccess : styles.chipDanger,
              ]}
            >
              <Text style={styles.detailChipText}>
                {item.exifVerified ? 'EXIF bevestigd' : 'EXIF ontbreekt'}
              </Text>
            </View>
            <View
              style={[
                styles.detailChip,
                approved && item.syncStatus === 'SYNCED'
                  ? styles.chipAiCloud
                  : approved
                    ? styles.chipAiEdge
                    : item.aiStatus === 'NEEDS_REVIEW'
                      ? styles.chipWarning
                      : styles.chipDanger,
              ]}
            >
              <Text
                style={[
                  styles.detailChipText,
                  approved && item.syncStatus === 'SYNCED' && styles.chipAiCloudText,
                ]}
              >
                {getAiLabel(item)}
              </Text>
            </View>
            {complianceContext.stopMoment ? (
              <View
                style={[
                  styles.detailChip,
                  item.stopMomentConfirmed ? styles.chipSuccess : styles.chipDanger,
                ]}
              >
                <Text style={styles.detailChipText}>
                  {item.stopMomentConfirmed ? 'Stopmoment bevestigd' : 'Stopmoment open'}
                </Text>
              </View>
            ) : null}
            {complianceContext.requiresMeasurementTool ? (
              <View
                style={[
                  styles.detailChip,
                  item.measurementToolConfirmed
                    ? styles.chipSuccess
                    : styles.chipDanger,
                ]}
              >
                <Text style={styles.detailChipText}>
                  {item.measurementToolConfirmed ? 'Meetmiddel bevestigd' : 'Meetmiddel open'}
                </Text>
              </View>
            ) : null}
            <View
              style={[
                styles.detailChip,
                item.locationVerified ? styles.chipSuccess : styles.chipDanger,
              ]}
            >
              <Text style={styles.detailChipText}>
                {item.locationVerified
                  ? `Locatie akkoord${item.locationSpoofRisk ? ` (${item.locationSpoofRisk})` : ''}`
                  : 'Locatie open'}
              </Text>
            </View>
          </View>

          {complianceContext.standards ? (
            <Text style={styles.complianceText}>⚖️ {complianceContext.standards}</Text>
          ) : null}

          {previewNote ? <Text style={styles.previewNote}>🗒️ {previewNote}</Text> : null}

          <View style={styles.quickFactsRow}>
            <Text style={styles.quickFactText}>
              📍 {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
            </Text>
            <Text style={styles.quickFactText}>
              🧭{' '}
              {item.gpsAccuracy != null ? `${item.gpsAccuracy.toFixed(1)}m` : 'GPS onbekend'}
            </Text>
          </View>

          <Text style={styles.expandHint}>
            {isExpanded ? 'Tik om details te sluiten' : 'Tik voor juridische details'}
          </Text>

          {isExpanded ? (
            <View style={styles.detailsPanel}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Inspectiepunt</Text>
                <Text style={styles.detailValue}>{item.inspectionPointId}</Text>
              </View>
              {complianceContext.disciplineTitle ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Discipline</Text>
                  <Text style={styles.detailValue}>{complianceContext.disciplineTitle}</Text>
                </View>
              ) : null}
              {complianceContext.standards ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Norm / kader</Text>
                  <Text style={styles.detailValue}>{complianceContext.standards}</Text>
                </View>
              ) : null}
              {complianceContext.stopMoment ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Stopmoment</Text>
                  <Text style={styles.detailValue}>
                    {complianceContext.stopMoment} •{' '}
                    {item.stopMomentConfirmed ? 'bevestigd' : 'nog niet bevestigd'}
                  </Text>
                </View>
              ) : null}
              {complianceContext.requiresMeasurementTool ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Meetmiddel</Text>
                  <Text style={styles.detailValue}>
                    {item.measurementToolConfirmed
                      ? 'Rolmaat/waterpas bevestigd in beeld'
                      : 'Nog geen bevestiging rolmaat/waterpas in beeld'}
                  </Text>
                </View>
              ) : null}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Tijdstip</Text>
                <Text style={styles.detailValue}>{formattedDate}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>GPS coördinaten</Text>
                <Text style={styles.detailValue}>
                  {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>GPS nauwkeurigheid</Text>
                <Text style={styles.detailValue}>
                  {item.gpsAccuracy != null ? `${item.gpsAccuracy.toFixed(1)} meter` : 'Onbekend'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Locatiecontrole</Text>
                <Text style={styles.detailValue}>
                  {item.locationVerified
                    ? `Akkoord${item.locationSpoofRisk ? ` (${item.locationSpoofRisk})` : ''}`
                    : item.locationSecurityMessage || 'Niet bevestigd'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>SHA-256 hash</Text>
                <Text style={styles.hashValue}>{item.exifHash}</Text>
              </View>
              {item.ifcGuid ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>IFC GUID</Text>
                  <Text style={styles.hashValue}>{item.ifcGuid}</Text>
                </View>
              ) : null}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>AI status</Text>
                <Text style={styles.detailValue}>
                  {item.aiStatus ?? 'PENDING'}
                  {item.aiConfidence != null
                    ? ` (${Math.round(item.aiConfidence * 100)}%)`
                    : ''}
                </Text>
              </View>
              {approved ? (
                <Text
                  style={
                    selectedEvidence?.syncStatus === 'SYNCED'
                      ? styles.aiApprovedCloudBadge
                      : styles.aiApprovedEdgeBadge
                  }
                >
                  {selectedEvidence?.syncStatus === 'SYNCED'
                    ? '✨ Cloud AI Inhoudelijk Goedgekeurd'
                    : '★ Edge AI Inhoudelijk Goedgekeurd'}
                </Text>
              ) : null}
              {item.aiNotes ? (
                <View style={styles.notePanel}>
                  <Text style={styles.notePanelLabel}>AI bevinding</Text>
                  <Text style={[styles.notePanelText, approved && styles.aiApprovedText]}>
                    {item.aiNotes}
                  </Text>
                </View>
              ) : null}
              {item.fieldNote ? (
                <View style={styles.notePanel}>
                  <Text style={styles.notePanelLabel}>Veldnotitie</Text>
                  <Text style={styles.notePanelText}>{item.fieldNote}</Text>
                </View>
              ) : null}
              <View
                style={[
                  styles.statusBadge,
                  item.syncStatus === 'SYNCED'
                    ? styles.synced
                    : item.syncStatus === 'FAILED'
                      ? styles.failed
                      : styles.offline,
                ]}
              >
                <Text style={styles.statusText}>
                  {item.syncStatus === 'SYNCED' && '✅ Veilig (Cloud)'}
                  {item.syncStatus === 'PENDING' && '⚠️ Offline (Lokaal)'}
                  {item.syncStatus === 'FAILED' && '❌ Sync opnieuw nodig'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.detailActionButton}
                onPress={() => setSelectedEvidence(item)}
              >
                <Text style={styles.detailActionButtonText}>Volledig bewijs bekijken</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{activeProjectName}</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={() => void fetchData()}>
          <Text style={styles.refreshText}>↻ Vernieuw</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.syncContainer}>
        <WkbOfficialPanel />
        <WkbCompliancePanel snapshot={complianceSnapshot} />
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{dossierMetrics.total}</Text>
            <Text style={styles.summaryLabel}>Totaal</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{dossierMetrics.offline}</Text>
            <Text style={styles.summaryLabel}>Offline</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{dossierMetrics.synced}</Text>
            <Text style={styles.summaryLabel}>Cloud</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{dossierMetrics.attention}</Text>
            <Text style={styles.summaryLabel}>AI aandacht</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{dossierMetrics.ready}</Text>
            <Text style={styles.summaryLabel}>Wkb-proof</Text>
          </View>
        </View>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Zoek op project, inspectiepunt, notitie, hash of AI-status"
          placeholderTextColor={theme.colors.textSecondary}
        />
        <View style={styles.filterRow}>
          {[
            { key: 'all', label: 'Alles' },
            { key: 'offline', label: 'Offline' },
            { key: 'cloud', label: 'Cloud' },
            { key: 'attention', label: 'AI aandacht' },
            { key: 'ready', label: 'Wkb-proof' },
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.filterChip,
                statusFilter === item.key && styles.filterChipActive,
              ]}
              onPress={() => setStatusFilter(item.key as StatusFilter)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  statusFilter === item.key && styles.filterChipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* PDF Borgingsdossier — alleen op web */}
        {isWeb ? (
          <TouchableOpacity
            style={[styles.syncButton, { backgroundColor: isPdfLoading ? '#9b1a22' : '#e63946' }, isPdfLoading && styles.syncButtonDisabled]}
            onPress={async () => {
              setIsPdfLoading(true);
              try {
                await exportDossierAsPdf(
                  evidenceList,
                  activeProjectId,
                  activeProjectName,
                  {
                    aannemer: exportAannemer || undefined,
                    adres: exportAdres || undefined,
                    kwaliteitsborger: exportKwaliteitsborger || undefined,
                  }
                );
              } finally {
                setIsPdfLoading(false);
              }
            }}
            disabled={isPdfLoading}
            activeOpacity={0.85}
          >
            {isPdfLoading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.syncButtonText}>FOTO'S LADEN…</Text>
              </View>
            ) : (
              <Text style={styles.syncButtonText}>📄 BORGINGSDOSSIER PDF</Text>
            )}
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.syncButton, isSyncing && styles.syncButtonDisabled]}
          onPress={handleSync}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <View style={styles.syncingContent}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.syncButtonTextActive}>{syncMessage || 'Syncing...'}</Text>
            </View>
          ) : (
            <Text style={styles.syncButtonText}>☁️ SYNC ALLES NAAR CLOUD</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.syncButton, isSubmitting && styles.syncButtonDisabled]}
          onPress={handleSubmitStam}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.syncButtonText}>📨 STAM INDIENEN</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleCheckStamStatus}>
          <Text style={styles.secondaryButtonText}>🔎 STAM STATUS</Text>
        </TouchableOpacity>
        <View style={styles.exportSection}>
          <Text style={styles.exportTitle}>📄 Dossier export</Text>
          <Text style={styles.exportSubtitle}>
            Kies type dossier en exporteer als PDF.
          </Text>
          <View style={styles.exportFields}>
            <TextInput
              style={styles.exportInput}
              value={exportAannemer}
              onChangeText={setExportAannemer}
              placeholder="Aannemer"
              placeholderTextColor={theme.colors.textSecondary}
            />
            <TextInput
              style={styles.exportInput}
              value={exportAdres}
              onChangeText={setExportAdres}
              placeholder="Adres"
              placeholderTextColor={theme.colors.textSecondary}
            />
            <View style={styles.exportInlineRow}>
              <TextInput
                style={[styles.exportInput, styles.exportInlineInput]}
                value={exportGevolgklasse}
                onChangeText={setExportGevolgklasse}
                placeholder="Gevolgklasse"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.exportInput, styles.exportInlineInput]}
                value={exportKwaliteitsborger}
                onChangeText={setExportKwaliteitsborger}
                placeholder="Kwaliteitsborger"
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>
          </View>
          <View style={styles.exportTypeRow}>
            <TouchableOpacity
              style={[
                styles.exportTypeButton,
                exportType === 'bevoegd-gezag' && styles.exportTypeButtonActive,
              ]}
              onPress={() => setExportType('bevoegd-gezag')}
            >
              <Text
                style={[
                  styles.exportTypeText,
                  exportType === 'bevoegd-gezag' && styles.exportTypeTextActive,
                ]}
              >
                🏛️ Bevoegd Gezag
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.exportTypeButton,
                exportType === 'consument' && styles.exportTypeButtonActive,
              ]}
              onPress={() => setExportType('consument')}
            >
              <Text
                style={[
                  styles.exportTypeText,
                  exportType === 'consument' && styles.exportTypeTextActive,
                ]}
              >
                👷 Consument
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.syncButton, isExporting && styles.syncButtonDisabled]}
            onPress={handleExportPdf}
            disabled={isExporting}
          >
            {isExporting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.syncButtonText}>📄 PDF DOSSIER EXPORT</Text>
            )}
          </TouchableOpacity>
        </View>
        {stamReference ? (
          <Text style={styles.statusTextInline}>
            Ref: {stamReference} • Status: {stamStatus ?? 'onbekend'}
          </Text>
        ) : null}
        {lastLiveUpdateAt ? (
          <Text style={styles.liveUpdateText}>
            ⚡ Live update: {lastLiveUpdateId ?? 'onbekend'} •{' '}
            {new Date(lastLiveUpdateAt).toLocaleTimeString('nl-NL')}
          </Text>
        ) : null}
      </View>

      {filteredEvidence.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {evidenceList.length === 0
              ? 'Nog geen bewijsmateriaal vastgelegd.'
              : 'Geen bewijsstukken gevonden voor deze filters.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredEvidence}
          keyExtractor={(item) => item.id}
          renderItem={renderEvidenceCard}
          contentContainerStyle={styles.listContent}
        />
      )}

      <Modal
        visible={selectedEvidence != null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedEvidence(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleBlock}>
                <Text style={styles.modalTitle}>
                  {selectedEvidence?.inspectionPointId ?? 'Bewijsdetail'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {selectedEvidence?.projectId ?? activeProjectId}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setSelectedEvidence(null)}
              >
                <Text style={styles.modalCloseButtonText}>Sluiten</Text>
              </TouchableOpacity>
            </View>

            {selectedEvidence ? (
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {(() => {
                  const context = getEvidenceComplianceContext(
                    selectedEvidence.inspectionPointId
                  );

                  return (
                    <>
                      <Image
                        source={{ uri: selectedEvidence.mediaUri }}
                        style={styles.modalImage}
                      />

                      <View style={styles.modalChipRow}>
                        <View
                          style={[
                            styles.detailChip,
                            selectedEvidence.syncStatus === 'SYNCED'
                              ? styles.chipSuccess
                              : selectedEvidence.syncStatus === 'FAILED'
                                ? styles.chipDanger
                                : styles.chipWarning,
                          ]}
                        >
                          <Text style={styles.detailChipText}>
                            {getSyncLabel(selectedEvidence)}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.detailChip,
                            selectedEvidence.exifVerified
                              ? styles.chipSuccess
                              : styles.chipDanger,
                          ]}
                        >
                          <Text style={styles.detailChipText}>
                            {selectedEvidence.exifVerified
                              ? 'EXIF bevestigd'
                              : 'EXIF niet bevestigd'}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.detailChip,
                            isAiApproved(selectedEvidence.aiStatus) &&
                            selectedEvidence.syncStatus === 'SYNCED'
                              ? styles.chipAiCloud
                              : isAiApproved(selectedEvidence.aiStatus)
                                ? styles.chipAiEdge
                                : selectedEvidence.aiStatus === 'NEEDS_REVIEW'
                                  ? styles.chipWarning
                                  : styles.chipDanger,
                          ]}
                        >
                          <Text
                            style={[
                              styles.detailChipText,
                              isAiApproved(selectedEvidence.aiStatus) &&
                                selectedEvidence.syncStatus === 'SYNCED' &&
                                styles.chipAiCloudText,
                            ]}
                          >
                            {getAiLabel(selectedEvidence)}
                          </Text>
                        </View>
                        {context.stopMoment ? (
                          <View
                            style={[
                              styles.detailChip,
                              selectedEvidence.stopMomentConfirmed
                                ? styles.chipSuccess
                                : styles.chipDanger,
                            ]}
                          >
                            <Text style={styles.detailChipText}>
                              {selectedEvidence.stopMomentConfirmed
                                ? 'Stopmoment bevestigd'
                                : 'Stopmoment open'}
                            </Text>
                          </View>
                        ) : null}
                        {context.requiresMeasurementTool ? (
                          <View
                            style={[
                              styles.detailChip,
                              selectedEvidence.measurementToolConfirmed
                                ? styles.chipSuccess
                                : styles.chipDanger,
                            ]}
                          >
                            <Text style={styles.detailChipText}>
                              {selectedEvidence.measurementToolConfirmed
                                ? 'Meetmiddel bevestigd'
                                : 'Meetmiddel open'}
                            </Text>
                          </View>
                        ) : null}
                        <View
                          style={[
                            styles.detailChip,
                            selectedEvidence.locationVerified
                              ? styles.chipSuccess
                              : styles.chipDanger,
                          ]}
                        >
                          <Text style={styles.detailChipText}>
                            {selectedEvidence.locationVerified
                              ? `Locatie akkoord${
                                  selectedEvidence.locationSpoofRisk
                                    ? ` (${selectedEvidence.locationSpoofRisk})`
                                    : ''
                                }`
                              : 'Locatie open'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.modalSection}>
                        <Text style={styles.modalSectionTitle}>Juridische metadata</Text>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Tijdstip</Text>
                          <Text style={styles.detailValue}>
                            {new Date(selectedEvidence.timestamp).toLocaleDateString('nl-NL')}{' '}
                            {new Date(selectedEvidence.timestamp).toLocaleTimeString('nl-NL')}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>GPS coördinaten</Text>
                          <Text style={styles.detailValue}>
                            {selectedEvidence.latitude.toFixed(6)},{' '}
                            {selectedEvidence.longitude.toFixed(6)}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>GPS nauwkeurigheid</Text>
                          <Text style={styles.detailValue}>
                            {selectedEvidence.gpsAccuracy != null
                              ? `${selectedEvidence.gpsAccuracy.toFixed(1)} meter`
                              : 'Niet beschikbaar'}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Locatiecontrole</Text>
                          <Text style={styles.detailValue}>
                            {selectedEvidence.locationVerified
                              ? `Akkoord${
                                  selectedEvidence.locationSpoofRisk
                                    ? ` (${selectedEvidence.locationSpoofRisk})`
                                    : ''
                                }`
                              : selectedEvidence.locationSecurityMessage ||
                                'Niet bevestigd'}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>SHA-256 hash</Text>
                          <Text style={styles.hashValue}>{selectedEvidence.exifHash}</Text>
                        </View>
                        {selectedEvidence.ifcGuid ? (
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>IFC GUID</Text>
                            <Text style={styles.hashValue}>{selectedEvidence.ifcGuid}</Text>
                          </View>
                        ) : null}
                        {context.stopMoment ? (
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Stopmoment</Text>
                            <Text style={styles.detailValue}>
                              {context.stopMoment} •{' '}
                              {selectedEvidence.stopMomentConfirmed
                                ? 'bevestigd'
                                : 'nog niet bevestigd'}
                            </Text>
                          </View>
                        ) : null}
                        {context.requiresMeasurementTool ? (
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Meetmiddel</Text>
                            <Text style={styles.detailValue}>
                              {selectedEvidence.measurementToolConfirmed
                                ? 'Rolmaat/waterpas bevestigd in beeld'
                                : 'Nog geen bevestiging rolmaat/waterpas in beeld'}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.modalSection}>
                        <Text style={styles.modalSectionTitle}>Validatie en context</Text>
                        {context.disciplineTitle ? (
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Discipline</Text>
                            <Text style={styles.detailValue}>{context.disciplineTitle}</Text>
                          </View>
                        ) : null}
                        {context.standards ? (
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Norm / kader</Text>
                            <Text style={styles.detailValue}>{context.standards}</Text>
                          </View>
                        ) : null}
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>AI status</Text>
                          <Text style={styles.detailValue}>
                            {selectedEvidence.aiStatus ?? 'PENDING'}
                            {selectedEvidence.aiConfidence != null
                              ? ` (${Math.round(selectedEvidence.aiConfidence * 100)}%)`
                              : ''}
                          </Text>
                        </View>
                        {selectedEvidence.aiNotes ? (
                          <View style={styles.notePanel}>
                            <Text style={styles.notePanelLabel}>AI bevinding</Text>
                            <Text
                              style={[
                                styles.notePanelText,
                                isAiApproved(selectedEvidence.aiStatus) &&
                                  styles.aiApprovedText,
                              ]}
                            >
                              {selectedEvidence.aiNotes}
                            </Text>
                          </View>
                        ) : null}
                        {selectedEvidence.fieldNote ? (
                          <View style={styles.notePanel}>
                            <Text style={styles.notePanelLabel}>Veldnotitie</Text>
                            <Text style={styles.notePanelText}>{selectedEvidence.fieldNote}</Text>
                          </View>
                        ) : null}
                      </View>
                    </>
                  );
                })()}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (
  theme: { colors: Record<string, string> },
  isWide: boolean,
  isCompact: boolean
) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background, overflow: 'auto' as any },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      paddingTop: 10,
      backgroundColor: theme.colors.surface,
      width: '100%',
      maxWidth: 1320,
      alignSelf: 'center',
    },
    headerTitle: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: '700' },
    refreshButton: {
      padding: 8,
      backgroundColor: theme.colors.accentMuted,
      borderRadius: 8,
    },
    refreshText: { color: theme.colors.textPrimary, fontWeight: '700' },
    syncContainer: {
      width: '100%',
      maxWidth: 1320,
      alignSelf: 'center',
      padding: 15,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      gap: 12,
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    summaryCard: {
      flex: 1,
      minWidth: isWide ? 180 : '47%',
      padding: 12,
      borderRadius: 10,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    summaryValue: {
      color: theme.colors.textPrimary,
      fontSize: 22,
      fontWeight: '700',
    },
    summaryLabel: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      marginTop: 4,
    },
    searchInput: {
      backgroundColor: theme.colors.surfaceAlt,
      color: theme.colors.textPrimary,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      fontSize: 13,
    },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    filterChip: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: theme.colors.accentMuted,
    },
    filterChipActive: {
      backgroundColor: theme.colors.accent,
    },
    filterChipText: {
      color: theme.colors.textPrimary,
      fontSize: 12,
      fontWeight: '600',
    },
    filterChipTextActive: {
      color: '#fff',
    },
    exportTypeRow: {
      flexDirection: isCompact ? 'column' : 'row',
      gap: 10,
    },
    exportTypeButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: theme.colors.accentMuted,
      alignItems: 'center',
    },
    exportTypeButtonActive: {
      backgroundColor: theme.colors.accent,
    },
    exportTypeText: {
      color: theme.colors.textPrimary,
      fontSize: 13,
      fontWeight: '600',
    },
    exportTypeTextActive: {
      color: '#fff',
    },
    exportSection: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 10,
      padding: 12,
      gap: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    exportTitle: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    exportSubtitle: {
      color: theme.colors.textSecondary,
      fontSize: 12,
    },
    exportFields: {
      gap: 8,
    },
    exportInput: {
      backgroundColor: theme.colors.surfaceAlt,
      color: theme.colors.textPrimary,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      fontSize: 13,
    },
    exportInlineRow: {
      flexDirection: isCompact ? 'column' : 'row',
      gap: 8,
    },
    exportInlineInput: {
      flex: 1,
    },
    syncButton: {
      backgroundColor: theme.colors.accent,
      padding: 15,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
    },
    syncButtonDisabled: { backgroundColor: theme.colors.textSecondary },
    syncingContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    syncButtonTextActive: { color: '#fff', fontSize: 13, fontWeight: '600' },
    syncButtonText: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '700' },
    secondaryButton: {
      backgroundColor: theme.colors.accentMuted,
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    secondaryButtonText: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: '600',
    },
    statusTextInline: {
      color: theme.colors.textSecondary,
      fontSize: 12,
    },
    liveUpdateText: {
      color: '#36D399',
      fontSize: 12,
      fontWeight: '600',
    },
    listContent: {
      width: '100%',
      maxWidth: 1320,
      alignSelf: 'center',
      padding: 15,
    },
    card: {
      flexDirection: isCompact ? 'column' : 'row',
      backgroundColor: theme.colors.surface,
      borderRadius: 10,
      marginBottom: 15,
      overflow: 'hidden',
      elevation: 3,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    thumbnail: {
      width: isCompact ? '100%' : 100,
      height: isCompact ? 220 : 100,
      backgroundColor: theme.colors.background,
    },
    infoContainer: { flex: 1, padding: 12, justifyContent: 'space-between' },
    cardHeaderRow: {
      flexDirection: isCompact ? 'column' : 'row',
      justifyContent: 'space-between',
      alignItems: isCompact ? 'flex-start' : 'center',
      gap: 8,
      marginBottom: 8,
    },
    cardTitleBlock: {
      flex: 1,
      gap: 4,
    },
    cardTitle: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontWeight: '800',
    },
    cardSubline: {
      color: theme.colors.textSecondary,
      fontSize: 12,
    },
    readinessBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    readyBadge: {
      backgroundColor: theme.colors.success,
    },
    attentionBadge: {
      backgroundColor: theme.colors.warning,
    },
    readinessBadgeText: {
      color: theme.colors.textPrimary,
      fontSize: 11,
      fontWeight: '800',
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 10,
    },
    detailChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    contextChip: {
      backgroundColor: theme.colors.accentMuted,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    chipSuccess: {
      backgroundColor: theme.colors.success,
    },
    chipWarning: {
      backgroundColor: theme.colors.warning,
    },
    chipDanger: {
      backgroundColor: theme.colors.danger,
    },
    chipAiCloud: {
      backgroundColor: '#FEF08A',
      borderWidth: 1,
      borderColor: '#EAB308',
    },
    chipAiCloudText: {
      color: '#854D0E',
    },
    chipAiEdge: {
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    detailChipText: {
      color: theme.colors.textPrimary,
      fontSize: 11,
      fontWeight: '700',
    },
    detailActionButton: {
      marginTop: 10,
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 8,
      backgroundColor: theme.colors.accent,
    },
    detailActionButtonText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '800',
    },
    complianceText: {
      color: theme.colors.warning,
      fontSize: 12,
      fontWeight: '800',
      lineHeight: 18,
      marginBottom: 8,
    },
    previewNote: {
      color: theme.colors.textPrimary,
      fontSize: 13,
      lineHeight: 18,
      marginBottom: 10,
    },
    quickFactsRow: {
      flexDirection: isCompact ? 'column' : 'row',
      gap: 10,
      marginBottom: 8,
    },
    quickFactText: {
      color: theme.colors.textSecondary,
      fontSize: 12,
    },
    expandHint: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '700',
    },
    detailsPanel: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      gap: 8,
    },
    detailRow: {
      gap: 4,
    },
    detailLabel: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    detailValue: {
      color: theme.colors.textPrimary,
      fontSize: 13,
      lineHeight: 18,
    },
    hashValue: {
      color: theme.colors.textPrimary,
      fontSize: 12,
      lineHeight: 18,
    },
    notePanel: {
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      padding: 10,
      gap: 6,
    },
    notePanelLabel: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    notePanelText: {
      color: theme.colors.textPrimary,
      fontSize: 13,
      lineHeight: 18,
    },
    metaText: { color: theme.colors.textSecondary, fontSize: 13, marginBottom: 4 },
    aiApprovedText: { color: '#36D399' },
    aiApprovedEdgeBadge: {
      color: theme.colors.textPrimary,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      alignSelf: 'flex-start',
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 4,
    },
    aiApprovedCloudBadge: {
      color: '#854D0E',
      backgroundColor: '#FEF08A',
      borderWidth: 1,
      borderColor: '#EAB308',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      alignSelf: 'flex-start',
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 4,
    },
    statusBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      marginTop: 5,
    },
    offline: { backgroundColor: theme.colors.warning },
    synced: { backgroundColor: theme.colors.success },
    failed: { backgroundColor: theme.colors.danger },
    statusText: { color: theme.colors.textPrimary, fontSize: 11, fontWeight: '700' },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: {
      color: theme.colors.textSecondary,
      fontSize: 16,
      textAlign: 'center',
      paddingHorizontal: 24,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(2, 6, 23, 0.78)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    modalCard: {
      width: '100%',
      maxWidth: 960,
      maxHeight: '92%',
      backgroundColor: theme.colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
      gap: 12,
    },
    modalTitleBlock: {
      flex: 1,
      gap: 4,
    },
    modalTitle: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontWeight: '800',
    },
    modalSubtitle: {
      color: theme.colors.textSecondary,
      fontSize: 12,
    },
    modalCloseButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: theme.colors.accent,
    },
    modalCloseButtonText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '800',
    },
    modalScroll: {
      flex: 1,
    },
    modalScrollContent: {
      padding: 18,
      gap: 16,
    },
    modalImage: {
      width: '100%',
      height: isCompact ? 220 : 340,
      borderRadius: 14,
      backgroundColor: theme.colors.background,
    },
    modalChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    modalSection: {
      gap: 10,
    },
    modalSectionTitle: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
  });
