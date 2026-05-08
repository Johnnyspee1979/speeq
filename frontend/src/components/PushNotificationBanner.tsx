/**
 * PushNotificationBanner — vraagt toestemming voor push notificaties
 *
 * Toont een niet-opdringerige banner wanneer:
 * - Push ondersteund wordt door de browser
 * - Toestemming nog niet gegeven of geweigerd is
 * - Gebruiker is ingelogd
 *
 * Sla "afgewezen" op in localStorage zodat we nooit opnieuw vragen.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { subscribeToWebPush, isPushSupported, getPushPermission } from '../services/WebPushService';
import { useTheme } from '../theme/ThemeProvider';

const DISMISSED_KEY = 'wkb_push_banner_dismissed';

interface Props {
  projectId: string;
  userId: string;
}

export default function PushNotificationBanner({ projectId, userId }: Props) {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [opacity] = useState(new Animated.Value(0));

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!isPushSupported()) return;

    const permission = getPushPermission();
    if (permission === 'granted' || permission === 'denied') return;

    // Check of al eerder afgewezen via de banner
    try {
      if (localStorage.getItem(DISMISSED_KEY) === '1') return;
    } catch { /* private browsing */ }

    // Toon banner na 3 seconden (niet direct opdringen)
    const timer = setTimeout(() => {
      setVisible(true);
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: false }).start();
    }, 3000);

    return () => clearTimeout(timer);
  }, [opacity]);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const result = await subscribeToWebPush(projectId, userId, session.access_token);
      if (result.subscribed || (result as { reason?: string }).reason === 'denied') {
        dismiss();
      }
    } catch { /* stil falen */ }
    finally { setLoading(false); }
  };

  const dismiss = () => {
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: false }).start(() => {
      setVisible(false);
    });
    try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* private browsing */ }
  };

  if (!visible || Platform.OS !== 'web') return null;

  return (
    // @ts-ignore web only
    <Animated.View style={[st.banner, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, opacity }]}>
      <View style={st.left}>
        <Text style={st.bell}>🔔</Text>
        <View>
          <Text style={[st.title, { color: theme.colors.textPrimary }]}>
            Meldingen inschakelen
          </Text>
          <Text style={[st.sub, { color: theme.colors.textSecondary }]}>
            Ontvang een melding als je foto wordt afgekeurd
          </Text>
        </View>
      </View>
      <View style={st.right}>
        <TouchableOpacity
          style={[st.btn, { backgroundColor: theme.colors.accent }]}
          onPress={handleEnable}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={st.btnText}>{loading ? '...' : 'Inschakelen'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.close} onPress={dismiss} activeOpacity={0.7}>
          <Text style={[st.closeText, { color: theme.colors.textSecondary }]}>✕</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 12,
    // @ts-ignore web
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  bell: { fontSize: 22 },
  title: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  sub: { fontSize: 12 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  close: { padding: 6 },
  closeText: { fontSize: 14, fontWeight: '600' },
});
