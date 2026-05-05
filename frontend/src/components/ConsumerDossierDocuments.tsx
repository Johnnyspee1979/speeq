import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { FileBadge2, Link2, Save, StickyNote } from 'lucide-react-native';
import { DEFAULT_PROJECT_ID } from '../config/app';
import {
  getConsumerDossierDocuments,
  saveConsumerDossierDocuments,
  type StoredConsumerDossierDocument,
} from '../database/database';
import { getDeviceType } from '../lib/platform';
import {
  CONSUMER_DOSSIER_DOCUMENT_REQUIREMENTS,
  isConsumerDossierDocumentComplete,
  type ConsumerDossierDocumentRequirement,
} from '../services/wkbCompliance';
import { useTheme } from '../theme/ThemeProvider';

type LocalConsumerDossierDocument = ConsumerDossierDocumentRequirement & {
  referenceValue: string;
  notes: string;
  updatedAt: string | null;
  syncStatus: StoredConsumerDossierDocument['syncStatus'];
};

type ConsumerDocumentStatus = {
  totalCount: number;
  completedCount: number;
  allCompleted: boolean;
  savedAt: string | null;
};

interface ConsumerDossierDocumentsProps {
  projectId?: string;
  onStatusChange?: (
    status: ConsumerDocumentStatus,
    documents: StoredConsumerDossierDocument[]
  ) => void;
}

const buildDefaultDocuments = (): LocalConsumerDossierDocument[] =>
  CONSUMER_DOSSIER_DOCUMENT_REQUIREMENTS.map((item) => ({
    ...item,
    referenceValue: '',
    notes: '',
    updatedAt: null,
    syncStatus: 'PENDING',
  }));

const mergeStoredDocuments = (
  storedDocuments: StoredConsumerDossierDocument[]
): LocalConsumerDossierDocument[] => {
  const byId = new Map(storedDocuments.map((item) => [item.id, item]));

  return CONSUMER_DOSSIER_DOCUMENT_REQUIREMENTS.map((item) => {
    const stored = byId.get(item.id);

    return {
      ...item,
      referenceValue: stored?.referenceValue ?? '',
      notes: stored?.notes ?? '',
      updatedAt: stored?.updatedAt ?? null,
      syncStatus: stored?.syncStatus ?? 'PENDING',
    };
  });
};

const toStoredDocuments = (
  documents: LocalConsumerDossierDocument[]
): StoredConsumerDossierDocument[] =>
  documents.map((item) => ({
    id: item.id,
    requirementId: item.requirementId,
    title: item.title,
    category: item.category,
    referenceValue: item.referenceValue,
    notes: item.notes,
    updatedAt: item.updatedAt,
    syncStatus: item.syncStatus,
  }));

