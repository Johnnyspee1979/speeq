/**
 * JoinScreen — vakman maakt account aan via uitnodigingslink.
 *
 * URL: /?join=TOKEN
 *
 * Flow:
 *  1. Ophalen invite-data via invite_token in profiles-tabel
 *  2. Tonen: welkomst, disciplines (readonly), naam + wachtwoord formulier
 *  3. supabase.auth.signUp → profiel bijwerken → redirect naar /
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme/ThemeProvider';
import { APP_TITLE } from '../config/app';

// Discipline labels
const DISCIPLINE_LABELS: Record<string, string> = {
  BOUW:            '🏗️ Bouw',
  BOUWFYSICA:      '🌡️ Bouwfysica',
  BRANDVEILIGHEID: '🔥 Brandveiligheid',
  INSTALLATIE:     '🔧 Installatie',
  ELEKTRA:         '⚡ Elektra',
  AFBOUW_SCHILDER: '🖌️ Afbouw & Schilder',
};

interface InviteData {
  displayName?: string | null;
  disciplines: string[];
  jobType?: string | null;
  email?: string | null;
  projectIds: string[];
  projectNames: string[];
}

interface JoinScreenProps {
  token: string;
}

export default function JoinScreen({ token }: JoinScreenProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Ophalen invite-data
  useEffect(() => {
    const loadInvite = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('display_name, disciplines, job_type, invite_accepted_at, project_ids')
          .eq('invite_token', token)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          setInviteError('Deze uitnodigingslink is ongeldig of verlopen.');
          return;
        }

        if (data.invite_accepted_at) {
          setInviteError('Deze uitnodigingslink is al gebruikt. Log in met je bestaande account.');
          return;
        }

        const projectIds = (data.project_ids as string[]) ?? [];

        // Probeer projectnamen op te halen (kan falen als anon geen toegang heeft)
        let projectNames: string[] = [];
        if (projectIds.length > 0) {
          try {
            const { data: projectRows } = await supabase
              .from('projects')
              .select('id, name')
              .in('id', projectIds);
            if (projectRows) {
              projectNames = projectIds.map((pid) => {
                const found = projectRows.find((r) => r.id === pid);
                return (found?.name as string | null) ?? pid;
              });
            }
          } catch {
            // Anon heeft mogelijk geen toegang — toon dan alleen het aantal
          }
        }

        setInviteData({
          displayName: data.display_name ?? null,
          disciplines: (data.disciplines as string[]) ?? [],
          jobType: data.job_type ?? null,
          projectIds,
          projectNames,
        });

        if (data.display_name) {
          setName(data.display_name);
        }
      } catch (err: any) {
        setInviteError(err?.message ?? 'Kon uitnodiging niet laden. Controleer je verbinding.');
      } finally {
        setLoadingInvite(false);
      }
    };

    void loadInvite();
  }, [token]);

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Fout', 'Vul je e-mailadres in.');
      return;
    }
    if (!password || password.length < 6) {
      Alert.alert('Fout', 'Wachtwoord moet minimaal 6 tekens zijn.');
      return;
    }
    if (password !== passwordConfirm) {
      Alert.alert('Fout', 'Wachtwoorden komen niet overeen.');
      return;
    }

    setSubmitting(true);

    try {
      // Account aanmaken
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { display_name: name.trim() || undefined },
        },
      });

      if (signUpError) throw signUpError;

      const userId = signUpData.user?.id;

      if (userId) {
        // Claim de uitnodigingsrij: verander het placeholder-id naar het echte auth-id.
        // De RLS policy "invite_accept_update" staat dit toe als:
        //  - de rij een invite_token heeft
        //  - invite_accepted_at nog null is
        //  - het nieuwe id = auth.uid()
        const { error: claimError } = await supabase
          .from('profiles')
          .update({
            id: userId,
            email: email.trim().toLowerCase(),
            display_name: name.trim() || null,
            invite_accepted_at: new Date().toISOString(),
          })
          .eq('invite_token', token)
          .is('invite_accepted_at', null);

        if (claimError) {
          // Fallback: als claim mislukt (bijv. al geaccepteerd), gewoon upsert
          await supabase.from('profiles').upsert({
            id: userId,
            email: email.trim().toLowerCase(),
            display_name: name.trim() || null,
            disciplines: inviteData?.disciplines ?? [],
            job_type: inviteData?.jobType ?? 'VAKMAN',
            invite_accepted_at: new Date().toISOString(),
            company_name: '',
          });
        }
      }

      setDone(true);
    } catch (err: any) {
      Alert.alert('Registratie mislukt', err?.message ?? 'Probeer het opnieuw.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Laden ──────────────────────────────────────────
  if (loadingInvite) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={styles.loadingText}>Uitnodiging laden…</Text>
      </View>
    );
  }

  // ── Fout ───────────────────────────────────────────
  if (inviteError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorIcon}>❌</Text>
        <Text style={styles.errorTitle}>Uitnodiging ongeldig</Text>
        <Text style={styles.errorText}>{inviteError}</Text>
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/';
            }
          }}
        >
          <Text style={styles.loginBtnText}>Ga naar inloggen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Klaar ──────────────────────────────────────────
  if (done) {
    return (
      <View style={styles.centered}>
        <Text style={styles.doneIcon}>🎉</Text>
        <Text style={styles.doneTitle}>Account aangemaakt!</Text>
        <Text style={styles.doneText}>
          Je kunt nu inloggen met je e-mailadres en wachtwoord.
        </Text>
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/';
            }
          }}
        >
          <Text style={styles.loginBtnText}>Inloggen →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Registratieformulier ──────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>UITNODIGING — WKB SNAP & SYNC</Text>
          <Text style={styles.title}>
            {inviteData?.displayName
              ? `Welkom, ${inviteData.displayName.split(' ')[0]}! 👋`
              : `Welkom! 👋`}
          </Text>
          <Text style={styles.subtitle}>
            Je bent uitgenodigd om foto-bewijsstukken te registreren op de bouwplaats. Maak hieronder je account aan — dat duurt 30 seconden.
          </Text>
        </View>

        {/* Project & disciplines (readonly) */}
        {inviteData ? (
          <View style={styles.disciplinesBox}>
            {/* Project(en) */}
            {inviteData.projectIds.length > 0 ? (
              <>
                <Text style={styles.disciplinesLabel}>TOEGEWEZEN PROJECT</Text>
                <View style={styles.disciplinesRow}>
                  {(inviteData.projectNames.length > 0 ? inviteData.projectNames : inviteData.projectIds).map((name, i) => (
                    <View
                      key={i}
                      style={[styles.disciplineChip, { backgroundColor: 'rgba(8,145,178,0.15)' }]}
                    >
                      <Text style={[styles.disciplineChipText, { color: '#0891b2' }]}>
                        📁 {name}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <Text style={[styles.disciplinesHint, { marginBottom: 8 }]}>
                ℹ️ Geen specifiek project ingesteld — je ziet alle projecten.
              </Text>
            )}

            {/* Disciplines */}
            {inviteData.disciplines.length > 0 ? (
              <>
                <Text style={[styles.disciplinesLabel, { marginTop: 10 }]}>JOUW DISCIPLINE</Text>
                <View style={styles.disciplinesRow}>
                  {inviteData.disciplines.map((d) => (
                    <View key={d} style={styles.disciplineChip}>
                      <Text style={styles.disciplineChipText}>
                        {DISCIPLINE_LABELS[d] ?? d}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            <Text style={styles.disciplinesHint}>
              Je ziet alleen de borgingspunten die bij jouw discipline horen.
            </Text>
          </View>
        ) : null}

        {/* Formulier */}
        <View style={styles.form}>
          <Text style={styles.fieldLabel}>NAAM</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Jouw volledige naam"
            placeholderTextColor={theme.colors.textSecondary + '88'}
            autoCapitalize="words"
            autoComplete="name"
          />

          <Text style={styles.fieldLabel}>E-MAILADRES</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="jouw@email.nl"
            placeholderTextColor={theme.colors.textSecondary + '88'}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <Text style={styles.fieldLabel}>WACHTWOORD</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Minimaal 6 tekens"
            placeholderTextColor={theme.colors.textSecondary + '88'}
            secureTextEntry
            autoComplete="new-password"
          />

          <Text style={styles.fieldLabel}>WACHTWOORD BEVESTIGEN</Text>
          <TextInput
            style={styles.input}
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            placeholder="Herhaal wachtwoord"
            placeholderTextColor={theme.colors.textSecondary + '88'}
            secureTextEntry
            autoComplete="new-password"
          />

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Account aanmaken →</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scroll: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 24,
      maxWidth: 480,
      alignSelf: 'center',
      width: '100%',
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      backgroundColor: theme.colors.background,
    },
    loadingText: { marginTop: 12, fontSize: 14, color: theme.colors.textSecondary },

    errorIcon: { fontSize: 40, marginBottom: 16 },
    errorTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 8 },
    errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 24 },
    loginBtn: {
      backgroundColor: theme.colors.accent,
      borderRadius: 12,
      paddingHorizontal: 24,
      paddingVertical: 12,
    },
    loginBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

    doneIcon: { fontSize: 48, marginBottom: 16 },
    doneTitle: { fontSize: 22, fontWeight: '900', color: theme.colors.textPrimary, marginBottom: 8 },
    doneText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 24 },

    header: { marginBottom: 24 },
    eyebrow: {
      fontSize: 10, fontWeight: '800', letterSpacing: 3,
      color: theme.colors.accent, marginBottom: 6,
    },
    title: { fontSize: 24, fontWeight: '900', color: theme.colors.textPrimary, marginBottom: 6 },
    subtitle: { fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20 },

    disciplinesBox: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    disciplinesLabel: {
      fontSize: 10, fontWeight: '800', letterSpacing: 2,
      color: theme.colors.textSecondary, marginBottom: 8,
    },
    disciplinesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    disciplineChip: {
      backgroundColor: theme.colors.accent + '22',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    disciplineChipText: { fontSize: 12, fontWeight: '700', color: theme.colors.accent },
    disciplinesHint: { fontSize: 11, color: theme.colors.textSecondary },

    form: { gap: 4 },
    fieldLabel: {
      fontSize: 10, fontWeight: '800', letterSpacing: 2,
      color: theme.colors.textSecondary, marginTop: 14, marginBottom: 6,
    },
    input: {
      height: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 14,
      fontSize: 15,
      color: theme.colors.textPrimary,
    },
    submitBtn: {
      marginTop: 24,
      height: 52,
      borderRadius: 14,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitBtnDisabled: { opacity: 0.6 },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  });
