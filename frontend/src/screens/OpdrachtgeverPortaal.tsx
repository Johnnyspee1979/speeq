/**
 * OpdrachtgeverPortaal — schoon, read-only overzicht voor de bouwheer.
 *
 * Toont:
 *  - Project header (naam, adres, aannemer)
 *  - Samenvatting: totaal / goedgekeurd / in review / afgekeurd
 *  - Voortgangsbalk per borgingspunt-categorie
 *  - Recente bewijsfoto's (thumbnails)
 *  - Knop: borgingsdossier downloaden als PDF
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme/ThemeProvider';
import { useProject } from '../context/ProjectContext';
import { exportDossierAsPdf } from '../services/BorgingsDossierService';
import { useTenantBranding } from '../hooks/useTenantBranding';
import type { StoredWkbEvidence } from '../types/Evidence';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectInfo {
  name: string;
  address?: string | null;
  initiatorName?: string | null;
}

type AiStatus = 'PASSED' | 'NEEDS_REVIEW' | 'FAILED' | 'PENDING';

interface CategoryStat {
  categoryId: string;
  label: string;
  total: number;
  approved: number;
  needsReview: number;
  rejected: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  BOUW:            '🏗️ Bouw & Ruwbouw',
  BOUWFYSICA:      '🌡️ Bouwfysica',
  BRANDVEILIGHEID: '🔥 Brandveiligheid',
  INSTALLATIE:     '🔧 Installatie',
  ELEKTRA:         '⚡ Elektra',
  AFBOUW_SCHILDER: '🖌️ Afbouw & Schilder',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface OpdrachtgeverPortaalProps {
  /** Optioneel: overschrijf het actieve project */
  projectId?: string;
}

