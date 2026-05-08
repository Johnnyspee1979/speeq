/**
 * OfflineSyncBanner — zichtbare status van offline opslag + automatische sync
 *
 * Toont drie staten:
 *   📵 Offline  — "Geen verbinding · X foto's bewaard"
 *   🔄 Syncing  — "Verbinding terug · uploaden X foto's…"
 *   ✅ Synced   — "X foto's gesynchroniseerd" (verdwijnt na 4s)
 *
 * Rendert niets als online én geen pending items.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Text, View } from 'react-native';
import { useNetworkSync } from '../hooks/useNetworkSync';

interface Props {
  theme: { colors: Record<string, string> };
}

export default function OfflineSyncBanner({ theme }: Props) {
  if (Platform.OS !== 'web') return null;

  return <OfflineSyncBannerInner theme={theme} />;
}

function OfflineSyncBannerInner({ theme }: Props) {
  const { isOnline, isSyncing, pendingCount, lastSyncedCount, lastSyncAt } =
    useNetworkSync();

  const [showSynced, setShowSynced] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const prevSyncAt = useRef<Date | null>(null);

  // Toon "gesynchroniseerd" melding na een succesvolle sync
  useEffect(() => {
    if (lastSyncAt && lastSyncAt !== prevSyncAt.current && lastSyncedCount > 0) {
      prevSyncAt.current = lastSyncAt;
      setShowSynced(true);
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: false }),
        Animated.delay(3500),
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: false }),
      ]).start(() => setShowSynced(false));
    }
  }, [lastSyncAt, lastSyncedCount, opacity]);

  // Animeer in/uit voor offline banner
  const bannerVisible = !isOnline || isSyncing || pendingCount > 0;
  useEffect(() => {
    if (showSynced) return; // laat "synced" animatie uitspelen
    Animated.timing(opacity, {
      toValue: bannerVisible ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [bannerVisible, showSynced, opacity]);

  if (!bannerVisible && !showSynced) return null;

  // ── "Gesynchroniseerd" melding ─────────────────────────────────────────────
  if (showSynced) {
    return (
      // @ts-ignore web only
      <Animated.View style={[banner, {
        backgroundColor: 'rgba(5,150,105,0.1)',
        borderColor: 'rgba(5,150,105,0.3)',
        opacity,
      }]}>
        <Text style={dot}>✅</Text>
        <Text style={[msg, { color: '#059669' }]}>
          {lastSyncedCount} foto{lastSyncedCount !== 1 ? "'s" : ''} gesynchroniseerd
        </Text>
      </Animated.View>
    );
  }

  // ── Uploading ──────────────────────────────────────────────────────────────
  if (isOnline && isSyncing) {
    return (
      // @ts-ignore web only
      <Animated.View style={[banner, {
        backgroundColor: `${theme.colors.accent}14`,
        borderColor: `${theme.colors.accent}35`,
        opacity,
      }]}>
        <Text style={dot}>🔄</Text>
        <Text style={[msg, { color: theme.colors.accent }]}>
          Verbinding terug — {pendingCount} foto{pendingCount !== 1 ? "'s" : ''} uploaden…
        </Text>
      </Animated.View>
    );
  }

  // ── Online maar wachtrij niet leeg (bijv. upload mislukt) ─────────────────
  if (isOnline && pendingCount > 0) {
    return (
      // @ts-ignore web only
      <Animated.View style={[banner, {
        backgroundColor: 'rgba(217,119,6,0.1)',
        borderColor: 'rgba(217,119,6,0.3)',
        opacity,
      }]}>
        <Text style={dot}>⏳</Text>
        <Text style={[msg, { color: '#d97706' }]}>
          {pendingCount} foto{pendingCount !== 1 ? "'s" : ''} wachten op upload…
        </Text>
      </Animated.View>
    );
  }

  // ── Offline ────────────────────────────────────────────────────────────────
  return (
    // @ts-ignore web only
    <Animated.View style={[banner, {
      backgroundColor: 'rgba(239,68,68,0.08)',
      borderColor: 'rgba(239,68,68,0.25)',
      opacity,
    }]}>
      <Text style={dot}>📵</Text>
      <Text style={[msg, { color: '#ef4444' }]}>
        Geen verbinding
        {pendingCount > 0
          ? ` · ${pendingCount} foto${pendingCount !== 1 ? "'s" : ''} bewaard — worden automatisch geüpload`
          : ' · Foto\'s worden bewaard tot het netwerk terugkomt'}
      </Text>
    </Animated.View>
  );
}

const banner = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 10,
  borderRadius: 10,
  borderWidth: 1,
  paddingHorizontal: 14,
  paddingVertical: 10,
  marginHorizontal: 16,
  marginBottom: 8,
};
const dot = { fontSize: 16 };
const msg = { flex: 1, fontSize: 12, fontWeight: '700' as const, lineHeight: 17 };
