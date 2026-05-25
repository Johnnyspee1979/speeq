/**
 * CodeGateScreen — Claude Design v2 (Raven Health-aesthetic).
 *
 * Bron mock: .claude/claude-design-import/ui_kits/desktop/CodeGateScreen.jsx
 *
 * Full-bleed soft gradient hero, centered headline + single input + navy CTA.
 * Back-link linksboven met glass-effect, brand-mark rechtsboven.
 *
 * Palette: hardcoded navy + green (Claude Design tokens v2) — eerste indruk.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { ArrowLeft, KeyRound } from 'lucide-react-native';

const speeqQLogo = require('../assets/speeq-q-logo.png');

/** Letterlijke toegangscode — case-insensitive vergeleken. */
export const TOOL_ACCESS_CODE = '0987';

/** sessionStorage key — onthoudt de gate alleen binnen dezelfde tab-sessie. */
export const GATE_STORAGE_KEY = 'speeq_gate_passed_v1';

export function hasPassedGate(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(GATE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markGatePassed(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(GATE_STORAGE_KEY, 'true');
  } catch { /* ignore */ }
}

interface CodeGateScreenProps {
  onCodeAccepted: () => void;
  onBack: () => void;
}

// Claude Design tokens (hardcoded).
const C = {
  bg:            '#FFFFFF',
  heroGradient:  'linear-gradient(120deg, #EEF2F7 0%, #F6F4EF 50%, #ECF6E5 100%)',
  navy:          '#1B3A5C',
  navyHover:     '#15304B',
  green:         '#5BAA3A',
  textStrong:    '#09090B',
  text:          '#18181B',
  textMuted:     '#52525B',
  textSubtle:    '#71717A',
  border:        '#E4E4E7',
  cardShadow:    '0 24px 48px -12px rgba(15,36,54,0.12), 0 4px 16px -4px rgba(9,9,11,0.04)',
  fontDisplay:   '"Bricolage Grotesque", "Plus Jakarta Sans", system-ui, sans-serif',
  fontSans:      '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
};

export default function CodeGateScreen({
  onCodeAccepted,
  onBack,
}: CodeGateScreenProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const labelAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(labelAnim, {
      toValue: focused || code.length > 0 ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [focused, code, labelAnim]);

  const handleSubmit = () => {
    setError(null);
    const trimmed = code.trim().toLowerCase();
    if (!trimmed) {
      setError('Vul de toegangscode in.');
      return;
    }
    setChecking(true);
    setTimeout(() => {
      if (trimmed === TOOL_ACCESS_CODE.toLowerCase()) {
        markGatePassed();
        onCodeAccepted();
      } else {
        setError('Onjuiste toegangscode.');
        setCode('');
        inputRef.current?.focus();
        setChecking(false);
      }
    }, 250);
  };

  const labelStyle = {
    position: 'absolute' as const,
    left: labelAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 12] }),
    top: labelAnim.interpolate({ inputRange: [0, 1], outputRange: [14, -8] }),
    fontSize: labelAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 11] }),
    color: error
      ? '#DC2626'
      : labelAnim.interpolate({ inputRange: [0, 1], outputRange: [C.textSubtle, C.navy] }),
    backgroundColor: C.bg,
    paddingHorizontal: 4,
    fontFamily: C.fontSans,
    fontWeight: '600' as const,
    zIndex: 1,
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Full-bleed gradient hero achtergrond */}
      <View style={styles.gradient} pointerEvents="none" />

      {/* Back-link met glass-effect (linksboven) */}
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [styles.backLink, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityLabel="Terug naar landing"
      >
        <ArrowLeft size={14} color={C.textMuted} />
        <Text style={styles.backLinkText}>terug</Text>
      </Pressable>

      {/* Brand-mark (rechtsboven) */}
      <View style={styles.brandMark} pointerEvents="none">
        <Image source={speeqQLogo} style={styles.brandLogo} resizeMode="contain" />
        <Text style={styles.brandText}>
          Spee<Text style={{ color: C.green }}>Q</Text>
        </Text>
        <Text style={styles.brandSub}>WKB Tool</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.iconBadge}>
            <KeyRound size={22} color={C.navy} />
          </View>
          <Text style={styles.eyebrow}>TOEGANG</Text>
          <Text style={styles.title}>Voer je toegangscode in</Text>
          <Text style={styles.subtitle}>
            SpeeQ WKB is alleen beschikbaar voor uitgenodigde bouwers.
            Geen code? Vraag een aan bij Spee Solutions.
          </Text>

          <View style={styles.field}>
            <Animated.Text style={labelStyle}>
              4-cijferige code
            </Animated.Text>
            <TextInput
              ref={inputRef}
              style={[styles.input, error ? styles.inputError : null]}
              value={code}
              onChangeText={(v) => {
                setCode(v);
                if (error) setError(null);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              editable={!checking}
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
              accessibilityLabel="Toegangscode"
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={checking}
            style={({ pressed }) => [
              styles.cta,
              (checking || pressed) && styles.ctaPressed,
            ]}
            accessibilityLabel="Open tool met toegangscode"
          >
            {checking ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaText}>Open tool</Text>
            )}
          </Pressable>

          <Text style={styles.footer}>
            Spee Solutions 2026
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    ...(Platform.OS === 'web'
      ? ({ backgroundImage: C.heroGradient } as object)
      : { backgroundColor: '#F0EEE8' }),
  },
  backLink: {
    position: 'absolute',
    top: 28,
    left: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    zIndex: 10,
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(8px)' } as object)
      : {}),
  },
  backLinkText: {
    fontFamily: C.fontSans,
    fontSize: 13,
    color: C.textMuted,
    fontWeight: '600',
  },
  brandMark: {
    position: 'absolute',
    top: 28,
    right: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  brandLogo: { width: 26, height: 26 },
  brandText: {
    fontFamily: C.fontDisplay,
    fontWeight: '800',
    fontSize: 15,
    color: '#0F2436',
    letterSpacing: -0.3,
  },
  brandSub: {
    fontFamily: C.fontSans,
    fontSize: 10,
    color: C.textSubtle,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginLeft: 2,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    paddingTop: 80,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: C.bg,
    borderRadius: 24,
    padding: 36,
    borderWidth: 1,
    borderColor: C.border,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: C.cardShadow } as object)
      : {
          shadowColor: '#0F2436',
          shadowOpacity: 0.12,
          shadowRadius: 48,
          shadowOffset: { width: 0, height: 24 },
          elevation: 8,
        }),
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EEF2F7', // navy-50 uit Claude Design
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  eyebrow: {
    fontFamily: C.fontSans,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: C.textMuted,
    marginBottom: 8,
  },
  title: {
    fontFamily: C.fontDisplay,
    fontSize: 28,
    fontWeight: '700',
    color: C.textStrong,
    letterSpacing: -0.7,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: C.fontSans,
    fontSize: 14,
    lineHeight: 22,
    color: C.textSubtle,
    marginBottom: 24,
  },
  field: {
    position: 'relative',
    marginBottom: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: C.text,
    fontFamily: C.fontSans,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  inputError: { borderColor: '#DC2626' },
  errorText: {
    fontFamily: C.fontSans,
    marginTop: 8,
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '500',
  },
  cta: {
    backgroundColor: C.navy,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: {
    backgroundColor: C.navyHover,
    opacity: 0.92,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: C.fontSans,
  },
  footer: {
    fontFamily: C.fontSans,
    marginTop: 22,
    textAlign: 'center',
    fontSize: 11,
    color: C.textSubtle,
  },
});
