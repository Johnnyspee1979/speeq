import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { DEFAULT_PROJECT_ID } from '../config/app';
import {
  fetchStamStatus,
  submitBouwmelding,
  submitGereedmelding,
  submitStam,
} from '../services/dso';
import {
  getAllEvidence,
  getConsumerDossierDocuments,
  getConsumerDossierItems,
  getDsoLogs,
  getGereedmeldingItems,
  getPunchlistItems,
  insertDsoLog,
  type DsoLogRow,
  type Evidence,
} from '../database/database';
import { getDeviceType } from '../lib/platform';
import WkbCompliancePanel from './WkbCompliancePanel';
import {
  buildWkbComplianceSnapshot,
  type StoredConsumerDossierDocument,
  type StoredConsumerDossierItem,
} from '../services/wkbCompliance';
import { useTheme } from '../theme/ThemeProvider';
import WkbGereedmeldingChecklist from './WkbGereedmeldingChecklist';

type DsoLogEntry = DsoLogRow;
type GereedmeldingChecklistStatus = {
  totalCount: number;
  checkedCount: number;
  allChecked: boolean;
  savedAt: string | null;
};

export default function DsoLog() {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const [entries, setEntries] = useState<DsoLogEntry[]>([]);
  const [manualReference, setManualReference] = useState('');
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
  const [gereedmeldingStatus, setGereedmeldingStatus] =
    useState<GereedmeldingChecklistStatus>({
      totalCount: 0,
      checkedCount: 0,
      allChecked: false,
      savedAt: null,
    });
  const isCompact = getDeviceType(width) === 'MOBILE';
  const styles = useMemo(() => createStyles(theme, isCompact), [theme, isCompact]);
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

  const addEntry = async (entry: DsoLogEntry) => {
    await insertDsoLog(entry);
    const updated = await getDsoLogs();
    setEntries(updated);
  };

  const handleGereedmeldingStatusChange = (status: GereedmeldingChecklistStatus) => {
    setGereedmeldingStatus(status);
    void getGereedmeldingItems(DEFAULT_PROJECT_ID).then(setGereedmeldingItems);
  };

  const createDemoProjectPayload = () => ({
    projectData: {
      projectId: DEFAULT_PROJECT_ID,
      initiatorDetails: {
        name: 'Demo Aannemer BV',
        address: 'Voorbeeldstraat 12, 1234 AB Utrecht',
        email: 'uitvoerder@demo-aannemer.nl',
      },
      location: {
        kadastraleAanduiding: 'UTR00-A-1234',
        coordinates: { lat: 52.0907, lng: 5.1214 },
      },
      kwaliteitsborgerId: 'KB-2026-DEMO',
      instrumentId: 'KIK-INSTRUMENT-DEMO',
    },
    borgingsplanUrl: 'https://example.invalid/borgingsplan.pdf',
    risicoUrl: 'https://example.invalid/risicobeoordeling.pdf',
  });

  const handleSubmitDummy = async () => {
    try {
      const response = await submitStam({
        project_id: DEFAULT_PROJECT_ID,
        project_naam: `Wkb Dossier ${DEFAULT_PROJECT_ID}`,
        kwaliteitsborger: 'Demo kwaliteitsborger',
        kwaliteitsborger_regnr: 'KB-2026-DEMO',
        type_melding: 'BOUWMELDING',
        verklaring_akkoord: true,
        bewijs: [
          {
            id: 'demo-1',
            photo_uri: 'https://example.invalid/demo-bewijs.jpg',
            latitude: 52.0705,
            longitude: 4.3007,
            timestamp: new Date().toISOString(),
            inspection_point_id: 'kik-wapening-002',
          },
        ],
      });
      await addEntry({
        reference_id: response.dsoReferentieId ?? response.referenceId ?? 'onbekend',
        status: response.status ?? 'PENDING',
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Controleer backend URL.';
      Alert.alert('DSO submit faalde', message);
    }
  };

  const handleSubmitBouwmelding = async () => {
    try {
      if (!complianceSnapshot.bevoegdGezagReady) {
        Alert.alert(
          'Bouwmelding met aandacht',
          complianceSnapshot.issues[0]?.detail ??
            'Er zijn nog Wkb-blokkades zichtbaar in het dossier.'
        );
      }

      const response = await submitBouwmelding(createDemoProjectPayload());
      await addEntry({
        reference_id: response.transactionId ?? 'bouwmelding-demo',
        status: `BOUWMELDING ${response.status}`,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bouwmelding faalde.';
      Alert.alert('Bouwmelding mislukt', message);
    }
  };

  const handleSubmitGereedmelding = async () => {
    if (!gereedmeldingStatus.allChecked || !gereedmeldingStatus.savedAt) {
      Alert.alert(
        'Gereedmelding geblokkeerd',
        'Maak eerst de offline gereedmelding-checklist volledig en sla deze lokaal op voordat je de STAM-gereedmelding verstuurt.'
      );
      return;
    }

    if (!complianceSnapshot.bevoegdGezagReady) {
      Alert.alert(
        'Gereedmelding geblokkeerd',
        complianceSnapshot.issues[0]?.detail ??
          'Het technische Wkb-dossier is nog niet vrijgegeven voor bevoegd gezag.'
      );
      return;
    }

    try {
      const response = await submitGereedmelding(createDemoProjectPayload());
      await addEntry({
        reference_id: response.transactionId ?? 'gereedmelding-demo',
        status: `GEREEDMELDING ${response.status}`,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gereedmelding faalde.';
      Alert.alert('Gereedmelding mislukt', message);
    }
  };

  const handleCheckStatus = async (referenceId?: string) => {
    const ref = referenceId ?? manualReference.trim();
    if (!ref) {
      Alert.alert('Geen referentie', 'Vul een referentie in.');
      return;
    }
    try {
      const response = await fetchStamStatus(ref);
      await addEntry({
        reference_id: ref,
        status: response.status ?? 'onbekend',
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'DSO status kon niet worden opgehaald.';
      Alert.alert('Status faalde', message);
    }
  };

  useEffect(() => {
    const load = async () => {
      const [
        stored,
        nextEvidence,
        nextPunchlistItems,
        nextGereedmeldingItems,
        nextConsumerDossierItems,
        nextConsumerDossierDocuments,
      ] =
        await Promise.all([
          getDsoLogs(),
          getAllEvidence(),
          getPunchlistItems(DEFAULT_PROJECT_ID),
          getGereedmeldingItems(DEFAULT_PROJECT_ID),
          getConsumerDossierItems(DEFAULT_PROJECT_ID),
          getConsumerDossierDocuments(DEFAULT_PROJECT_ID),
        ]);
      setEntries(stored);
      setEvidence(nextEvidence);
      setPunchlistItems(nextPunchlistItems);
      setGereedmeldingItems(nextGereedmeldingItems);
      setConsumerDossierItems(nextConsumerDossierItems);
      setConsumerDossierDocuments(nextConsumerDossierDocuments);
    };
    void load();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>DSO Logboek</Text>

        <WkbCompliancePanel snapshot={complianceSnapshot} />

        <WkbGereedmeldingChecklist
          projectId={DEFAULT_PROJECT_ID}
          onStatusChange={handleGereedmeldingStatusChange}
        />

        <View style={styles.controls}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleSubmitDummy}>
            <Text style={styles.primaryButtonText}>📨 Test STAM submit</Text>
          </TouchableOpacity>

          <View style={styles.inlineRow}>
            <TouchableOpacity
              style={styles.secondaryActionButton}
              onPress={handleSubmitBouwmelding}
            >
              <Text style={styles.secondaryActionButtonText}>🏗️ Bouwmelding</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.secondaryActionButton,
                (!gereedmeldingStatus.allChecked || !gereedmeldingStatus.savedAt) &&
                  styles.disabledActionButton,
              ]}
              onPress={handleSubmitGereedmelding}
              disabled={!gereedmeldingStatus.allChecked || !gereedmeldingStatus.savedAt}
            >
              <Text style={styles.secondaryActionButtonText}>✅ Gereedmelding</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.readinessText}>
            Gereedmelding checklist:{' '}
            {gereedmeldingStatus.allChecked && gereedmeldingStatus.savedAt
              ? 'compleet en lokaal vergrendeld'
              : `${gereedmeldingStatus.checkedCount}/${gereedmeldingStatus.totalCount} vereisten afgevinkt`}
          </Text>

          <Text style={styles.helpText}>
            Demo gebruikt project {DEFAULT_PROJECT_ID}. Je kunt hieronder ook een
            handmatige referentie controleren.
          </Text>

          <View style={styles.inlineRow}>
            <TextInput
              style={styles.input}
              value={manualReference}
              onChangeText={setManualReference}
              placeholder="Reference ID"
              placeholderTextColor="#8B96A8"
            />
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => handleCheckStatus()}
            >
              <Text style={styles.secondaryButtonText}>Status</Text>
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={entries}
          keyExtractor={(item, index) => `${item.reference_id}-${index}`}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.reference_id}</Text>
              <Text style={styles.cardSubtitle}>Status: {item.status}</Text>
              <Text style={styles.cardMeta}>{new Date(item.created_at).toLocaleString()}</Text>
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => handleCheckStatus(item.reference_id)}
              >
                <Text style={styles.linkButtonText}>Ververs status</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Nog geen DSO‑meldingen.</Text>
          }
        />
      </View>
    </View>
  );
}

const createStyles = (
  theme: { colors: Record<string, string> },
  isCompact: boolean
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      overflow: 'auto' as any,
    },
    content: {
      flex: 1,
      width: '100%',
      maxWidth: 1080,
      alignSelf: 'center',
      padding: isCompact ? 14 : 20,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 12,
    },
    controls: {
      gap: 12,
      marginBottom: 16,
      backgroundColor: theme.colors.surface,
      padding: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    primaryButton: {
      backgroundColor: theme.colors.accent,
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: theme.colors.textPrimary,
      fontWeight: '600',
    },
    inlineRow: {
      flexDirection: isCompact ? 'column' : 'row',
      gap: 10,
    },
    helpText: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
    input: {
      flex: 1,
      backgroundColor: theme.colors.surfaceAlt,
      color: theme.colors.textPrimary,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    secondaryButton: {
      backgroundColor: theme.colors.accentMuted,
      paddingHorizontal: 16,
      minHeight: 44,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    secondaryButtonText: {
      color: theme.colors.textPrimary,
      fontWeight: '600',
    },
    secondaryActionButton: {
      flex: 1,
      backgroundColor: theme.colors.surfaceAlt,
      paddingHorizontal: 14,
      minHeight: 44,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    disabledActionButton: {
      opacity: 0.55,
    },
    secondaryActionButtonText: {
      color: theme.colors.textPrimary,
      fontWeight: '700',
      fontSize: 13,
    },
    readinessText: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 18,
    },
    list: {
      gap: 12,
      paddingBottom: 24,
    },
    card: {
      backgroundColor: theme.colors.surface,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cardTitle: {
      color: theme.colors.textPrimary,
      fontWeight: '600',
    },
    cardSubtitle: {
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
    cardMeta: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      marginTop: 6,
    },
    linkButton: {
      marginTop: 8,
    },
    linkButtonText: {
      color: theme.colors.accent,
      fontSize: 12,
    },
    emptyText: {
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: 20,
    },
  });
