import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, ScrollView, RefreshControl } from 'react-native';
import { BarChart, BrainCircuit, CheckCircle, Search, Server, ShieldCheck, XCircle } from 'lucide-react-native';
import { BACKEND_URL } from '../config/app';
import { useTheme } from '../theme/ThemeProvider';
import { getDeviceType } from '../lib/platform';

type AiStats = {
  totalConfigured: number;
  totalProcessedEvidence: number;
  totalPassed: number;
  totalNeedsReview: number;
  totalFailed: number;
  totalPending: number;
};

export default function AiValidationDashboard() {
  const { theme } = useTheme();
  const isDesktop = getDeviceType() === 'DESKTOP';
  const styles = createStyles(theme, isDesktop);

  const [stats, setStats] = useState<AiStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/ai-stats`);
      if (!response.ok) {
        throw new Error('Kon AI statistieken niet ophalen');
      }
      const data = await response.json();
      setStats(data as AiStats);
    } catch (err: any) {
      setError(err.message || 'Een onbekende fout is opgetreden bij het laden van AI stats.');
      console.error('fetchStats Error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const renderMetric = (title: string, value: number, description: string, Icon: React.ElementType, color: string) => (
    <View style={[styles.metricCard, { borderTopColor: color, borderTopWidth: 4 }]}>
      <View style={styles.metricHeader}>
        <Icon color={color} size={28} />
        <Text style={styles.metricValue}>{value}</Text>
      </View>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricDesc}>{description}</Text>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchStats} tintColor={theme.colors.accent} />}
    >
      <View style={styles.hero}>
        <View style={styles.heroHeader}>
          <BrainCircuit color={theme.colors.accent} size={40} />
          <View>
            <Text style={styles.heroTitle}>Autonome AI Validatie (Google Gemini)</Text>
            <Text style={styles.heroSubtitle}>
              Live prestatiemetingen van het generatieve AI controle model voor Wkb-bouwprojecten (NEN Normering).
            </Text>
          </View>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {!stats && !loading && !error ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Geen data gevonden</Text>
          <Text style={styles.emptySubtitle}>Er zijn geen AI resultaten beschikbaar in de backend.</Text>
        </View>
      ) : null}

      {stats ? (
        <View style={styles.grid}>
          {renderMetric(
            'Totaal Verwerkt',
            stats.totalProcessedEvidence,
            'Totale hoeveelheid digitaal afgewerkte en door de AI beoordeelde bewijsstukken.',
            BarChart,
            theme.colors.textPrimary
          )}
          {renderMetric(
            'Autonoom Goedgekeurd',
            stats.totalPassed,
            'Volledig door Edge en/of Cloud AI beoordeeld als PASSED.',
            ShieldCheck,
            theme.colors.success
          )}
          {renderMetric(
            'Verplichte Human Review',
            stats.totalNeedsReview,
            'Gemarkeerd als onzeker of voorzien van waarschuwing door het ML model (NEEDS_REVIEW).',
            Search,
            theme.colors.warning
          )}
          {renderMetric(
            'Systeem Afkeur',
            stats.totalFailed,
            'Door AI geclassificeerd als FAILED en afgekeurd wegens detectie bouwgebreken.',
            XCircle,
            theme.colors.danger
          )}
          {renderMetric(
            'Mogelijkheden AI Engine',
            stats.totalConfigured,
            'Aantal distinctieve NEN inspectiepunten die volledig worden ondersteund door Generatieve AI.',
            CheckCircle,
            theme.colors.accent
          )}
          {renderMetric(
            'Data Sync Wachtrij',
            stats.totalPending,
            'Bewijs in de wachtrij of bezig met upload en analyse.',
            Server,
            theme.colors.accentMuted
          )}
        </View>
      ) : null}

      {loading && !stats ? (
        <View style={styles.loaderArea}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={styles.loaderText}>Statistieken live laden...</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>['theme'], isDesktop: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      overflow: 'auto' as any,
    },
    content: {
      padding: isDesktop ? 32 : 16,
      gap: 24,
    },
    hero: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 24,
    },
    heroHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    heroTitle: {
      fontSize: isDesktop ? 26 : 22,
      fontWeight: '900',
      color: theme.colors.textPrimary,
    },
    heroSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 6,
      maxWidth: 600,
      lineHeight: 20,
    },
    grid: {
      flexDirection: isDesktop ? 'row' : 'column',
      flexWrap: 'wrap',
      gap: 16,
    },
    metricCard: {
      flex: 1,
      minWidth: isDesktop ? 280 : '100%',
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 24,
    },
    metricHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    metricValue: {
      fontSize: 32,
      fontWeight: '900',
      color: theme.colors.textPrimary,
    },
    metricTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      marginBottom: 8,
    },
    metricDesc: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
    errorBanner: {
      backgroundColor: theme.colors.danger + '20',
      borderWidth: 1,
      borderColor: theme.colors.danger,
      padding: 16,
      borderRadius: 12,
    },
    errorText: {
      color: theme.colors.danger,
      fontWeight: '700',
    },
    emptyState: {
      padding: 40,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 8,
    },
    loaderArea: {
      padding: 60,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loaderText: {
      marginTop: 16,
      color: theme.colors.textSecondary,
      fontSize: 15,
      fontWeight: '600',
    },
  });
