import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  Image,
} from 'react-native';
import {
  AlertCircle,
  Camera,
  Droplet,
  Flame,
  Hammer,
  Home,
  Layout,
  Search,
  ShieldCheck,
  XCircle,
  Zap,
} from 'lucide-react-native';
import {
  NEN_DISCIPLINES,
  findNenDisciplineById,
  getNenDisciplinesForNorm,
  toNenCaptureTask,
  type Discipline,
  type NenIconName,
  type NenNorm,
  type NenTask,
} from '../constants/NenStandards';
import { getCaptureTimerBadgeLabel } from '../constants/Nen1006TimerProfiles';
import { getDeviceType } from '../lib/platform';
import { searchNenNorm } from '../services/NenSearchService';
import { useTheme } from '../theme/ThemeProvider';
import type { CaptureTask } from '../types/CaptureTask';

interface NenTaskSelectorProps {
  onSelectTask: (task: CaptureTask) => void;
  showHeader?: boolean;
}

const QUICK_SEARCH_TERMS = [
  'betonbon',
  'latei',
  'rook',
  'valdorpel',
  'meterkast',
  'persproef',
  'riolering',
  'warmtepomp',
  'isolatie',
  'stuc',
  'brandklep',
  'toilet',
  'glas',
];

const getIcon = (iconName: NenIconName, color: string, size: number) => {
  switch (iconName) {
    case 'Zap':
      return <Zap color={color} size={size} />;
    case 'Droplet':
      return <Droplet color={color} size={size} />;
    case 'Flame':
      return <Flame color={color} size={size} />;
    case 'Home':
      return <Home color={color} size={size} />;
    case 'Layout':
      return <Layout color={color} size={size} />;
    case 'Hammer':
      return <Hammer color={color} size={size} />;
    default:
      return <AlertCircle color={color} size={size} />;
  }
};

