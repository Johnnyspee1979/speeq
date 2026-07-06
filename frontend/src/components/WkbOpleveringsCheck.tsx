import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Camera, CheckSquare, Save, Square } from 'lucide-react-native';
import { DEFAULT_PROJECT_ID } from '../config/app';
import {
  getPunchlistItems,
  savePunchlistItems,
  type StoredPunchlistItem,
} from '../database/database';
import { getDeviceType } from '../lib/platform';
import { useTheme } from '../theme/ThemeProvider';
import type { CaptureTask } from '../types/CaptureTask';

type PunchlistDefinition = {
  id: string;
  title: string;
  inspectionPointId: string;
  description: string;
};

const INITIAL_PUNCHLIST: PunchlistDefinition[] = [
  {
    id: 'p1',
    title: 'Schilderwerk en wandafwerking krasvrij',
    inspectionPointId: 'oplevering-schilderwerk-001',
    description: 'Controleer zichtwerk, hoeken en wandafwerking op beschadigingen.',
  },
  {
    id: 'p2',
    title: 'Hang- en sluitwerk deuren correct afgesteld',
    inspectionPointId: 'oplevering-hang-sluitwerk-001',
    description: 'Leg sluitnaden, scharnieren en afstelling van deuren vast.',
  },
  {
    id: 'p3',
    title: 'Kitvoegen natte ruimtes sluitend',
    inspectionPointId: 'oplevering-kitwerk-001',
    description: 'Maak bewijs van kitwerk in badkamer, toilet en aansluitingen.',
  },
  {
    id: 'p4',
    title: 'Meterkast codering en indeling compleet',
    inspectionPointId: 'oplevering-meterkast-001',
    description: 'Controleer groepen, labels en veiligheidsaanduidingen.',
  },
  {
    id: 'p5',
    title: 'Installaties werkend getest',
    inspectionPointId: 'oplevering-installaties-001',
    description: 'Documenteer warmtepomp, ventilatie en functionele teststatus.',
  },
];

type LocalPunchlistItem = PunchlistDefinition & {
  checked: boolean;
  updatedAt: string | null;
  syncStatus: StoredPunchlistItem['syncStatus'];
};

interface WkbOpleveringsCheckProps {
  projectId?: string;
  onOpenCamera: (task: CaptureTask) => void;
}

const buildDefaultItems = (): LocalPunchlistItem[] =>
  INITIAL_PUNCHLIST.map((item) => ({
    ...item,
    checked: false,
    updatedAt: null,
    syncStatus: 'PENDING',
  }));

const mergeStoredItems = (storedItems: StoredPunchlistItem[]): LocalPunchlistItem[] => {
  const byId = new Map(storedItems.map((item) => [item.id, item]));

  return INITIAL_PUNCHLIST.map((item) => {
    const stored = byId.get(item.id);

    return {
      ...item,
      checked: stored?.checked ?? false,
      updatedAt: stored?.updatedAt ?? null,
      syncStatus: stored?.syncStatus ?? 'PENDING',
    };
  });
};

