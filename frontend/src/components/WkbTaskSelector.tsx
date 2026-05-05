import React, { useMemo, useState } from 'react';
import {
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  wkbTaskTemplates,
  type TaskCategory,
  type WkbTaskTemplate,
} from '../data/WkbTemplates';
import { getCaptureTimerBadgeLabel } from '../constants/Nen1006TimerProfiles';
import { getDeviceType } from '../lib/platform';
import NenTaskSelector from '../screens/NenTaskSelector';
import { useTheme } from '../theme/ThemeProvider';
import type { CaptureTask } from '../types/CaptureTask';

const SELECTOR_MODES = [
  { id: 'WKB' as const, label: 'Borgingspunten' },
  { id: 'NEN' as const, label: 'Slimme templates' },
];

const CATEGORIES: { id: TaskCategory | 'ALL'; label: string }[] = [
  { id: 'ALL', label: 'Alles' },
  { id: 'BOUW', label: 'Bouw' },
  { id: 'BOUWFYSICA', label: 'Bouwfysica' },
  { id: 'BRANDVEILIGHEID', label: 'Brandveiligheid' },
  { id: 'INSTALLATIE', label: 'Installatie' },
  { id: 'ELEKTRA', label: 'Elektra' },
  { id: 'AFBOUW_SCHILDER', label: 'Schilder/Afbouw' },
];

interface WkbTaskSelectorProps {
  onSelectTask: (task: CaptureTask) => void;
}

export default function WkbTaskSelector({ onSelectTask }: WkbTaskSelectorProps) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const deviceType = getDeviceType(width);
  const [activeMode, setActiveMode] = useState<'WKB' | 'NEN'>('WKB');
  const [activeCategory, setActiveCategory] = useState<TaskCategory | 'ALL'>('ALL');
  const styles = useMemo(() => createStyles(theme, deviceType), [theme, deviceType]);

  const filteredTasks = useMemo(
    () =>
      wkbTaskTemplates.filter(
        (task) => activeCategory === 'ALL' || task.categoryId === activeCategory
      ),
    [activeCategory]
  );

  const renderTaskCard = ({ item }: { item: WkbTaskTemplate }) => {
    const IconComponent = item.icon;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          onSelectTask({
            id: item.id,
            title: item.title,
            description: item.description,
            inspectionPointId: item.inspectionPointId,
            instruction: item.instruction,
            standards: item.standards,
            disciplineTitle: item.disciplineTitle,
            requiresExif: item.requiresExif,
            requiresMeasurementTool: item.requiresMeasurementTool,
            requiresTimer: item.requiresTimer,
            timerConfig: item.timerConfig,
            stopMoment: item.stopMoment,
            aiValidationKey: item.aiValidationKey,
            selectionSource: 'WKB',
          })
        }
        activeOpacity={0.72}
      >
        {/* Left color accent stripe */}
        <View style={[styles.cardAccentBar, { backgroundColor: item.color }]} />

        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: `${item.color}14` }]}>
          <IconComponent color={item.color} size={26} strokeWidth={1.8} />
        </View>

        {/* Content */}
        <View style={styles.textContainer}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardDescription}>{item.description}</Text>
          <Text style={styles.cardMeta}>{item.inspectionPointId}</Text>
          <View style={styles.cardBadgeRow}>
            {item.stopMoment ? (
              <View style={styles.cardBadge}>
                <Text style={styles.cardBadgeText}>{item.stopMoment}</Text>
              </View>
            ) : null}
            {item.requiresMeasurementTool ? (
              <View style={styles.cardBadge}>
                <Text style={styles.cardBadgeText}>MEETMIDDEL</Text>
              </View>
            ) : null}
            {item.requiresTimer ? (
              <View style={styles.cardBadge}>
                <Text style={styles.cardBadgeText}>
                  {getCaptureTimerBadgeLabel(item)}
                </Text>
              </View>
            ) : null}
            {item.aiValidationKey ? (
              <View style={[styles.cardBadge, styles.cardBadgeAi]}>
                <Text style={[styles.cardBadgeText, styles.cardBadgeTextAi]}>AI</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Arrow indicator */}
        <Text style={styles.cardArrow}>›</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.headerEyebrow}>BORGINGSPUNTEN</Text>
        <Text style={styles.headerTitle}>Wat ga je{'\n'}vastleggen?</Text>

        <View style={styles.modeContainer}>
          {SELECTOR_MODES.map((mode) => (
            <TouchableOpacity
              key={mode.id}
              style={[
                styles.modeButton,
                activeMode === mode.id && styles.modeButtonActive,
              ]}
              onPress={() => setActiveMode(mode.id)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  activeMode === mode.id && styles.modeButtonTextActive,
                ]}
              >
                {mode.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeMode === 'NEN' ? (
          <NenTaskSelector onSelectTask={onSelectTask} showHeader={false} />
        ) : (
          <>
            <View style={styles.filterContainer}>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={CATEGORIES}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.filterButton,
                      activeCategory === item.id && styles.filterButtonActive,
                    ]}
                    onPress={() => setActiveCategory(item.id)}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        activeCategory === item.id && styles.filterTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>

            <FlatList
              data={filteredTasks}
              keyExtractor={(item) => item.id}
              renderItem={renderTaskCard}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
            />
          </>
        )}
      </View>
    </View>
  );
}

