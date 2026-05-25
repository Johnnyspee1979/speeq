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
import { AlertOctagon, CheckCircle, Circle, FileCheck } from 'lucide-react-native';
import { DEFAULT_PROJECT_ID } from '../config/app';
import {
  getGereedmeldingItems,
  saveGereedmeldingItems,
  type StoredGereedmeldingItem,
} from '../database/database';
import { getDeviceType } from '../lib/platform';
import { useTheme } from '../theme/ThemeProvider';

type GereedmeldingDefinition = {
  id: string;
  title: string;
};

type LocalGereedmeldingItem = GereedmeldingDefinition & {
  checked: boolean;
  updatedAt: string | null;
  syncStatus: StoredGereedmeldingItem['syncStatus'];
};

type ChecklistStatus = {
  totalCount: number;
  checkedCount: number;
  allChecked: boolean;
  savedAt: string | null;
};

interface WkbGereedmeldingChecklistProps {
  projectId?: string;
  onStatusChange?: (status: ChecklistStatus) => void;
}

const GEREEDMELDING_REQUIREMENTS: GereedmeldingDefinition[] = [
  {
    id: 'req_1',
    title: 'Definitieve verklaring van de kwaliteitsborger aanwezig',
  },
  {
    id: 'req_2',
    title: 'As-built revisietekeningen compleet',
  },
  {
    id: 'req_3',
    title: 'Bewijslast constructieve veiligheid akkoord',
  },
  {
    id: 'req_4',
    title: 'Bewijslast brandveiligheid gereed',
  },
  {
    id: 'req_5',
    title: 'Energiezuinigheid, ventilatie en milieuprestatie compleet',
  },
  {
    id: 'req_6',
    title: 'Gelijkwaardige maatregelen verantwoord en gedocumenteerd',
  },
];

const buildDefaultItems = (): LocalGereedmeldingItem[] =>
  GEREEDMELDING_REQUIREMENTS.map((item) => ({
    ...item,
    checked: false,
    updatedAt: null,
    syncStatus: 'PENDING',
  }));

const mergeStoredItems = (
  storedItems: StoredGereedmeldingItem[]
): LocalGereedmeldingItem[] => {
  const byId = new Map(storedItems.map((item) => [item.id, item]));

  return GEREEDMELDING_REQUIREMENTS.map((item) => {
    const stored = byId.get(item.id);

    return {
      ...item,
      checked: stored?.checked ?? false,
      updatedAt: stored?.updatedAt ?? null,
      syncStatus: stored?.syncStatus ?? 'PENDING',
    };
  });
};

