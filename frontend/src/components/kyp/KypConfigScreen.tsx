// frontend/src/components/kyp/KypConfigScreen.tsx
//
// KEYUSER/ADMIN-scherm: KYP-token invoeren, verbinding testen en het huidige
// SpeeQ-project aan een KYP-project koppelen. Schrijven gaat via KypService en
// is in de DB door RLS beperkt tot de juiste rollen.
//
// Het token wordt door de gebruiker zélf ingevoerd (nooit auto-fill) en
// gemaskeerd weergegeven zodra het is opgeslagen.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { PrimaryButton } from '../ui/PrimaryButton';
import { SecondaryButton } from '../ui/SecondaryButton';
import {
  getKypConfig,
  getProjectMapping,
  getProjects,
  pingApi,
  saveKypConfig,
  saveProjectMapping,
  type KypProject,
} from '../../services/KypService';

interface KypConfigScreenProps {
  /** Het SpeeQ-project dat we (optioneel) aan een KYP-project koppelen. */
  speeqProjectId?: string;
}

type PingState =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'ok'; projectCount: number }
  | { kind: 'error'; message: string };

const BASE_URL = 'https://kyp.nl/rest';

export const KypConfigScreen = ({ speeqProjectId }: KypConfigScreenProps) => {
  const { theme } = useTheme();

  const [token, setToken] = useState('');
  const [hasStoredToken, setHasStoredToken] = useState(false);
  const [savingToken, setSavingToken] = useState(false);
  const [ping, setPing] = useState<PingState>({ kind: 'idle' });

  const [projects, setProjects] = useState<KypProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedKypId, setSelectedKypId] = useState<number | null>(null);
  const [savingMapping, setSavingMapping] = useState(false);
  const [mappingMsg, setMappingMsg] = useState<string | null>(null);

  // Bestaande config + koppeling inladen.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cfg = await getKypConfig();
      if (cancelled) return;
      if (cfg) setHasStoredToken(true);
      if (speeqProjectId) {
        const mapping = await getProjectMapping(speeqProjectId);
        if (!cancelled && mapping) setSelectedKypId(mapping.kypProjectId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [speeqProjectId]);

  const onSaveToken = useCallback(async () => {
    setSavingToken(true);
    setPing({ kind: 'idle' });
    const res = await saveKypConfig(token, BASE_URL);
    setSavingToken(false);
    if (res.ok) {
      setHasStoredToken(true);
      setToken('');
    } else {
      setPing({ kind: 'error', message: res.error });
    }
  }, [token]);

  const onTestConnection = useCallback(async () => {
    setPing({ kind: 'testing' });
    // Test met het zojuist ingevoerde token, of met het opgeslagen token.
    let activeToken = token.trim();
    if (!activeToken) {
      const cfg = await getKypConfig();
      activeToken = cfg?.token ?? '';
    }
    if (!activeToken) {
      setPing({ kind: 'error', message: 'Geen token om te testen.' });
      return;
    }
    const res = await pingApi(activeToken, BASE_URL);
    if (res.ok) {
      setPing({ kind: 'ok', projectCount: res.data.projectCount });
    } else {
      setPing({ kind: 'error', message: res.error });
    }
  }, [token]);

  const onLoadProjects = useCallback(async () => {
    setLoadingProjects(true);
    setMappingMsg(null);
    const cfg = await getKypConfig();
    const activeToken = token.trim() || cfg?.token || '';
    if (!activeToken) {
      setMappingMsg('Sla eerst een token op.');
      setLoadingProjects(false);
      return;
    }
    const res = await getProjects(activeToken, BASE_URL);
    setLoadingProjects(false);
    if (res.ok) {
      setProjects(res.data);
    } else {
      setMappingMsg(res.error);
    }
  }, [token]);

  const onSaveMapping = useCallback(async () => {
    if (!speeqProjectId || selectedKypId == null) return;
    setSavingMapping(true);
    setMappingMsg(null);
    const picked = projects.find((p) => p.id === selectedKypId);
    const res = await saveProjectMapping(
      speeqProjectId,
      selectedKypId,
      picked?.name ?? null,
    );
    setSavingMapping(false);
    setMappingMsg(res.ok ? 'Koppeling opgeslagen.' : res.error);
  }, [speeqProjectId, selectedKypId, projects]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      {/* ── Token ── */}
      <Text style={[styles.section, { color: theme.colors.textPrimary }]}>
        KYP-token
      </Text>
      <Text style={[styles.help, { color: theme.colors.textSecondary }]}>
        Plak hier het persoonlijke KYP access-token (van een gebruiker met de
        rol Projectmanager). Het wordt veilig in jouw eigen Supabase opgeslagen,
        nooit in code of e-mail.
      </Text>

      {hasStoredToken ? (
        <View
          style={[
            styles.storedBadge,
            { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border },
          ]}
        >
          <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
            ✓ Er is een token opgeslagen (•••• verborgen). Plak een nieuw token
            om het te vervangen.
          </Text>
        </View>
      ) : null}

      <TextInput
        value={token}
        onChangeText={setToken}
        placeholder="Bearer access-token"
        placeholderTextColor={theme.colors.textSecondary}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          styles.input,
          {
            borderColor: theme.colors.border,
            color: theme.colors.textPrimary,
            backgroundColor: theme.colors.surface,
          },
        ]}
      />

      <View style={styles.buttonRow}>
        <PrimaryButton
          label="Token opslaan"
          loading={savingToken}
          disabled={!token.trim()}
          onPress={onSaveToken}
          size="sm"
        />
        <SecondaryButton title="Verbinding testen" onPress={onTestConnection} />
      </View>

      {ping.kind === 'testing' ? (
        <View style={styles.pingRow}>
          <ActivityIndicator color={theme.colors.accent} size="small" />
          <Text style={[styles.pingText, { color: theme.colors.textSecondary }]}>
            Bezig met testen…
          </Text>
        </View>
      ) : null}
      {ping.kind === 'ok' ? (
        <Text style={[styles.pingText, { color: theme.colors.success }]}>
          ✓ Verbonden — {ping.projectCount} project(en) gevonden.
        </Text>
      ) : null}
      {ping.kind === 'error' ? (
        <Text style={[styles.pingText, { color: theme.colors.danger }]}>
          {ping.message}
        </Text>
      ) : null}

      {/* ── Project-koppeling ── */}
      {speeqProjectId ? (
        <View style={{ marginTop: 28 }}>
          <Text style={[styles.section, { color: theme.colors.textPrimary }]}>
            Koppel aan KYP-project
          </Text>
          <Text style={[styles.help, { color: theme.colors.textSecondary }]}>
            Kies welk KYP-project bij dit SpeeQ-project hoort. De planning wordt
            daarna automatisch geladen.
          </Text>

          <SecondaryButton
            title={loadingProjects ? 'Laden…' : 'Laad KYP-projecten'}
            onPress={onLoadProjects}
            disabled={loadingProjects}
          />

          <View style={{ marginTop: 12 }}>
            {projects.map((p) => {
              const selected = p.id === selectedKypId;
              return (
                <TouchableOpacity
                  key={p.id}
                  activeOpacity={0.8}
                  onPress={() => setSelectedKypId(p.id)}
                  style={[
                    styles.projectRow,
                    {
                      borderColor: selected ? theme.colors.accent : theme.colors.border,
                      backgroundColor: selected
                        ? theme.colors.surfaceAlt
                        : theme.colors.surface,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: theme.colors.textPrimary,
                      fontWeight: selected ? '700' : '500',
                      fontSize: 14,
                    }}
                  >
                    {selected ? '● ' : '○ '}
                    {p.name}
                  </Text>
                  {p.status ? (
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                      {p.status}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedKypId != null ? (
            <View style={{ marginTop: 12 }}>
              <PrimaryButton
                label="Koppeling opslaan"
                loading={savingMapping}
                onPress={onSaveMapping}
                size="sm"
              />
            </View>
          ) : null}

          {mappingMsg ? (
            <Text style={[styles.pingText, { color: theme.colors.textSecondary }]}>
              {mappingMsg}
            </Text>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { fontSize: 17, fontWeight: '700', marginBottom: 6 },
  help: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  pingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  pingText: { fontSize: 13, marginTop: 10 },
  storedBadge: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
});
