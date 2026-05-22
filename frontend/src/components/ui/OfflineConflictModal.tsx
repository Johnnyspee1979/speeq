/**
 * OfflineConflictModal — lijst van sync-conflicts die handmatige
 * actie van de werkvoorbereider vereisen.
 *
 * Een conflict ontstaat wanneer:
 *   - Local en remote allebei dezelfde evidence-record hebben gemuteerd
 *   - Remote client_version > local client_version
 *
 * Per conflict drie keuzes voor de gebruiker:
 *   1. "Behoud cloud-versie" — gooi onze lokale wijziging weg
 *   2. "Forceer lokale versie" — verhoog client_version + sync opnieuw
 *   3. "Negeer voor nu" — laat staan voor later
 *
 * Onderdeel van Week 4 deliverable (sync-UI + conflict-resolution).
 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { getOfflineStorage, type SyncQueueRow, type LocalEvidenceRow } from '../../database/offlineDb';
import { syncOfflineQueueNow } from '../../services/OfflineSyncEngine';
import { PrimaryButton } from './PrimaryButton';
import { SecondaryButton } from './SecondaryButton';

interface ConflictItem {
  queueOp: SyncQueueRow;
  localRow: LocalEvidenceRow;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const OfflineConflictModal: React.FC<Props> = ({ visible, onClose }) => {
  const { theme } = useTheme();
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const store = await getOfflineStorage();
      const queue = await store.listPendingSync();
      const failed = queue.filter((q) => q.attempts >= 1 && q.last_error?.startsWith('Conflict'));

      const enriched: ConflictItem[] = [];
      for (const op of failed) {
        const row = await store.getEvidence(op.evidence_uuid);
        if (row) enriched.push({ queueOp: op, localRow: row });
      }
      if (!cancelled) {
        setConflicts(enriched);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const handleKeepCloud = async (item: ConflictItem): Promise<void> => {
    const store = await getOfflineStorage();
    // Verwijder de queue-operation; remote blijft zoals 'ie is
    await store.removeSyncOperation(item.queueOp.id);
    await store.updateEvidence(item.localRow.uuid, { sync_status: 'synced' });
    setConflicts((prev) => prev.filter((c) => c.queueOp.id !== item.queueOp.id));
  };

  const handleForceLocal = async (item: ConflictItem): Promise<void> => {
    const store = await getOfflineStorage();
    // Verhoog client_version zodat onze update wint bij volgende push
    await store.updateEvidence(item.localRow.uuid, {
      client_version: item.localRow.client_version + 100, // sprongetje om remote te overtreffen
      sync_status: 'pending',
    });
    // Reset attempts zodat backoff niet meer in de weg zit
    await store.markSyncAttempt(item.queueOp.id, null);
    setConflicts((prev) => prev.filter((c) => c.queueOp.id !== item.queueOp.id));
    // Trigger meteen een sync
    void syncOfflineQueueNow();
  };

  const handleSkip = (item: ConflictItem): void => {
    setConflicts((prev) => prev.filter((c) => c.queueOp.id !== item.queueOp.id));
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: 'rgba(43,43,43,0.45)' }]}>
        <View
          style={[
            styles.dialog,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.borderWarm,
            },
          ]}
        >
          <View style={styles.header}>
            <Text
              style={[
                styles.title,
                {
                  color: theme.colors.textPrimary,
                  fontFamily: theme.typography.headline.fontFamily,
                  fontWeight: '700',
                  fontStyle: 'italic',
                },
              ]}
            >
              Sync-conflicten
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
              {conflicts.length === 0
                ? 'Geen openstaande conflicten.'
                : `${conflicts.length} item${conflicts.length === 1 ? '' : 's'} wachten op uw beslissing`}
            </Text>
          </View>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={theme.colors.textPrimary} />
            </View>
          ) : conflicts.length === 0 ? (
            <View style={styles.centerBox}>
              <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>
                ✓ Alles in orde.
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.list}>
              {conflicts.map((item) => (
                <View
                  key={item.queueOp.id}
                  style={[
                    styles.card,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.borderWarm,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.evidenceLabel,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    EVIDENCE · {item.localRow.uuid.slice(0, 8)}…
                  </Text>
                  <Text
                    style={[
                      styles.evidenceMeta,
                      { color: theme.colors.textPrimary },
                    ]}
                  >
                    {item.localRow.field_note ?? 'Geen notitie'}
                  </Text>
                  <Text
                    style={[
                      styles.versionInfo,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    Lokale versie {item.localRow.client_version} · Cloud is nieuwer
                  </Text>
                  <Text
                    style={[
                      styles.errorMsg,
                      { color: theme.colors.statusWarning },
                    ]}
                  >
                    {item.queueOp.last_error ?? 'Onbekende fout'}
                  </Text>

                  <View style={styles.actions}>
                    <SecondaryButton
                      title="Negeer"
                      onPress={() => handleSkip(item)}
                    />
                    <SecondaryButton
                      title="Behoud cloud"
                      onPress={() => void handleKeepCloud(item)}
                    />
                    <View style={{ flex: 1 }}>
                      <PrimaryButton
                        label="Forceer lokaal"
                        onPress={() => void handleForceLocal(item)}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.footer}>
            <SecondaryButton title="Sluiten" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '85%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 0,
    overflow: 'hidden',
  },
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
  },
  list: {
    padding: 12,
  },
  card: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  evidenceLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  evidenceMeta: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  versionInfo: {
    fontSize: 12,
    marginBottom: 4,
  },
  errorMsg: {
    fontSize: 12,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  centerBox: {
    padding: 40,
    alignItems: 'center',
  },
  empty: {
    fontSize: 15,
  },
  footer: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
