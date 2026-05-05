import React, { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react-native';
import { getDeviceType } from '../lib/platform';
import type { WkbComplianceSnapshot } from '../services/wkbCompliance';
import { useTheme } from '../theme/ThemeProvider';

interface WkbCompliancePanelProps {
  snapshot: WkbComplianceSnapshot;
  title?: string;
}

export default function WkbCompliancePanel({
  snapshot,
  title = 'Wkb compliance-status',
}: WkbCompliancePanelProps) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const deviceType = getDeviceType(width);
  const styles = useMemo(() => createStyles(theme, deviceType), [theme, deviceType]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          {snapshot.bevoegdGezagReady ? (
            <ShieldCheck color={theme.colors.success} size={22} />
          ) : (
            <ShieldAlert color={theme.colors.warning} size={22} />
          )}
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            Score {snapshot.overallScore}/100 •{' '}
            {snapshot.bevoegdGezagReady
              ? 'klaar voor bevoegd gezag'
              : 'nog niet dossierklaar voor bevoegd gezag'}
          </Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusBadge,
            snapshot.bevoegdGezagReady ? styles.successBadge : styles.warningBadge,
          ]}
        >
          <Text style={styles.statusBadgeText}>
            {snapshot.bevoegdGezagReady ? 'Bevoegd gezag gereed' : 'Bevoegd gezag geblokkeerd'}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            snapshot.gereedmeldingReady ? styles.successBadge : styles.warningBadge,
          ]}
        >
          <Text style={styles.statusBadgeText}>
            {snapshot.gereedmeldingReady ? 'Gereedmelding vrij' : 'Gereedmelding open'}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            snapshot.consumentReady ? styles.successBadge : styles.warningBadge,
          ]}
        >
          <Text style={styles.statusBadgeText}>
            {snapshot.consumentReady ? 'Consumentendossier gereed' : 'Consumentendossier open'}
          </Text>
        </View>
      </View>

      <View style={styles.metricGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{snapshot.readyEvidenceCount}</Text>
          <Text style={styles.metricLabel}>Dossierklaar bewijs</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{snapshot.localOnlyEvidenceCount}</Text>
          <Text style={styles.metricLabel}>Nog lokaal</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{snapshot.reviewEvidenceCount}</Text>
          <Text style={styles.metricLabel}>Review / AI aandacht</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{snapshot.missingExifCount}</Text>
          <Text style={styles.metricLabel}>EXIF blokkades</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>
            {snapshot.missingLocationVerificationCount}
          </Text>
          <Text style={styles.metricLabel}>Locatie blokkades</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{snapshot.missingStopMomentCount}</Text>
          <Text style={styles.metricLabel}>Stopmoment open</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{snapshot.missingMeasurementToolCount}</Text>
          <Text style={styles.metricLabel}>Meetmiddel open</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>
            {snapshot.consumerDossierCheckedCount}/{snapshot.consumerDossierTotalCount}
          </Text>
          <Text style={styles.metricLabel}>NPR 8092 checklist</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>
            {snapshot.consumerDossierDocumentFilledCount}/
            {snapshot.consumerDossierDocumentTotalCount}
          </Text>
          <Text style={styles.metricLabel}>Documentreferenties</Text>
        </View>
      </View>

      <View style={styles.moduleList}>
        {snapshot.modules.map((module) => (
          <View key={module.id} style={styles.moduleCard}>
            <View style={styles.moduleHeader}>
              {module.ready ? (
                <CheckCircle2 color={theme.colors.success} size={18} />
              ) : (
                <AlertTriangle color={theme.colors.warning} size={18} />
              )}
              <View style={styles.moduleHeaderCopy}>
                <Text style={styles.moduleTitle}>{module.title}</Text>
                <Text style={styles.moduleLegal}>{module.legalBasis}</Text>
              </View>
              <Text style={styles.moduleCount}>
                {module.readyEvidenceCount}/{Math.max(module.evidenceCount, 1)}
              </Text>
            </View>
            <Text style={styles.moduleState}>
              {module.ready
                ? 'Minimaal één juridisch bruikbaar bewijsstuk aanwezig.'
                : module.blocker ?? 'Nog geen dekkend bewijs voor deze discipline.'}
            </Text>
          </View>
        ))}
      </View>

      {snapshot.issues.length > 0 ? (
        <View style={styles.issueList}>
          {snapshot.issues.slice(0, 4).map((issue) => (
            <View key={issue.id} style={styles.issueCard}>
              <Text style={styles.issueTitle}>
                {issue.severity === 'critical' ? 'Blokkade' : 'Aandacht'}: {issue.title}
              </Text>
              <Text style={styles.issueDetail}>{issue.detail}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (
  theme: { colors: Record<string, string> },
  deviceType: 'DESKTOP' | 'TABLET' | 'MOBILE'
) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: deviceType === 'DESKTOP' ? 22 : 18,
      gap: 16,
    },
    header: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
    },
    headerIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceAlt,
    },
    headerCopy: {
      flex: 1,
      gap: 3,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontWeight: '800',
    },
    subtitle: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    statusRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    statusBadge: {
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    successBadge: {
      backgroundColor: theme.colors.success,
    },
    warningBadge: {
      backgroundColor: theme.colors.warning,
    },
    statusBadgeText: {
      color: theme.colors.textPrimary,
      fontSize: 12,
      fontWeight: '800',
    },
    metricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    metricCard: {
      flex: 1,
      minWidth: deviceType === 'MOBILE' ? '47%' : 150,
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
    },
    metricValue: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontWeight: '900',
    },
    metricLabel: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      marginTop: 4,
    },
    moduleList: {
      gap: 10,
    },
    moduleCard: {
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 16,
      padding: 14,
      gap: 8,
    },
    moduleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    moduleHeaderCopy: {
      flex: 1,
      gap: 2,
    },
    moduleTitle: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    moduleLegal: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      lineHeight: 16,
    },
    moduleCount: {
      color: theme.colors.chip,
      fontSize: 12,
      fontWeight: '800',
    },
    moduleState: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    issueList: {
      gap: 8,
    },
    issueCard: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
      gap: 4,
    },
    issueTitle: {
      color: theme.colors.textPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    issueDetail: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
  });
