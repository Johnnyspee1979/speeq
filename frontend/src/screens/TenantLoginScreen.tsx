import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { initSupabase } from '../lib/supabase';
import { setTenantConfig } from '../config/tenant';
import { BACKEND_URL } from '../config/app';
import { useTheme } from '../theme/ThemeProvider';
import { PrimaryButton } from '../components/ui/PrimaryButton';

interface Props {
  onLoginSuccess: () => void;
}

export default function TenantLoginScreen({ onLoginSuccess }: Props) {
  const { theme } = useTheme();
  const [companyId, setCompanyId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    const id = companyId.trim();
    if (!id) {
      setError('Vul je Bedrijfs-ID in');
      inputRef.current?.focus();
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/tenants/resolve/${encodeURIComponent(id)}`);
      const result = await res.json();

      if (result.success) {
        const { supabaseUrl, supabaseAnonKey } = result.data;
        await setTenantConfig({ companyId: id, supabaseUrl, supabaseAnonKey });
        initSupabase(supabaseUrl, supabaseAnonKey);
        onLoginSuccess();
      } else {
        setError(result.error ?? 'Bedrijfs-ID niet gevonden. Controleer je licentie.');
      }
    } catch {
      setError('Geen verbinding met de server. Controleer je internet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.outer, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        {/* Logo + serif merk-titel */}
        <View style={styles.logoRow}>
          <View style={[styles.logoBadge, { backgroundColor: theme.colors.textPrimary }]}>
            <Text style={[styles.logoText, { color: theme.colors.background }]}>W</Text>
          </View>
          <Text
            style={[
              styles.appName,
              {
                fontFamily: theme.typography.headline.fontFamily,
                fontWeight: theme.typography.headline.fontWeight,
                fontStyle: theme.typography.headline.fontStyle,
                color: theme.colors.textPrimary,
              },
            ]}
          >
            WKB Snap & Sync
          </Text>
        </View>
        <Text
          style={[
            styles.tagline,
            {
              fontFamily: theme.typography.bodyData.fontFamily,
              color: theme.colors.textSecondary,
            },
          ]}
        >
          Voer je Bedrijfs-ID in om te verbinden
        </Text>

        {/* Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderWarm,
            },
          ]}
        >
          <Text
            style={[
              styles.label,
              {
                fontFamily: theme.typography.caption.fontFamily,
                color: theme.colors.textMuted,
              },
            ]}
          >
            BEDRIJFS-ID
          </Text>
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.background,
                color: theme.colors.textPrimary,
                borderColor: theme.colors.borderWarm,
              },
            ]}
            placeholder="bijv. demo"
            placeholderTextColor={theme.colors.textMuted}
            value={companyId}
            onChangeText={(v) => { setCompanyId(v); setError(''); }}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={handleLogin}
            editable={!loading}
          />

          {error ? (
            <View
              style={[
                styles.errorBox,
                {
                  backgroundColor: theme.colors.statusWarning,
                  borderColor: theme.colors.borderWarm,
                },
              ]}
            >
              <Text style={[styles.errorText, { color: theme.colors.textPrimary }]}>
                ⚠ {error}
              </Text>
            </View>
          ) : null}

          <PrimaryButton
            label="Verbinden →"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
          />
        </View>

        <Text
          style={[
            styles.footer,
            {
              fontFamily: theme.typography.caption.fontFamily,
              color: theme.colors.textMuted,
            },
          ]}
        >
          Geen licentie?{' '}
          <Text style={{ color: theme.colors.textSecondary, textDecorationLine: 'underline' }}>
            Neem contact op met Spee Solutions
          </Text>
        </Text>
      </View>

      {loading ? <ActivityIndicator color={theme.colors.textPrimary} style={{ marginTop: 12 }} /> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    padding: 28,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 22,
    fontWeight: '900',
  },
  appName: {
    fontSize: 28,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 36,
  },
  card: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    marginBottom: 24,
    flexDirection: 'column',
    gap: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  input: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 16,
    letterSpacing: 1,
  },
  errorBox: {
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  footer: {
    fontSize: 13,
    textAlign: 'center',
  },
});
