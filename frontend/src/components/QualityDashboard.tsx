import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Platform,
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
import type { CloudEvidence } from '../services/cloudEvidenceService';
import { useEvidenceRepository } from '../hooks/useEvidenceRepository';
import { useWkbAuth } from '../hooks/useWkbAuth';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { pushApprovedEvidenceToKik } from '../services/kik';
import { useTheme } from '../theme/ThemeProvider';
import { tokens } from '../theme/designTokens';
import { PageHeader } from './ui/PageHeader';
import { PrimaryButton } from './ui/PrimaryButton';
import { SecondaryButton } from './ui/SecondaryButton';
import { StatusPill } from './ui/StatusPill';
import { EmptyState } from './ui/EmptyState';

const formatShortDate = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

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
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Laag 3 (Actie) — modal-state: welk record + welke beslissing
  type ActionKind = 'APPROVED' | 'NEEDS_REVIEW' | 'REJECTED';
  const [actionTarget, setActionTarget] = useState<
    { record: CloudEvidence; kind: ActionKind } | null
  >(null);
  const [actionNote, setActionNote] = useState('');

  // Dev-info wordt alleen aan beheerders getoond (ruisreductie voor gewone gebruikers)
  const isAdmin = useIsAdmin();
  const { width } = useWindowDimensions();
  const deviceType = getDeviceType(width);
  const isWide = deviceType === 'DESKTOP';
  const styles = useMemo(() => createStyles(theme, isWide), [theme, isWide, width]);

  // Dual-mode: cloud OF lokaal, gekozen op basis van tenant_features.offline_mode
  const evidenceRepo = useEvidenceRepository();

  const loadCloudEvidence = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setRecords([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const nextRecords = await evidenceRepo.listForReview(DEFAULT_PROJECT_ID);
    setRecords(nextRecords);
    setNoteDrafts(
      nextRecords.reduce<Record<number, string>>((acc, item) => {
        acc[item.id] = item.ai_notes ?? '';
        return acc;
      }, {})
    );
    setIsLoading(false);
  }, [evidenceRepo]);

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
    const success = await evidenceRepo.updateStatus(record.id, nextStatus, nextNote || null);

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
    const isOpen = expandedId === item.id;

    // Map de fijnmazige reviewBucket op het 3-status Calm Design model.
    // approved → success · review/rejected/pending → warning (actie nodig).
    const pillStatus: 'success' | 'warning' | 'neutral' =
      reviewBucket === 'approved' ? 'success' : 'warning';

    return (
      <View style={styles.evidenceCardCompact}>
        <View style={styles.evidenceRowCompact}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.evidenceThumb} />
          ) : (
            <View style={[styles.evidenceThumb, styles.evidenceThumbEmpty]} />
          )}
          <View style={styles.evidenceInfo}>
            <Text style={styles.evidenceId} numberOfLines={1}>
              {item.inspection_point_id ?? 'Onbekend inspectiepunt'}
            </Text>
            <Text style={styles.evidenceMeta} numberOfLines={1}>
              {item.project_id ?? 'Project onbekend'} {' · '} {formatShortDate(item.timestamp)}
            </Text>
          </View>
          <StatusPill label={getHumanStatusLabel(item.ai_status)} status={pillStatus} />
          <TouchableOpacity
            style={styles.detailBtn}
            onPress={() => setExpandedId(isOpen ? null : item.id)}
            activeOpacity={0.85}
          >
            <Text style={styles.detailBtnText}>{isOpen ? 'Sluiten ▾' : 'Details →'}</Text>
          </TouchableOpacity>
        </View>

        {isOpen ? (
          <View style={styles.evidenceExpand}>
            {/* Laag 2 — Diagnose: betekenisvolle audit-pills voor iedereen */}
            <View style={styles.auditRowCompact}>
              <StatusPill
                label={isConfirmed(item.exif_verified) ? 'EXIF ✓' : 'EXIF open'}
                status={isConfirmed(item.exif_verified) ? 'success' : 'neutral'}
              />
              <StatusPill
                label={isConfirmed(item.location_verified) ? 'Locatie ✓' : 'Locatie open'}
                status={isConfirmed(item.location_verified) ? 'success' : 'neutral'}
              />
              <StatusPill
                label={isConfirmed(item.stop_moment_confirmed) ? 'Stopmoment ✓' : 'Stopmoment open'}
                status={isConfirmed(item.stop_moment_confirmed) ? 'success' : 'neutral'}
              />
              <StatusPill
                label={isConfirmed(item.measurement_tool_confirmed) ? 'Meetmiddel ✓' : 'Meetmiddel open'}
                status={isConfirmed(item.measurement_tool_confirmed) ? 'success' : 'neutral'}
              />
            </View>

            {(item.betonkwaliteit || item.milieuklasse || item.volume || item.leverdatum) ? (
              <Text style={styles.detailTextMuted}>
                OCR: {item.betonkwaliteit || '—'}
                {item.milieuklasse ? ` · ${item.milieuklasse}` : ''}
                {item.volume ? ` · ${item.volume} m³` : ''}
                {item.leverdatum ? ` · ${item.leverdatum}` : ''}
              </Text>
            ) : null}

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

            {/* Dev-info (GPS-coords, SHA, AI-vertrouwen): alleen voor ADMIN */}
            {isAdmin ? (
              <View style={styles.devInfoBox}>
                <Text style={styles.devInfoLabel}>DEV — alleen voor beheer</Text>
                <Text style={styles.detailTextMuted}>
                  GPS: {item.latitude ?? '—'}, {item.longitude ?? '—'}
                  {item.gps_accuracy != null
                    ? `  ·  ±${Number(item.gps_accuracy).toFixed(1)} m`
                    : ''}
                </Text>
                <Text style={styles.detailTextMuted}>
                  AI-vertrouwen:{' '}
                  {item.ai_confidence != null
                    ? `${Math.round(item.ai_confidence * 100)}%`
                    : '—'}
                  {item.exif_hash
                    ? `  ·  SHA ${item.exif_hash.slice(0, 12)}…`
                    : ''}
                </Text>
              </View>
            ) : null}

            {/* Laag 3 — Actie: openen via modal zodat context behouden blijft */}
            <View style={styles.actionRowCompact}>
              <PrimaryButton
                label="Goedkeuren"
                size="sm"
                onPress={() => {
                  setActionNote(noteDrafts[item.id] ?? item.ai_notes ?? '');
                  setActionTarget({ record: item, kind: 'APPROVED' });
                }}
                disabled={isSaving}
              />
              <SecondaryButton
                title="Review aanvragen"
                onPress={() => {
                  setActionNote(noteDrafts[item.id] ?? item.ai_notes ?? '');
                  setActionTarget({ record: item, kind: 'NEEDS_REVIEW' });
                }}
                disabled={isSaving}
              />
              <SecondaryButton
                title="Afkeuren"
                onPress={() => {
                  setActionNote(noteDrafts[item.id] ?? item.ai_notes ?? '');
                  setActionTarget({ record: item, kind: 'REJECTED' });
                }}
                disabled={isSaving}
              />
            </View>
          </View>
        ) : null}
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

  // Max 1 CTA in de PageHeader — "Push naar KiK" verschuift naar de toolbar.
  const headerActions = (
    <PrimaryButton
      label="Vernieuwen"
      size="sm"
      onPress={() => void loadCloudEvidence()}
    />
  );

  // ListHeaderComponent — page header, stats, search/filter (rendert 1x boven de lijst).
  // Hard begrensd op 20% van de viewport zodat er ALTIJD 5 evidence-cards onder passen.
  const windowHeight = Dimensions.get('window').height;
  const renderListHeader = () => (
    <View style={[styles.listHeader, { maxHeight: windowHeight * 0.2, overflow: 'hidden' }]}>
      <PageHeader title="Bewijs & dossier" rightAction={headerActions} />

      {metrics.total === 0 && !isLoading ? null : (
        <View style={styles.statInline}>
          <Text style={styles.statInlineText}>
            <Text style={styles.statInlineNum}>{metrics.total}</Text> totaal
            {'  ·  '}
            <Text style={styles.statInlineNum}>{metrics.pending}</Text> openstaand
            {'  ·  '}
            <Text style={[styles.statInlineNum, { color: tokens.forest }]}>{metrics.approved}</Text> goedgekeurd
            {'  ·  '}
            <Text style={[styles.statInlineNum, { color: tokens.amber }]}>{metrics.review}</Text> review
            {'  ·  '}
            <Text style={[styles.statInlineNum, { color: tokens.terracotta }]}>{metrics.rejected}</Text> afgekeurd
          </Text>
        </View>
      )}

      <View style={styles.toolbarRow}>
        <TextInput
          style={styles.searchInputV2}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Zoek op project, inspectiepunt of hash"
          placeholderTextColor={theme.colors.textSecondary}
        />
        <View style={styles.filterRowInline}>
          {[
            ['all', 'Alles'],
            ['pending', 'Open'],
            ['approved', 'Goed'],
            ['review', 'Review'],
            ['rejected', 'Afgekeurd'],
          ].map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.filterChipV2,
                statusFilter === key && styles.filterChipV2Active,
              ]}
              onPress={() => setStatusFilter(key as ReviewStatusFilter)}
            >
              <Text
                style={[
                  styles.filterChipV2Text,
                  statusFilter === key && styles.filterChipV2TextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <SecondaryButton
          title={isPushingKik ? 'KiK push…' : 'Push naar KiK'}
          onPress={() => void handlePushToKik()}
          disabled={isPushingKik}
        />
      </View>
    </View>
  );

  // ListEmptyComponent — toont laad-state, échte lege staat of filter-resultaat
  const renderListEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator color={theme.colors.accent} />
          <Text style={styles.emptyText}>Cloudbewijs laden…</Text>
        </View>
      );
    }
    if (metrics.total === 0) {
      return (
        <EmptyState
          icon="📭"
          title="Nog geen bewijs binnen"
          subtitle="Zodra de vakman op de bouw foto's maakt, verschijnt het bewijs hier voor jouw beoordeling."
        />
      );
    }
    return (
      <EmptyState
        icon="🔍"
        title="Geen resultaten met deze filters"
        subtitle="Pas de zoekterm of het statusfilter aan om bewijs terug te vinden."
      />
    );
  };

  // Laag 3 — Action-modal handler
  const confirmAction = async () => {
    if (!actionTarget) return;
    setNoteDrafts((current) => ({
      ...current,
      [actionTarget.record.id]: actionNote,
    }));
    const target = actionTarget;
    setActionTarget(null);
    await persistReview(target.record, target.kind);
  };

  const actionMeta: Record<ActionKind, { title: string; cta: string; tone: 'primary' | 'neutral' }> = {
    APPROVED:     { title: 'Bewijs goedkeuren',  cta: 'Bevestig goedkeuring', tone: 'primary' },
    NEEDS_REVIEW: { title: 'Review aanvragen',   cta: 'Stuur naar review',    tone: 'neutral' },
    REJECTED:     { title: 'Bewijs afkeuren',    cta: 'Bevestig afkeuring',   tone: 'neutral' },
  };

  // FlatList is de fundamentele, buitenste root-container.
  // Header + stats + toolbar gaan via ListHeaderComponent (rendert 1x, niet per kaart).
  // NOOIT in een ScrollView nesten — zou viewport-tracking breken en alle items in memory laden.
  return (
    <>
      <FlatList
        style={styles.container}
        data={filteredRecords}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderRecord}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderListEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        initialNumToRender={5}
        windowSize={5}
      />

      {/* Laag 3 — Actie-modal: gefocuste afhandeling, behoudt context */}
      {actionTarget ? (
        <View style={styles.actionBackdrop}>
          <View style={[styles.actionModal, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.actionModalHeader}>
              <Text style={[styles.actionModalTitle, { color: theme.colors.textPrimary }]}>
                {actionMeta[actionTarget.kind].title}
              </Text>
              <TouchableOpacity
                onPress={() => setActionTarget(null)}
                style={styles.actionModalClose}
                disabled={isSavingId === actionTarget.record.id}
              >
                <Text style={[styles.actionModalCloseText, { color: theme.colors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.actionModalSubtitle, { color: theme.colors.textSecondary }]}>
              {actionTarget.record.inspection_point_id ?? 'Bewijs'} · {actionTarget.record.project_id ?? 'project'}
            </Text>
            <Text style={styles.actionModalLabel}>NOTITIE (zichtbaar in dossier)</Text>
            <TextInput
              style={styles.actionModalInput}
              multiline
              value={actionNote}
              onChangeText={setActionNote}
              placeholder={
                actionTarget.kind === 'REJECTED'
                  ? "Waarom keur je dit af? Bijv. 'Foto onscherp, EXIF mist tijdstempel'."
                  : actionTarget.kind === 'NEEDS_REVIEW'
                    ? 'Welke aanvullende controle is nodig?'
                    : 'Optionele toelichting bij goedkeuring.'
              }
              placeholderTextColor={theme.colors.textSecondary}
            />
            <View style={styles.actionModalActions}>
              <SecondaryButton
                title="Annuleer"
                onPress={() => setActionTarget(null)}
                disabled={isSavingId === actionTarget.record.id}
              />
              <PrimaryButton
                label={actionMeta[actionTarget.kind].cta}
                size="md"
                style={{ flex: 1 }}
                onPress={() => void confirmAction()}
                loading={isSavingId === actionTarget.record.id}
                disabled={isSavingId === actionTarget.record.id}
              />
            </View>
          </View>
        </View>
      ) : null}
    </>
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
    // v2 — premium compacte layout
    listHeader: {
      paddingBottom: 4,
    },
    statInline: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: 'rgba(120,90,70,0.04)',
      marginBottom: 12,
    },
    statInlineText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      letterSpacing: 0.2,
    },
    statInlineNum: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    toolbarRow: {
      flexDirection: isWide ? 'row' : 'column',
      gap: 10,
      alignItems: isWide ? 'center' : 'stretch',
      marginBottom: 12,
    },
    searchInputV2: {
      flex: isWide ? 1 : undefined,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(120,90,70,0.15)',
      backgroundColor: 'rgba(250,245,240,0.5)',
      color: theme.colors.textPrimary,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 13,
    },
    filterRowInline: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    filterChipV2: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(120,90,70,0.15)',
      backgroundColor: 'transparent',
    },
    filterChipV2Active: {
      borderColor: theme.colors.textPrimary,
      backgroundColor: theme.colors.textPrimary,
    },
    filterChipV2Text: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      letterSpacing: 0.2,
    },
    filterChipV2TextActive: {
      color: theme.colors.background,
    },
    evidenceCardCompact: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(120,90,70,0.12)',
      backgroundColor: theme.colors.surface,
      marginBottom: 8,
      overflow: 'hidden',
    },
    evidenceRowCompact: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 14,
      // 5-Card Rule: gefixeerde hoogte 110px zodat er exact 5 cards in een
      // 800-900px viewport passen (na aftrek van ListHeader ≤20%).
      height: 110,
    },
    evidenceThumb: {
      width: 60,
      height: 60,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceAlt,
    },
    evidenceThumbEmpty: {
      borderWidth: 1,
      borderColor: 'rgba(120,90,70,0.12)',
    },
    evidenceInfo: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    evidenceId: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      letterSpacing: -0.2,
    },
    evidenceMeta: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    detailBtn: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: 'rgba(120,90,70,0.08)',
    },
    detailBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    evidenceExpand: {
      borderTopWidth: 1,
      borderTopColor: 'rgba(120,90,70,0.08)',
      padding: 16,
      gap: 12,
      backgroundColor: 'rgba(250,245,240,0.35)',
    },
    detailGridCompact: {
      gap: 4,
    },
    detailTextMuted: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      lineHeight: 16,
    },
    auditRowCompact: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    actionRowCompact: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    devInfoBox: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(43,43,43,0.12)',
      backgroundColor: 'rgba(43,43,43,0.04)',
      padding: 10,
      gap: 3,
    },
    devInfoLabel: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 2,
      color: theme.colors.textSecondary,
      marginBottom: 2,
      textTransform: 'uppercase' as const,
    },
    // Laag 3 — actie-modal
    actionBackdrop: {
      position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(43,43,43,0.4)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      zIndex: 80,
    },
    actionModal: {
      width: '100%',
      maxWidth: 460,
      borderRadius: 18,
      padding: 24,
      gap: 10,
      shadowColor: '#2B2B2B',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.18,
      shadowRadius: 28,
      elevation: 10,
    },
    actionModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    actionModalTitle: {
      fontSize: 20,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    actionModalClose: {
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: 'rgba(43,43,43,0.08)',
      alignItems: 'center', justifyContent: 'center',
    },
    actionModalCloseText: { fontSize: 13 },
    actionModalSubtitle: {
      fontSize: 12,
      marginBottom: 6,
    },
    actionModalLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 2,
      color: theme.colors.textSecondary,
      marginTop: 4,
      marginBottom: 4,
    },
    actionModalInput: {
      minHeight: 96,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(120,90,70,0.18)',
      backgroundColor: 'rgba(244,236,221,0.4)',
      color: theme.colors.textPrimary,
      padding: 12,
      textAlignVertical: 'top' as const,
      fontSize: 13,
      lineHeight: 18,
    },
    actionModalActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
    },
  });
