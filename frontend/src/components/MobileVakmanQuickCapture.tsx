/**
 * MobileVakmanQuickCapture — Claude Design v2 (Raven Health-aesthetic).
 *
 * Bron mock: .claude/claude-design-import/ui_kits/mobile/VakmanScene.jsx
 *
 * Wat vakman ziet:
 *  • Eyebrow "Hé {voornaam}" in navy uppercase
 *  • Bricolage headline "Klaar voor een foto? {count} vandaag." (groen accent)
 *  • 4 chips: GPS adres · Klant · Project (chevron) · Discipline (chevron)
 *  • Grote GROENE capture-knop met camera icoon
 *  • Bottom sheets voor project/discipline kiezen
 *  • Toast na succesvolle upload
 *
 * Palette: hardcoded navy + green + zinc (Claude Design tokens v2).
 * Onder de motorkap: EXIF, GPS, SHA-256 hash, IndexedDB, syncEvidenceQueue —
 * onveranderd. Vakman hoeft niets te weten van die plumbing.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import {
  MapPin,
  User,
  Folder,
  Target,
  Camera,
  Check,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react-native';
import { useProject, type Project } from '../context/ProjectContext';
import { persistOfflinePhoto } from '../services/OfflinePhotoStore';
import { saveEvidenceLocally } from '../database/database';
import { syncEvidenceQueue } from '../services/sync';
import { createEvidenceHash, createEvidenceId } from '../services/evidenceIntegrity';
import { useWkbAuth } from '../hooks/useWkbAuth';
import { isWeb } from '../lib/platform';
import type { WkbEvidence } from '../types/Evidence';

// Claude Design tokens (hardcoded — Raven-aligned navy + green).
const C = {
  bg:            '#FFFFFF',
  navy:          '#1B3A5C',
  navyDark:      '#0F2436',
  green:         '#5BAA3A',
  green600:      '#4A9430',
  greenSoft:     '#ECF6E5',
  successFg:     '#15803D',
  successWash:   '#ECFDF5',
  text:          '#18181B',
  textStrong:    '#09090B',
  textMuted:     '#52525B',
  textSubtle:    '#71717A',
  border:        '#E4E4E7',
  borderSoft:    '#F4F4F5',
  chipMuted:     '#F4F4F5',
  fontDisplay:   '"Bricolage Grotesque", "Plus Jakarta Sans", system-ui, sans-serif',
  fontSans:      '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
};

interface Discipline {
  id: string;
  emoji: string;
  label: string;
}

const DISCIPLINES: Discipline[] = [
  { id: 'BOUW',            emoji: '🏗️', label: 'Bouw / constructie' },
  { id: 'BOUWFYSICA',      emoji: '🌡️', label: 'Isolatie / bouwfysica' },
  { id: 'BRANDVEILIGHEID', emoji: '🔥', label: 'Brand / rook' },
  { id: 'INSTALLATIE',     emoji: '🔧', label: 'Sanitair / installatie' },
  { id: 'ELEKTRA',         emoji: '⚡', label: 'Elektra' },
  { id: 'AFBOUW_SCHILDER', emoji: '🖌️', label: 'Afbouw / schilder' },
];

const DISCIPLINE_STORAGE_KEY = 'wkb_vakman_last_discipline';
const COUNT_STORAGE_KEY      = 'wkb_vakman_today_count';
const COUNT_DATE_KEY         = 'wkb_vakman_today_date';

function loadLastDiscipline(): Discipline | null {
  if (typeof window === 'undefined') return null;
  try {
    const id = window.localStorage.getItem(DISCIPLINE_STORAGE_KEY);
    if (!id) return null;
    return DISCIPLINES.find((d) => d.id === id) ?? null;
  } catch {
    return null;
  }
}

function saveLastDiscipline(d: Discipline): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DISCIPLINE_STORAGE_KEY, d.id);
  } catch { /* ignore */ }
}

function loadTodayCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const storedDate = window.localStorage.getItem(COUNT_DATE_KEY);
    if (storedDate !== today) {
      window.localStorage.setItem(COUNT_DATE_KEY, today);
      window.localStorage.setItem(COUNT_STORAGE_KEY, '0');
      return 0;
    }
    return parseInt(window.localStorage.getItem(COUNT_STORAGE_KEY) ?? '0', 10) || 0;
  } catch { return 0; }
}

