import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { initSupabase } from '../lib/supabase';
import { setTenantConfig } from '../config/tenant';
import { BACKEND_URL } from '../config/app';

interface Props {
  onLoginSuccess: () => void;
}

export default function TenantLoginScreen({ onLoginSuccess }: Props) {
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
      style={styles.outer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        {/* Logo / merk */}
        <View style={styles.logoRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>W</Text>
          </View>
          <Text style={styles.appName}>WKB Snap & Sync</Text>
        </View>
        <Text style={styles.tagline}>Voer je Bedrijfs-ID in om te verbinden</Text>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.label}>Bedrijfs-ID</Text>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="bijv. demo"
            placeholderTextColor="#555"
            value={companyId}
            onChangeText={(v) => { setCompanyId(v); setError(''); }}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={handleLogin}
            editable={!loading}
          />

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️  {error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Verbinden →</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          Geen licentie?{' '}
          <Text style={styles.footerLink}>Neem contact op met Spee Solutions</Text>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },

  // Logo
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
    backgroundColor: '#A40D2F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
  },
  appName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tagline: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 36,
  },

  // Card
  card: {
    backgroundColor: '#161B2C',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginBottom: 24,
  },
  label: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0B0F19',
    color: '#F9FAFB',
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
  },
  errorBox: {
    backgroundColor: '#7F1D1D22',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EF444440',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    backgroundColor: '#A40D2F',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.3,
  },

  // Footer
  footer: {
    color: '#4B5563',
    fontSize: 13,
    textAlign: 'center',
  },
  footerLink: {
    color: '#6B7280',
    textDecorationLine: 'underline',
  },
});
