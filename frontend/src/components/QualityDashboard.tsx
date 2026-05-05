import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { DEFAULT_PROJECT_ID } from '../config/app';
import { getDeviceType } from '../lib/platform';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  fetchEvidenceForReview,
  type CloudEvidence,
  updateEvidenceStatus,
} from '../services/cloudEvidenceService';
import { useWkbAuth } from '../hooks/useWkbAuth';
import { pushApprovedEvidenceToKik } from '../services/kik';
import { useTheme } from '../theme/ThemeProvider';

type ReviewStatusFilter = 'all' | 'pending' | 'approved' | 'review' | 'rejected';

const getReviewBucket = (status?: string | null): ReviewStatusFilter => {
  const normalized = (status ?? '').toUpperCase();

  if (!normalized || normalized === 'PENDING') {
    return 'pending';
  }
  if (['APPROVED', 'OK', 'PASSED'].includes(normalized)) {
    return 'approved';
  }
  if (normalized === 'NEEDS_REVIEW' || normalized === 'WARNING') {
    return 'review';
  }
  return 'rejected';
};

const getHumanStatusLabel = (status?: string | null) => {
  const bucket = getReviewBucket(status);
  if (bucket === 'approved') return 'Goedgekeurd';
  if (bucket === 'review') return 'Review nodig';
  if (bucket === 'rejected') return 'Afgekeurd';
  return 'Openstaand';
};

const isConfirmed = (value?: boolean | number | null) => value === true || value === 1;

