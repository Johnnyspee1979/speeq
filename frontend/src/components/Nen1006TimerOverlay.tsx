import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Timer } from 'react-native-stopwatch-timer';
import {
  getNen1006TimerDurationLabel,
  getNen1006TimerDurationMs,
  getNen1006TimerProfile,
  profileSupportsVolumeExtension,
} from '../constants/Nen1006TimerProfiles';
import { useTheme } from '../theme/ThemeProvider';
import type { Nen1006TimerProfileId } from '../types/CaptureTask';

interface Nen1006TimerOverlayProps {
  profileId: Nen1006TimerProfileId;
  extraVolumeBlocks: number;
  timerInstanceKey: number;
  isRunning: boolean;
  isCapturing: boolean;
  hasStarted: boolean;
  isAwaitingEndCapture: boolean;
  isComplete: boolean;
  startCapturedAt: string | null;
  endCapturedAt: string | null;
  onProfileChange: (profileId: Nen1006TimerProfileId) => void;
  onExtraVolumeBlocksChange: (nextValue: number) => void;
  onStartCapture: () => void;
  onEndCapture: () => void;
  onReset: () => void;
  onTimerFinish: () => void;
}

const PROFILE_ORDER: Nen1006TimerProfileId[] = [
  'WATER_LEAK_TIGHTNESS_10_MIN',
  'WATER_PRESSURE_RESISTANCE_10_MIN',
  'AIR_GAS_LEAK_TIGHTNESS_120_MIN',
  'AIR_GAS_PRESSURE_RESISTANCE_10_MIN',
];

