import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { BookOpenCheck, CheckCircle, Circle, FileBadge2 } from 'lucide-react-native';
import { DEFAULT_PROJECT_ID } from '../config/app';
import {
  getConsumerDossierItems,
  saveConsumerDossierItems,
  type StoredConsumerDossierItem,
} from '../database/database';
import { getDeviceType } from '../lib/platform';
import {
  CONSUMER_DOSSIER_REQUIREMENTS,
  type StoredConsumerDossierItem as ComplianceConsumerItem,
} from '../services/wkbCompliance';
import { useTheme } from '../theme/ThemeProvider';

type ConsumerChecklistDefinition = {
  id: string;
  title: string;
  description: string;
  legalBasis: string;
};

type LocalConsumerDossierItem = ConsumerChecklistDefinition & {
  checked: boolean;
  updatedAt: string | null;
  syncStatus: StoredConsumerDossierItem['syncStatus'];
};

type ConsumerChecklistStatus = {
  totalCount: number;
  checkedCount: number;
  allChecked: boolean;
  savedAt: string | null;
};

interface ConsumerDossierChecklistProps {
  projectId?: string;
  onStatusChange?: (
    status: ConsumerChecklistStatus,
    items: ComplianceConsumerItem[]
  ) => void;
}

const buildDefaultItems = (): LocalConsumerDossierItem[] =>
  CONSUMER_DOSSIER_REQUIREMENTS.map((item) => ({
    ...item,
    checked: false,
    updatedAt: null,
    syncStatus: 'PENDING',
  }));

const mergeStoredItems = (
  storedItems: StoredConsumerDossierItem[]
): LocalConsumerDossierItem[] => {
  const byId = new Map(storedItems.map((item) => [item.id, item]));

  return CONSUMER_DOSSIER_REQUIREMENTS.map((item) => {
    const stored = byId.get(item.id);

    return {
      ...item,
      checked: stored?.checked ?? false,
      updatedAt: stored?.updatedAt ?? null,
      syncStatus: stored?.syncStatus ?? 'PENDING',
    };
  });
};