export default function QualityDashboard() {
  const { theme } = useTheme();
  const { user, canApproveEvidence } = useWkbAuth();
  const [records, setRecords] = useState<CloudEvidence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingId, setIsSavingId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReviewStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const [isPushingKik, setIsPushingKik] = useState(false);
  const { width } = useWindowDimensions();
  const deviceType = getDeviceType(width);
  const isWide = deviceType === 'DESKTOP';
  const styles = useMemo(() => createStyles(theme, isWide), [theme, isWide, width]);

  const loadCloudEvidence = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setRecords([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const nextRecords = await fetchEvidenceForReview(DEFAULT_PROJECT_ID);
    setRecords(nextRecords);
    setNoteDrafts(
      nextRecords.reduce<Record<number, string>>((acc, item) => {
        acc[item.id] = item.ai_notes ?? '';
        return acc;
      }, {})
    );
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadCloudEvidence();

    if (!isSupabaseConfigured()) {
      return;
    }

    const channel = supabase
      .channel('quality-dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'evidence' },
        () => {
          void loadCloudEvidence();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadCloudEvidence]);

  const metrics = useMemo(
    () => ({
      total: records.length,
      pending: records.filter((item) => getReviewBucket(item.ai_status) === 'pending').length,
      approved: records.filter((item) => getReviewBucket(item.ai_status) === 'approved')
        .length,
      review: records.filter((item) => getReviewBucket(item.ai_status) === 'review').length,
      rejected: records.filter((item) => getReviewBucket(item.ai_status) === 'rejected')
        .length,
    }),
    [records]
  );

  const filteredRecords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return records.filter((item) => {
      const matchesFilter =
        statusFilter === 'all' || getReviewBucket(item.ai_status) === statusFilter;

      if (!matchesFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        item.project_id,
        item.inspection_point_id,
        item.ai_status,
        item.ai_notes,
        item.field_note,
        item.exif_hash,
        item.betonkwaliteit,
        item.milieuklasse,
        item.volume,
        item.leverdatum,
        item.location_spoof_risk,
        item.location_security_message,
        isConfirmed(item.exif_verified) ? 'exif bevestigd' : 'exif open',
        isConfirmed(item.location_verified) ? 'locatie bevestigd' : 'locatie open',
        isConfirmed(item.stop_moment_confirmed) ? 'stopmoment bevestigd' : 'stopmoment open',
        isConfirmed(item.measurement_tool_confirmed)
          ? 'meetmiddel bevestigd'
          : 'meetmiddel open',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [records, searchQuery, statusFilter]);

  const persistReview = async (
    record: CloudEvidence,
    nextStatus: 'APPROVED' | 'NEEDS_REVIEW' | 'REJECTED'
  ) => {
    if (!isSupabaseConfigured()) {
      return;
    }

    setIsSavingId(record.id);

    const nextNote = noteDrafts[record.id] ?? record.ai_notes ?? '';
    const success = await updateEvidenceStatus(record.id, nextStatus, nextNote || null);

    if (!success) {
      Alert.alert('Opslaan mislukt', 'De reviewstatus kon niet in de cloud worden opgeslagen.');
    }

    setIsSavingId(null);
    await loadCloudEvidence();
  };

  const handlePushToKik = async () => {
    const approvedRecords = records.filter(
      (item) => getReviewBucket(item.ai_status) === 'approved'
    );

    if (approvedRecords.length === 0) {
      Alert.alert('Geen goedgekeurd bewijs', 'Keurt eerst minimaal één bewijsstuk goed.');
      return;
    }

    setIsPushingKik(true);
    try {
      await pushApprovedEvidenceToKik(DEFAULT_PROJECT_ID, approvedRecords);
      Alert.alert(
        'KiK synchronisatie gereed',
        `${approvedRecords.length} goedgekeurde bewijsstukken zijn naar KiK gepusht.`
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'KiK push kon niet worden uitgevoerd.';
      Alert.alert('KiK push mislukt', message);
    } finally {
      setIsPushingKik(false);
    }
  };

  const renderMetric = (label: string, value: number) => (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );

  const renderRecord = ({ item }: { item: CloudEvidence }) => {
    const imageUri = item.photo_uri ?? item.media_uri ?? '';
    const isSaving = isSavingId === item.id;
    const reviewBucket = getReviewBucket(item.ai_status);

    return (
      <View style={styles.recordCard}>
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.recordImage} /> : null}
        <View style={styles.recordBody}>
          <View style={styles.recordHeader}>
            <View style={styles.recordTitleBlock}>
              <Text style={styles.recordTitle}>
                {item.inspection_point_id ?? 'Onbekend inspectiepunt'}
              </Text>
              <Text style={styles.recordSubtitle}>
                {item.project_id ?? 'Onbekend project'} •{' '}
                {item.timestamp
                  ? new Date(item.timestamp).toLocaleString('nl-NL')
                  : 'Geen tijdstip'}
              </Text>
            </View>
            <View
              style={[
                styles.statusPill,
                reviewBucket === 'approved'
                  ? styles.pillApproved
                  : reviewBucket === 'review'
                    ? styles.pillReview
                    : reviewBucket === 'rejected'
                      ? styles.pillRejected
                      : styles.pillPending,
              ]}
            >
              <Text style={styles.statusPillText}>{getHumanStatusLabel(item.ai_status)}</Text>
            </View>
          </View>

          <View style={styles.detailGrid}>
            <Text style={styles.detailText}>
              GPS: {item.latitude ?? '—'}, {item.longitude ?? '—'}
            </Text>
            <Text style={styles.detailText}>
              GPS nauwkeurigheid:{' '}
              {item.gps_accuracy != null ? `${Number(item.gps_accuracy).toFixed(1)} m` : '—'}
            </Text>
            <Text style={styles.detailText}>
              AI confidence:{' '}
              {item.ai_confidence != null ? `${Math.round(item.ai_confidence * 100)}%` : '—'}
            </Text>
            <Text style={styles.detailText}>
              SHA-256: {item.exif_hash ? `${item.exif_hash.slice(0, 24)}...` : '—'}
            </Text>
            {(item.betonkwaliteit || item.milieuklasse || item.volume || item.leverdatum) && (
              <Text style={styles.detailText}>
                OCR: {item.betonkwaliteit || '—'}
                {item.milieuklasse ? ` • ${item.milieuklasse}` : ''}
                {item.volume ? ` • ${item.volume} m3` : ''}
                {item.leverdatum ? ` • ${item.leverdatum}` : ''}
              </Text>
            )}
          </View>

          <View style={styles.auditRow}>
            <View
              style={[
                styles.auditPill,
                isConfirmed(item.exif_verified) ? styles.pillApproved : styles.pillRejected,
              ]}
            >
              <Text style={styles.auditPillText}>
                {isConfirmed(item.exif_verified) ? 'EXIF bevestigd' : 'EXIF open'}
              </Text>
            </View>
            <View
              style={[
                styles.auditPill,
                isConfirmed(item.location_verified)
                  ? styles.pillApproved
                  : styles.pillRejected,
              ]}
            >
              <Text style={styles.auditPillText}>
                {isConfirmed(item.location_verified)
                  ? `Locatie akkoord${item.location_spoof_risk ? ` (${item.location_spoof_risk})` : ''}`
                  : 'Locatie open'}
              </Text>
            </View>
            <View
              style={[
                styles.auditPill,
                isConfirmed(item.stop_moment_confirmed)
                  ? styles.pillApproved
                  : styles.pillRejected,
              ]}
            >
              <Text style={styles.auditPillText}>
                {isConfirmed(item.stop_moment_confirmed)
                  ? 'Stopmoment bevestigd'
                  : 'Stopmoment open'}
              </Text>
            </View>
            <View
              style={[
                styles.auditPill,
                isConfirmed(item.measurement_tool_confirmed)
                  ? styles.pillApproved
                  : styles.pillRejected,
              ]}
            >
              <Text style={styles.auditPillText}>
                {isConfirmed(item.measurement_tool_confirmed)
                  ? 'Meetmiddel bevestigd'
                  : 'Meetmiddel open'}
              </Text>
            </View>
          </View>

          {item.field_note ? (
            <View style={styles.noteBox}>
              <Text style={styles.noteBoxLabel}>Veldnotitie</Text>
              <Text style={styles.noteBoxText}>{item.field_note}</Text>
            </View>
          ) : null}

          {item.location_security_message ? (
            <View style={styles.noteBox}>
              <Text style={styles.noteBoxLabel}>Locatiecontrole</Text>
              <Text style={styles.noteBoxText}>{item.location_security_message}</Text>
            </View>
          ) : null}

          <TextInput
            style={styles.reviewInput}
            multiline
            value={noteDrafts[item.id] ?? ''}
            onChangeText={(value) =>
              setNoteDrafts((current) => ({ ...current, [item.id]: value }))
            }
            placeholder="Notitie van kwaliteitsborger of review-opmerking"
            placeholderTextColor={theme.colors.textSecondary}
          />

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionApprove]}
              onPress={() => void persistReview(item, 'APPROVED')}
              disabled={isSaving}
            >
              <Text style={styles.actionButtonText}>Goedkeuren</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionReview]}
              onPress={() => void persistReview(item, 'NEEDS_REVIEW')}
              disabled={isSaving}
            >
              <Text style={styles.actionButtonText}>Review nodig</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionReject]}
              onPress={() => void persistReview(item, 'REJECTED')}
              disabled={isSaving}
            >
              <Text style={styles.actionButtonText}>Afkeuren</Text>
            </TouchableOpacity>
          </View>

          {isSaving ? <ActivityIndicator color={theme.colors.accent} /> : null}
        </View>
      </View>
    );
  };

  if (!isSupabaseConfigured()) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Supabase ontbreekt</Text>
        <Text style={styles.emptyText}>
          Stel eerst de cloudconfiguratie in om het kwaliteitsborger-dashboard te gebruiken.
        </Text>
      </View>
    );
  }

  if (user && !canApproveEvidence()) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Geen toegang</Text>
        <Text style={styles.emptyText}>
          Alleen de aannemer of kwaliteitsborger mag bewijs beoordelen en dossiers vrijgeven.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Kwaliteitsborger Dashboard</Text>
          <Text style={styles.heroSubtitle}>
            Beoordeel geüpload bewijs, voeg review-notities toe en zet dossiers klaar
            voor bevoegd gezag.
          </Text>
        </View>
        <View style={styles.heroActions}>
          <TouchableOpacity
            style={styles.kikButton}
            onPress={() => void handlePushToKik()}
            disabled={isPushingKik}
          >
            <Text style={styles.refreshButtonText}>
              {isPushingKik ? 'KiK push…' : 'Push naar KiK'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.refreshButton} onPress={() => void loadCloudEvidence()}>
            <Text style={styles.refreshButtonText}>Vernieuwen</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.contextBanner}>
        <Text style={styles.contextBannerTitle}>Projectcontext</Text>
        <Text style={styles.contextBannerText}>
          Alleen cloudbewijs voor project {DEFAULT_PROJECT_ID} wordt hier getoond,
          beoordeeld en klaargezet voor dossier of KiK-sync.
        </Text>
      </View>

      <View style={styles.metricsRow}>
        {renderMetric('Totaal', metrics.total)}
        {renderMetric('Openstaand', metrics.pending)}
        {renderMetric('Goedgekeurd', metrics.approved)}
        {renderMetric('Review', metrics.review)}
        {renderMetric('Afgekeurd', metrics.rejected)}
      </View>

      <View style={styles.toolbar}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Zoek op project, inspectiepunt of hash"
          placeholderTextColor={theme.colors.textSecondary}
        />
        <View style={styles.filterRow}>
          {[
            ['all', 'Alles'],
            ['pending', 'Openstaand'],
            ['approved', 'Goedgekeurd'],
            ['review', 'Review'],
            ['rejected', 'Afgekeurd'],
          ].map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.filterChip,
                statusFilter === key && styles.filterChipActive,
              ]}
              onPress={() => setStatusFilter(key as ReviewStatusFilter)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  statusFilter === key && styles.filterChipTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={theme.colors.accent} />
          <Text style={styles.emptyText}>Cloudbewijs laden…</Text>
        </View>
      ) : filteredRecords.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Geen cloudbewijs gevonden</Text>
          <Text style={styles.emptyText}>
            Pas filters aan of synchroniseer eerst bewijs vanuit de bouwplaats.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredRecords}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderRecord}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const createStyles = (
  theme: { colors: Record<string, string> },
  isWide: boolean
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: isWide ? 20 : 14,
      gap: 12,
      overflow: 'auto' as any,
    },
    hero: {
      backgroundColor: theme.colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 20,
      flexDirection: isWide ? 'row' : 'column',
      justifyContent: 'space-between',
      alignItems: isWide ? 'center' : 'flex-start',
      gap: 14,
    },
    heroCopy: {
      flex: 1,
      gap: 6,
    },
    heroTitle: {
      color: theme.colors.textPrimary,
      fontSize: 24,
      fontWeight: '800',
    },
    heroSubtitle: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      maxWidth: 760,
    },
    heroActions: {
      flexDirection: isWide ? 'row' : 'column',
      gap: 10,
      width: isWide ? 'auto' : '100%',
    },
    refreshButton: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: theme.colors.accent,
    },
    kikButton: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: theme.colors.success,
    },
    refreshButtonText: {
      color: '#fff',
      fontWeight: '800',
    },
    contextBanner: {
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 14,
      padding: 14,
      gap: 4,
    },
    contextBannerTitle: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    contextBannerText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    metricsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    metricCard: {
      flex: 1,
      minWidth: isWide ? 160 : 140,
      padding: 14,
      borderRadius: 14,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    metricValue: {
      color: theme.colors.textPrimary,
      fontSize: 26,
      fontWeight: '800',
    },
    metricLabel: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      marginTop: 4,
    },
    toolbar: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 14,
      gap: 12,
    },
    searchInput: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      color: theme.colors.textPrimary,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
    },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.colors.accentMuted,
    },
    filterChipActive: {
      backgroundColor: theme.colors.accent,
    },
    filterChipText: {
      color: theme.colors.textPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    filterChipTextActive: {
      color: '#fff',
    },
    listContent: {
      paddingBottom: 32,
      gap: 14,
    },
    recordCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
      flexDirection: isWide ? 'row' : 'column',
    },
    recordImage: {
      width: isWide ? 260 : '100%',
      height: isWide ? 260 : 220,
      backgroundColor: theme.colors.surfaceAlt,
    },
    recordBody: {
      flex: 1,
      padding: 16,
      gap: 12,
    },
    recordHeader: {
      flexDirection: isWide ? 'row' : 'column',
      justifyContent: 'space-between',
      alignItems: isWide ? 'center' : 'flex-start',
      gap: 10,
    },
    recordTitleBlock: {
      flex: 1,
      gap: 4,
    },
    recordTitle: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontWeight: '800',
    },
    recordSubtitle: {
      color: theme.colors.textSecondary,
      fontSize: 12,
    },
    statusPill: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
    },
    pillApproved: {
      backgroundColor: theme.colors.success,
    },
    pillReview: {
      backgroundColor: theme.colors.warning,
    },
    pillRejected: {
      backgroundColor: theme.colors.danger,
    },
    pillPending: {
      backgroundColor: theme.colors.accentMuted,
    },
    statusPillText: {
      color: theme.colors.textPrimary,
      fontSize: 12,
      fontWeight: '800',
    },
    detailGrid: {
      gap: 6,
    },
    detailText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
    },
    auditRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    auditPill: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
    },
    auditPillText: {
      color: theme.colors.textPrimary,
      fontSize: 11,
      fontWeight: '800',
    },
    noteBox: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
      gap: 6,
    },
    noteBoxLabel: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    noteBoxText: {
      color: theme.colors.textPrimary,
      fontSize: 13,
      lineHeight: 18,
    },
    reviewInput: {
      minHeight: 86,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
      color: theme.colors.textPrimary,
      padding: 12,
      textAlignVertical: 'top',
      fontSize: 14,
    },
    actionRow: {
      flexDirection: isWide ? 'row' : 'column',
      gap: 10,
    },
    actionButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
    },
    actionApprove: {
      backgroundColor: theme.colors.success,
    },
    actionReview: {
      backgroundColor: theme.colors.warning,
    },
    actionReject: {
      backgroundColor: theme.colors.danger,
    },
    actionButtonText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '800',
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      gap: 10,
    },
    emptyTitle: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontWeight: '800',
      textAlign: 'center',
    },
    emptyText: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
      maxWidth: 520,
    },
  });
