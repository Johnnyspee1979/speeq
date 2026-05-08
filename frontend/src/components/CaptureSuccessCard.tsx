/**
 * CaptureSuccessCard — verschijnt direct na het opslaan van een borgingspunt.
 *
 * De vakman ziet:
 *  ✅ Opgeslagen bevestiging
 *  → Deel via WhatsApp (1 tap)
 *  → Deel via Email
 *  → Kopieer naar klembord
 *  → Nieuwe foto (terug naar capture)
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  copyToClipboard,
  nativeShare,
  shareViaEmail,
  shareViaWhatsApp,
  type SharePayload,
} from '../services/ShareService';
import { useTheme } from '../theme/ThemeProvider';

interface CaptureSuccessCardProps {
  payload: SharePayload;
  onNewCapture: () => void;
  onBack?: () => void;            // legacy — use onBackToProject / onBackToMain instead
  onBackToProject?: () => void;   // ↩️ Ander borgingspunt (zelfde project/discipline)
  onBackToMain?: () => void;      // 🏠 Terug naar hoofdmenu
}

export default function CaptureSuccessCard({
  payload,
  onNewCapture,
  onBack,
  onBackToProject,
  onBackToMain,
}: CaptureSuccessCardProps) {
  const { theme } = useTheme();
  const isDark = theme.name === 'dark';

  // Slide-in animatie
  const slideAnim = useRef(new Animated.Value(60)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, []);

  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await copyToClipboard(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    const didShare = await nativeShare(payload);
    if (!didShare) {
      // Fallback naar WhatsApp als native share niet beschikbaar
      shareViaWhatsApp(payload);
    }
  };

  const time = new Date(payload.timestamp).toLocaleString('nl-NL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.success + '40',
          transform: [{ translateY: slideAnim }],
          opacity: fadeAnim,
        },
      ]}
    >
      {/* Groene accent balk boven */}
      <View style={[styles.topBar, { backgroundColor: theme.colors.success }]} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.checkCircle}>
          <Text style={styles.checkIcon}>✓</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.savedLabel, { color: theme.colors.success }]}>OPGESLAGEN</Text>
          <Text style={[styles.taskTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
            {payload.taskTitle}
          </Text>
        </View>
      </View>

      {/* Meta info */}
      <View style={[styles.metaBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)', borderColor: theme.colors.border }]}>
        <View style={styles.metaRow}>
          <Text style={[styles.metaIcon]}>🏗️</Text>
          <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>{payload.projectId}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaIcon}>📍</Text>
          <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
            {payload.latitude.toFixed(5)}, {payload.longitude.toFixed(5)}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaIcon}>🕐</Text>
          <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>{time}</Text>
        </View>
        {payload.weatherLabel ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>🌤️</Text>
            <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>{payload.weatherLabel}</Text>
          </View>
        ) : null}
        <View style={styles.metaRow}>
          <Text style={styles.metaIcon}>🔖</Text>
          <Text style={[styles.metaCode, { color: theme.colors.textSecondary }]}>{payload.inspectionPointId}</Text>
        </View>
      </View>

      {/* Deel knoppen */}
      <Text style={[styles.shareLabel, { color: theme.colors.textSecondary }]}>DIRECT DELEN</Text>

      <View style={styles.shareRow}>
        {/* WhatsApp — altijd de primaire knop */}
        <TouchableOpacity
          style={[styles.shareBtn, styles.shareBtnWhatsApp]}
          onPress={() => shareViaWhatsApp(payload)}
          activeOpacity={0.8}
        >
          <Text style={styles.shareBtnIcon}>💬</Text>
          <Text style={styles.shareBtnTextWhatsApp}>WhatsApp</Text>
        </TouchableOpacity>

        {/* Native share (iOS/Android systeem-sheet) */}
        {Platform.OS === 'web' && typeof navigator !== 'undefined' && (navigator as any).share ? (
          <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', borderColor: theme.colors.border }]}
            onPress={handleNativeShare}
            activeOpacity={0.8}
          >
            <Text style={styles.shareBtnIcon}>↑</Text>
            <Text style={[styles.shareBtnText, { color: theme.colors.textPrimary }]}>Deel</Text>
          </TouchableOpacity>
        ) : null}

        {/* Email */}
        <TouchableOpacity
          style={[styles.shareBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', borderColor: theme.colors.border }]}
          onPress={() => shareViaEmail(payload)}
          activeOpacity={0.8}
        >
          <Text style={styles.shareBtnIcon}>✉️</Text>
          <Text style={[styles.shareBtnText, { color: theme.colors.textPrimary }]}>Email</Text>
        </TouchableOpacity>

        {/* Kopieer */}
        <TouchableOpacity
          style={[styles.shareBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', borderColor: theme.colors.border }]}
          onPress={handleCopy}
          activeOpacity={0.8}
        >
          <Text style={styles.shareBtnIcon}>{copied ? '✓' : '📋'}</Text>
          <Text style={[styles.shareBtnText, { color: copied ? theme.colors.success : theme.colors.textPrimary }]}>
            {copied ? 'Gekopieerd' : 'Kopieer'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Actie knoppen */}
      {(onBackToProject || onBackToMain) ? (
        // Nieuwe 3-knops navigatie na registratie
        <View style={styles.actionColumn}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary, { backgroundColor: theme.colors.accent }]}
            onPress={onNewCapture}
            activeOpacity={0.85}
          >
            <Text style={styles.actionBtnPrimaryText}>📸  Zelfde borgingspunt opnieuw</Text>
          </TouchableOpacity>

          {onBackToProject && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnProject, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)', borderColor: theme.colors.border }]}
              onPress={onBackToProject}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionBtnText, { color: theme.colors.textPrimary, fontWeight: '700' }]}>↩️  Ander borgingspunt</Text>
            </TouchableOpacity>
          )}

          {onBackToMain && (
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: theme.colors.border, borderWidth: 1 }]}
              onPress={onBackToMain}
              activeOpacity={0.75}
            >
              <Text style={[styles.actionBtnText, { color: theme.colors.textSecondary }]}>🏠  Hoofdmenu</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        // Legacy 2-knops lay-out (voor backward compat)
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary, { backgroundColor: theme.colors.accent }]}
            onPress={onNewCapture}
            activeOpacity={0.85}
          >
            <Text style={styles.actionBtnPrimaryText}>📸  Nieuwe foto</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: theme.colors.border, borderWidth: 1 }]}
            onPress={onBack}
            activeOpacity={0.75}
          >
            <Text style={[styles.actionBtnText, { color: theme.colors.textSecondary }]}>Terug</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    margin: 16,
  },
  topBar: {
    height: 4,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  checkCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#05966920',
    borderWidth: 2,
    borderColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkIcon: {
    fontSize: 18,
    color: '#059669',
    fontWeight: '800',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  savedLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  // Meta box
  metaBox: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaIcon: {
    fontSize: 13,
    width: 20,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  metaCode: {
    fontSize: 11,
    fontFamily: 'monospace' as any,
    fontWeight: '600',
  },

  // Share
  shareLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  shareRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  shareBtnWhatsApp: {
    backgroundColor: '#25D366',
    borderColor: '#25D366',
  },
  shareBtnIcon: {
    fontSize: 14,
  },
  shareBtnTextWhatsApp: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Actie knoppen
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  actionColumn: {
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnProject: {
    borderWidth: 1,
  },
  actionBtnPrimary: {},
  actionBtnPrimaryText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
