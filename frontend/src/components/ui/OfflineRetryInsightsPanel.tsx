/**
 * OfflineRetryInsightsPanel — debug-paneel op OfflineRetryInsights (#52).
 *
 * Modal voor de werkvoorbereider met:
 *  - Samenvattings-balk: totaal pending, awaiting, exhausted, oudste
 *  - Gefaalde operations lijst (top-20, meest-recent eerst)
 *  - Error-clusters (zelfde error gegroepeerd, count desc)
 *
 * Read-only — voor mutatie zie OfflineConflictResolutionModal.
 * Bedoeld voor diagnose: "waarom syncten 8 foto's niet?" "Tokens vervallen?
 * Storage vol? RLS-violation?"
 *
 * Warm Minimal tokens.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { designTokens } from '../../theme/designTokens';
import {
  getRetrySummary,
  listFailedOperations,
  groupErrorsByMessage,
  type RetrySummary,
  type FailedOperationDetail,
} from '../../services/OfflineRetryInsights';

const theme = designTokens;
const REFRESH_INTERVAL_MS = 8_000;

export interface OfflineRetryInsightsPanelProps {
  visible: boolean;
  onClose: () => void;
}

export const OfflineRetryInsightsPanel: React.FC<
  OfflineRetryInsightsPanelProps
> = ({ visible, onClose }) => {
  const [summary, setSummary] = useState<RetrySummary | null>(null);
  const [failed, setFailed] = useState<FailedOperationDetail[]>([]);
  const [groups, setGroups] = useState<
    Array<{ message: string; count: number; sampleUuid: string }>
  >([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, f, g] = await Promise.all([
        getRetrySummary(),
        listFailedOperations(),
        groupErrorsByMessage(),
      ]);
      setSummary(s);
      setFailed(f.slice(0, 20));
      setGroups(g.slice(0, 10));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    void refresh();
    const id = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [visible, refresh]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Sync-diagnose</Text>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityLabel="Sluiten"
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          {loading && !summary ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.colors.statusWarning} />
            </View>
          ) : (
            <ScrollView style={styles.scroll} contentContainerStyle={{ gap: 16 }}>
              {summary ? <SummaryStrip summary={summary} /> : null}

              <Section title="Fout-patronen">
                {groups.length === 0 ? (
                  <Text style={styles.muted}>Geen recente fouten.</Text>
                ) : (
                  groups.map((g) => (
                    <View key={g.message} style={styles.groupRow}>
                      <Text style={styles.groupCount}>{g.count}×</Text>
                      <Text style={styles.groupMsg} numberOfLines={3}>
                        {g.message}
                      </Text>
                    </View>
                  ))
                )}
              </Section>

              <Section title="Gefaalde operations">
                {failed.length === 0 ? (
                  <Text style={styles.muted}>Niets in de queue.</Text>
                ) : (
                  failed.map((op) => (
                    <View key={op.id} style={styles.opRow}>
                      <View style={styles.opHeader}>
                        <Text style={styles.opType}>{op.operation}</Text>
                        <Text style={styles.opAttempts}>
                          {op.attempts}×{' '}
                          {op.exhausted ? '(opgegeven)' : 'gefaald'}
                        </Text>
                      </View>
                      <Text style={styles.opUuid} numberOfLines={1}>
                        {op.evidenceUuid}
                      </Text>
                      {op.lastError ? (
                        <Text style={styles.opError} numberOfLines={2}>
                          {op.lastError}
                        </Text>
                      ) : null}
                    </View>
                  ))
                )}
              </Section>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

// ─── SummaryStrip ────────────────────────────────────────────────────────────

const SummaryStrip: React.FC<{ summary: RetrySummary }> = ({ summary }) => {
  const oldest = summary.oldestPendingIso
    ? new Date(summary.oldestPendingIso).toLocaleDateString('nl-NL')
    : '—';
  return (
    <View style={styles.summaryRow}>
      <Stat label="Pending" value={String(summary.totalPending)} />
      <Stat label="Wachten" value={String(summary.awaitingRetry)} />
      <Stat
        label="Opgegeven"
        value={String(summary.exhausted)}
        accent={summary.exhausted > 0}
      />
      <Stat label="Oudste" value={oldest} />
    </View>
  );
};

const Stat: React.FC<{ label: string; value: string; accent?: boolean }> = ({
  label,
  value,
  accent,
}) => (
  <View style={styles.stat}>
    <Text
      style={[
        styles.statValue,
        accent ? { color: theme.colors.statusWarning } : null,
      ]}
    >
      {value}
    </Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={{ gap: 8 }}>{children}</View>
  </View>
);

// ─── Styles (Warm Minimal) ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(43, 43, 43, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    width: '100%',
    maxWidth: 640,
    maxHeight: '85%',
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.borderWarm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.borderWarmAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: { fontSize: 20, color: theme.colors.textPrimary, lineHeight: 22 },
  scroll: { maxHeight: '100%' },
  center: { paddingVertical: 36, alignItems: 'center' },
  muted: { color: theme.colors.textPrimary, opacity: 0.5, fontSize: 13 },

  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderWarm,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 20, fontWeight: '600', color: theme.colors.textPrimary },
  statLabel: { fontSize: 11, color: theme.colors.textPrimary, opacity: 0.6 },

  section: { gap: 8 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    opacity: 0.75,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  groupRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    alignItems: 'flex-start',
  },
  groupCount: {
    color: theme.colors.statusWarning,
    fontWeight: '700',
    minWidth: 32,
  },
  groupMsg: { flex: 1, color: theme.colors.textPrimary, fontSize: 13 },

  opRow: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    gap: 4,
  },
  opHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  opType: {
    fontWeight: '600',
    color: theme.colors.textPrimary,
    fontSize: 13,
    textTransform: 'uppercase',
  },
  opAttempts: {
    color: theme.colors.textPrimary,
    opacity: 0.6,
    fontSize: 12,
  },
  opUuid: {
    color: theme.colors.textPrimary,
    opacity: 0.5,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  opError: {
    color: theme.colors.statusWarning,
    fontSize: 12,
    marginTop: 2,
  },
});
