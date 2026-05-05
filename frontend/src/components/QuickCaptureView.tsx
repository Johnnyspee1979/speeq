/**
 * QuickCaptureView — de mobiele werkvloer-scherm.
 * Principe: max 3 taps, nooit typen, vakman denkt niet na.
 *
 * Flow:
 *  1. Open app → zie project + rode knop + recente foto's
 *  2. Tap knop → kies borgingspunt (bottom sheet, snel scrollen)
 *  3. Camera opent direct
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { wkbTaskTemplates, type WkbTaskTemplate } from '../data/WkbTemplates';
import { DEFAULT_PROJECT_NAME, PROJECT_LOCATION, PROJECT_RADIUS_METERS } from '../config/app';
import { fetchWeather, type WeatherSnapshot } from '../services/WeatherService';
import { isWeb } from '../lib/platform';
import { useTheme } from '../theme/ThemeProvider';
import { useWkbAuth } from '../hooks/useWkbAuth';
import type { CaptureTask } from '../types/CaptureTask';

// Berekent afstand tussen 2 GPS-punten in meters (Haversine)
function haversineMeters(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface QuickCaptureViewProps {
  onSelectTask: (task: CaptureTask) => void;
  recentCount?: number; // hoeveel recente registraties tonen
}

type GpsStatus = 'checking' | 'onsite' | 'offsite' | 'unavailable';

export default function QuickCaptureView({
  onSelectTask,
  recentCount = 5,
}: QuickCaptureViewProps) {
  const { theme } = useTheme();
  const { user } = useWkbAuth();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('checking');
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  // Pulse animatie op rode knop
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // GPS check + weer ophalen
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (isWeb) {
        if (!navigator.geolocation) {
          setGpsStatus('unavailable');
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled) return;
            const { latitude, longitude } = pos.coords;
            checkOnsite(latitude, longitude);
            fetchWeather(latitude, longitude).then((w) => {
              if (!cancelled) setWeather(w);
            });
          },
          () => {
            if (!cancelled) setGpsStatus('unavailable');
          },
          { timeout: 6000, maximumAge: 30000 }
        );
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') { setGpsStatus('unavailable'); return; }

        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;

        const { latitude, longitude } = pos.coords;
        checkOnsite(latitude, longitude);
        fetchWeather(latitude, longitude).then((w) => {
          if (!cancelled) setWeather(w);
        });
      }
    };

    run();
    return () => { cancelled = true; };
  }, []);

  const checkOnsite = (lat: number, lon: number) => {
    if (!PROJECT_LOCATION) { setGpsStatus('unavailable'); return; }
    const dist = haversineMeters(lat, lon, PROJECT_LOCATION.latitude, PROJECT_LOCATION.longitude);
    setGpsStatus(dist <= PROJECT_RADIUS_METERS ? 'onsite' : 'offsite');
  };

  // Basis discipline-filter: leeg = alles tonen (admin/dev), gevuld = alleen eigen disciplines
  const disciplineAllowedTasks = useMemo(() => {
    const userDisciplines = user?.disciplines ?? [];
    const userExtraIds = user?.extraTaskIds ?? [];
    if (userDisciplines.length === 0 && userExtraIds.length === 0) {
      return wkbTaskTemplates; // Geen filter (admin/dev bypass)
    }
    return wkbTaskTemplates.filter(
      (t) =>
        userDisciplines.includes(t.categoryId) ||
        userExtraIds.includes(t.inspectionPointId)
    );
  }, [user]);

  // Categorieën — alleen categorieën tonen waartoe de vakman toegang heeft
  const categories = useMemo(() => {
    const cats = Array.from(new Set(disciplineAllowedTasks.map((t) => t.categoryId)));
    return ['ALL', ...cats];
  }, [disciplineAllowedTasks]);

  const catLabel = (id: string) => {
    const map: Record<string, string> = {
      ALL: 'Alles',
      BOUW: 'Bouw',
      BOUWFYSICA: 'Bouwfysica',
      BRANDVEILIGHEID: 'Brand',
      INSTALLATIE: 'Installatie',
      ELEKTRA: 'Elektra',
      AFBOUW_SCHILDER: 'Schilder',
    };
    return map[id] ?? id;
  };

  const filteredTasks = useMemo(
    () =>
      activeCategory === 'ALL'
        ? disciplineAllowedTasks
        : disciplineAllowedTasks.filter((t) => t.categoryId === activeCategory),
    [activeCategory, disciplineAllowedTasks]
  );

  const handleSelectTask = useCallback(
    (item: WkbTaskTemplate) => {
      setSelectorVisible(false);
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
      });
    },
    [onSelectTask]
  );

  // GPS status pill
  const gpsPill = () => {
    if (gpsStatus === 'checking') return { icon: '📍', label: 'Locatie bepalen...', color: theme.colors.textSecondary };
    if (gpsStatus === 'onsite')   return { icon: '✅', label: 'Op locatie', color: theme.colors.success };
    if (gpsStatus === 'offsite')  return { icon: '⚠️', label: 'Buiten werkgebied', color: theme.colors.warning };
    return { icon: '📍', label: 'GPS niet beschikbaar', color: theme.colors.textSecondary };
  };

  const gps = gpsPill();

  return (
    <View style={styles.container}>
      {/* ── Project header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.projectEyebrow}>ACTIEF PROJECT</Text>
          <Text style={styles.projectName}>{DEFAULT_PROJECT_NAME}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.pill, { borderColor: theme.colors.border }]}>
            <Text style={styles.pillIcon}>{gps.icon}</Text>
            <Text style={[styles.pillText, { color: gps.color }]}>{gps.label}</Text>
          </View>
        </View>
      </View>

      {/* ── Weer banner ── */}
      {weather ? (
        <View style={styles.weatherBanner}>
          <Text style={styles.weatherText}>🌤️ {weather.label}</Text>
        </View>
      ) : null}

      {/* ── Grote rode capture-knop ── */}
      <View style={styles.captureSection}>
        <Text style={styles.captureHint}>Tap om een borgingspunt vast te leggen</Text>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={styles.captureBtn}
            onPress={() => setSelectorVisible(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.captureBtnIcon}>📸</Text>
            <Text style={styles.captureBtnText}>MAAK FOTO</Text>
          </TouchableOpacity>
        </Animated.View>
        <Text style={styles.captureSub}>Kies borgingspunt → camera opent direct</Text>
      </View>

      {/* ── Bottom sheet: borgingspunt selector ── */}
      <Modal
        visible={selectorVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectorVisible(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={styles.sheetBackdrop}
            activeOpacity={1}
            onPress={() => setSelectorVisible(false)}
          />
          <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
            {/* Handle */}
            <View style={styles.sheetHandle} />

            <Text style={styles.sheetTitle}>Kies borgingspunt</Text>

            {/* Categorie filter */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.catScroll}
              contentContainerStyle={styles.catScrollContent}
            >
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.catChip,
                    { borderColor: theme.colors.border },
                    activeCategory === cat && { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
                  ]}
                  onPress={() => setActiveCategory(cat)}
                >
                  <Text
                    style={[
                      styles.catChipText,
                      { color: theme.colors.textSecondary },
                      activeCategory === cat && { color: '#fff' },
                    ]}
                  >
                    {catLabel(cat)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Taak lijst */}
            <FlatList
              data={filteredTasks}
              keyExtractor={(item) => item.id}
              style={styles.taskList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const IconComponent = item.icon;
                return (
                  <TouchableOpacity
                    style={[styles.taskRow, { borderBottomColor: theme.colors.border }]}
                    onPress={() => handleSelectTask(item)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.taskIconBox, { backgroundColor: `${item.color}18` }]}>
                      <IconComponent color={item.color} size={20} strokeWidth={1.8} />
                    </View>
                    <View style={styles.taskInfo}>
                      <Text style={[styles.taskTitle, { color: theme.colors.textPrimary }]}>
                        {item.title}
                      </Text>
                      <Text style={[styles.taskSub, { color: theme.colors.textSecondary }]}>
                        {item.inspectionPointId}
                      </Text>
                    </View>
                    {item.aiValidationKey ? (
                      <View style={styles.aiChip}>
                        <Text style={[styles.aiChipText, { color: theme.colors.accent }]}>AI</Text>
                      </View>
                    ) : null}
                    <Text style={[styles.taskArrow, { color: theme.colors.textSecondary }]}>›</Text>
                  </TouchableOpacity>
                );
              }}
            />

            {/* Sluit knop */}
            <TouchableOpacity
              style={[styles.closeBtn, { borderColor: theme.colors.border }]}
              onPress={() => setSelectorVisible(false)}
            >
              <Text style={[styles.closeBtnText, { color: theme.colors.textSecondary }]}>
                Annuleren
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: { name?: string; colors: Record<string, string> }) => {
  const isDark = theme.name === 'dark';

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
    },
    headerLeft: {
      flex: 1,
    },
    headerRight: {
      marginLeft: 12,
    },
    projectEyebrow: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 2.5,
      color: theme.colors.accent,
      marginBottom: 4,
    },
    projectName: {
      fontSize: 20,
      fontWeight: '900',
      color: theme.colors.textPrimary,
      letterSpacing: -0.5,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
    },
    pillIcon: {
      fontSize: 12,
    },
    pillText: {
      fontSize: 11,
      fontWeight: '600',
    },

    // Weer banner
    weatherBanner: {
      marginHorizontal: 20,
      marginBottom: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    weatherText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },

    // Grote rode knop sectie
    captureSection: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      gap: 16,
    },
    captureHint: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      fontWeight: '500',
      textAlign: 'center',
    },
    captureBtn: {
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 0 60px rgba(164,13,47,0.4), 0 4px 24px rgba(164,13,47,0.3)',
          } as any)
        : {}),
    },
    captureBtnIcon: {
      fontSize: 48,
    },
    captureBtnText: {
      fontSize: 16,
      fontWeight: '900',
      color: '#FFFFFF',
      letterSpacing: 1.5,
    },
    captureSub: {
      fontSize: 12,
      color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)',
      textAlign: 'center',
    },

    // Bottom sheet
    sheetOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    sheetBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 12,
      paddingBottom: 32,
      maxHeight: '80%',
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
      alignSelf: 'center',
      marginBottom: 16,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      paddingHorizontal: 20,
      marginBottom: 14,
      letterSpacing: -0.3,
    },

    // Categorie chips
    catScroll: {
      maxHeight: 44,
      marginBottom: 8,
    },
    catScrollContent: {
      paddingHorizontal: 20,
      gap: 8,
      alignItems: 'center',
    },
    catChip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
    },
    catChipText: {
      fontSize: 12,
      fontWeight: '700',
    },

    // Taak rijen
    taskList: {
      flex: 1,
      marginTop: 4,
    },
    taskRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      gap: 12,
    },
    taskIconBox: {
      width: 40,
      height: 40,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    taskInfo: {
      flex: 1,
      gap: 2,
    },
    taskTitle: {
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    taskSub: {
      fontSize: 11,
      fontFamily: 'monospace' as any,
      fontWeight: '500',
    },
    aiChip: {
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: 'rgba(164,13,47,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(164,13,47,0.3)',
    },
    aiChipText: {
      fontSize: 10,
      fontWeight: '800',
    },
    taskArrow: {
      fontSize: 20,
      fontWeight: '300',
    },

    // Sluit knop
    closeBtn: {
      marginHorizontal: 20,
      marginTop: 12,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: 'center',
    },
    closeBtnText: {
      fontSize: 14,
      fontWeight: '700',
    },
  });
};
