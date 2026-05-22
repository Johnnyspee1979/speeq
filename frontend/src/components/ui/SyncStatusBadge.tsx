/**
 * SyncStatusBadge — toont de actuele offline-sync-status.
 *
 * - Idle (gesynced): groen "Alles gesynchroniseerd · X min geleden"
 * - Syncing: subtiele animatie "Synchroniseren (3/8)"
 * - Error / pending: terracotta "3 wachten op netwerk · opnieuw proberen om HH:MM"
 *
 * Volgt Warm Minimal design-tokens — geen techno-blauw, geen neon.
 * Klikbaar voor handmatige "Nu synchroniseren" actie.
 *
 * Hide-self bij cloud-mode (offline_mode = false) — alleen relevant in
 * offline-mode actief.
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useOfflineMode } from '../../hooks/useOfflineMode';
import { useOfflineSyncState } from '../../hooks/useOfflineSyncState';
import { syncOfflineQueueNow } from '../../services/OfflineSyncEngine';

function formatTimeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return 'zojuist';
  if (min < 60) return `${min} min geleden`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} uur geleden`;
  return `${Math.round(hr / 24)} dag geleden`;
}

function formatHHMM(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export const SyncStatusBadge: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { theme } = useTheme();
  const offlineMode = useOfflineMode();
  const sync = useOfflineSyncState();

  // Niet tonen in cloud-mode — geen offline-queue om over te rapporteren
  if (!offlineMode) return null;

  const palette = useMemo(() => {
    if (sync.status === 'syncing') {
      return { bg: theme.colors.surfaceAlt, fg: theme.colors.textPrimary, accent: theme.colors.statusSuccess };
    }
    if (sync.status === 'error') {
      return { bg: theme.colors.surfaceAlt, fg: theme.colors.textPrimary, accent: theme.colors.statusWarning };
    }
    return { bg: theme.colors.surfaceAlt, fg: theme.colors.textSecondary, accent: theme.colors.statusSuccess };
  }, [sync.status, theme]);

  const handlePress = (): void => {
    void syncOfflineQueueNow();
  };

  const label = (() => {
    if (sync.status === 'syncing') {
      return `Synchroniseren (${sync.processed}/${sync.total})`;
    }
    if (sync.status === 'error') {
      return `${sync.pendingCount} wacht op netwerk · retry ${formatHHMM(sync.willRetryAt)}`;
    }
    return `Gesynchroniseerd · ${formatTimeAgo(sync.lastSyncAt)}`;
  })();

  if (compact) {
    return (
      <TouchableOpacity
        accessibilityLabel="Synchronisatie-status"
        onPress={handlePress}
        style={[
          styles.compactPill,
          { backgroundColor: palette.bg, borderColor: theme.colors.borderWarm },
        ]}
        activeOpacity={0.75}
      >
        <View style={[styles.dot, { backgroundColor: palette.accent }]} />
        {sync.status === 'syncing' ? (
          <ActivityIndicator size="small" color={palette.accent} style={{ marginLeft: 6 }} />
        ) : null}
        <Text style={[styles.compactText, { color: palette.fg }]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      accessibilityLabel="Synchronisatie-status"
      onPress={handlePress}
      style={[
        styles.fullCard,
        { backgroundColor: palette.bg, borderColor: theme.colors.borderWarm },
      ]}
      activeOpacity={0.75}
    >
      <View style={[styles.iconBox, { backgroundColor: palette.accent }]}>
        {sync.status === 'syncing' ? (
          <ActivityIndicator size="small" color={theme.colors.background} />
        ) : (
          <Text style={[styles.iconText, { color: theme.colors.background }]}>
            {sync.status === 'error' ? '⚠' : '✓'}
          </Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, { color: palette.fg }]}>{label}</Text>
        <Text style={[styles.subtle, { color: theme.colors.textMuted }]}>
          Tik om handmatig te synchroniseren
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  compactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  compactText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
  fullCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 18,
    fontWeight: '700',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  subtle: {
    fontSize: 11,
    marginTop: 2,
  },
});
