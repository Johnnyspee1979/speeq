/**
 * OfflineStorageMeter — toont KEYUSER hoeveel lokale storage de offline-
 * mode gebruikt + biedt handmatige cleanup-knop.
 *
 * Toont alleen wanneer offline_mode = true (anders hide-self).
 *
 * Render-states:
 *   - Loading: skeleton-line
 *   - Idle: "X foto's · ~Y MB" + "Cache opruimen"-knop
 *   - Cleaning: spinner + "Bezig met opruimen…"
 *   - Done: "Z foto's verwijderd · Y MB vrijgemaakt"
 *
 * Volgt Warm Minimal tokens — terracotta voor "ruim op", forest voor klaar.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useOfflineMode } from '../../hooks/useOfflineMode';
import {
  runOfflineStorageCleanup,
  getApproximateLocalStorageBytes,
  type CleanupResult,
} from '../../services/OfflineStorageCleanup';
import { getOfflineStorage } from '../../database/offlineDb';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const mb = bytes / 1_000_000;
  if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
  if (mb < 1000) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1000).toFixed(2)} GB`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const OfflineStorageMeter: React.FC = () => {
  const { theme } = useTheme();
  const offline = useOfflineMode();
  const [photoCount, setPhotoCount] = useState<number | null>(null);
  const [bytes, setBytes] = useState<number | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [lastResult, setLastResult] = useState<CleanupResult | null>(null);

  const refresh = useCallback(async () => {
    try {
      const store = await getOfflineStorage();
      const rows = await store.listEvidence();
      setPhotoCount(rows.length);
      setBytes(await getApproximateLocalStorageBytes());
    } catch (err) {
      console.warn('[OfflineStorageMeter] refresh faalt:', err);
      setPhotoCount(0);
      setBytes(0);
    }
  }, []);

  useEffect(() => {
    if (!offline) return;
    void refresh();
  }, [offline, refresh]);

  const handleCleanup = useCallback(async () => {
    setCleaning(true);
    try {
      const result = await runOfflineStorageCleanup();
      setLastResult(result);
      await refresh();
    } catch (err) {
      console.warn('[OfflineStorageMeter] cleanup faalt:', err);
    } finally {
      setCleaning(false);
    }
  }, [refresh]);

  if (!offline) return null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.borderWarm,
        },
      ]}
    >
      <View style={styles.headerRow}>
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
          Lokale opslag
        </Text>
        <View style={[styles.iconBox, { backgroundColor: theme.colors.statusSuccess }]}>
          <Text style={[styles.iconText, { color: theme.colors.background }]}>💾</Text>
        </View>
      </View>

      {photoCount === null ? (
        <ActivityIndicator color={theme.colors.textPrimary} />
      ) : (
        <>
          <Text style={[styles.line, { color: theme.colors.textSecondary }]}>
            <Text style={[styles.bold, { color: theme.colors.textPrimary }]}>
              {photoCount}
            </Text>{' '}
            foto{photoCount === 1 ? '' : "'s"} · ongeveer{' '}
            <Text style={[styles.bold, { color: theme.colors.textPrimary }]}>
              {formatBytes(bytes ?? 0)}
            </Text>
          </Text>

          <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
            Foto's ouder dan 30 dagen worden automatisch opgeruimd. Boven
            1.000 foto's verwijderen we eerst de oudste. Het cloud-dossier
            blijft altijd compleet.
          </Text>

          {lastResult && (
            <View
              style={[
                styles.resultBox,
                {
                  backgroundColor: theme.colors.surfaceAlt,
                  borderColor: theme.colors.borderWarm,
                },
              ]}
            >
              <Text style={[styles.resultLabel, { color: theme.colors.textMuted }]}>
                LAATSTE OPRUIMING
              </Text>
              <Text style={[styles.resultText, { color: theme.colors.textPrimary }]}>
                {lastResult.removed === 0
                  ? 'Niets te doen — alles binnen de retentie-periode.'
                  : `${lastResult.removed} foto${
                      lastResult.removed === 1 ? '' : "'s"
                    } opgeruimd, ${lastResult.retained} behouden.`}
                {lastResult.hardCapTriggered ? ' (hard-cap geraakt)' : ''}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.cleanupBtn,
              {
                backgroundColor: theme.colors.statusWarning,
                opacity: cleaning ? 0.6 : 1,
              },
            ]}
            disabled={cleaning}
            onPress={() => void handleCleanup()}
            activeOpacity={0.85}
          >
            {cleaning ? (
              <ActivityIndicator color={theme.colors.textPrimary} />
            ) : (
              <Text style={[styles.cleanupBtnText, { color: theme.colors.textPrimary }]}>
                Cache opruimen
              </Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginTop: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 22,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 16,
  },
  line: {
    fontSize: 15,
    lineHeight: 22,
  },
  bold: {
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
  },
  resultBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  resultLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  resultText: {
    fontSize: 13,
    lineHeight: 18,
  },
  cleanupBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cleanupBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