export default function NenTaskSelector({
  onSelectTask,
  showHeader = true,
}: NenTaskSelectorProps) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const deviceType = getDeviceType(width);
  const styles = useMemo(() => createStyles(theme, deviceType), [theme, deviceType]);
  const [selectedDiscipline, setSelectedDiscipline] = useState<Discipline | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const trimmedQuery = searchQuery.trim();
  const normResults = useMemo(
    () => (trimmedQuery ? searchNenNorm(trimmedQuery).slice(0, 12) : []),
    [trimmedQuery]
  );

  const groupedTasks = useMemo(() => {
    if (!selectedDiscipline) return [];

    const groups: { normTitle: string; tasks: typeof selectedDiscipline.tasks }[] = [];

    selectedDiscipline.tasks.forEach((task) => {
      // Bepaal de hoofd-norm (vaak de 1e in de lijst) als sectie-kop
      const primaryNorm = task.normCodes[0] || 'Overige Eisen & Normen';
      let group = groups.find((g) => g.normTitle === primaryNorm);
      if (!group) {
        group = { normTitle: primaryNorm, tasks: [] };
        groups.push(group);
      }
      group.tasks.push(task);
    });

    return groups;
  }, [selectedDiscipline]);

  const handleStartTask = (discipline: Discipline, task: NenTask) => {
    setSelectedDiscipline(null);
    onSelectTask(toNenCaptureTask(discipline, task));
  };

  const handleOpenNorm = (norm: NenNorm) => {
    const discipline =
      findNenDisciplineById(norm.primaryDisciplineId) ??
      getNenDisciplinesForNorm(norm)[0] ??
      null;

    if (discipline) {
      setSelectedDiscipline(discipline);
    }
  };

  const renderDisciplineCard = ({ item }: { item: Discipline }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.82}
      onPress={() => setSelectedDiscipline(item)}
    >
      <View style={[styles.iconContainer, { backgroundColor: `${item.accentColor}18` }]}>
        {getIcon(item.iconName, item.accentColor, 30)}
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={[styles.cardStandards, { color: item.accentColor }]}>
          {item.standards}
        </Text>
        <Text style={styles.cardDescription}>{item.description}</Text>
        <Text style={styles.cardMeta}>
          {item.tasks.length} compliance-template{item.tasks.length === 1 ? '' : 's'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderNormCard = ({ item }: { item: NenNorm }) => {
    const linkedDisciplines = getNenDisciplinesForNorm(item);
    const primaryDiscipline =
      findNenDisciplineById(item.primaryDisciplineId) ?? linkedDisciplines[0] ?? null;

    return (
      <View style={styles.normCard}>
        <View style={styles.normHeader}>
          <View style={styles.normCodeBadge}>
            <Text style={styles.normCode}>{item.code}</Text>
          </View>
          <View style={styles.normCategoryBadge}>
            <Text style={styles.normCategoryText}>{item.category}</Text>
          </View>
        </View>

        <Text style={styles.normTitle}>{item.title}</Text>
        <Text style={styles.normDescription}>{item.description}</Text>

        <Text style={styles.normCheckLabel}>Wat moet je vastleggen?</Text>
        <Text style={styles.normCheckText}>{item.wkbCheck}</Text>

        <View style={styles.normDisciplineRow}>
          {linkedDisciplines.map((discipline) => (
            <View
              key={`${item.code}-${discipline.id}`}
              style={[
                styles.normDisciplineChip,
                { backgroundColor: `${discipline.accentColor}16` },
              ]}
            >
              <Text
                style={[
                  styles.normDisciplineChipText,
                  { color: discipline.accentColor },
                ]}
              >
                {discipline.title}
              </Text>
            </View>
          ))}
        </View>

        {primaryDiscipline ? (
          <TouchableOpacity
            style={[
              styles.normActionButton,
              { backgroundColor: primaryDiscipline.accentColor },
            ]}
            activeOpacity={0.85}
            onPress={() => handleOpenNorm(item)}
          >
            <Text style={styles.normActionButtonText}>
              Toon discipline: {primaryDiscipline.title}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {showHeader ? (
        <View style={styles.header}>
          <Image
            source={require('../../assets/logo-spee.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>NEN Smart Templates</Text>
          <Text style={styles.headerSubtitle}>
            Kies je discipline of zoek direct op norm, bouwdeel of risico. Zo krijgt
            de vakman precies de bewijslast te zien die voor het Bbl en de Wkb telt.
          </Text>
        </View>
      ) : null}

      <View style={styles.searchShell}>
        <View style={styles.searchInputRow}>
          <Search color={theme.colors.textSecondary} size={18} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Zoek op betonbon, rook, toilet, meterkast of normcode"
            placeholderTextColor={theme.colors.textSecondary}
            style={styles.searchInput}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {searchQuery ? (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              activeOpacity={0.8}
              style={styles.searchClearButton}
            >
              <Text style={styles.searchClearText}>Wis</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.quickSearchRow}>
          {QUICK_SEARCH_TERMS.map((term) => (
            <TouchableOpacity
              key={term}
              style={styles.quickSearchChip}
              activeOpacity={0.82}
              onPress={() => setSearchQuery(term)}
            >
              <Text style={styles.quickSearchChipText}>{term}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {trimmedQuery ? (
        <FlatList
          data={normResults}
          keyExtractor={(item) => item.code}
          renderItem={renderNormCard}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>Geen norm gevonden</Text>
              <Text style={styles.emptyStateText}>
                Probeer een ander woord zoals betonbon, rook, toilet, ventilatie of
                meterkast.
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={NEN_DISCIPLINES}
          keyExtractor={(item) => item.id}
          renderItem={renderDisciplineCard}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        visible={Boolean(selectedDiscipline)}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedDiscipline(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleStack}>
                <Text style={styles.modalTitle}>{selectedDiscipline?.title}</Text>
                <Text style={styles.modalSubtitle}>
                  Verplichte bewijsvoering op basis van {selectedDiscipline?.standards}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedDiscipline(null)}
                style={styles.closeButton}
                activeOpacity={0.8}
              >
                <XCircle color={theme.colors.danger} size={30} />
              </TouchableOpacity>
            </View>

            {selectedDiscipline ? (
              <View
                style={[
                  styles.complianceBanner,
                  { borderColor: `${selectedDiscipline.accentColor}4D` },
                ]}
              >
                <ShieldCheck color={selectedDiscipline.accentColor} size={20} />
                <Text style={styles.complianceBannerText}>
                  {selectedDiscipline.description}
                </Text>
              </View>
            ) : null}

            {selectedDiscipline?.summaryNorms?.length ? (
              <View style={styles.summaryNormRow}>
                {selectedDiscipline.summaryNorms.map((normCode) => (
                  <View key={normCode} style={styles.summaryNormChip}>
                    <Text style={styles.summaryNormChipText}>{normCode}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <ScrollView
              contentContainerStyle={styles.taskList}
              showsVerticalScrollIndicator={false}
            >
              {groupedTasks.map((group) => (
                <View key={group.normTitle} style={styles.taskGroupContainer}>
                  <View
                    style={[
                      styles.taskGroupHeader,
                      {
                        borderLeftColor:
                          selectedDiscipline?.accentColor ?? theme.colors.accent,
                      },
                    ]}
                  >
                    <Text style={styles.taskGroupTitle}>{group.normTitle}</Text>
                    <Text style={styles.taskGroupCount}>
                      {group.tasks.length} Check
                      {group.tasks.length === 1 ? '' : 's'}
                    </Text>
                  </View>

                  {group.tasks.map((task) => (
                    <View key={task.id} style={styles.taskCard}>
                      <View style={styles.taskHeader}>
                        <Text style={styles.taskTitle}>{task.title}</Text>
                        <View style={styles.taskBadgeRow}>
                          {task.stopMoment ? (
                            <View style={styles.taskBadge}>
                              <Text style={styles.taskBadgeText}>{task.stopMoment}</Text>
                            </View>
                          ) : null}
                          {task.requiresMeasurementTool ? (
                            <View style={styles.taskBadge}>
                              <Text style={styles.taskBadgeText}>MEETMIDDEL IN BEELD</Text>
                            </View>
                          ) : null}
                          {task.requiresTimer ? (
                            <View style={styles.taskBadge}>
                              <Text style={styles.taskBadgeText}>
                                {getCaptureTimerBadgeLabel(task)}
                              </Text>
                            </View>
                          ) : null}
                          {task.requiresExif ? (
                            <View style={styles.taskBadge}>
                              <Text style={styles.taskBadgeText}>EXIF VERPLICHT</Text>
                            </View>
                          ) : null}
                          {task.aiValidationKey ? (
                            <View style={styles.taskBadge}>
                              <Text style={styles.taskBadgeText}>AI CHECK</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <Text style={styles.taskNormCodes}>{task.normCodes.join(' / ')}</Text>
                      <Text style={styles.taskInstruction}>{task.instruction}</Text>

                      <TouchableOpacity
                        style={[
                          styles.cameraButton,
                          {
                            backgroundColor:
                              selectedDiscipline?.accentColor ?? theme.colors.accent,
                          },
                        ]}
                        activeOpacity={0.86}
                        onPress={() => {
                          if (selectedDiscipline) {
                            handleStartTask(selectedDiscipline, task);
                          }
                        }}
                      >
                        <Camera color="#FFF" size={22} />
                        <Text style={styles.cameraButtonText}>VASTLEGGEN</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
      overflow: 'auto' as any,
    },
    header: {
      marginBottom: 18,
    },
    headerLogo: {
      width: 140,
      height: 48,
      marginBottom: 12,
    },
    headerTitle: {
      fontSize: deviceType === 'DESKTOP' ? 30 : 26,
      fontWeight: '900',
      color: theme.colors.textPrimary,
      marginBottom: 8,
    },
    headerSubtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.textSecondary,
      maxWidth: 760,
    },
    searchShell: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 16,
      marginBottom: 16,
    },
    searchInputRow: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 16,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 14,
    },
    searchInput: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontWeight: '600',
      paddingVertical: 12,
    },
    searchClearButton: {
      paddingVertical: 8,
      paddingHorizontal: 2,
    },
    searchClearText: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.colors.accent,
    },
    quickSearchRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 14,
    },
    quickSearchChip: {
      borderRadius: 999,
      backgroundColor: theme.colors.accentMuted,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 9,
      paddingHorizontal: 14,
    },
    quickSearchChipText: {
      color: theme.colors.textPrimary,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    listContainer: {
      paddingBottom: 40,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 22,
      padding: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 18,
      elevation: 3,
    },
    iconContainer: {
      width: 66,
      height: 66,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    cardContent: {
      flex: 1,
    },
    cardTitle: {
      fontSize: 19,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      marginBottom: 4,
    },
    cardStandards: {
      fontSize: 13,
      fontWeight: '800',
      marginBottom: 6,
    },
    cardDescription: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textSecondary,
      marginBottom: 6,
    },
    cardMeta: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.chip,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    normCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 22,
      padding: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    normHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
    },
    normCodeBadge: {
      borderRadius: 999,
      backgroundColor: '#10243B',
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    normCode: {
      color: '#F8FAFC',
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.45,
    },
    normCategoryBadge: {
      borderRadius: 999,
      backgroundColor: theme.colors.accentMuted,
      paddingVertical: 7,
      paddingHorizontal: 11,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    normCategoryText: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    normTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      marginBottom: 6,
    },
    normDescription: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textSecondary,
      marginBottom: 12,
    },
    normCheckLabel: {
      fontSize: 12,
      fontWeight: '900',
      color: theme.colors.chip,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 6,
    },
    normCheckText: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.textPrimary,
      marginBottom: 14,
    },
    normDisciplineRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 14,
    },
    normDisciplineChip: {
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    normDisciplineChipText: {
      fontSize: 12,
      fontWeight: '800',
    },
    normActionButton: {
      minHeight: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    normActionButtonText: {
      color: '#FFF',
      fontSize: 14,
      fontWeight: '900',
      textAlign: 'center',
    },
    emptyState: {
      backgroundColor: theme.colors.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 20,
      alignItems: 'center',
    },
    emptyStateTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      marginBottom: 8,
    },
    emptyStateText: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      maxWidth: 420,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(4, 10, 18, 0.52)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: 24,
      paddingHorizontal: 20,
      paddingBottom: 24,
      minHeight: '72%',
      maxHeight: '92%',
      overflow: 'hidden',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    modalTitleStack: {
      flex: 1,
    },
    modalTitle: {
      fontSize: 25,
      fontWeight: '900',
      color: theme.colors.textPrimary,
      marginBottom: 6,
    },
    modalSubtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textSecondary,
    },
    closeButton: {
      paddingTop: 2,
      paddingHorizontal: 2,
    },
    complianceBanner: {
      marginTop: 16,
      marginBottom: 12,
      padding: 14,
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
    },
    complianceBannerText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    summaryNormRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 4,
    },
    summaryNormChip: {
      backgroundColor: theme.colors.surface,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 7,
      paddingHorizontal: 11,
    },
    summaryNormChipText: {
      color: theme.colors.chip,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.35,
    },
    taskList: {
      paddingTop: 12,
      paddingBottom: 24,
    },
    taskGroupContainer: {
      marginBottom: 20,
    },
    taskGroupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: 12,
      borderLeftWidth: 4,
      marginBottom: 12,
    },
    taskGroupTitle: {
      fontSize: 18,
      fontWeight: '900',
      color: theme.colors.textPrimary,
      letterSpacing: 0.3,
    },
    taskGroupCount: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.colors.textSecondary,
    },
    taskCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    taskHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 8,
    },
    taskBadgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: 8,
      flexShrink: 1,
    },
    taskTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    taskBadge: {
      backgroundColor: `${theme.colors.success}20`,
      borderRadius: 999,
      paddingVertical: 7,
      paddingHorizontal: 10,
    },
    taskBadgeText: {
      color: theme.colors.success,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.5,
    },
    taskNormCodes: {
      fontSize: 12,
      fontWeight: '900',
      color: theme.colors.warning,
      letterSpacing: 0.45,
      textTransform: 'uppercase',
      marginBottom: 10,
    },
    taskInstruction: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.textSecondary,
      marginBottom: 16,
    },
    cameraButton: {
      minHeight: 58,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    cameraButtonText: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: 0.6,
    },
  });
