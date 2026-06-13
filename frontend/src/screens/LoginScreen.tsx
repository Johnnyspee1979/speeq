/**
 * LoginScreen — Claude Design v2 (Raven Health-aesthetic).
 *
 * Bron mock: .claude/claude-design-import/ui_kits/desktop/LoginScreen.jsx
 *
 * Layout:
 *  • Desktop (>=900px): 2-koloms — soft-gradient hero links, wit login-card rechts
 *  • Mobile (<900px):  alleen card (geen hero — vakman wil snel inloggen)
 *
 * Palette: hardcoded navy + green + zinc (Claude Design tokens v2).
 * Bewust losgekoppeld van theme-toggle zodat eerste indruk altijd modern is.
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
  useWindowDimensions,
} from 'react-native';
import { Eye, EyeOff, ShieldCheck, Lock, CloudUpload } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

const speeqQLogo = require('../assets/speeq-q-logo.png');

interface LoginScreenProps {
  onDevBypass?: () => void;
}

// Demo-accounts voor klant-demo's. BEWUST alleen WEGWERP-demo-accounts hier
// (eigen speedemo.nl-tenant zonder echte data) — NOOIT een echt klant-account.
// Een echt account (bv. vakman@combivo.nl) hoort hier niet: de inlogknop logt
// dan elke bezoeker in op de klant-tenant (RLS scope = die klant) en het
// wachtwoord wordt meegebakken in de publieke web-bundle.
//
// De demo-rij wordt bovendien alleen getoond als EXPO_PUBLIC_ENABLE_DEMO_LOGIN
// === 'true' (standaard UIT in productie). Zet 'm aan op een demo-URL.
const DEMO_LOGIN_ENABLED = process.env.EXPO_PUBLIC_ENABLE_DEMO_LOGIN === 'true';
const DEMO_ACCOUNTS: ReadonlyArray<{ role: string; emoji: string; email: string; password: string }> = [
  { role: 'Projectleider',    emoji: '👔', email: 'projectleider@speedemo.nl',  password: 'demo2026' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Claude Design tokens (hardcoded — Raven-aligned navy + green).
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
  borderStrong:  '#D4D4D8',
  cardShadow:    '0 24px 48px -12px rgba(15,36,54,0.12), 0 4px 16px -4px rgba(9,9,11,0.04)',
  fontDisplay:   '"Bricolage Grotesque", "Plus Jakarta Sans", system-ui, sans-serif',
  fontSans:      '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
};

export default function LoginScreen({ onDevBypass }: LoginScreenProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  const [emailValid, setEmailValid] = useState(true);
  const [submitted, setSubmitted] = useState(false);

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

  // Wachtwoord-herstel via Supabase. Stuurt een recovery-mail naar het
  // ingevulde adres; de gebruiker kiest na de mail-link een nieuw wachtwoord.
  // Bewust géén bevestiging of het adres bestaat (voorkomt account-enumeratie).
  const handleForgotPassword = async () => {
    if (!email || !EMAIL_RE.test(email)) {
      setEmailValid(false);
      Alert.alert(
        'Wachtwoord vergeten',
        'Vul eerst je e-mailadres in het veld hierboven in, dan sturen we je een herstellink.'
      );
      return;
    }
    setLoading(true);
    const redirectTo =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);
    if (error) {
      Alert.alert('Herstel mislukt', error.message);
      return;
    }
    Alert.alert(
      'Check je mail',
      `Als er een account bij ${email} hoort, ontvang je een mail met een link om je wachtwoord opnieuw in te stellen.`
    );
  };

  const labelStyle = (anim: Animated.Value, hasError: boolean) => ({
    position: 'absolute' as const,
    left: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 12] }),
    top: anim.interpolate({ inputRange: [0, 1], outputRange: [14, -8] }),
    fontSize: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 11] }),
    color: hasError
      ? '#DC2626'
      : anim.interpolate({ inputRange: [0, 1], outputRange: [C.textSubtle, C.navy] }),
    backgroundColor: C.bg,
    paddingHorizontal: 4,
    fontFamily: C.fontSans,
    fontWeight: '600' as const,
    zIndex: 1,
  });

  const Hero = (
    <View style={[styles.hero, !isDesktop && styles.hidden]}>
      <Text style={styles.heroEyebrow}>WKB · GEVOLGKLASSE 1</Text>
      <Text style={styles.heroHeadline}>
        Borging zonder{'\n'}
        Excel-soep.{'\n'}
        <Text style={{ color: C.green }}>Eén foto, klaar.</Text>
      </Text>
      <Text style={styles.heroBody}>
        De vakman maakt een foto, SpeeQ doet de rest — AI-validatie,
        GPS, dossier-opbouw, push naar KiK. Honderden bouwbedrijven
        werken al met SpeeQ.
      </Text>
      <View style={styles.heroTrust}>
        <View style={styles.trustItem}>
          <ShieldCheck size={16} color={C.green} />
          <Text style={styles.trustText}>Offline-first</Text>
        </View>
        <View style={styles.trustItem}>
          <Lock size={16} color={C.green} />
          <Text style={styles.trustText}>Supabase auth</Text>
        </View>
        <View style={styles.trustItem}>
          <CloudUpload size={16} color={C.green} />
          <Text style={styles.trustText}>Auto-sync</Text>
        </View>
      </View>
    </View>
  );

  const LoginCard = (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Welkom terug</Text>
      <Text style={styles.cardSub}>Log in om verder te gaan.</Text>

      <View style={[styles.field, { marginTop: 22 }]}>
        <Animated.Text style={labelStyle(emailLabelAnim, !emailValid && !!email)}>
          E-mailadres
        </Animated.Text>
        <TextInput
          style={[styles.input, !emailValid && email ? styles.inputError : null]}
          value={email}
          onChangeText={handleEmailChange}
          onFocus={() => setEmailFocused(true)}
          onBlur={() => setEmailFocused(false)}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          editable={!loading}
        />
        {!emailValid && email ? (
          <Text style={styles.errorText}>Vul een geldig e-mailadres in</Text>
        ) : null}
      </View>

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
        />
        <TouchableOpacity
          style={styles.eyeBtn}
          onPress={() => setShowPassword((v) => !v)}
        >
          {showPassword ? <EyeOff size={18} color={C.textSubtle} /> : <Eye size={18} color={C.textSubtle} />}
        </TouchableOpacity>
      </View>

      <View style={styles.optionsRow}>
        <Pressable onPress={() => setRememberMe(!rememberMe)} style={styles.remember}>
          <View style={[styles.checkbox, rememberMe && styles.checkboxOn]}>
            {rememberMe ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
          <Text style={styles.rememberText}>Onthoud mij</Text>
        </Pressable>
        <Pressable onPress={handleForgotPassword} disabled={loading}>
          <Text style={styles.forgot}>Wachtwoord vergeten?</Text>
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.cta,
          (loading || (submitted && (!email || !password || !emailValid))) && styles.ctaDisabled,
          pressed && styles.ctaPressed,
        ]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.ctaText}>Inloggen</Text>
        )}
      </Pressable>

      {DEMO_LOGIN_ENABLED && DEMO_ACCOUNTS.length > 0 ? (
        <>
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>of demo</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.demoRow}>
            {DEMO_ACCOUNTS.map((acc) => (
              <Pressable
                key={acc.email}
                style={({ pressed }) => [styles.demoBtn, pressed && { opacity: 0.7 }]}
                onPress={() => handleQuickLogin(acc)}
                disabled={loading}
              >
                <Text style={styles.demoEmoji}>{acc.emoji}</Text>
                <Text style={styles.demoText}>{acc.role}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {onDevBypass ? (
        <Pressable
          style={({ pressed }) => [styles.devBtn, pressed && { opacity: 0.6 }]}
          onPress={onDevBypass}
          disabled={loading}
        >
          <Text style={styles.devBtnText}>
            🛠 Lokale dev-bypass (localhost only) →
          </Text>
        </Pressable>
      ) : null}

      <Text style={styles.footer}>
        Veilig via Supabase · Spee Solutions 2026
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <Image source={speeqQLogo} style={styles.brandLogo} resizeMode="contain" />
          <Text style={styles.brandText}>
            Spee<Text style={{ color: C.green }}>Q</Text>
          </Text>
          <Text style={styles.brandSub}>WKB Tool</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={isDesktop ? styles.desktopGrid : styles.mobileStack}>
          {Hero}
          {LoginCard}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  hidden: { display: 'none' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 36,
    paddingTop: 20,
    paddingBottom: 12,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandLogo: { width: 32, height: 32 },
  brandText: {
    fontFamily: C.fontDisplay,
    fontWeight: '800',
    fontSize: 18,
    color: '#0F2436',
    letterSpacing: -0.4,
  },
  brandSub: {
    fontFamily: C.fontSans,
    fontSize: 11,
    color: C.textSubtle,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 56,
  },
  desktopGrid: {
    flex: 1,
    flexDirection: 'row',
    gap: 56,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 24,
    maxWidth: 1240,
    width: '100%',
    alignSelf: 'center',
  },
  mobileStack: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 32,
  },
  hero: {
    flex: 1.05,
    borderRadius: 32,
    padding: 52,
    minHeight: 520,
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ backgroundImage: C.heroGradient } as object)
      : { backgroundColor: '#F0EEE8' }),
  },
  heroEyebrow: {
    fontFamily: C.fontSans,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: C.navy,
    marginBottom: 14,
  },
  heroHeadline: {
    fontFamily: C.fontDisplay,
    fontSize: 52,
    fontWeight: '700',
    color: C.textStrong,
    letterSpacing: -1.8,
    lineHeight: 54,
    maxWidth: 520,
  },
  heroBody: {
    fontFamily: C.fontSans,
    marginTop: 18,
    fontSize: 16,
    color: C.textMuted,
    maxWidth: 460,
    lineHeight: 24,
  },
  heroTrust: {
    flexDirection: 'row',
    gap: 28,
    marginTop: 24,
    flexWrap: 'wrap',
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trustText: {
    fontFamily: C.fontSans,
    fontSize: 13,
    color: C.textMuted,
    fontWeight: '500',
  },
  card: {
    flex: 0.95,
    maxWidth: 440,
    width: '100%',
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
  cardTitle: {
    fontFamily: C.fontDisplay,
    fontSize: 26,
    fontWeight: '700',
    color: C.textStrong,
    letterSpacing: -0.7,
  },
  cardSub: {
    fontFamily: C.fontSans,
    fontSize: 14,
    color: C.textSubtle,
    marginTop: 6,
  },
  field: { position: 'relative', marginTop: 16 },
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
    color: '#DC2626',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  eyeBtn: { position: 'absolute', right: 12, top: 14, padding: 4 },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  remember: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: C.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg,
  },
  checkboxOn: { backgroundColor: C.navy, borderColor: C.navy },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '900' },
  rememberText: {
    fontFamily: C.fontSans,
    color: C.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  forgot: {
    fontFamily: C.fontSans,
    color: C.navy,
    fontSize: 13,
    fontWeight: '600',
  },
  cta: {
    backgroundColor: C.navy,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
    ...(Platform.OS === 'web'
      ? ({
          transitionProperty: 'background-color, transform',
          transitionDuration: '180ms',
        } as object)
      : {}),
  },
  ctaDisabled: { opacity: 0.55 },
  ctaPressed: {
    backgroundColor: C.navyHover,
    transform: [{ scale: 0.99 }],
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: C.fontSans,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
    marginBottom: 14,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: {
    fontFamily: C.fontSans,
    color: C.textSubtle,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  demoRow: { flexDirection: 'row', gap: 10 },
  demoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg,
  },
  demoEmoji: { fontSize: 16 },
  demoText: {
    fontFamily: C.fontSans,
    color: C.text,
    fontSize: 13,
    fontWeight: '700',
  },
  devBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  devBtnText: {
    fontFamily: C.fontSans,
    color: C.textSubtle,
    fontSize: 12,
    fontWeight: '500',
  },
  footer: {
    fontFamily: C.fontSans,
    marginTop: 18,
    textAlign: 'center',
    fontSize: 11,
    color: C.textSubtle,
  },
});