function saveTodayCount(n: number): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(COUNT_STORAGE_KEY, String(n)); } catch { /* ignore */ }
}

interface MobileVakmanQuickCaptureProps {
  onChangeProject?: () => void;
}

export default function MobileVakmanQuickCapture({ onChangeProject }: MobileVakmanQuickCaptureProps) {
  const { user } = useWkbAuth();
  const { activeProject, projects, setActiveProject } = useProject();

  const [discipline, setDiscipline] = useState<Discipline | null>(loadLastDiscipline);
  const [showDisciplinePicker, setShowDisciplinePicker] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [todayCount, setTodayCount] = useState(loadTodayCount);
  const [toast, setToast] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const firstName = (() => {
    const ROLE_NAMES = new Set(['vakman', 'voorman', 'admin', 'keyuser', 'projectleider', 'werkvoorbereider']);
    const c = (user?.displayName?.split(' ')[0] ?? user?.email?.split('@')[0] ?? '').trim();
    if (!c || ROLE_NAMES.has(c.toLowerCase())) return null;
    return c.charAt(0).toUpperCase() + c.slice(1);
  })();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        const res = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        if (cancelled || !res.length) return;
        const a = res[0];
        const parts = [a.street, a.city].filter(Boolean);
        setAddress(parts.length ? parts.join(', ') : null);
      } catch { /* geen GPS — chip blijft leeg */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const klantNaam =
    (activeProject as { initiatorName?: string | null })?.initiatorName ??
    user?.companyName ??
    null;

  const projectNaam = activeProject?.name ?? 'Kies project';

  const handlePhotoTap = useCallback(() => {
    if (uploadState === 'uploading') return;
    if (!discipline) { setShowDisciplinePicker(true); return; }
    if (!activeProject || activeProject.id === 'demo-default') {
      setShowProjectPicker(true);
      return;
    }
    fileInputRef.current?.click();
  }, [uploadState, discipline, activeProject]);

  const handleFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!discipline || !activeProject) return;

    setUploadState('uploading');
    setErrorMsg(null);

    try {
      const blobUri = URL.createObjectURL(file);
      const evidenceId = createEvidenceId();
      const persistedUri = (await persistOfflinePhoto(blobUri, evidenceId).catch(() => null)) ?? blobUri;

      let lat = 0;
      let lng = 0;
      let acc: number | null = null;
      let hasGps = false;
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        acc = pos.coords.accuracy ?? null;
        hasGps = true;
      } catch { /* geen GPS */ }

      const timestamp = new Date().toISOString();
      const exifHash = await createEvidenceHash(persistedUri).catch(() => '');

      const newEvidence: WkbEvidence = {
        id: evidenceId,
        mediaUri: persistedUri,
        latitude: lat,
        longitude: lng,
        gpsAccuracy: acc,
        timestamp,
        projectId: activeProject.id,
        inspectionPointId: `${discipline.id}-QUICK`,
        exifHash,
        exifVerified: false,
        userId: user?.id ?? null,
        fieldNote: `Snel-foto · ${discipline.label}`,
        weatherLabel: null,
        stopMomentConfirmed: null,
        measurementToolConfirmed: null,
        locationVerified: hasGps,
        locationSpoofRisk: null,
        locationSecurityMessage: null,
        etage: null,
        huisnummer: null,
        ruimtenummer: null,
        binnenbuiten: 'BINNEN',
        locatieDetail: null,
        context_extra: { source: 'mobile-vakman-quick' },
        floorPlanId: null,
        pinX: null,
        pinY: null,
        syncStatus: 'PENDING',
      };

      await saveEvidenceLocally(newEvidence);
      void syncEvidenceQueue();

      const nextCount = todayCount + 1;
      setTodayCount(nextCount);
      saveTodayCount(nextCount);
      const ticket = `KIK-${discipline.id}-${String(nextCount).padStart(3, '0')}`;
      setToast(`${ticket} verzonden`);
      setUploadState('success');
      setTimeout(() => setToast(null), 2400);
      setTimeout(() => setUploadState('idle'), 2600);
    } catch (err) {
      setUploadState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Onbekende fout');
      setTimeout(() => setUploadState('idle'), 3500);
    }
  }, [discipline, activeProject, user?.id, todayCount]);

  if (!isWeb) {
    return (
      <View style={styles.fullscreen}>
        <Text style={styles.fallbackText}>📷 Snel-vakman is alleen op web beschikbaar.</Text>
      </View>
    );
  }

  const captureBg =
    uploadState === 'success' ? C.successFg :
    uploadState === 'error'   ? '#DC2626' :
    uploadState === 'uploading' ? C.green600 :
    C.green;
  const captureText =
    uploadState === 'success' ? 'Verzonden' :
    uploadState === 'error'   ? 'Probeer opnieuw' :
    uploadState === 'uploading' ? 'Verzenden…' :
    'Foto maken';

  return (
    <View style={styles.fullscreen}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' } as React.CSSProperties}
        onChange={handleFileSelected}
      />

      <View style={styles.headerWrap}>
        <Text style={styles.eyebrow}>
          {firstName ? `Hé ${firstName}` : 'Goedendag'}
        </Text>
        <Text style={styles.headline}>
          Klaar voor een foto?{'\n'}
          <Text style={{ color: C.green }}>
            {todayCount} vandaag.
          </Text>
        </Text>
      </View>

      <View style={styles.chipsWrap}>
        <Chip icon={<MapPin size={16} color={C.textSubtle} />} label={address ?? 'GPS laden…'} muted />
        {klantNaam ? <Chip icon={<User size={16} color={C.textSubtle} />} label={klantNaam} muted /> : null}
        <Chip
          icon={<Folder size={16} color={C.navy} />}
          label={projectNaam}
          chevron
          onPress={() => setShowProjectPicker(true)}
        />
        <Chip
          icon={<Target size={16} color={discipline ? C.navy : C.green} />}
          label={discipline?.label ?? 'Kies wat je registreert'}
          chevron
          highlight={!discipline}
          onPress={() => setShowDisciplinePicker(true)}
        />
      </View>

      <View style={styles.captureWrap}>
        <Pressable
          onPress={handlePhotoTap}
          disabled={uploadState === 'uploading'}
          style={({ pressed }) => [
            styles.captureBtn,
            { backgroundColor: captureBg },
            pressed && styles.capturePressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Foto maken"
        >
          {uploadState === 'uploading' ? (
            <ActivityIndicator color="#fff" size="large" />
          ) : uploadState === 'success' ? (
            <Check size={56} color="#fff" strokeWidth={1.8} />
          ) : uploadState === 'error' ? (
            <AlertTriangle size={56} color="#fff" strokeWidth={1.8} />
          ) : (
            <Camera size={56} color="#fff" strokeWidth={1.6} />
          )}
          <Text style={styles.captureText}>{captureText}</Text>
          {uploadState === 'error' && errorMsg ? (
            <Text style={styles.captureSub}>{errorMsg.slice(0, 50)}</Text>
          ) : null}
        </Pressable>
      </View>

      {toast ? (
        <View style={styles.toast}>
          <Check size={16} color="#fff" />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      <Modal
        visible={showDisciplinePicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDisciplinePicker(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowDisciplinePicker(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Wat ga je registreren?</Text>
            <ScrollView>
              {DISCIPLINES.map((d) => {
                const active = discipline?.id === d.id;
                return (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.sheetItem, active && styles.sheetItemActive]}
                    onPress={() => {
                      setDiscipline(d);
                      saveLastDiscipline(d);
                      setShowDisciplinePicker(false);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.sheetItemEmoji}>{d.emoji}</Text>
                    <Text style={[styles.sheetItemText, active && styles.sheetItemTextActive]}>{d.label}</Text>
                    {active ? <Check size={18} color={C.green} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showProjectPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowProjectPicker(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowProjectPicker(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Welk project?</Text>
            <ScrollView>
              {projects.map((p: Project) => {
                const active = activeProject?.id === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.sheetItem, active && styles.sheetItemActive]}
                    onPress={() => {
                      setActiveProject(p);
                      setShowProjectPicker(false);
                      if (onChangeProject) onChangeProject();
                    }}
                    activeOpacity={0.75}
                  >
                    <Folder size={18} color={active ? C.green : C.navy} />
                    <Text style={[styles.sheetItemText, active && styles.sheetItemTextActive]}>{p.name}</Text>
                    {active ? <Check size={18} color={C.green} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

interface ChipProps {
  icon: React.ReactNode;
  label: string;
  muted?: boolean;
  highlight?: boolean;
  chevron?: boolean;
  onPress?: () => void;
}
const Chip: React.FC<ChipProps> = ({ icon, label, muted, highlight, chevron, onPress }) => (
  <Pressable
    onPress={onPress}
    disabled={!onPress}
    style={({ pressed }) => [
      styles.chip,
      muted && styles.chipMuted,
      highlight && styles.chipHighlight,
      pressed && onPress && styles.chipPressed,
    ]}
    accessibilityRole={onPress ? 'button' : undefined}
    accessibilityLabel={onPress ? `${label} — tap om te wijzigen` : label}
  >
    {icon}
    <Text
      style={[styles.chipLabel, muted && styles.chipLabelMuted]}
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      {label}
    </Text>
    {chevron ? <ChevronRight size={18} color={C.textSubtle} /> : null}
  </Pressable>
);

const styles = StyleSheet.create({
  fullscreen: { flex: 1, backgroundColor: C.bg },
  fallbackText: {
    color: C.text,
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 20,
    fontFamily: C.fontSans,
  },
  headerWrap: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  eyebrow: {
    fontFamily: C.fontSans,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: C.navy,
    marginBottom: 6,
  },
  headline: {
    fontFamily: C.fontDisplay,
    fontSize: 30,
    fontWeight: '700',
    color: C.textStrong,
    letterSpacing: -1.05,
    lineHeight: 32,
  },
  chipsWrap: {
    paddingHorizontal: 16,
    paddingTop: 18,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 1px 2px rgba(15,36,54,0.04)' } as object)
      : {}),
  },
  chipMuted: {
    backgroundColor: C.chipMuted,
    borderColor: C.borderSoft,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: 'none' } as object)
      : {}),
  },
  chipHighlight: {
    borderColor: C.green,
    backgroundColor: C.greenSoft,
  },
  chipPressed: { opacity: 0.7 },
  chipLabel: {
    flex: 1,
    fontFamily: C.fontSans,
    fontSize: 15,
    fontWeight: '600',
    color: C.text,
  },
  chipLabelMuted: {
    color: C.textMuted,
    fontWeight: '500',
  },
  captureWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 28,
  },
  captureBtn: {
    width: '100%',
    minHeight: 180,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 28,
    paddingHorizontal: 24,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 18px 40px -12px rgba(91,170,58,0.40), 0 6px 16px -6px rgba(91,170,58,0.30)',
          transitionProperty: 'transform, background-color',
          transitionDuration: '180ms',
        } as object)
      : {
          shadowColor: '#5BAA3A',
          shadowOpacity: 0.4,
          shadowRadius: 40,
          shadowOffset: { width: 0, height: 18 },
          elevation: 8,
        }),
  },
  capturePressed: {
    transform: [{ scale: 0.98 }],
  },
  captureText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    fontFamily: C.fontSans,
    letterSpacing: -0.4,
  },
  captureSub: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.85,
    paddingHorizontal: 16,
    textAlign: 'center',
    fontFamily: C.fontSans,
  },
  toast: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.navyDark,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 24px rgba(9,9,11,0.30)' } as object)
      : {}),
  },
  toastText: {
    fontFamily: C.fontSans,
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,36,54,0.45)',
    justifyContent: 'flex-end',
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(4px)' } as object)
      : {}),
  },
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
    maxHeight: '74%',
  },
  sheetHandle: {
    width: 44,
    height: 4,
    backgroundColor: C.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    fontFamily: C.fontDisplay,
    fontSize: 22,
    fontWeight: '700',
    color: C.textStrong,
    letterSpacing: -0.5,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 12,
    marginBottom: 4,
  },
  sheetItemActive: {
    backgroundColor: C.greenSoft,
  },
  sheetItemEmoji: {
    fontSize: 22,
  },
  sheetItemText: {
    flex: 1,
    fontFamily: C.fontSans,
    color: C.text,
    fontSize: 16,
    fontWeight: '600',
  },
  sheetItemTextActive: {
    color: C.successFg,
  },
});
