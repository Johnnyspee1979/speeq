import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Timer } from 'react-native-stopwatch-timer';
import { useTheme } from '../theme/ThemeProvider';

interface Nen1078TimerOverlayProps {
  durationMinutes: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  stepMinutes: number;
  timerInstanceKey: number;
  isRunning: boolean;
  isCapturing: boolean;
  hasStarted: boolean;
  isAwaitingEndCapture: boolean;
  isComplete: boolean;
  startCapturedAt: string | null;
  endCapturedAt: string | null;
  onDurationChange: (nextValue: number) => void;
  onStartCapture: () => void;
  onEndCapture: () => void;
  onReset: () => void;
  onTimerFinish: () => void;
}

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

export default function Nen1078TimerOverlay({
  durationMinutes,
  minDurationMinutes,
  maxDurationMinutes,
  stepMinutes,
  timerInstanceKey,
  isRunning,
  isCapturing,
  hasStarted,
  isAwaitingEndCapture,
  isComplete,
  startCapturedAt,
  endCapturedAt,
  onDurationChange,
  onStartCapture,
  onEndCapture,
  onReset,
  onTimerFinish,
}: Nen1078TimerOverlayProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const profileSelectionLocked = hasStarted && !isComplete;
  const durationConfigured = durationMinutes >= minDurationMinutes;
  const totalDurationMs = durationMinutes * 60 * 1000;
  const decrementDisabled =
    profileSelectionLocked || durationMinutes <= Math.max(minDurationMinutes, 0);
  const incrementDisabled =
    profileSelectionLocked || durationMinutes >= maxDurationMinutes;

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>NEN 1078:2024</Text>
      <Text style={styles.title}>Dichtheidsbeproeving Timer Overlay</Text>
      <Text style={styles.subtitle}>
        Stel eerst de exacte beproevingstijd uit Tabel A.1 in. Maak daarna de
        beginfoto van de manometer; de eindfoto wordt pas vrijgegeven zodra de
        volledige wachttijd is verstreken.
      </Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Beproevingstijd conform Tabel A.1</Text>
        <Text style={styles.summaryText}>
          Kies de normatieve wachttijd voordat je de gasinstallatie op testdruk zet.
        </Text>
        <Text style={styles.durationText}>
          Wachttijd: {durationConfigured ? `${durationMinutes} min` : 'Nog niet ingesteld'}
        </Text>
      </View>

      <View style={styles.volumeCard}>
        <Text style={styles.volumeTitle}>Stel de beproevingstijd in</Text>
        <Text style={styles.volumeText}>
          Gebruik de exacte tijd uit NEN 1078 Tabel A.1 voor deze installatie.
        </Text>
        <View style={styles.volumeControls}>
          <TouchableOpacity
            style={[styles.volumeButton, decrementDisabled && styles.volumeButtonDisabled]}
            activeOpacity={0.85}
            disabled={decrementDisabled}
            onPress={() =>
              onDurationChange(Math.max(durationMinutes - stepMinutes, minDurationMinutes))
            }
          >
            <Text style={styles.volumeButtonText}>-{stepMinutes} min</Text>
          </TouchableOpacity>
          <View style={styles.volumeValue}>
            <Text style={styles.volumeValueText}>
              {durationConfigured ? `${durationMinutes} min` : 'Kies tijd'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.volumeButton, incrementDisabled && styles.volumeButtonDisabled]}
            activeOpacity={0.85}
            disabled={incrementDisabled}
            onPress={() =>
              onDurationChange(Math.min(durationMinutes + stepMinutes, maxDurationMinutes))
            }
          >
            <Text style={styles.volumeButtonText}>+{stepMinutes} min</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.timerShell}>
        <Timer
          key={`nen1078-${durationMinutes}-${timerInstanceKey}`}
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
          style={[
            styles.primaryAction,
            (!durationConfigured || isCapturing) && styles.actionDisabled,
          ]}
          activeOpacity={0.88}
          disabled={!durationConfigured || isCapturing}
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
              ? 'Wachttijd voltooid. De eindfoto is nu verplicht om de dichtheidsbeproeving af te ronden.'
              : hasStarted
                ? 'Timer loopt. De eindfoto blijft geblokkeerd totdat de volledige wachttijd is verstreken.'
                : durationConfigured
                  ? 'De beproevingstijd staat ingesteld. Leg nu de beginfoto van de manometer vast.'
                  : 'Stel eerst de normatieve beproevingstijd in op basis van Tabel A.1.'}
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
      color: '#FBBF24',
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
    summaryCard: {
      borderRadius: 16,
      padding: 14,
      backgroundColor: 'rgba(251, 191, 36, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(251, 191, 36, 0.25)',
      gap: 6,
    },
    summaryTitle: {
      color: '#F8FAFC',
      fontSize: 15,
      fontWeight: '800',
    },
    summaryText: {
      color: '#E2E8F0',
      fontSize: 13,
      lineHeight: 19,
    },
    durationText: {
      color: '#FDE68A',
      fontSize: 13,
      fontWeight: '800',
    },
    volumeCard: {
      borderRadius: 16,
      padding: 14,
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
      gap: 10,
    },
    volumeTitle: {
      color: '#F8FAFC',
      fontSize: 14,
      fontWeight: '800',
    },
    volumeText: {
      color: '#CBD5E1',
      fontSize: 13,
      lineHeight: 18,
    },
    volumeControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    volumeButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: 'rgba(59, 130, 246, 0.18)',
      borderWidth: 1,
      borderColor: 'rgba(59, 130, 246, 0.45)',
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
      minWidth: 110,
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: 12,
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
      alignItems: 'center',
    },
    volumeValueText: {
      color: '#FDE68A',
      fontSize: 14,
      fontWeight: '800',
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
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
      gap: 6,
    },
    statusLabel: {
      color: '#94A3B8',
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    statusValue: {
      color: '#F8FAFC',
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '700',
    },
    actionRow: {
      flexDirection: 'row',
      gap: 10,
    },
    primaryAction: {
      flex: 1,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 12,
      backgroundColor: '#2563EB',
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryAction: {
      flex: 1,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 12,
      backgroundColor: '#16A34A',
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionDisabled: {
      opacity: 0.45,
    },
    primaryActionText: {
      color: '#F8FAFC',
      fontSize: 13,
      fontWeight: '800',
      textAlign: 'center',
    },
    secondaryActionText: {
      color: '#F8FAFC',
      fontSize: 13,
      fontWeight: '800',
      textAlign: 'center',
    },
    resetRow: {
      alignItems: 'flex-start',
    },
    resetAction: {
      paddingVertical: 8,
      paddingHorizontal: 2,
    },
    resetActionText: {
      color: '#CBD5E1',
      fontSize: 13,
      fontWeight: '700',
      textDecorationLine: 'underline',
    },
    noticeCard: {
      borderRadius: 14,
      padding: 12,
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    noticeText: {
      color: '#E2E8F0',
      fontSize: 13,
      lineHeight: 19,
    },
  });
