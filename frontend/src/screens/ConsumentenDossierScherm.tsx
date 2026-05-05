import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  CheckCircle,
  DownloadCloud,
  FileText,
  Share2,
  RefreshCw,
} from 'lucide-react-native';
import { BACKEND_URL, DEFAULT_PROJECT_ID, DEFAULT_PROJECT_NAME } from '../config/app';
import ConsumerDossierChecklist from '../components/ConsumerDossierChecklist';
import ConsumerDossierDocuments from '../components/ConsumerDossierDocuments';
import WkbCompliancePanel from '../components/WkbCompliancePanel';
import WkbOfficialPanel from '../components/WkbOfficialPanel';
import {
  getAllEvidence,
  getConsumerDossierDocuments,
  getConsumerDossierItems,
  getGereedmeldingItems,
  getPunchlistItems,
  type Evidence,
} from '../database/database';
import { getDeviceType } from '../lib/platform';
import {
  buildWkbComplianceSnapshot,
  type StoredConsumerDossierDocument,
  type StoredConsumerDossierItem,
} from '../services/wkbCompliance';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  syncEvidenceQueue,
  syncProjectDeliveryStateToCloud,
} from '../services/sync';
import { useTheme } from '../theme/ThemeProvider';

interface ConsumentenDossierSchermProps {
  projectId?: string;
  projectName?: string;
}

