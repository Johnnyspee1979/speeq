import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme/ThemeProvider';
import { APP_TITLE } from '../config/app';

interface LoginScreenProps {
  onDevBypass?: () => void;
}

export default function LoginScreen({ onDevBypass }: LoginScreenProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
      <View style={styles.card}>
        <View style={styles.headerContainer}>
          <Image
             source={require('../../assets/logo-spee.png')}
             style={styles.logo}
             resizeMode="contain"
          />
          <Text style={styles.title}>{APP_TITLE}</Text>
          <Text style={styles.subtitle}>Kwaliteitsborging Powered by Spee Solutions 2026.</Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="E-mailadres"
          placeholderTextColor={theme.colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Wachtwoord"
          placeholderTextColor={theme.colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />

        <Pressable
          style={({ pressed }) => [styles.button, (loading || pressed) && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.background} />
          ) : (
            <Text style={styles.buttonText}>Inloggen</Text>
          )}
        </Pressable>

        {onDevBypass ? (
          <Pressable
            style={({ pressed }) => [styles.devButton, pressed && { opacity: 0.7 }]}
            onPress={onDevBypass}
            disabled={loading}
          >
            <Text style={styles.devButtonText}>Snel Toegang (Demo)</Text>
          </Pressable>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) => 
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      justifyContent: 'center',
      padding: 24,
    },
    card: {
      backgroundColor: theme.colors.surface,
      padding: 24,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 24,
      elevation: 5,
    },
    headerContainer: {
      alignItems: 'center',
      marginBottom: 32,
    },
    logo: {
      height: 85,
      width: 280,
      marginBottom: 20,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      color: theme.colors.textSecondary,
    },
    input: {
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      fontSize: 16,
      color: theme.colors.textPrimary,
    },
    button: {
      backgroundColor: theme.colors.accent,
      borderRadius: 12,
      padding: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
    },
    devButton: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 12,
      padding: 18,
      alignItems: 'center',
      marginTop: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    devButtonText: {
      color: theme.colors.textSecondary,
      fontSize: 16,
      fontWeight: '700',
    },
  });
