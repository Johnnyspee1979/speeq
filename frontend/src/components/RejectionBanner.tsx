/**
 * RejectionBanner — toont de vakman een blokkerende waarschuwing zodra zijn
 * foto wordt afgekeurd (AI_FAILED of WV NEEDS_REVIEW).
 *
 * Werkt zonder VakmanFeedbackService prop: het component luistert puur naar
 * het CustomEvent `wkb:rejection` dat door VakmanFeedbackService op `window`
 * wordt gedispatcht (zie App.tsx). Op native (geen window) blijft het component
 * inactief — daar gebruik je push-notificaties via NotificationService.
 *
 * UX: één sticky banner bovenaan; meerdere afkeuringen verzamelen in een queue
 * en de vakman tikt ze één voor één weg.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { RejectedEvidence } from '../services/VakmanFeedbackService';
import { useTheme } from '../theme/ThemeProvider';
import { useVoicePlayback } from '../hooks/useVoicePlayback';

const REASON_LABELS: Record<RejectedEvidence['reason'], string> = {
  AI_FAILED: 'AI heeft je foto afgekeurd',
  WV_REJECTED: 'Werkvoorbereider heeft je foto afgekeurd',
  NEEDS_REVIEW: 'Foto staat op handmatige review',
};

export default function RejectionBanner() {
  const { theme } = useTheme();
  const [queue, setQueue] = useState<RejectedEvidence[]>([]);
  const { playVoice } = useVoicePlayback();

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<RejectedEvidence>).detail;
      if (!detail) return;
      // Voorkom duplicaten (zelfde evidenceId binnen huidige queue)
      setQueue(prev => {
        if (prev.some(p => p.evidenceId === detail.evidenceId)) return prev;
        // Spreek alleen uit voor NIEUWE afkeuringen, niet voor duplicaten.
        // Voice is no-op als de gebruiker 'm uit heeft staan (zie #60).
        void playVoice(REASON_LABELS[detail.reason]);
        return [...prev, detail];
      });
    };

    window.addEventListener('wkb:rejection', handler as EventListener);
    return () => window.removeEventListener('wkb:rejection', handler as EventListener);
  }, [playVoice]);

  const dismissCurrent = useCallback(() => {
    setQueue(prev => prev.slice(1));
  }, []);

  const current = queue[0];
  if (!current) return null;

  const remaining = queue.length - 1;

  return (
    <View style={[
      st.banner,
      { backgroundColor: '#fef2f2', borderColor: '#dc2626' },
    ]}>
      <View style={st.iconCol}>
        <Text style={st.icon}>⚠️</Text>
      </View>

      <View style={st.textCol}>
        <Text style={st.title}>
          {REASON_LABELS[current.reason]}
        </Text>
        <Text style={st.subtitle}>
          Borgingspunt {current.inspectionPointId} — maak een nieuwe foto.
        </Text>
        {current.notes ? (
          <Text style={st.notes} numberOfLines={3}>
            "{current.notes}"
          </Text>
        ) : null}
        {remaining > 0 ? (
          <Text style={st.queueInfo}>
            +{remaining} andere afkeuring{remaining === 1 ? '' : 'en'} wachten
          </Text>
        ) : null}
      </View>

      <TouchableOpacity
        onPress={dismissCurrent}
        style={st.dismissBtn}
        activeOpacity={0.7}
        accessibilityLabel="Melding sluiten"
      >
        <Text style={st.dismissText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const st = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 2,
    gap: 12,
  },
  iconCol: { paddingTop: 2 },
  icon: { fontSize: 22 },
  textCol: { flex: 1, gap: 2 },
  title: {
    color: '#991b1b',
    fontWeight: '800',
    fontSize: 14,
  },
  subtitle: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '600',
  },
  notes: {
    color: '#7f1d1d',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  queueInfo: {
    color: '#991b1b',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  dismissBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(220,38,38,0.15)',
  },
  dismissText: {
    color: '#991b1b',
    fontSize: 16,
    fontWeight: '800',
  },
});