const formatMoment = (value: string | null) => {
  if (!value) {
    return 'Nog niet vastgelegd';
  }

  return new Date(value).toLocaleString('nl-NL', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export default function Nen1006TimerOverlay({
  profileId,
  extraVolumeBlocks,
  timerInstanceKey,
  isRunning,
  isCapturing,
  hasStarted,
  isAwaitingEndCapture,
  isComplete,
  startCapturedAt,
  endCapturedAt,
  onProfileChange,
  onExtraVolumeBlocksChange,
  onStartCapture,
  onEndCapture,
  onReset,
  onTimerFinish,
}: Nen1006TimerOverlayProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const profile = getNen1006TimerProfile(profileId);
  const supportsVolumeExtension = profileSupportsVolumeExtension(profileId);
  const totalDurationMs = getNen1006TimerDurationMs(profileId, extraVolumeBlocks);
  const totalDurationLabel = getNen1006TimerDurationLabel(profileId, extraVolumeBlocks);
  const profileSelectionLocked = hasStarted && !isComplete;

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>NEN 1006 / WB 2.3</Text>
      <Text style={styles.title}>Persproef Timer Overlay</Text>
      <Text style={styles.subtitle}>
        Maak eerst de beginfoto van de manometer. De eindfoto wordt pas vrijgegeven
        zodra de volledige wachttijd is verstreken.
      </Text>

      <View style={styles.profileGrid}>
        {PROFILE_ORDER.map((candidate) => {
          const candidateProfile = getNen1006TimerProfile(candidate);
          const selected = candidate === profileId;

          return (
            <TouchableOpacity
              key={candidate}
              style={[
                styles.profileChip,
                selected && styles.profileChipSelected,
                profileSelectionLocked && styles.profileChipLocked,
              ]}
              activeOpacity={0.85}
              disabled={profileSelectionLocked}
              onPress={() => onProfileChange(candidate)}
            >
              <Text
                style={[
                  styles.profileChipTitle,
                  selected && styles.profileChipTitleSelected,
                ]}
              >
                {candidateProfile.shortLabel}
              </Text>
              <Text
                style={[
                  styles.profileChipText,
                  selected && styles.profileChipTextSelected,
                ]}
              >
                {candidateProfile.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>{profile.title}</Text>
        <Text style={styles.summaryText}>{profile.description}</Text>
        <Text style={styles.durationText}>Wachttijd: {totalDurationLabel}</Text>
      </View>

      {supportsVolumeExtension ? (
        <View style={styles.volumeCard}>
          <Text style={styles.volumeTitle}>Extra leidinginhoud boven 100 liter</Text>
          <Text style={styles.volumeText}>
            Voeg 20 minuten toe per extra blok van 100 liter leidinginhoud.
          </Text>
          <View style={styles.volumeControls}>
            <TouchableOpacity
              style={[
                styles.volumeButton,
                profileSelectionLocked && styles.volumeButtonDisabled,
              ]}
              activeOpacity={0.85}
              disabled={profileSelectionLocked || extraVolumeBlocks <= 0}
              onPress={() =>
                onExtraVolumeBlocksChange(Math.max(extraVolumeBlocks - 1, 0))
              }
            >
              <Text style={styles.volumeButtonText}>-100 L</Text>
            </TouchableOpacity>
            <View style={styles.volumeValue}>
              <Text style={styles.volumeValueText}>
                {extraVolumeBlocks * 100} L extra
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.volumeButton,
                profileSelectionLocked && styles.volumeButtonDisabled,
              ]}
              activeOpacity={0.85}
              disabled={profileSelectionLocked}
              onPress={() => onExtraVolumeBlocksChange(extraVolumeBlocks + 1)}
            >
              <Text style={styles.volumeButtonText}>+100 L</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View style={styles.timerShell}>
        <Timer
          key={`${profileId}-${extraVolumeBlocks}-${timerInstanceKey}`}
          totalDuration={totalDurationMs}
          start={isRunning}
          msecs={false}
          handleFinish={onTimerFinish}
          options={createTimerOptions(theme)}
        />
      </View>

      <View style={styles.statusGrid}>
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Beginfoto</Text>
          <Text style={styles.statusValue}>{formatMoment(startCapturedAt)}</Text>
        </View>
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Eindfoto</Text>
          <Text style={styles.statusValue}>{formatMoment(endCapturedAt)}</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.primaryAction}
          activeOpacity={0.88}
          disabled={isCapturing}
          onPress={onStartCapture}
        >
          <Text style={styles.primaryActionText}>
            {hasStarted && !isComplete
              ? 'Beginfoto opnieuw maken & timer herstarten'
              : 'Maak beginfoto & start timer'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.secondaryAction,
            (!isAwaitingEndCapture || isCapturing) && styles.actionDisabled,
          ]}
          activeOpacity={0.88}
          disabled={!isAwaitingEndCapture || isCapturing}
          onPress={onEndCapture}
        >
          <Text style={styles.secondaryActionText}>Maak eindfoto & rond af</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.resetRow}>
        <TouchableOpacity
          style={styles.resetAction}
          activeOpacity={0.85}
          disabled={isCapturing}
          onPress={onReset}
        >
          <Text style={styles.resetActionText}>Reset timer-sessie</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.noticeCard}>
        <Text style={styles.noticeText}>
          {isComplete
            ? 'Beginfoto, wachttijd en eindfoto zijn vastgelegd.'
            : isAwaitingEndCapture
              ? 'Wachttijd voltooid. De eindfoto is nu verplicht om de persproef af te ronden.'
              : hasStarted
                ? 'Timer loopt. De eindfoto blijft geblokkeerd totdat de volledige wachttijd is verstreken.'
                : 'Kies de juiste testmethode en leg daarna de beginfoto van de manometer vast.'}
        </Text>
      </View>
    </View>
  );
}

const createTimerOptions = (theme: { colors: Record<string, string> }) => ({
  container: {
    backgroundColor: theme.colors.surfaceAlt,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    width: 220,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  text: {
    fontSize: 34,
    color: theme.colors.textPrimary,
    fontWeight: '800' as const,
    marginLeft: 0,
    letterSpacing: 1,
  },
});

const createStyles = (theme: { colors: Record<string, string> }) =>
  StyleSheet.create({
    container: {
      borderRadius: 22,
      padding: 18,
      backgroundColor: 'rgba(8, 11, 18, 0.9)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      gap: 14,
    },
    eyebrow: {
      color: '#9CCBFF',
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    title: {
      color: '#F8FAFC',
      fontSize: 24,
      fontWeight: '900',
    },
    subtitle: {
      color: '#CBD5E1',
      fontSize: 14,
      lineHeight: 21,
    },
    profileGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    profileChip: {
      minWidth: '47%',
      padding: 12,
      borderRadius: 14,
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    profileChipSelected: {
      backgroundColor: 'rgba(59, 130, 246, 0.22)',
      borderColor: 'rgba(59, 130, 246, 0.7)',
    },
    profileChipLocked: {
      opacity: 0.66,
    },
    profileChipTitle: {
      color: '#F8FAFC',
      fontSize: 13,
      fontWeight: '800',
      marginBottom: 4,
    },
    profileChipTitleSelected: {
      color: '#DCEEFF',
    },
    profileChipText: {
      color: '#94A3B8',
      fontSize: 12,
      lineHeight: 18,
    },
    profileChipTextSelected: {
      color: '#DBEAFE',
    },
    summaryCard: {
      borderRadius: 16,
      padding: 14,
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    summaryTitle: {
      color: '#F8FAFC',
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 4,
    },
    summaryText: {
      color: '#CBD5E1',
      fontSize: 13,
      lineHeight: 19,
      marginBottom: 8,
    },
    durationText: {
      color: '#8BD3A4',
      fontSize: 14,
      fontWeight: '800',
    },
    volumeCard: {
      borderRadius: 16,
      padding: 14,
      backgroundColor: 'rgba(245, 158, 11, 0.14)',
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.25)',
    },
    volumeTitle: {
      color: '#F8FAFC',
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 4,
    },
    volumeText: {
      color: '#FDE68A',
      fontSize: 12,
      lineHeight: 18,
      marginBottom: 12,
    },
    volumeControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    volumeButton: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 10,
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      alignItems: 'center',
    },
    volumeButtonDisabled: {
      opacity: 0.45,
    },
    volumeButtonText: {
      color: '#F8FAFC',
      fontSize: 13,
      fontWeight: '800',
    },
    volumeValue: {
      minWidth: 112,
      alignItems: 'center',
    },
    volumeValueText: {
      color: '#F8FAFC',
      fontSize: 13,
      fontWeight: '700',
    },
    timerShell: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusGrid: {
      flexDirection: 'row',
      gap: 10,
    },
    statusCard: {
      flex: 1,
      borderRadius: 14,
      padding: 12,
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    statusLabel: {
      color: '#94A3B8',
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 6,
      textTransform: 'uppercase',
    },
    statusValue: {
      color: '#F8FAFC',
      fontSize: 13,
      lineHeight: 19,
      fontWeight: '700',
    },
    actionRow: {
      gap: 10,
    },
    primaryAction: {
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
    },
    primaryActionText: {
      color: '#F8FAFC',
      fontSize: 14,
      fontWeight: '900',
    },
    secondaryAction: {
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: theme.colors.success,
      alignItems: 'center',
    },
    secondaryActionText: {
      color: '#F8FAFC',
      fontSize: 14,
      fontWeight: '900',
    },
    actionDisabled: {
      opacity: 0.48,
    },
    resetRow: {
      alignItems: 'center',
    },
    resetAction: {
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    resetActionText: {
      color: '#CBD5E1',
      fontSize: 13,
      fontWeight: '700',
    },
    noticeCard: {
      borderRadius: 14,
      padding: 12,
      backgroundColor: 'rgba(148, 163, 184, 0.12)',
    },
    noticeText: {
      color: '#E2E8F0',
      fontSize: 13,
      lineHeight: 19,
    },
  });