export default function WkbOpleveringsCheck({
  projectId = DEFAULT_PROJECT_ID,
  onOpenCamera,
}: WkbOpleveringsCheckProps) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const deviceType = getDeviceType(width);
  // Live foto maken werkt niet op een desktop-browser (geen bruikbare camera);
  // op de telefoon-browser wél. Camera-knop daarom grijs + tooltip op desktop.
  const isDesktopWeb = Platform.OS === 'web' && deviceType === 'DESKTOP';
  const styles = useMemo(() => createStyles(theme, deviceType), [theme, deviceType]);
  const [checklist, setChecklist] = useState<LocalPunchlistItem[]>(buildDefaultItems);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadChecklist = async () => {
      const storedItems = await getPunchlistItems(projectId);
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

  const completedCount = checklist.filter((item) => item.checked).length;
  const remainingCount = checklist.length - completedCount;

  const toggleItem = (id: string) => {
    setChecklist((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              checked: !item.checked,
              updatedAt: new Date().toISOString(),
              syncStatus: 'PENDING',
            }
          : item
      )
    );
  };

  const handleOpenCamera = (item: LocalPunchlistItem) => {
    // Op desktop opent de camera-tab niet (die zit alleen op mobiel in de nav),
    // dus de knop leek "niets te doen". Leg nu vriendelijk uit waar het wél werkt.
    if (isDesktopWeb) {
      if (typeof window !== 'undefined') {
        window.alert(
          'Foto maken werkt op de telefoon.\n\n' +
            'Scan de QR-code op "Mijn werkruimte" of open SpeeQ op je mobiel om ' +
            'bewijsfoto\'s te maken. Op de telefoon opent de camera direct.'
        );
      }
      return;
    }
    onOpenCamera({
      id: `oplevering-${item.id}`,
      title: item.title,
      description: item.description,
      inspectionPointId: item.inspectionPointId,
    });
  };

  const handleSaveChecklist = async () => {
    setIsSaving(true);

    try {
      const updatedAt = await savePunchlistItems(
        projectId,
        checklist.map((item) => ({
          id: item.id,
          title: item.title,
          checked: item.checked,
        }))
      );

      setChecklist((current) =>
        current.map((item) => ({
          ...item,
          updatedAt,
          syncStatus: 'PENDING',
        }))
      );

      if (remainingCount > 0) {
        Alert.alert(
          'Oplevering opgeslagen als restpuntenlijst',
          `Nog ${remainingCount} punt(en) open. De lijst is wel offline opgeslagen en kan later verder worden aangevuld.`
        );
      } else {
        Alert.alert(
          'Opleverings-check opgeslagen',
          'Alle punten zijn lokaal vastgelegd en klaar voor de verdere dossieropbouw.'
        );
      }
    } catch (error) {
      console.error('Opleverings-check opslaan faalde:', error);
      Alert.alert(
        'Opslaan mislukt',
        'Kon de opleverings-check niet lokaal opslaan.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const renderItem = ({ item }: { item: LocalPunchlistItem }) => (
    <View style={[styles.card, item.checked && styles.cardChecked]}>
      <TouchableOpacity
        style={styles.checkboxContainer}
        onPress={() => toggleItem(item.id)}
        activeOpacity={0.78}
      >
        {item.checked ? (
          <CheckSquare color={theme.colors.success} size={32} />
        ) : (
          <Square color={theme.colors.textSecondary} size={32} />
        )}
        <View style={styles.itemCopy}>
          <Text style={[styles.itemTitle, item.checked && styles.itemTitleChecked]}>
            {item.title}
          </Text>
          <Text style={styles.itemDescription}>{item.description}</Text>
          <Text style={styles.itemMeta}>
            {item.updatedAt
              ? `Laatst bijgewerkt: ${new Date(item.updatedAt).toLocaleString('nl-NL')}`
              : 'Nog niet lokaal opgeslagen'}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.cameraButton, isDesktopWeb && styles.cameraButtonDisabled]}
        onPress={() => handleOpenCamera(item)}
        activeOpacity={isDesktopWeb ? 1 : 0.8}
        accessibilityLabel={isDesktopWeb ? 'Foto maken — werkt op telefoon' : 'Foto maken voor dit punt'}
        {...(Platform.OS === 'web'
          ? ({ title: isDesktopWeb ? 'Werkt op telefoon' : 'Foto maken' } as object)
          : {})}
      >
        <Camera color={isDesktopWeb ? theme.colors.textSecondary : theme.colors.accent} size={24} />
        {isDesktopWeb ? <Text style={styles.cameraHint}>telefoon</Text> : null}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerEyebrow}>OFFLINE BORGINGSLIJST</Text>
        <Text style={styles.headerTitle}>Opleverings-check</Text>
        <Text style={styles.headerText}>
          Loop de woning of het pand langs, vink visuele controles af en leg afwijkingen
          direct vast met bewijsfoto&apos;s.
        </Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{completedCount}</Text>
          <Text style={styles.summaryLabel}>Afgevinkt</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{remainingCount}</Text>
          <Text style={styles.summaryLabel}>Open punten</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{projectId}</Text>
          <Text style={styles.summaryLabel}>Project</Text>
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
          <Save color="#FFFFFF" size={22} />
          <Text style={styles.saveButtonText}>
            {isSaving ? 'OPSLAAN…' : 'DOSSIER OPSLAAN'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (
  theme: { colors: Record<string, string> },
  deviceType: 'DESKTOP' | 'TABLET' | 'MOBILE'
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      overflow: 'auto' as any,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 22,
      paddingBottom: 14,
    },
    headerEyebrow: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    headerTitle: {
      color: theme.colors.textPrimary,
      fontSize: deviceType === 'DESKTOP' ? 34 : 28,
      fontWeight: '900',
      marginBottom: 8,
    },
    headerText: {
      color: theme.colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      maxWidth: 760,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    summaryCard: {
      flex: 1,
      minHeight: 96,
      borderRadius: 18,
      padding: 16,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: 'space-between',
    },
    summaryValue: {
      color: theme.colors.textPrimary,
      fontSize: deviceType === 'MOBILE' ? 26 : 30,
      fontWeight: '900',
    },
    summaryLabel: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
    },
    listContainer: {
      paddingHorizontal: 20,
      paddingBottom: 28,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 14,
      borderLeftWidth: 6,
      borderLeftColor: '#F59E0B',
      overflow: 'hidden',
    },
    cardChecked: {
      borderLeftColor: theme.colors.success,
    },
    checkboxContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 18,
      minHeight: 86,
    },
    itemCopy: {
      flex: 1,
      marginLeft: 12,
    },
    itemTitle: {
      color: theme.colors.textPrimary,
      fontSize: 17,
      fontWeight: '800',
      marginBottom: 4,
    },
    itemTitleChecked: {
      textDecorationLine: 'line-through',
      color: theme.colors.textSecondary,
    },
    itemDescription: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 6,
    },
    itemMeta: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    cameraButton: {
      width: 66,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceAlt,
      borderLeftWidth: 1,
      borderLeftColor: theme.colors.border,
    },
    cameraButtonDisabled: {
      opacity: 0.6,
      ...(Platform.OS === 'web' ? ({ cursor: 'not-allowed' } as object) : {}),
    },
    cameraHint: {
      marginTop: 3,
      fontSize: 9,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 20,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    saveButton: {
      minHeight: 62,
      borderRadius: 16,
      backgroundColor: '#FF6600',
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
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: 0.3,
    },
  });
