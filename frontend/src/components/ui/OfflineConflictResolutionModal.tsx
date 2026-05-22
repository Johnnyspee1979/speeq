/**
 * OfflineConflictResolutionModal — werkvoorbereider-UI voor het oplossen
 * van sync-conflicten die OfflineSyncEngine/OfflineCloudPuller hebben
 * geparkeerd op sync_status='error'.
 *
 * Toont elk conflict als een card met:
 *   - Mini-thumbnail (lokale foto-cache, fallback placeholder)
 *   - Veld-notitie + AI-status
 *   - Lokale versie nummer (transparant voor de werkvoorbereider)
 *   - Twee knoppen: "Mijn versie behouden" / "Cloud versie overnemen"
 *
 * Polling: refresh-conflict-lijst elke 10s zodat nieuwe conflicts
 * automatisch verschijnen.
 *
 * Warm Minimal design tokens — geen agressieve danger-rood, wel terracotta
 * accent voor de "Actie vereist"-toon.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { designTokens } from '../../theme/designTokens';

const theme = designTokens;
import {
  listConflicts,
  resolveConflict,
  type ConflictRow,
  type ConflictResolution,
} from '../../services/OfflineConflictResolver';

const REFRESH_INTERVAL_MS = 10_000;

export interface OfflineConflictResolutionModalProps {
  visible: boolean;
  onClose: () => void;
  /** Optioneel callback wanneer alle conflicts zijn opgelost */
  onAllResolved?: () => void;
}

export const OfflineConflictResolutionModal: React.FC<
  OfflineConflictResolutionModalProps
> = ({ visible, onClose, onAllResolved }) => {
  const [conflicts, setConflicts] = useState<ConflictRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolvingUuid, setResolvingUuid] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listConflicts();
      setConflicts(list);
      if (list.length === 0) onAllResolved?.();
    } finally {
      setLoading(false);
    }
  }, [onAllResolved]);

  useEffect(() => {
    if (!visible) return;
    void refresh();
    const id = setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [visible, refresh]);

  const handleResolve = useCallback(
    async (uuid: string, resolution: ConflictResolution) => {
      setResolvingUuid(uuid);
      try {
        await resolveConflict(uuid, resolution);
        await refresh();
      } finally {
        setResolvingUuid(null);
      }
    },
    [refresh],
  );

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
            <Text style={styles.title}>Synchronisatie-conflicten</Text>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityLabel="Sluiten"
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <Text style={styles.intro}>
            Deze foto's zijn op meerdere apparaten tegelijk aangepast. Kies per
            foto welke versie u wilt bewaren.
          </Text>

          {loading && conflicts.length === 0 ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.colors.statusWarning} />
            </View>
          ) : conflicts.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>Geen conflicten</Text>
              <Text style={styles.emptyBody}>
                Alle wijzigingen zijn netjes gesynchroniseerd.
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
              {conflicts.map((c) => (
                <ConflictCard
                  key={c.uuid}
                  conflict={c}
                  resolving={resolvingUuid === c.uuid}
                  onKeepLocal={() => handleResolve(c.uuid, 'keep-local')}
                  onAcceptCloud={() => handleResolve(c.uuid, 'accept-cloud')}
                />
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

// ─── ConflictCard ────────────────────────────────────────────────────────────

interface ConflictCardProps {
  conflict: ConflictRow;
  resolving: boolean;
  onKeepLocal: () => void;
  onAcceptCloud: () => void;
}

const ConflictCard: React.FC<ConflictCardProps> = ({
  conflict,
  resolving,
  onKeepLocal,
  onAcceptCloud,
}) => {
  return (
    <View style={styles.conflictCard}>
      <View style={styles.cardRow}>
        {conflict.photoUri ? (
          <Image source={{ uri: conflict.photoUri }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Text style={styles.thumbPlaceholderText}>Foto</Text>
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {conflict.aiStatus ?? 'Geen status'}
          </Text>
          {conflict.fieldNote ? (
            <Text style={styles.cardNote} numberOfLines={2}>
              {conflict.fieldNote}
            </Text>
          ) : null}
          <Text style={styles.cardMeta}>
            Versie {conflict.localVersion} ·{' '}
            {new Date(conflict.updatedAt).toLocaleDateString('nl-NL')}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onKeepLocal}
          disabled={resolving}
          style={({ pressed }) => [
            styles.btn,
            styles.btnPrimary,
            pressed && styles.btnPressed,
            resolving && styles.btnDisabled,
          ]}
        >
          <Text style={styles.btnPrimaryText}>Mijn versie behouden</Text>
        </Pressable>
        <Pressable
          onPress={onAcceptCloud}
          disabled={resolving}
          style={({ pressed }) => [
            styles.btn,
            styles.btnSecondary,
            pressed && styles.btnPressed,
            resolving && styles.btnDisabled,
          ]}
        >
          <Text style={styles.btnSecondaryText}>Cloud versie overnemen</Text>
        </Pressable>
      </View>
    </View>
  );
};

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
    maxWidth: 560,
    maxHeight: '85%',
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.borderWarm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  closeText: {
    fontSize: 20,
    color: theme.colors.textPrimary,
    lineHeight: 22,
  },
  intro: {
    color: theme.colors.textPrimary,
    opacity: 0.75,
    fontSize: 14,
    marginBottom: 16,
  },
  center: {
    paddingVertical: 36,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    color: theme.colors.statusSuccess,
    fontWeight: '600',
  },
  emptyBody: {
    color: theme.colors.textPrimary,
    opacity: 0.6,
  },
  list: {
    gap: 12,
    paddingBottom: 4,
  },
  conflictCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderWarm,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: theme.colors.borderWarmAlt,
  },
  thumbPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbPlaceholderText: {
    color: theme.colors.textPrimary,
    opacity: 0.4,
    fontSize: 12,
  },
  cardBody: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  cardNote: {
    fontSize: 13,
    color: theme.colors.textPrimary,
    opacity: 0.75,
  },
  cardMeta: {
    fontSize: 12,
    color: theme.colors.textPrimary,
    opacity: 0.5,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnPrimary: {
    backgroundColor: theme.colors.statusWarning,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.borderWarm,
  },
  btnSecondaryText: {
    color: theme.colors.textPrimary,
    fontWeight: '500',
    fontSize: 14,
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
