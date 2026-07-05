import React, { useMemo } from 'react';
import { Alert, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react-native';
import {
  DEFAULT_GEVOLGKLASSE,
  WKB_ILLEGAL_EXISTING_BUILD,
  WKB_KWALITEITSBORGER_ASSIGNED,
  WKB_KWALITEITSBORGER_INDEPENDENT,
  WKB_PROJECT_KIND,
  WKB_VERGUNNINGPLICHTIG,
} from '../config/app';
import {
  evaluateWkbOfficialRules,
  type WkbOfficialCheck,
} from '../services/wkbOfficialRules';
import { useTheme } from '../theme/ThemeProvider';

export default function WkbOfficialPanel() {
  const { theme } = useTheme();
  const checks = useMemo(
    () =>
      evaluateWkbOfficialRules({
        gevolgklasse: DEFAULT_GEVOLGKLASSE,
        projectKind: WKB_PROJECT_KIND,
        vergunningplichtig: WKB_VERGUNNINGPLICHTIG,
        illegalExistingBuild: WKB_ILLEGAL_EXISTING_BUILD,
        kwaliteitsborgerAssigned: WKB_KWALITEITSBORGER_ASSIGNED,
        kwaliteitsborgerIndependent: WKB_KWALITEITSBORGER_INDEPENDENT,
      }),
    []
  );
  const styles = useMemo(() => createStyles(theme), [theme]);

  const criticalCount = checks.filter((check) => check.severity === 'critical' && !check.ok)
    .length;
  const warningCount = checks.filter(
    (check) => check.severity === 'warning' && !check.ok
  ).length;

  const openSource = (check: WkbOfficialCheck) => {
    const title = 'Externe link openen';
    const message = `Je verlaat SpeeQ om een officiele overheidsbron (${check.source.label}) te bekijken. Wil je doorgaan?`;

    const go = async () => {
      try {
        await Linking.openURL(check.source.url);
      } catch (error) {
        console.error('Kon Wkb-bron niet openen:', error);
      }
    };

    // react-native-web's Alert.alert is een no-op; val op web terug op de
    // browser-confirm (zelfde pattern als elders in de app).
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) {
        void go();
      }
      return;
    }

    Alert.alert(title, message, [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Doorgaan', onPress: () => { void go(); } },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Officiele Wkb randvoorwaarden</Text>
          <Text style={styles.subtitle}>
            Gebaseerd op IPLO en Wetten.nl, gericht op de formele Wkb-scope en meldplicht.
          </Text>
        </View>
        <View
          style={[
            styles.summaryBadge,
            criticalCount === 0 ? styles.successBadge : styles.dangerBadge,
          ]}
        >
          <Text style={styles.summaryBadgeText}>
            {criticalCount === 0
              ? `Geen kritieke scopeblokkades${warningCount > 0 ? ` • ${warningCount} aandacht` : ''}`
              : `${criticalCount} kritieke Wkb blokkade(s)`}
          </Text>
        </View>
      </View>

      <View style={styles.list}>
        {checks.map((check) => (
          <TouchableOpacity
            key={check.id}
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => void openSource(check)}
          >
            <View style={styles.cardHeader}>
              {check.ok ? (
                <CheckCircle2 color={theme.colors.success} size={18} />
              ) : check.severity === 'critical' ? (
                <AlertTriangle color={theme.colors.danger} size={18} />
              ) : (
                <Info color={theme.colors.warning} size={18} />
              )}
              <View style={styles.cardCopy}>
                <Text style={styles.cardTitle}>{check.title}</Text>
                <Text style={styles.cardDetail}>{check.detail}</Text>
              </View>
            </View>
            <Text style={styles.sourceText}>{check.source.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const createStyles = (theme: { colors: Record<string, string> }) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 18,
      gap: 14,
    },
    header: {
      gap: 10,
    },
    headerCopy: {
      gap: 4,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontWeight: '800',
    },
    subtitle: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
    },
    summaryBadge: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      alignSelf: 'flex-start',
    },
    successBadge: {
      backgroundColor: theme.colors.success,
    },
    dangerBadge: {
      backgroundColor: theme.colors.danger,
    },
    summaryBadgeText: {
      color: theme.colors.textPrimary,
      fontSize: 12,
      fontWeight: '800',
    },
    list: {
      gap: 10,
    },
    card: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
      gap: 8,
    },
    cardHeader: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
    },
    cardCopy: {
      flex: 1,
      gap: 4,
    },
    cardTitle: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    cardDetail: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    sourceText: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '700',
    },
  });