const createStyles = (
  theme: { name?: string; colors: Record<string, string> },
  deviceType: 'DESKTOP' | 'TABLET' | 'MOBILE'
) => {
  const isDark = theme.name === 'dark';
  const isDesktop = deviceType === 'DESKTOP';

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      width: '100%',
      maxWidth: isDesktop ? 1080 : undefined,
      alignSelf: 'center',
      paddingHorizontal: isDesktop ? 32 : 16,
      paddingTop: isDesktop ? 32 : 20,
    },

    // Header
    headerEyebrow: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 3,
      color: theme.colors.accent,
      marginBottom: 8,
    },
    headerTitle: {
      fontSize: isDesktop ? 38 : 30,
      fontWeight: '900',
      color: theme.colors.textPrimary,
      lineHeight: isDesktop ? 44 : 36,
      letterSpacing: -1,
      marginBottom: 20,
    },

    // Mode toggle (segmented control style)
    modeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 20,
      padding: 4,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modeButton: {
      flex: 1,
      minHeight: 40,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 12,
    },
    modeButtonActive: {
      backgroundColor: theme.colors.accent,
    },
    modeButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    modeButtonTextActive: {
      color: '#FFFFFF',
    },

    // Filter pills
    filterContainer: {
      marginBottom: 18,
    },
    filterButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      backgroundColor: 'transparent',
      borderRadius: 999,
      marginRight: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    filterButtonActive: {
      backgroundColor: theme.colors.textPrimary,
      borderColor: theme.colors.textPrimary,
    },
    filterText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    filterTextActive: {
      color: isDark ? '#04060E' : '#FFFFFF',
      fontWeight: '700',
    },

    listContainer: {
      paddingBottom: 60,
      gap: 10,
    },

    // Card — 2026 style
    card: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      paddingVertical: 16,
      paddingRight: 16,
      paddingLeft: 0,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    cardAccentBar: {
      width: 3,
      alignSelf: 'stretch',
      borderRadius: 2,
      marginRight: 14,
      marginLeft: 1,
    },
    iconContainer: {
      width: 52,
      height: 52,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    textContainer: {
      flex: 1,
      gap: 2,
    },
    cardTitle: {
      fontSize: isDesktop ? 17 : 15,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      letterSpacing: -0.3,
    },
    cardDescription: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      fontWeight: '400',
      lineHeight: 18,
    },
    cardMeta: {
      fontSize: 10,
      color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.25)',
      fontWeight: '600',
      letterSpacing: 0.5,
      marginTop: 2,
      fontFamily: 'monospace' as any,
    },
    cardBadgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 8,
    },
    cardBadge: {
      borderRadius: 6,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    cardBadgeAi: {
      backgroundColor: isDark ? 'rgba(164,13,47,0.15)' : 'rgba(164,13,47,0.08)',
      borderColor: 'rgba(164,13,47,0.3)',
    },
    cardBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      letterSpacing: 0.5,
    },
    cardBadgeTextAi: {
      color: theme.colors.accent,
    },
    cardArrow: {
      fontSize: 22,
      color: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.2)',
      fontWeight: '300',
      marginLeft: 8,
    },
  });
};