export default function ConsumentenDossierScherm({
  projectId = DEFAULT_PROJECT_ID,
  projectName = DEFAULT_PROJECT_NAME,
}: ConsumentenDossierSchermProps) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const deviceType = getDeviceType(width);
  const isDesktop = deviceType === 'DESKTOP';
  const styles = useMemo(() => createStyles(theme, isDesktop), [theme, isDesktop]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [lastDownloadedAt, setLastDownloadedAt] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [punchlistItems, setPunchlistItems] = useState<
    Awaited<ReturnType<typeof getPunchlistItems>>
  >([]);
  const [gereedmeldingItems, setGereedmeldingItems] = useState<
    Awaited<ReturnType<typeof getGereedmeldingItems>>
  >([]);
  const [consumerDossierItems, setConsumerDossierItems] = useState<
    StoredConsumerDossierItem[]
  >([]);
  const [consumerDossierDocuments, setConsumerDossierDocuments] = useState<
    StoredConsumerDossierDocument[]
  >([]);

  const consumerDossierUrl = `${BACKEND_URL}/api/wkb-dossier/consument/${encodeURIComponent(
    projectId
  )}`;
  const consumerDossierStatusUrl = `${BACKEND_URL}/api/wkb-dossier/consument/status/${encodeURIComponent(
    projectId
  )}`;
  const complianceSnapshot = useMemo(
    () =>
      buildWkbComplianceSnapshot({
        evidence,
        punchlistItems,
        gereedmeldingItems,
        consumerDossierItems,
        consumerDossierDocuments,
      }),
    [
      consumerDossierDocuments,
      consumerDossierItems,
      evidence,
      gereedmeldingItems,
      punchlistItems,
    ]
  );

  React.useEffect(() => {
    let isMounted = true;

    const loadComplianceData = async () => {
      const [
        nextEvidence,
        nextPunchlistItems,
        nextGereedmeldingItems,
        nextConsumerDossierItems,
        nextConsumerDossierDocuments,
      ] = await Promise.all([
        getAllEvidence(),
        getPunchlistItems(projectId),
        getGereedmeldingItems(projectId),
        getConsumerDossierItems(projectId),
        getConsumerDossierDocuments(projectId),
      ]);

      if (!isMounted) {
        return;
      }

      setEvidence(nextEvidence);
      setPunchlistItems(nextPunchlistItems);
      setGereedmeldingItems(nextGereedmeldingItems);
      setConsumerDossierItems(nextConsumerDossierItems);
      setConsumerDossierDocuments(nextConsumerDossierDocuments);
    };

    void loadComplianceData();

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';

  const handleDownloadDossier = async () => {
    setIsDownloading(true);

    try {
      // Op web: open direct via browser (geen FileSystem nodig)
      if (isWeb) {
        const backendAvailable = await fetch(consumerDossierStatusUrl, { method: 'GET' })
          .then((r) => r.ok)
          .catch(() => false);

        if (!backendAvailable) {
          Alert.alert(
            'Backend niet bereikbaar',
            `Zorg dat de backend draait op:\n${consumerDossierUrl}\n\nOf deploy de backend naar Railway voor online toegang.`
          );
          return;
        }

        window.open(consumerDossierUrl, '_blank');
        setPdfUri(consumerDossierUrl);
        setLastDownloadedAt(new Date().toISOString());
        return;
      }

      // Op native (iOS/Android): download via FileSystem
      if (!complianceSnapshot.consumentReady) {
        throw new Error(
          complianceSnapshot.issues.find((issue) =>
            [
              'consumer-dossier-incomplete',
              'consumer-documentation-missing',
              'consumer-evidence-missing',
              'punchlist-open',
            ].includes(issue.id)
          )?.detail ??
            'Het consumentendossier is nog niet compleet genoeg voor overdracht.'
        );
      }

      if (isSupabaseConfigured()) {
        const projectContextResult = await syncProjectDeliveryStateToCloud(projectId);

        if (projectContextResult.status === 'error') {
          throw new Error(
            projectContextResult.message ??
              'De overdrachtsinformatie kon niet veilig naar de cloud worden gesynchroniseerd.'
          );
        }

        const evidenceSyncResult = await syncEvidenceQueue();

        if (evidenceSyncResult.status === 'error') {
          throw new Error(
            evidenceSyncResult.message ??
              'Niet alle bewijsstukken konden veilig naar de cloud worden gesynchroniseerd.'
          );
        }
      }

      const statusResponse = await fetch(consumerDossierStatusUrl);
      const statusPayload = (await statusResponse.json().catch(() => null)) as
        | {
            error?: string;
            ready?: boolean;
            issues?: Array<{ detail?: string }>;
          }
        | null;

      if (!statusResponse.ok || statusPayload?.ready === false) {
        throw new Error(
          statusPayload?.issues?.[0]?.detail ??
            statusPayload?.error ??
            'De server-side consumentendossiercontrole blokkeert export.'
        );
      }

      const baseDir =
        (FileSystem as unknown as { documentDirectory?: string; cacheDirectory?: string })
          .documentDirectory ??
        (FileSystem as unknown as { cacheDirectory?: string }).cacheDirectory ??
        '';

      if (!baseDir) {
        throw new Error('Geen lokale opslagmap beschikbaar op dit apparaat.');
      }

      const sanitizedProjectId = projectId.replace(/[^a-zA-Z0-9-_]/g, '_');
      const localFilePath = `${baseDir}consumentendossier-${sanitizedProjectId}-${Date.now()}.pdf`;
      const downloadResult = await FileSystem.downloadAsync(
        consumerDossierUrl,
        localFilePath
      );

      if (downloadResult.status !== 200) {
        throw new Error(`Serverfout bij dossiergeneratie (${downloadResult.status}).`);
      }

      setPdfUri(downloadResult.uri);
      setLastDownloadedAt(new Date().toISOString());
      Alert.alert(
        'Consumentendossier gereed',
        'Het PDF-dossier is lokaal opgeslagen en klaar om te delen met de koper.'
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Zorg dat je backend bereikbaar is en probeer het opnieuw.';
      console.error('Consumentendossier downloaden faalde:', error);
      Alert.alert('Download mislukt', message);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShareDossier = async () => {
    if (!pdfUri) {
      Alert.alert('Nog geen PDF', 'Genereer eerst het consumentendossier.');
      return;
    }

    // Op web: open URL opnieuw (browser biedt opslaan/delen aan)
    if (isWeb) {
      window.open(pdfUri, '_blank');
      return;
    }

    try {
      const canShare = await Sharing.isAvailableAsync();

      if (!canShare) {
        Alert.alert('Delen niet beschikbaar', `Bestand opgeslagen op: ${pdfUri}`);
        return;
      }

      await Sharing.shareAsync(pdfUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Consumentendossier - ${projectName}`,
        UTI: 'com.adobe.pdf',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Kon het deelmenu niet openen.';
      console.error('Consumentendossier delen faalde:', error);
      Alert.alert('Delen mislukt', message);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoCard}>
          <View style={styles.iconHalo}>
            <FileText color={theme.colors.accent} size={32} />
          </View>
          <Text style={styles.title}>Consumentendossier</Text>
          <Text style={styles.subtitle}>Project: {projectName}</Text>
          <Text style={styles.description}>
            Genereer hier het opleverdossier conform art. 7:757a BW en NPR 8092,
            met as-built informatie, materiaal- en installatiespecificaties,
            gebruiksfuncties, handleidingen, onderhoud en garanties voor de koper.
          </Text>
          <Text style={styles.legalNote}>
            Backend route: {consumerDossierUrl}
          </Text>
        </View>

        <WkbCompliancePanel
          snapshot={complianceSnapshot}
          title="Wkb overdrachtsstatus consumentendossier"
        />

        <WkbOfficialPanel />

        <ConsumerDossierChecklist
          projectId={projectId}
          onStatusChange={(_, items) => setConsumerDossierItems(items)}
        />

        <ConsumerDossierDocuments
          projectId={projectId}
          onStatusChange={(_, documents) => setConsumerDossierDocuments(documents)}
        />

        <View style={styles.actionPanel}>
          {!pdfUri ? (
            <TouchableOpacity
              style={[styles.primaryButton, isDownloading && styles.primaryButtonDisabled]}
              onPress={handleDownloadDossier}
              disabled={isDownloading}
              activeOpacity={0.85}
            >
              {isDownloading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <DownloadCloud color="#FFFFFF" size={22} />
                  <Text style={styles.primaryButtonText}>GENEREER DOSSIER</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.successBadge}>
                <CheckCircle color={theme.colors.success} size={22} />
                <View style={styles.successCopy}>
                  <Text style={styles.successTitle}>Dossier lokaal opgeslagen</Text>
                  <Text style={styles.successMeta}>
                    {lastDownloadedAt
                      ? `Gegenereerd op ${new Date(lastDownloadedAt).toLocaleString('nl-NL')}`
                      : 'Klaar voor overdracht'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.shareButton}
                onPress={handleShareDossier}
                activeOpacity={0.85}
              >
                <Share2 color="#FFFFFF" size={22} />
                <Text style={styles.shareButtonText}>DEEL MET KOPER</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleDownloadDossier}
                activeOpacity={0.85}
              >
                <RefreshCw color={theme.colors.textPrimary} size={18} />
                <Text style={styles.secondaryButtonText}>Genereer opnieuw</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (
  theme: ReturnType<typeof useTheme>['theme'],
  isDesktop: boolean
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: isDesktop ? 28 : 16,
      overflow: 'auto' as any,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      width: '100%',
      maxWidth: isDesktop ? 980 : undefined,
      alignSelf: 'center',
      gap: 20,
      paddingBottom: 28,
    },
    infoCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: isDesktop ? 28 : 22,
      alignItems: 'center',
    },
    iconHalo: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 18,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: isDesktop ? 28 : 24,
      fontWeight: '900',
      textAlign: 'center',
    },
    subtitle: {
      color: theme.colors.textSecondary,
      fontSize: 15,
      fontWeight: '600',
      marginTop: 8,
      textAlign: 'center',
    },
    description: {
      color: theme.colors.textSecondary,
      fontSize: 15,
      lineHeight: 24,
      textAlign: 'center',
      marginTop: 18,
      maxWidth: 720,
    },
    legalNote: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      marginTop: 16,
      textAlign: 'center',
    },
    actionPanel: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: isDesktop ? 24 : 18,
      gap: 14,
    },
    primaryButton: {
      minHeight: 68,
      borderRadius: 16,
      backgroundColor: '#FF6600',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    primaryButtonDisabled: {
      opacity: 0.7,
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '900',
      letterSpacing: 0.3,
    },
    successBadge: {
      minHeight: 78,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: `${theme.colors.success}55`,
      backgroundColor:
        theme.name === 'dark' ? 'rgba(22, 163, 74, 0.12)' : 'rgba(22, 163, 74, 0.10)',
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    successCopy: {
      flex: 1,
    },
    successTitle: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontWeight: '800',
    },
    successMeta: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      marginTop: 4,
    },
    shareButton: {
      minHeight: 64,
      borderRadius: 16,
      backgroundColor: theme.colors.accent,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    shareButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: 0.3,
    },
    secondaryButton: {
      minHeight: 56,
      borderRadius: 14,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    secondaryButtonText: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
  });
