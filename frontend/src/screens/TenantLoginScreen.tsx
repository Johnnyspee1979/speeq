import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { setTenantConfig } from '../config/tenant';
import { initSupabase } from '../lib/supabase';
import { BACKEND_URL } from '../config/app';

interface Props {
  onLoginSuccess: () => void;
}

export default function TenantLoginScreen({ onLoginSuccess }: Props) {
  const [companyId, setCompanyId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!companyId.trim()) {
      setError('Vul een Bedrijfs-ID in');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/tenants/resolve/${companyId}`);
      const result = await response.json();
      
      if (result.success) {
        const { supabaseUrl, supabaseAnonKey } = result.data;
        await setTenantConfig({ companyId, supabaseUrl, supabaseAnonKey });
        initSupabase(supabaseUrl, supabaseAnonKey);
        onLoginSuccess();
      } else {
        setError(result.error || 'Er ging iets mis.');
      }
    } catch (e) {
      setError('Kan de Master server niet bereiken.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SpeeQ</Text>
      <Text style={styles.subtitle}>Log in met je Structura Wkb licentie</Text>
      
      <View style={styles.card}>
        <Text style={styles.label}>Bedrijfs-ID</Text>
        <TextInput 
          style={styles.input}
          placeholder="Bijv. demo"
          placeholderTextColor="#666"
          value={companyId}
          onChangeText={setCompanyId}
          autoCapitalize="none"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        
        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verbinden</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0B0F19' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#888', textAlign: 'center', marginBottom: 32 },
  card: { backgroundColor: '#1E2433', padding: 24, borderRadius: 12 },
  label: { color: '#fff', marginBottom: 8, fontSize: 14, fontWeight: 'bold' },
  input: { backgroundColor: '#0B0F19', color: '#fff', padding: 12, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#333' },
  button: { backgroundColor: '#A40D2F', padding: 14, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  error: { color: '#ff4444', marginBottom: 16 }
});