const buildStatus = (
  items: LocalConsumerDossierItem[]
): ConsumerChecklistStatus => {
  const checkedCount = items.filter((item) => item.checked).length;
  const savedAt =
    items
      .map((item) => item.updatedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

  return {
    totalCount: items.length,
    checkedCount,
    allChecked: checkedCount === items.length,
    savedAt,
  };
};

const toComplianceItems = (
  items: LocalConsumerDossierItem[]
): ComplianceConsumerItem[] =>
  items.map((item) => ({
    id: item.id,
    title: item.title,
    checked: item.checked,
    updatedAt: item.updatedAt,
    syncStatus: item.syncStatus,
  }));

export default function ConsumerDossierChecklist({
  projectId = DEFAULT_PROJECT_ID,
  onStatusChange,
}: ConsumerDossierChecklistProps) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const deviceType = getDeviceType(width);
  const styles = useMemo(() => createStyles(theme, deviceType), [theme, deviceType]);
  const [items, setItems] = useState<LocalConsumerDossierItem[]>(buildDefaultItems);
  const [isSaving, setIsSaving] = useState(false);
  const status = useMemo(() => buildStatus(items), [items]);

  useEffect(() => {
    onStatusChange?.(status, toComplianceItems(items));
  }, [items, onStatusChange, status]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const stored = await getConsumerDossierItems(projectId);

      if (!isMounted) {
        return;
      }

      if (stored.length === 0) {
        setItems(buildDefaultItems());
        return;
      }

      setItems(mergeStoredItems(stored));
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  const toggleItem = (id: string) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              checked: !item.checked,
              syncStatus: 'PENDING',
            }
          : item
      )
    );
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const updatedAt = await saveConsumerDossierItems(
        projectId,
        items.map((item) => ({
          id: item.id,
          title: item.title,
          checked: item.checked,
        }))
      );

      const updatedItems = items.map((item) => ({
        ...item,
        updatedAt,
        syncStatus: 'PENDING' as const,
      }));

      setItems(updatedItems);

      if (updatedItems.every((item) => item.checked)) {
        Alert.alert(
          'Consumentendossier checklist compleet',
          'De overdrachtsinformatie is lokaal vergrendeld en klaar om mee te gaan in het consumentendossier.'
        );
      } else {
        Alert.alert(
          'Checklist opgeslagen',
          'De consumentendossier-checklist is lokaal bewaard. Rond de openstaande overdrachtsinformatie af voordat je het dossier deelt.'
        );
      }
    } catch (error) {
      console.error('Consumentendossier-checklist opslaan faalde:', error);
      Alert.alert(
        'Opslaan mislukt',
        'Kon de consumentendossier-checklist niet lokaal opslaan.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const renderItem = ({ item }: { item: LocalConsumerDossierItem }) => (
    <TouchableOpacity
      style={[styles.card, item.checked && styles.cardChecked]}
      activeOpacity={0.82}
      onPress={() => toggleItem(item.id)}
    >
      <View style={styles.cardHeader}>
        {item.checked ? (
          <CheckCircle color={theme.colors.success} size={28} />
        ) : (
          <Circle color={theme.colors.textSecondary} size={28} />
        )}
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardLegal}>{item.legalBasis}</Text>
        </View>
      </View>
      <Text style={styles.cardDescription}>{item.description}</Text>
      {item.updatedAt ? (
        <Text style={styles.cardMeta}>
          Lokaal bijgewerkt op {new Date(item.updatedAt).toLocaleString('nl-NL')}
        </Text>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <BookOpenCheck color={theme.colors.accent} size={22} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Consumentendossier checklist</Text>
          <Text style={styles.headerText}>
            Borg de overdrachtsinformatie voor de koper conform art. 7:757a BW en
            NPR 8092. Zonder afwijkende contractafspraak geldt deze checklist als
            de standaardset voor overdracht.
          </Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{status.checkedCount}</Text>
          <Text style={styles.summaryLabel}>Afgevinkt</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{status.totalCount - status.checkedCount}</Text>
          <Text style={styles.summaryLabel}>Nog open</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{projectId}</Text>
          <Text style={styles.summaryLabel}>Project</Text>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        scrollEnabled={false}
      />

      <TouchableOpacity
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        disabled={isSaving}
        activeOpacity={0.85}
        onPress={() => void handleSave()}
      >
        <FileBadge2 color="#FFFFFF" size={20} />
        <Text style={styles.saveButtonText}>
          {isSaving ? 'OPSLAAN...' : 'CHECKLIST LOKAAL OPSLAAN'}
        </Text>
      </TouchableOpacity>
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
      alignItems: 'flex-start',
    },
    headerIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCopy: {
      flex: 1,
      gap: 4,
    },
    headerTitle: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontWeight: '800',
    },
    headerText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 20,
    },
    summaryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    summaryCard: {
      flex: 1,
      minWidth: deviceType === 'MOBILE' ? '47%' : 160,
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
    },
    summaryValue: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontWeight: '800',
    },
    summaryLabel: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      marginTop: 4,
    },
    listContent: {
      gap: 12,
    },
    card: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 16,
      gap: 10,
    },
    cardChecked: {
      borderColor: `${theme.colors.success}66`,
    },
    cardHeader: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'flex-start',
    },
    cardTitleBlock: {
      flex: 1,
      gap: 4,
    },
    cardTitle: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    cardLegal: {
      color: theme.colors.warning,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    cardDescription: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
    },
    cardMeta: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      fontWeight: '600',
    },
    saveButton: {
      minHeight: 54,
      borderRadius: 16,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    saveButtonDisabled: {
      opacity: 0.65,
    },
    saveButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 0.45,
    },
  });