const buildStatus = (items: LocalGereedmeldingItem[]): ChecklistStatus => {
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

export default function WkbGereedmeldingChecklist({
  projectId = DEFAULT_PROJECT_ID,
  onStatusChange,
}: WkbGereedmeldingChecklistProps) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const deviceType = getDeviceType(width);
  const styles = useMemo(() => createStyles(theme, deviceType), [theme, deviceType]);
  const [checklist, setChecklist] = useState<LocalGereedmeldingItem[]>(buildDefaultItems);
  const [isSaving, setIsSaving] = useState(false);

  const status = useMemo(() => buildStatus(checklist), [checklist]);

  useEffect(() => {
    onStatusChange?.(status);
  }, [onStatusChange, status]);

  useEffect(() => {
    let isMounted = true;

    const loadChecklist = async () => {
      const storedItems = await getGereedmeldingItems(projectId);

      if (!isMounted) {
        return;
      }

      if (storedItems.length === 0) {
        setChecklist(buildDefaultItems());
        return;
      }

      setChecklist(mergeStoredItems(storedItems));
    };

    void loadChecklist();

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  const toggleItem = (id: string) => {
    setChecklist((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              checked: !item.checked,
              updatedAt: item.updatedAt,
              syncStatus: 'PENDING',
            }
          : item
      )
    );
  };

  const handleSaveChecklist = async () => {
    setIsSaving(true);

    try {
      const updatedAt = await saveGereedmeldingItems(
        projectId,
        checklist.map((item) => ({
          id: item.id,
          title: item.title,
          checked: item.checked,
        }))
      );

      const updatedChecklist = checklist.map((item) => ({
        ...item,
        updatedAt,
        syncStatus: 'PENDING' as const,
      }));

      setChecklist(updatedChecklist);

      const updatedStatus = buildStatus(updatedChecklist);

      if (!updatedStatus.allChecked) {
        Alert.alert(
          'Gereedmelding nog niet vrijgegeven',
          'De checklist is wel offline opgeslagen, maar nog niet compleet genoeg om de gereedmelding juridisch vrij te geven.'
        );
        return;
      }

      Alert.alert(
        'Gereedmelding vastgelegd',
        'De checklist is compleet en lokaal vergrendeld. Zodra er netwerk is, kan de STAM-gereedmelding worden verstuurd. Daarna geldt de termijn van 2 weken voor ingebruikname.'
      );
    } catch (error) {
      console.error('Gereedmelding-checklist opslaan faalde:', error);
      Alert.alert(
        'Opslaan mislukt',
        'Kon de gereedmelding-checklist niet lokaal opslaan.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const renderItem = ({ item }: { item: LocalGereedmeldingItem }) => (
    <TouchableOpacity
      style={[styles.card, item.checked && styles.cardChecked]}
      onPress={() => toggleItem(item.id)}
      activeOpacity={0.78}
    >
      <View style={styles.checkboxContainer}>
        {item.checked ? (
          <CheckCircle color={theme.colors.success} size={36} />
        ) : (
          <Circle color={theme.colors.textSecondary} size={36} />
        )}
      </View>
      <Text style={[styles.itemTitle, item.checked && styles.itemTitleChecked]}>
        {item.title}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gereedmelding Wkb</Text>
        <Text style={styles.headerSub}>Project: {projectId}</Text>
        <View style={styles.warningBox}>
          <AlertOctagon color="#F59E0B" size={20} />
          <Text style={styles.warningText}>
            Minimaal 2 weken voor ingebruikname indienen bij het bevoegd gezag.
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
      </View>

      <FlatList
        data={checklist}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSaveChecklist}
          disabled={isSaving}
          activeOpacity={0.85}
        >
          <FileCheck color="#FFFFFF" size={22} />
          <Text style={styles.saveButtonText}>
            {isSaving ? 'OPSLAAN…' : 'GEREEDMELDING VASTLEGGEN'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (
  theme: { name: 'dark' | 'light' | 'modern'; colors: Record<string, string> },
  deviceType: 'DESKTOP' | 'TABLET' | 'MOBILE'
) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
      marginBottom: 18,
    },
    header: {
      padding: 20,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontSize: deviceType === 'DESKTOP' ? 28 : 24,
      fontWeight: '900',
      color: theme.colors.textPrimary,
    },
    headerSub: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 4,
      marginBottom: 12,
    },
    warningBox: {
      flexDirection: 'row',
      backgroundColor: theme.name === 'dark' ? '#3A2C14' : '#FFF4E5',
      padding: 12,
      borderRadius: 10,
      alignItems: 'center',
    },
    warningText: {
      marginLeft: 8,
      fontSize: 13,
      color: '#F59E0B',
      fontWeight: '800',
      flex: 1,
      lineHeight: 18,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
    },
    summaryCard: {
      flex: 1,
      minHeight: 88,
      borderRadius: 14,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 14,
      justifyContent: 'space-between',
    },
    summaryValue: {
      fontSize: 26,
      fontWeight: '900',
      color: theme.colors.textPrimary,
    },
    summaryLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    listContainer: {
      padding: 16,
      paddingBottom: 20,
    },
    card: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 14,
      marginBottom: 12,
      alignItems: 'center',
      paddingRight: 16,
      minHeight: 82,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderLeftWidth: 6,
      borderLeftColor: '#FF6600',
    },
    cardChecked: {
      borderLeftColor: theme.colors.success,
      backgroundColor: theme.name === 'dark' ? '#102417' : '#F0FFF4',
    },
    checkboxContainer: {
      padding: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    itemTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      flex: 1,
      lineHeight: 22,
    },
    itemTitleChecked: {
      textDecorationLine: 'line-through',
      color: theme.colors.textSecondary,
    },
    footer: {
      padding: 20,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    saveButton: {
      backgroundColor: theme.colors.success,
      flexDirection: 'row',
      gap: 10,
      borderRadius: 14,
      minHeight: 62,
      justifyContent: 'center',
      alignItems: 'center',
    },
    saveButtonDisabled: {
      opacity: 0.7,
    },
    saveButtonText: {
      color: '#FFF',
      fontSize: 17,
      fontWeight: '900',
    },
  });
