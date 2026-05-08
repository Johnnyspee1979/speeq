/**
 * PWAInstallBanner — toont een "Installeer app" banner
 * wanneer de browser het beforeinstallprompt-event vuurt.
 *
 * Werkt alleen op web. Native: null.
 * Slaat "dismissed" op in localStorage zodat de banner
 * niet constant terugkomt.
 */

import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Theme = {
  colors: {
    background: string;
    surface: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    accent: string;
  };
};

interface Props {
  theme: Theme;
}

const DISMISSED_KEY = 'wkb_pwa_install_dismissed';

export default function PWAInstallBanner({ theme }: Props) {
  const [promptEvent, setPromptEvent] = useState<Event | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // Already dismissed?
    try {
      if (window.localStorage.getItem(DISMISSED_KEY) === '1') {
        setDismissed(true);
        return;
      }
    } catch { /* ignore */ }

    // Already installed as PWA (standalone mode)?
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setDismissed(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!promptEvent) return;
    // @ts-ignore — BeforeInstallPromptEvent
    await promptEvent.prompt();
    // @ts-ignore
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      dismiss();
    }
  };

  const dismiss = () => {
    try { window.localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
    setPromptEvent(null);
  };

  if (Platform.OS !== 'web' || dismissed || !promptEvent) return null;

  return (
    <View style={[styles.banner, { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent }]}>
      <Text style={styles.icon}>📲</Text>
      <View style={styles.textBlock}>
        <Text style={styles.title}>Installeer WKB Snap & Sync</Text>
        <Text style={styles.sub}>Gebruik als app op je telefoon of desktop — ook offline</Text>
      </View>
      <TouchableOpacity onPress={handleInstall} style={styles.installBtn} activeOpacity={0.85}>
        <Text style={styles.installBtnText}>Installeren</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={dismiss} style={styles.closeBtn} activeOpacity={0.7}>
        <Text style={styles.closeBtnText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1,
  },
  icon: { fontSize: 22, flexShrink: 0 },
  textBlock: { flex: 1 },
  title: { color: '#fff', fontSize: 13, fontWeight: '800' },
  sub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 1 },
  installBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  installBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  closeBtn: { padding: 6 },
  closeBtnText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '700' },
});
