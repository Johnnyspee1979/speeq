import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { ArrowLeft, KeyRound } from 'lucide-react-native';

const speeqQLogo = require('../assets/speeq-q-logo.png');

/** Letterlijke toegangscode — case-insensitive vergeleken. */
export const TOOL_ACCESS_CODE = 'code';

/** localStorage key — onthoudt dat de bezoeker de gate gepasseerd is. */
export const GATE_STORAGE_KEY = 'speeq_gate_passed_v1';

/** Web-only helper: heeft deze browser de gate al gepasseerd? */
export function hasPassedGate(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(GATE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Markeer de gate als gepasseerd (alleen web). */
export function markGatePassed(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GATE_STORAGE_KEY, 'true');
  } catch {
    /* private mode, quota — geen probleem, gate werkt dan per sessie */
  }
}

interface CodeGateScreenProps {
  /** Code geaccepteerd → laat de bezoeker door naar de echte login. */
  onCodeAccepted: () => void;
  /** Terug naar de landing pagina. */
  onBack: () => void;
}

/**
 * CodeGateScreen — soft gatekeeper vóór de Supabase login.
 *
 * Niet bedoeld als echte beveiliging (de code zit in de JS bundle),
 * maar als drempel om de tool niet open op het publieke internet te zetten.
 * Voor échte security blijft de Supabase auth verantwoordelijk.
 */
export default function CodeGateScreen({
  onCodeAccepted,
  onBack,
}: CodeGateScreenProps) {
  const { theme } = useTheme();
  const s = createStyles(theme);

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleSubmit = () => {
    setError(null);
    const trimmed = code.trim().toLowerCase();
    if (!trimmed) {
      setError('Vul de toegangscode in.');
      return;
    }

    setChecking(true);
    // Korte UX-pauze zodat de loading state zichtbaar is
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

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={s.watermark} pointerEvents="none">
        <Image source={speeqQLogo} style={s.watermarkImage} resizeMode="contain" />
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.card}>
          {/* Back link */}
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [s.backLink, pressed && { opacity: 0.6 }]}
          >
            <ArrowLeft size={14} color={theme.colors.textSecondary} />
            <Text style={s.backLinkText}>terug</Text>
          </Pressable>

          {/* Header */}
          <View style={s.iconBadge}>
            <KeyRound size={22} color={theme.colors.accent} />
          </View>
          <Text style={s.eyebrow}>TOEGANG</Text>
          <Text style={s.title}>Voer je toegangscode in</Text>
          <Text style={s.subtitle}>
            SpeeQ WKB Tool is alleen beschikbaar voor uitgenodigde bouwers.
            Geen code? Vraag een aan bij Spee Solutions.
          </Text>

          {/* Input */}
          <View style={s.field}>
            <Text style={s.label}>Toegangscode</Text>
            <TextInput
              ref={inputRef}
              style={[s.input, error ? s.inputError : null]}
              placeholder="Bijv. een woord van 4 letters"
              placeholderTextColor={theme.colors.textSecondary}
              value={code}
              onChangeText={(v) => {
                setCode(v);
                if (error) setError(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              editable={!checking}
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
            />
            {error ? <Text style={s.errorText}>{error}</Text> : null}
          </View>

          {/* Submit */}
          <Pressable
            onPress={handleSubmit}
            disabled={checking}
            style={({ pressed }) => [
              s.button,
              (checking || pressed) && s.buttonPressed,
            ]}
          >
            {checking ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={s.buttonText}>Open tool</Text>
            )}
          </Pressable>

          {/* Footer */}
          <View style={s.footer}>
            <View style={s.footerDot} />
            <Text style={s.footerText}>
              Spee Solutions 2026
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    watermark: {
      position: 'absolute',
      top: -60,
      right: -80,
      width: 320,
      height: 320,
      opacity: 0.05,
      transform: [{ rotate: '12deg' }],
    },
    watermarkImage: { width: '100%', height: '100%' },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 24,
    },
    card: {
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 28,
      paddingVertical: 32,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.06,
      shadowRadius: 32,
      elevation: 4,
      maxWidth: 440,
      width: '100%',
      alignSelf: 'center',
    },
    backLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-start',
      marginBottom: 20,
      paddingVertical: 4,
    },
    backLinkText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    iconBadge: {
      width: 44,
      height: 44,
      borderRadius: 11,
      backgroundColor: theme.colors.accentMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    eyebrow: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1.8,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      letterSpacing: -0.4,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 21,
      color: theme.colors.textSecondary,
      marginBottom: 24,
    },
    field: {
      marginBottom: 18,
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textPrimary,
      marginBottom: 6,
      letterSpacing: 0.2,
    },
    input: {
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 14,
      fontSize: 15,
      color: theme.colors.textPrimary,
    },
    inputError: {
      borderColor: theme.colors.danger,
    },
    errorText: {
      marginTop: 8,
      fontSize: 13,
      color: theme.colors.danger,
      fontWeight: '500',
    },
    button: {
      backgroundColor: theme.colors.accent,
      borderRadius: 10,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 3,
    },
    buttonPressed: { opacity: 0.85 },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 22,
      paddingTop: 18,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    footerDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.accent,
    },
    footerText: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      letterSpacing: 0.2,
    },
  });