const buildStatus = (
  documents: LocalConsumerDossierDocument[]
): ConsumerDocumentStatus => {
  const completedCount = documents.filter((item) =>
    isConsumerDossierDocumentComplete({
      id: item.id,
      requirementId: item.requirementId,
      title: item.title,
      category: item.category,
      referenceValue: item.referenceValue,
      notes: item.notes,
      updatedAt: item.updatedAt,
      syncStatus: item.syncStatus,
    })
  ).length;
  const savedAt =
    documents
      .map((item) => item.updatedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

  return {
    totalCount: documents.length,
    completedCount,
    allCompleted: completedCount === documents.length,
    savedAt,
  };
};

export default function ConsumerDossierDocuments({
  projectId = DEFAULT_PROJECT_ID,
  onStatusChange,
}: ConsumerDossierDocumentsProps) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const deviceType = getDeviceType(width);
  const styles = useMemo(() => createStyles(theme, deviceType), [theme, deviceType]);
  const [documents, setDocuments] = useState<LocalConsumerDossierDocument[]>(
    buildDefaultDocuments
  );
  const [isSaving, setIsSaving] = useState(false);
  const status = useMemo(() => buildStatus(documents), [documents]);

  useEffect(() => {
    onStatusChange?.(status, toStoredDocuments(documents));
  }, [documents, onStatusChange, status]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const storedDocuments = await getConsumerDossierDocuments(projectId);

      if (!isMounted) {
        return;
      }

      if (storedDocuments.length === 0) {
        setDocuments(buildDefaultDocuments());
        return;
      }

      setDocuments(mergeStoredDocuments(storedDocuments));
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  const updateDocument = (
    id: string,
    field: 'referenceValue' | 'notes',
    value: string
  ) => {
    setDocuments((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: value,
              syncStatus: 'PENDING',
            }
          : item
      )
    );
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const updatedAt = await saveConsumerDossierDocuments(
        projectId,
        documents.map((item) => ({
          id: item.id,
          requirementId: item.requirementId,
          title: item.title,
          category: item.category,
          referenceValue: item.referenceValue,
          notes: item.notes,
        }))
      );

      const updatedDocuments = documents.map((item) => ({
        ...item,
        updatedAt,
        syncStatus: 'PENDING' as const,
      }));

      setDocuments(updatedDocuments);

      if (buildStatus(updatedDocuments).allCompleted) {
        Alert.alert(
          'Documentset compleet',
          'De NPR 8092-documentreferenties zijn lokaal vastgelegd en klaar voor synchronisatie en export.'
        );
      } else {
        Alert.alert(
          'Documentset opgeslagen',
          'De documentreferenties zijn lokaal opgeslagen. Vul de open velden aan voordat je het consumentendossier exporteert.'
        );
      }
    } catch (error) {
      console.error('Consumentendossier-documenten opslaan faalde:', error);
      Alert.alert(
        'Opslaan mislukt',
        'Kon de documentreferenties van het consumentendossier niet lokaal bewaren.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <FileBadge2 color={theme.colors.accent} size={22} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Documentreferenties NPR 8092</Text>
          <Text style={styles.headerText}>
            Leg per dossieronderdeel vast waar de koper de echte overdrachtsdocumenten
            terugvindt. Deze referenties gaan mee in de server-side validatie en PDF.
          </Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{status.completedCount}</Text>
          <Text style={styles.summaryLabel}>Compleet</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{status.totalCount - status.completedCount}</Text>
          <Text style={styles.summaryLabel}>Nog open</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{projectId}</Text>
          <Text style={styles.summaryLabel}>Project</Text>
        </View>
      </View>

      {documents.map((item) => {
        const complete = isConsumerDossierDocumentComplete({
          id: item.id,
          requirementId: item.requirementId,
          title: item.title,
          category: item.category,
          referenceValue: item.referenceValue,
          notes: item.notes,
          updatedAt: item.updatedAt,
          syncStatus: item.syncStatus,
        });

        return (
          <View key={item.id} style={[styles.card, complete && styles.cardComplete]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardCategory}>{item.category}</Text>
            </View>
            <Text style={styles.cardDescription}>{item.description}</Text>

            <View style={styles.fieldHeader}>
              <Link2 color={theme.colors.textSecondary} size={16} />
              <Text style={styles.fieldLabel}>{item.referenceLabel}</Text>
            </View>
            <TextInput
              style={styles.input}
              value={item.referenceValue}
              onChangeText={(value) => updateDocument(item.id, 'referenceValue', value)}
              placeholder={item.referencePlaceholder}
              placeholderTextColor={theme.colors.textSecondary}
              autoCapitalize="none"
            />

            <View style={styles.fieldHeader}>
              <StickyNote color={theme.colors.textSecondary} size={16} />
              <Text style={styles.fieldLabel}>{item.noteLabel}</Text>
            </View>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={item.notes}
              onChangeText={(value) => updateDocument(item.id, 'notes', value)}
              placeholder={item.notePlaceholder}
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.metaText}>
              {item.updatedAt
                ? `Lokaal bijgewerkt op ${new Date(item.updatedAt).toLocaleString('nl-NL')}`
                : 'Nog niet lokaal opgeslagen'}
            </Text>
          </View>
        );
      })}

      <TouchableOpacity
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={isSaving}
        activeOpacity={0.84}
      >
        <Save color="#FFFFFF" size={18} />
        <Text style={styles.saveButtonText}>
          {isSaving ? 'OPSLAAN...' : 'DOCUMENTSET OPSLAAN'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (
  theme: ReturnType<typeof useTheme>['theme'],
  deviceType: ReturnType<typeof getDeviceType>
) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: deviceType === 'DESKTOP' ? 24 : 18,
      gap: 18,
    },
    header: {
      flexDirection: 'row',
      gap: 14,
      alignItems: 'flex-start',
    },
    headerIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCopy: {
      flex: 1,
      gap: 6,
    },
    headerTitle: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontWeight: '800',
    },
    headerText: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    summaryRow: {
      flexDirection: deviceType === 'MOBILE' ? 'column' : 'row',
      gap: 12,
    },
    summaryCard: {
      flex: 1,
      minHeight: 78,
      borderRadius: 16,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 16,
      justifyContent: 'center',
      gap: 4,
    },
    summaryValue: {
      color: theme.colors.textPrimary,
      fontSize: deviceType === 'DESKTOP' ? 24 : 20,
      fontWeight: '900',
    },
    summaryLabel: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    card: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      padding: 16,
      gap: 10,
    },
    cardComplete: {
      borderColor: theme.colors.success,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    cardTitle: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontWeight: '800',
    },
    cardCategory: {
      color: theme.colors.accent,
      fontSize: 11,
      fontWeight: '800',
    },
    cardDescription: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 20,
    },
    fieldHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 2,
    },
    fieldLabel: {
      color: theme.colors.textPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
    input: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: theme.colors.textPrimary,
      fontSize: 14,
    },
    notesInput: {
      minHeight: 96,
    },
    metaText: {
      color: theme.colors.textSecondary,
      fontSize: 12,
    },
    saveButton: {
      minHeight: 52,
      borderRadius: 18,
      backgroundColor: theme.colors.accent,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    saveButtonDisabled: {
      opacity: 0.7,
    },
    saveButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 0.8,
    },
  });
