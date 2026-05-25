import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme/ThemeProvider';

const speeqLogoFull = require('../assets/speeq-logo-full.png');
const speeqQLogo = require('../assets/speeq-q-logo.png');

interface LoginScreenProps {
  onDevBypass?: () => void;
}

/**
 * Demo-quick-logins voor live productie-demo's (Johnny 25 mei).
 * Echte test-accounts in Supabase combivo tenant — geen geheime data,
 * alleen voor showcase. Knoppen verschijnen onder de inlog-form en
 * vullen + submitten direct.
 */
const DEMO_ACCOUNTS: ReadonlyArray<{ role: string; emoji: string; email: string; password: string }> = [
  { role: 'Vakman',           emoji: '👷', email: 'vakman@combivo.nl',       password: 'combivo2026' },
  { role: 'Werkvoorbereider', emoji: '🛠️', email: 'johnny@speesolutions.com', password: 'Val7118!?' },
];

export default function LoginScreen({ onDevBypass }: LoginScreenProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  /** Quick-login: tap rol-knop en log direct in. Voor demo's. */
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
    // Bij succes: supabase triggert auth-state change → App.tsx rerendert
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Fout', 'Vul zowel e-mail als wachtwoord in.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      Alert.alert('Inloggen mislukt', error.message);
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Subtiele Q-watermark, "Dutch Govtech" rust */}
      <View style={styles.watermark} pointerEvents="none">
        <Image
          source={speeqQLogo}
          style={styles.watermarkImage}
          resizeMode="contain"
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.headerContainer}>
            <Image
              source={speeqLogoFull}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Inloggen</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>E-mailadres</Text>
            <TextInput
              style={styles.input}
              placeholder="naam@bedrijf.nl"
              placeholderTextColor={theme.colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!loading}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Wachtwoord</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={theme.colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              (loading || pressed) && styles.buttonDisabled,
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Inloggen</Text>
            )}
          </Pressable>

          {/* Demo-quick-login knoppen — altijd zichtbaar (de accounts
              zijn echte test-users, geen geheime data). Onder de "of"-lijn
              voor visuele scheiding van de echte inlog. */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>of demo</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.quickLoginRow}>
            {DEMO_ACCOUNTS.map((acc) => (
              <Pressable
                key={acc.email}
                style={({ pressed }) => [
                  styles.quickLoginBtn,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => handleQuickLogin(acc)}
                disabled={loading}
                accessibilityLabel={`Demo-login als ${acc.role}`}
              >
                <Text style={styles.quickLoginEmoji}>{acc.emoji}</Text>
                <Text style={styles.quickLoginText}>{acc.role}</Text>
              </Pressable>
            ))}
          </View>

          {onDevBypass ? (
            <Pressable
              style={({ pressed }) => [
                styles.devButton,
                pressed && { opacity: 0.6 },
              ]}
              onPress={onDevBypass}
              disabled={loading}
            >
              <Text style={styles.devButtonText}>
                🛠 Lokale dev-bypass (localhost only) →
              </Text>
            </Pressable>
          ) : null}

          <View style={styles.footer}>
            <View style={styles.footerDot} />
            <Text style={styles.footerText}>
              Veilig ingelogd via Supabase · Spee Solutions 2026
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
    watermarkImage: {
      width: '100%',
      height: '100%',
    },
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
    headerContainer: {
      alignItems: 'flex-start',
      marginBottom: 28,
    },
    logo: {
      height: 64,
      width: 220,
      marginBottom: 20,
      marginLeft: -8, // optisch uitlijnen met label
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
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      letterSpacing: -0.4,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 21,
      color: theme.colors.textSecondary,
    },
    field: {
      marginBottom: 16,
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
    button: {
      backgroundColor: theme.colors.accent,
      borderRadius: 10,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      shadowColor: theme.colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 3,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 22,
      marginBottom: 14,
      gap: 10,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.border,
    },
    dividerText: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    quickLoginRow: {
      flexDirection: 'row',
      gap: 10,
    },
    quickLoginBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    quickLoginEmoji: {
      fontSize: 18,
    },
    quickLoginText: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    devButton: {
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 14,
    },
    devButtonText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontWeight: '500',
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 24,
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
