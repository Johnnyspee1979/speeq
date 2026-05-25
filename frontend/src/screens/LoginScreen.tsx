/**
 * LoginScreen — Animated sign-in stijl per Johnny 25 mei.
 *
 * Geïnspireerd op 21st.dev animated-sign-in component (Johnny vindt die
 * mooier dan eerdere versies). Stack-vertaling naar React Native:
 *  • Floating labels via Animated.Value (label slidet omhoog bij focus)
 *  • Show/hide password met Eye/EyeOff uit lucide-react-native
 *  • Donker gradient-achtergrond (particle canvas overgeslagen — RN heeft
 *    geen <canvas>; statische gradient + dots heeft 90% van het effect)
 *  • Dark/light theme-toggle via Sun/Moon
 *  • Welcome / Please sign in header
 *  • "or continue with" separator (vervangen door "of demo" + quick-login knoppen)
 *
 * Demo-quick-login knoppen behouden — Johnny gebruikt die in elke demo.
 * Echte Supabase signInWithPassword onveranderd.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Eye, EyeOff, Sun, Moon } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme/ThemeProvider';

const speeqLogoFull = require('../assets/speeq-logo-full.png');

interface LoginScreenProps {
  onDevBypass?: () => void;
}

const DEMO_ACCOUNTS: ReadonlyArray<{ role: string; emoji: string; email: string; password: string }> = [
  { role: 'Vakman',           emoji: '👷', email: 'vakman@combivo.nl',       password: 'combivo2026' },
  { role: 'Werkvoorbereider', emoji: '🛠️', email: 'johnny@speesolutions.com', password: 'Val7118!?' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen({ onDevBypass }: LoginScreenProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme.name === 'dark';
  const styles = createStyles(isDark);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  const [emailValid, setEmailValid] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  // ─── Floating-label animaties ─────────────────────────────────────────
  const emailLabelAnim = useRef(new Animated.Value(0)).current;
  const pwLabelAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(emailLabelAnim, {
      toValue: emailFocused || email.length > 0 ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [emailFocused, email, emailLabelAnim]);

  useEffect(() => {
    Animated.timing(pwLabelAnim, {
      toValue: pwFocused || password.length > 0 ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pwFocused, password, pwLabelAnim]);

  const handleEmailChange = (v: string) => {
    setEmail(v);
    if (v) setEmailValid(EMAIL_RE.test(v));
    else setEmailValid(true);
  };

  const handleQuickLogin = async (acc: { email: string; password: string }) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: acc.email,
      password: acc.password,
    });
    if (error) {
      setLoading(false);
      Alert.alert('Demo-login mislukt', error.message);
    }
  };

  const handleLogin = async () => {
    setSubmitted(true);
    if (!email || !password) {
      Alert.alert('Fout', 'Vul zowel e-mail als wachtwoord in.');
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setEmailValid(false);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      Alert.alert('Inloggen mislukt', error.message);
    }
  };

  const labelStyle = (anim: Animated.Value, hasError: boolean) => ({
    position: 'absolute' as const,
    left: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 12] }),
    top: anim.interpolate({ inputRange: [0, 1], outputRange: [16, -8] }),
    fontSize: anim.interpolate({ inputRange: [0, 1], outputRange: [15, 11] }),
    color: hasError
      ? '#ef4444'
      : isDark
        ? anim.interpolate({ inputRange: [0, 1], outputRange: ['#94a3b8', '#a78bfa'] })
        : anim.interpolate({ inputRange: [0, 1], outputRange: ['#64748b', '#7c3aed'] }),
    backgroundColor: isDark ? '#0f172a' : '#ffffff',
    paddingHorizontal: 4,
    zIndex: 1,
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Dotted achtergrond — vervangt particle canvas */}
      <View style={styles.bgDots} pointerEvents="none" />

      {/* Theme toggle rechtsboven */}
      <TouchableOpacity
        style={styles.themeToggle}
        onPress={toggleTheme}
        accessibilityLabel="Licht/donker thema wisselen"
        activeOpacity={0.7}
      >
        {isDark ? (
          <Sun size={20} color="#fde68a" />
        ) : (
          <Moon size={20} color="#475569" />
        )}
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <Image source={speeqLogoFull} style={styles.logo} resizeMode="contain" />
            <Text style={styles.welcome}>Welkom</Text>
            <Text style={styles.subWelcome}>Log in om verder te gaan</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Email field */}
            <View style={[styles.field, !emailValid && email ? styles.fieldError : null]}>
              <Animated.Text style={labelStyle(emailLabelAnim, !emailValid && !!email)}>
                E-mailadres
              </Animated.Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={handleEmailChange}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                editable={!loading}
                accessibilityLabel="E-mailadres"
              />
              {!emailValid && email ? (
                <Text style={styles.errorText}>Vul een geldig e-mailadres in</Text>
              ) : null}
            </View>

            {/* Password field */}
            <View style={styles.field}>
              <Animated.Text style={labelStyle(pwLabelAnim, false)}>
                Wachtwoord
              </Animated.Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPwFocused(true)}
                onBlur={() => setPwFocused(false)}
                secureTextEntry={!showPassword}
                editable={!loading}
                accessibilityLabel="Wachtwoord"
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword((v) => !v)}
                accessibilityLabel={showPassword ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'}
              >
                {showPassword ? (
                  <EyeOff size={18} color={isDark ? '#94a3b8' : '#64748b'} />
                ) : (
                  <Eye size={18} color={isDark ? '#94a3b8' : '#64748b'} />
                )}
              </TouchableOpacity>
            </View>

            {/* Options row */}
            <View style={styles.optionsRow}>
              <Pressable
                onPress={() => setRememberMe(!rememberMe)}
                style={styles.remember}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberMe }}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxOn]}>
                  {rememberMe ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
                <Text style={styles.rememberText}>Onthoud mij</Text>
              </Pressable>
              <Pressable onPress={() => Alert.alert('Wachtwoord vergeten', 'Neem contact op met Spee Solutions.')}>
                <Text style={styles.forgot}>Wachtwoord vergeten?</Text>
              </Pressable>
            </View>

            {/* Sign in button */}
            <Pressable
              style={({ pressed }) => [
                styles.button,
                (loading || (submitted && (!email || !password || !emailValid))) && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Inloggen</Text>
              )}
            </Pressable>
          </View>

          {/* Separator */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>of demo</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Demo quick-login knoppen */}
          <View style={styles.demoRow}>
            {DEMO_ACCOUNTS.map((acc) => (
              <Pressable
                key={acc.email}
                style={({ pressed }) => [styles.demoBtn, pressed && { opacity: 0.7 }]}
                onPress={() => handleQuickLogin(acc)}
                disabled={loading}
                accessibilityLabel={`Demo-login als ${acc.role}`}
              >
                <Text style={styles.demoEmoji}>{acc.emoji}</Text>
                <Text style={styles.demoText}>{acc.role}</Text>
              </Pressable>
            ))}
          </View>

          {onDevBypass ? (
            <Pressable
              style={({ pressed }) => [styles.devButton, pressed && { opacity: 0.6 }]}
              onPress={onDevBypass}
              disabled={loading}
            >
              <Text style={styles.devButtonText}>
                🛠 Lokale dev-bypass (localhost only) →
              </Text>
            </Pressable>
          ) : null}

          <Text style={styles.footer}>
            Veilig ingelogd via Supabase · Spee Solutions 2026
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(isDark: boolean) {
  // Hardcoded animated-sign-in palette (geen useTheme — bewust losgekoppeld
  // van Warm Minimal zodat het er exact zo uitziet als het 21st.dev voorbeeld)
  const C = isDark
    ? {
        bg: '#0f172a',         // slate-900
        bgGradient: '#1e293b', // slate-800
        cardBg: '#1e293b',
        cardBorder: '#334155', // slate-700
        text: '#f1f5f9',       // slate-100
        textMuted: '#94a3b8',  // slate-400
        accent: '#a78bfa',     // violet-400
        accentDark: '#8b5cf6', // violet-500
        inputBg: '#0f172a',
        inputBorder: '#334155',
        dotColor: 'rgba(255,255,255,0.04)',
      }
    : {
        bg: '#f8fafc',         // slate-50
        bgGradient: '#e2e8f0', // slate-200
        cardBg: '#ffffff',
        cardBorder: '#e2e8f0',
        text: '#0f172a',
        textMuted: '#64748b',
        accent: '#7c3aed',     // violet-600
        accentDark: '#6d28d9', // violet-700
        inputBg: '#ffffff',
        inputBorder: '#e2e8f0',
        dotColor: 'rgba(0,0,0,0.04)',
      };

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.bg,
    },
    bgDots: {
      ...StyleSheet.absoluteFillObject,
      // Web-only radial-gradient dotted pattern (RN negeert onbekende keys)
      ...(Platform.OS === 'web'
        ? ({
            backgroundImage: `radial-gradient(${C.dotColor} 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          } as object)
        : {}),
    },
    themeToggle: {
      position: 'absolute',
      top: 24,
      right: 24,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: C.cardBg,
      borderWidth: 1,
      borderColor: C.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      paddingTop: 80,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: C.cardBg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.cardBorder,
      padding: 32,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' } as object)
        : {}),
    },
    header: {
      alignItems: 'center',
      marginBottom: 28,
    },
    logo: {
      width: 96,
      height: 48,
      marginBottom: 12,
    },
    welcome: {
      fontSize: 28,
      fontWeight: '700',
      color: C.text,
      letterSpacing: -0.5,
    },
    subWelcome: {
      fontSize: 14,
      color: C.textMuted,
      marginTop: 4,
    },
    form: {
      gap: 22,
    },
    field: {
      position: 'relative',
    },
    fieldError: {
      // visuele aanvulling via input borderColor — niet zelf
    },
    input: {
      borderWidth: 1,
      borderColor: C.inputBorder,
      backgroundColor: C.inputBg,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      color: C.text,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
    },
    errorText: {
      color: '#ef4444',
      fontSize: 12,
      marginTop: 4,
      marginLeft: 4,
    },
    eyeBtn: {
      position: 'absolute',
      right: 12,
      top: 14,
      padding: 4,
    },
    optionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    remember: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    checkbox: {
      width: 18,
      height: 18,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: C.inputBorder,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.inputBg,
    },
    checkboxOn: {
      backgroundColor: C.accent,
      borderColor: C.accent,
    },
    checkmark: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '900',
    },
    rememberText: {
      color: C.textMuted,
      fontSize: 13,
    },
    forgot: {
      color: C.accent,
      fontSize: 13,
      fontWeight: '600',
    },
    button: {
      backgroundColor: C.accent,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
      ...(Platform.OS === 'web'
        ? ({
            transitionProperty: 'background-color, transform',
            transitionDuration: '180ms',
          } as object)
        : {}),
    },
    buttonDisabled: {
      opacity: 0.55,
    },
    buttonPressed: {
      backgroundColor: C.accentDark,
      transform: [{ scale: 0.99 }],
    },
    buttonText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '700',
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 24,
      marginBottom: 16,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: C.cardBorder,
    },
    dividerText: {
      color: C.textMuted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    demoRow: {
      flexDirection: 'row',
      gap: 10,
    },
    demoBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.cardBorder,
      backgroundColor: C.inputBg,
    },
    demoEmoji: {
      fontSize: 16,
    },
    demoText: {
      color: C.text,
      fontSize: 13,
      fontWeight: '700',
    },
    devButton: {
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 12,
    },
    devButtonText: {
      color: C.textMuted,
      fontSize: 12,
      fontWeight: '500',
    },
    footer: {
      marginTop: 20,
      textAlign: 'center',
      fontSize: 11,
      color: C.textMuted,
    },
  });
}
