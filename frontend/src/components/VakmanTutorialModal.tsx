/**
 * VakmanTutorialModal — Sprint 6 (v1.0 onboarding)
 *
 * Een 3-staps onboarding-carrousel die ÉÉN keer aan een vakman wordt getoond
 * direct nadat zijn tenant succesvol is verbonden en hij is ingelogd.
 *
 *  Stap 1 — Snel foto's maken            (camera-flow)
 *  Stap 2 — Ander borgingspunt           (StartFlowResumeContext)
 *  Stap 3 — Prik je locatie              (FloorPlanPinPicker)
 *
 * Persist: localforage key `@has_seen_tutorial` (web + PWA + native via
 * driver). Eenmaal voltooid of overgeslagen verschijnt de modal nooit meer
 * automatisch — testers kunnen 'm forceren via window.__resetVakmanTutorial().
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Platform,
  useWindowDimensions,
} from 'react-native';
import localforage from 'localforage';
import { useTranslation } from '../i18n';

const STORAGE_KEY = '@has_seen_tutorial';

interface TutorialStep {
  icon: string;
  titleKey: string;
  bodyKey: string;
  bullets: string[]; // i18n keys
  accent: string;
}

const STEPS: TutorialStep[] = [
  {
    icon: '📸',
    titleKey: 'tutorial.step1_title',
    bodyKey:  'tutorial.step1_body',
    bullets: ['tutorial.step1_b1', 'tutorial.step1_b2', 'tutorial.step1_b3'],
    accent: '#e63946',
  },
  {
    icon: '🔄',
    titleKey: 'tutorial.step2_title',
    bodyKey:  'tutorial.step2_body',
    bullets: ['tutorial.step2_b1', 'tutorial.step2_b2', 'tutorial.step2_b3'],
    accent: '#2563eb',
  },
  {
    icon: '📐',
    titleKey: 'tutorial.step3_title',
    bodyKey:  'tutorial.step3_body',
    bullets: ['tutorial.step3_b1', 'tutorial.step3_b2', 'tutorial.step3_b3'],
    accent: '#059669',
  },
];

export interface VakmanTutorialModalProps {
  /** Forceer tonen (negeert seen-flag). Handig voor "Toon uitleg opnieuw"-knop. */
  forceVisible?: boolean;
  /** Callback wanneer modal sluit (overslaan of voltooien). */
  onClose?: () => void;
}

/**
 * Reset-helper: lees of de tutorial al is gezien.
 * Geëxporteerd zodat instellingen-scherm 'm later kan resetten.
 */
export async function hasSeenVakmanTutorial(): Promise<boolean> {
  try {
    const v = await localforage.getItem<string>(STORAGE_KEY);
    return v === 'true';
  } catch {
    return false;
  }
}

export async function resetVakmanTutorial(): Promise<void> {
  try { await localforage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export default function VakmanTutorialModal({
  forceVisible = false,
  onClose,
}: VakmanTutorialModalProps) {
  const { t } = useTranslation();
  const { width: screenW } = useWindowDimensions();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;

  // Bepaal carrouselbreedte (max 460 voor desktop)
  const cardWidth = Math.min(screenW - 32, 460);

  // ── Bepaal of we open moeten bij mount ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (forceVisible) {
        if (!cancelled) setVisible(true);
        return;
      }
      const seen = await hasSeenVakmanTutorial();
      if (!cancelled && !seen) setVisible(true);
    })();
    return () => { cancelled = true; };
  }, [forceVisible]);

  // ── Dev-helper: window.__resetVakmanTutorial() in console ───────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__resetVakmanTutorial = async () => {
      await resetVakmanTutorial();
      setStep(0);
      setVisible(true);
      console.log('🎓 Vakman tutorial gereset — verschijnt opnieuw.');
    };
    return () => {
      try { delete (window as any).__resetVakmanTutorial; } catch {}
    };
  }, []);

  // ── Fade-in bij stap-wissel ──────────────────────────────────────────────
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 220,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [step, fade]);

  const total = STEPS.length;
  const isLast = step === total - 1;
  const current = STEPS[step]!;

  const closeAndPersist = async () => {
    try { await localforage.setItem(STORAGE_KEY, 'true'); } catch {}
    setVisible(false);
    setStep(0);
    onClose?.();
  };

  const handleSkip = () => { closeAndPersist(); };
  const handleNext = () => {
    if (isLast) closeAndPersist();
    else setStep((s) => Math.min(s + 1, total - 1));
  };
  const handleBack = () => setStep((s) => Math.max(s - 1, 0));

  // Memoize bullets om re-render te beperken
  const bullets = useMemo(
    () => current.bullets.map((k) => t(k)),
    [current.bullets, t]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleSkip}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { width: cardWidth }]}>

          {/* Skip-knop rechtsboven */}
          <Pressable style={styles.skipBtn} onPress={handleSkip} hitSlop={10}>
            <Text style={styles.skipText}>{t('tutorial.skip')}</Text>
          </Pressable>

          {/* Hero icoon + accentbalk */}
          <View style={[styles.hero, { backgroundColor: `${current.accent}1a` }]}>
            <Animated.Text style={[styles.heroIcon, { opacity: fade }]}>
              {current.icon}
            </Animated.Text>
          </View>

          {/* Inhoud */}
          <ScrollView
            style={{ maxHeight: 320 }}
            contentContainerStyle={{ padding: 22 }}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={{ opacity: fade }}>
              <Text style={[styles.stepNum, { color: current.accent }]}>
                {t('tutorial.step_of', { current: step + 1, total })}
              </Text>
              <Text style={styles.title}>{t(current.titleKey)}</Text>
              <Text style={styles.body}>{t(current.bodyKey)}</Text>

              <View style={styles.bullets}>
                {bullets.map((b, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <Text style={[styles.bulletDot, { color: current.accent }]}>●</Text>
                    <Text style={styles.bulletText}>{b}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          </ScrollView>

          {/* Stap-indicator (dots) */}
          <View style={styles.dots}>
            {STEPS.map((s, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === step && { backgroundColor: s.accent, width: 22 },
                ]}
              />
            ))}
          </View>

          {/* Navigatie-knoppen */}
          <View style={styles.footer}>
            {step > 0 ? (
              <Pressable style={styles.btnGhost} onPress={handleBack}>
                <Text style={styles.btnGhostText}>{t('tutorial.back')}</Text>
              </Pressable>
            ) : <View style={{ flex: 1 }} />}

            <Pressable
              style={[styles.btnPrimary, { backgroundColor: current.accent }]}
              onPress={handleNext}
            >
              <Text style={styles.btnPrimaryText}>
                {isLast ? t('tutorial.start') : t('tutorial.next')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  skipBtn: {
    position: 'absolute',
    top: 10,
    right: 12,
    zIndex: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  skipText: { color: '#888', fontSize: 12, fontWeight: '700' },

  hero: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIcon: { fontSize: 64 },

  stepNum: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: { fontSize: 22, fontWeight: '900', color: '#111', marginBottom: 8, letterSpacing: -0.3 },
  body: { fontSize: 14, color: '#444', lineHeight: 20, marginBottom: 14 },

  bullets: { marginTop: 4 },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  bulletDot: { fontSize: 12, marginTop: 3 },
  bulletText: { flex: 1, fontSize: 13, color: '#333', lineHeight: 19 },

  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e0e0e0',
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fafafa',
    gap: 10,
  },
  btnGhost: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  btnGhostText: { color: '#444', fontWeight: '700', fontSize: 13 },
  btnPrimary: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.3 },
});
