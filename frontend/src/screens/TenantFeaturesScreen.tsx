/**
 * TenantFeaturesScreen — Keyuser/Admin kan hier modules van hun bedrijf
 * aan- of uitzetten. Wijzigingen zijn direct zichtbaar voor alle gebruikers
 * van dezelfde tenant.
 *
 * Wie mag wat:
 *   - SPEE (Maker): alles aan/uit, ook voor andere klanten via /maker
 *   - KEYUSER / ADMIN binnen de tenant: alleen hun eigen tenant
 *   - PROJECTLEIDER / overigen: alleen lezen
 *
 * RLS in `tenant_features` regelt de toegang op DB-niveau.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useWkbAuth } from '../hooks/useWkbAuth';
import {
  FEATURE_KEYS,
  FEATURE_META,
  getTenantFeatures,
  setTenantFeature,
  type FeatureKey,
} from '../services/TenantFeaturesService';
import { refreshTenantFeatures } from '../hooks/useTenantFeature';
import { getActiveTenantId } from '../config/tenant';
import { OfflineModeWizard } from '../components/ui/OfflineModeWizard';
import { OfflineStorageMeter } from '../components/ui/OfflineStorageMeter';

interface Props {
  onBack?: () => void;
}

export default function TenantFeaturesScreen({ onBack }: Props) {
  const { theme } = useTheme();
  const { user } = useWkbAuth();

  const [features, setFeatures] = useState<Record<FeatureKey, boolean>>(
    {} as Record<FeatureKey, boolean>,
  );
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<FeatureKey | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [wizardVisible, setWizardVisible] = useState(false);

  const tenantId = getActiveTenantId();
  const role = user?.role ?? null;
  const isKeyuserOrAdmin = role === 'KEYUSER' || role === 'ADMIN';
  const isMaker = user?.email === 'johnny@speesolutions.com' || user?.email === 'johnny@speesolutions.nl';
  const canWrite = isKeyuserOrAdmin || isMaker;

  const flash = useCallback((tone: 'ok' | 'err', text: string) => {
    setMessage({ tone, text });
    window.setTimeout(() => setMessage(null), 3500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getTenantFeatures();
      setFeatures(all);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const persistToggle = useCallback(async (key: FeatureKey, next: boolean) => {
    setBusyKey(key);
    // Optimistic update
    setFeatures(prev => ({ ...prev, [key]: next }));
    const result = await setTenantFeature(
      key,
      next,
      isMaker ? 'SPEE' : 'KEYUSER',
    );
    setBusyKey(null);
    if (!result.ok) {
      // Rollback
      setFeatures(prev => ({ ...prev, [key]: !next }));
      flash('err', result.error ?? 'Wijzigen mislukt.');
      return false;
    }
    flash('ok', `${FEATURE_META[key].label} ${next ? 'aangezet' : 'uitgezet'}.`);
    // Globale cache verversen zodat andere schermen reageren
    void refreshTenantFeatures();
    return true;
  }, [isMaker, flash]);

  const handleToggle = useCallback(async (key: FeatureKey, next: boolean) => {
    if (!canWrite) {
      flash('err', 'Alleen Keyuser of Admin mag modules aanpassen.');
      return;
    }
    // Speciale onboarding-wizard voor offline-mode bij aanzetten
    if (key === 'offline_mode' && next === true) {
      setWizardVisible(true);
      return;
    }
    await persistToggle(key, next);
  }, [canWrite, flash, persistToggle]);

  const handleWizardConfirm = useCallback(async () => {
    await persistToggle('offline_mode', true);
  }, [persistToggle]);

  const handleWizardClose = useCallback(() => {
    setWizardVisible(false);
  }, []);

  const styles = createStyles(theme);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backTxt}>← Terug</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.title}>🛠️ Modules</Text>
        <Text style={styles.subtitle}>
          Zet onderdelen van SpeeQ aan of uit voor je bedrijf
          {tenantId ? ` (${tenantId})` : ''}.
        </Text>
        {!canWrite ? (
          <View style={styles.readOnlyBanner}>
            <Text style={styles.readOnlyText}>
              👁️ Alleen-lezen — vraag de Keyuser om wijzigingen te maken.
            </Text>
          </View>
        ) : null}
      </View>

      {message ? (
        <View style={[
          styles.msg,
          { backgroundColor: message.tone === 'ok' ? '#dcfce7' : '#fee2e2' },
        ]}>
          <Text style={[
            styles.msgText,
            { color: message.tone === 'ok' ? '#166534' : '#991b1b' },
          ]}>
            {message.tone === 'ok' ? '✅' : '⚠️'} {message.text}
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={theme.colors.accent} />
          <Text style={styles.loadingText}>Modules laden...</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {FEATURE_KEYS.map(key => {
            const meta = FEATURE_META[key];
            const enabled = !!features[key];
            const busy = busyKey === key;
            return (
              <View key={key} style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={styles.icon}>{meta.icon}</Text>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{meta.label}</Text>
                    <Text style={styles.rowDesc}>{meta.description}</Text>
                  </View>
                </View>
                <View style={styles.rowRight}>
                  {busy ? (
                    <ActivityIndicator color={theme.colors.accent} />
                  ) : (
                    <Switch
                      value={enabled}
                      onValueChange={v => handleToggle(key, v)}
                      disabled={!canWrite}
                      trackColor={{ false: '#cbd5e1', true: theme.colors.accent }}
                      thumbColor="#ffffff"
                    />
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Storage-meter: hide-self wanneer offline_mode = false */}
      <OfflineStorageMeter />

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          ℹ️ Wijzigingen zijn direct zichtbaar voor alle gebruikers van je bedrijf.
          Uitgezette modules zijn voor jouw bedrijf nergens meer zichtbaar.
        </Text>
      </View>

      {/* Onboarding-wizard die opent bij eerste activatie van offline_mode */}
      <OfflineModeWizard
        visible={wizardVisible}
        onClose={handleWizardClose}
        onConfirm={handleWizardConfirm}
      />
    </ScrollView>
  );
}

function createStyles(theme: any) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: 24,
      maxWidth: 960,
      width: '100%',
      alignSelf: 'center',
    },
    header: {
      marginBottom: 24,
    },
    backBtn: {
      marginBottom: 12,
    },
    backTxt: {
      color: theme.colors.accent,
      fontSize: 14,
      fontWeight: '500',
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 15,
      color: theme.colors.textSecondary,
    },
    readOnlyBanner: {
      marginTop: 12,
      padding: 12,
      backgroundColor: '#fef3c7',
      borderRadius: 8,
    },
    readOnlyText: {
      fontSize: 13,
      color: '#92400e',
    },
    msg: {
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
    },
    msgText: {
      fontSize: 14,
      fontWeight: '500',
    },
    loadingBox: {
      padding: 40,
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      color: theme.colors.textSecondary,
    },
    list: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    rowLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    icon: {
      fontSize: 28,
      width: 36,
      textAlign: 'center',
    },
    rowText: {
      flex: 1,
    },
    rowTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    rowDesc: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
    rowRight: {
      paddingLeft: 16,
      minWidth: 60,
      alignItems: 'flex-end',
    },
    footer: {
      marginTop: 24,
      padding: 16,
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    footerText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      lineHeight: 19,
    },
  });
}