export default function OpdrachtgeverPortaal({ projectId: propProjectId }: OpdrachtgeverPortaalProps = {}) {
  const { theme } = useTheme();
  const tenantBranding = useTenantBranding();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { activeProject } = useProject();

  const projectId = propProjectId ?? activeProject.id;
  const projectName = activeProject.name;

  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [evidence, setEvidence] = useState<StoredWkbEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  // ── Data laden ───────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: proj }, { data: ev }] = await Promise.all([
        supabase
          .from('projects')
          .select('name, address, initiator_name')
          .eq('id', projectId)
          .maybeSingle(),
        supabase
          .from('evidence')
          .select(
            'id, inspection_point_id, ai_status, ai_confidence, sync_status, created_at, photo_uri, media_uri, discipline_id, timestamp'
          )
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
      ]);

      if (proj) {
        setProjectInfo({
          name: (proj.name as string | null) ?? projectName,
          address: proj.address as string | null,
          initiatorName: proj.initiator_name as string | null,
        });
      }

      if (ev) {
        setEvidence(
          ev.map((r) => ({
            id: String(r.id),
            projectId,
            inspectionPointId: (r.inspection_point_id as string) ?? '',
            mediaUri: (r.media_uri as string) ?? (r.photo_uri as string) ?? '',
            timestamp: (r.timestamp as string) ?? new Date().toISOString(),
            latitude: 0,
            longitude: 0,
            gpsAccuracy: null,
            exifHash: '',
            exifVerified: false,
            syncStatus: ((r.sync_status as string) ?? 'PENDING') as 'PENDING' | 'SYNCED' | 'FAILED',
            aiStatus: (r.ai_status as AiStatus) ?? 'PENDING',
            aiConfidence: (r.ai_confidence as number | null) ?? null,
            disciplineId: (r.discipline_id as string) ?? undefined,
          })) as StoredWkbEvidence[]
        );
      }
    } catch {
      // stil falen
    } finally {
      setLoading(false);
    }
  }, [projectId, projectName]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ── Statistieken ─────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = evidence.length;
    const approved = evidence.filter((e) => e.aiStatus === 'PASSED').length;
    const needsReview = evidence.filter((e) => e.aiStatus === 'NEEDS_REVIEW').length;
    const rejected = evidence.filter((e) => e.aiStatus === 'FAILED').length;
    const pending = evidence.filter((e) => e.aiStatus === 'PENDING').length;
    const pct = total > 0 ? Math.round((approved / total) * 100) : 0;
    return { total, approved, needsReview, rejected, pending, pct };
  }, [evidence]);

  const categoryStats = useMemo((): CategoryStat[] => {
    const map = new Map<string, CategoryStat>();

    for (const e of evidence) {
      const catId = (e as StoredWkbEvidence & { disciplineId?: string }).disciplineId ?? 'OVERIG';
      if (!map.has(catId)) {
        map.set(catId, {
          categoryId: catId,
          label: CATEGORY_LABELS[catId] ?? catId,
          total: 0,
          approved: 0,
          needsReview: 0,
          rejected: 0,
        });
      }
      const stat = map.get(catId)!;
      stat.total += 1;
      if (e.aiStatus === 'PASSED') stat.approved += 1;
      else if (e.aiStatus === 'NEEDS_REVIEW') stat.needsReview += 1;
      else if (e.aiStatus === 'FAILED') stat.rejected += 1;
    }

    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [evidence]);

  // ── PDF export ────────────────────────────────────────────────────────────

  const handleDownloadPdf = useCallback(async () => {
    if (isPdfLoading) return;
    setIsPdfLoading(true);
    try {
      await exportDossierAsPdf(evidence, projectId, projectName, {
        aannemer: projectInfo?.initiatorName ?? undefined,
        adres: projectInfo?.address ?? undefined,
      });
    } finally {
      setIsPdfLoading(false);
    }
  }, [evidence, projectId, projectName, projectInfo, isPdfLoading]);

  // ── Status helpers ────────────────────────────────────────────────────────

  const statusColor = (status: AiStatus | string) => {
    if (status === 'PASSED') return '#059669';
    if (status === 'NEEDS_REVIEW') return '#D97706';
    if (status === 'FAILED') return '#DC2626';
    return theme.colors.border;
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={styles.loadingText}>Project laden…</Text>
      </View>
    );
  }

  const recentEvidence = evidence.slice(0, 12);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Project header ── */}
      <View style={[styles.projectCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={styles.eyebrow}>BORGINGSDOSSIER</Text>
        <Text style={styles.projectTitle} numberOfLines={2}>
          {projectInfo?.name ?? projectName}
        </Text>
        {projectInfo?.address ? (
          <Text style={styles.projectMeta}>📍 {projectInfo.address}</Text>
        ) : null}
        {projectInfo?.initiatorName ? (
          <Text style={styles.projectMeta}>🏢 {projectInfo.initiatorName}</Text>
        ) : null}

        {/* PDF knop */}
        <TouchableOpacity
          style={[styles.pdfBtn, isPdfLoading && { opacity: 0.6 }]}
          onPress={() => void handleDownloadPdf()}
          disabled={isPdfLoading}
          activeOpacity={0.85}
        >
          {isPdfLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.pdfBtnText}>⬇️ Download borgingsdossier PDF</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Samenvatting stats ── */}
      <View style={styles.statsRow}>
        <StatCard label="Totaal" value={stats.total} color={theme.colors.textSecondary} theme={theme} />
        <StatCard label="Akkoord" value={stats.approved} color="#059669" theme={theme} />
        <StatCard label="In review" value={stats.needsReview} color="#D97706" theme={theme} />
        <StatCard label="Afgekeurd" value={stats.rejected} color="#DC2626" theme={theme} />
      </View>

      {/* ── Voortgangsbalk ── */}
      <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={styles.sectionTitle}>TOTALE VOORTGANG</Text>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${stats.pct}%` as any }]} />
        </View>
        <Text style={styles.progressLabel}>{stats.pct}% goedgekeurd</Text>
      </View>

      {/* ── Per categorie ── */}
      {categoryStats.length > 0 ? (
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={styles.sectionTitle}>PER DISCIPLINE</Text>
          {categoryStats.map((cat) => {
            const pct = cat.total > 0 ? Math.round((cat.approved / cat.total) * 100) : 0;
            return (
              <View key={cat.categoryId} style={styles.catRow}>
                <View style={styles.catLeft}>
                  <Text style={[styles.catLabel, { color: theme.colors.textPrimary }]}>
                    {cat.label}
                  </Text>
                  <Text style={[styles.catSub, { color: theme.colors.textSecondary }]}>
                    {cat.approved}/{cat.total} goedgekeurd
                    {cat.needsReview > 0 ? ` · ${cat.needsReview} in review` : ''}
                    {cat.rejected > 0 ? ` · ${cat.rejected} afgekeurd` : ''}
                  </Text>
                </View>
                <View style={styles.catBarWrap}>
                  <View style={styles.catBarBg}>
                    <View
                      style={[
                        styles.catBarFill,
                        {
                          width: `${pct}%` as any,
                          backgroundColor: pct === 100 ? '#059669' : theme.colors.accent,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.catPct, { color: theme.colors.textSecondary }]}>
                    {pct}%
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {/* ── Recente bewijsfoto's ── */}
      {recentEvidence.length > 0 ? (
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={styles.sectionTitle}>RECENTE BORGINGSPUNTEN</Text>
          <View style={styles.evidenceGrid}>
            {recentEvidence.map((e) => (
              <View
                key={e.id}
                style={[
                  styles.evidenceCell,
                  { borderColor: statusColor(e.aiStatus ?? 'PENDING') },
                ]}
              >
                <View
                  style={[
                    styles.evidenceDot,
                    { backgroundColor: statusColor(e.aiStatus ?? 'PENDING') },
                  ]}
                />
                <Text
                  style={[styles.evidencePid, { color: theme.colors.textPrimary }]}
                  numberOfLines={2}
                >
                  {e.inspectionPointId}
                </Text>
                <Text style={[styles.evidenceDate, { color: theme.colors.textSecondary }]}>
                  {new Date(e.timestamp).toLocaleDateString('nl-NL', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>
            Nog geen bewijsstukken
          </Text>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            Zodra vakmensen foto's vastleggen verschijnen ze hier.
          </Text>
        </View>
      )}

      {/* ── Footer ── */}
      <Text style={[styles.footer, { color: theme.colors.textSecondary }]}>
        Gegenereerd op {new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
        {tenantBranding.companyName ? ` · ${tenantBranding.companyName}` : ''}
      </Text>
    </ScrollView>
  );
}

// ─── StatCard sub-component ───────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  theme,
}: {
  label: string;
  value: number;
  color: string;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <View
      style={[
        statCardStyles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <Text style={[statCardStyles.value, { color }]}>{value}</Text>
      <Text style={[statCardStyles.label, { color: theme.colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

const statCardStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  value: { fontSize: 26, fontWeight: '900', letterSpacing: -1 },
  label: { fontSize: 11, fontWeight: '700', marginTop: 2 },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    content: {
      padding: 20,
      paddingBottom: 60,
      gap: 14,
      maxWidth: 900,
      alignSelf: 'center',
      width: '100%',
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    loadingText: { fontSize: 14, color: theme.colors.textSecondary },

    // Project card
    projectCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 20,
      gap: 6,
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 3,
      color: theme.colors.accent,
    },
    projectTitle: {
      fontSize: 34,
      fontFamily: 'Georgia, "Playfair Display", serif',
      fontStyle: 'italic',
      fontWeight: '500',
      color: theme.colors.textPrimary,
      letterSpacing: -0.8,
      marginTop: 4,
      marginBottom: 4,
    },
    projectMeta: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    pdfBtn: {
      marginTop: 10,
      backgroundColor: theme.colors.accent,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    pdfBtnText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '800',
    },

    // Stats
    statsRow: {
      flexDirection: 'row',
      gap: 10,
    },

    // Sections
    section: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 16,
      gap: 10,
    },
    sectionTitle: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 3,
      color: theme.colors.textSecondary,
      marginBottom: 4,
    },

    // Progress bar
    progressBarBg: {
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.colors.border,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 5,
      backgroundColor: '#059669',
    },
    progressLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: '#059669',
    },

    // Category rows
    catRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    catLeft: { flex: 1 },
    catLabel: { fontSize: 13, fontWeight: '700' },
    catSub: { fontSize: 11, marginTop: 2 },
    catBarWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, width: 140 },
    catBarBg: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.border,
      overflow: 'hidden',
    },
    catBarFill: { height: '100%', borderRadius: 3 },
    catPct: { fontSize: 11, fontWeight: '700', width: 32, textAlign: 'right' },

    // Evidence grid
    evidenceGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    evidenceCell: {
      width: 100,
      borderRadius: 10,
      borderWidth: 1.5,
      padding: 8,
      gap: 4,
    },
    evidenceDot: { width: 8, height: 8, borderRadius: 4 },
    evidencePid: { fontSize: 11, fontWeight: '700', lineHeight: 14 },
    evidenceDate: { fontSize: 10 },

    // Empty state
    emptyState: {
      alignItems: 'center',
      paddingVertical: 40,
      gap: 8,
    },
    emptyIcon: { fontSize: 36 },
    emptyTitle: { fontSize: 16, fontWeight: '800' },
    emptyText: { fontSize: 13, textAlign: 'center', maxWidth: 280 },

    // Footer
    footer: { fontSize: 11, textAlign: 'center', paddingTop: 8 },
  });
