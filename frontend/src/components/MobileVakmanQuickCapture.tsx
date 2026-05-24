/**
 * MobileVakmanQuickCapture — ultra-minimale vakman-flow voor mobiel.
 *
 * Per Johnny 24 mei: "vakman moet zien WAAR ie is, welk PROJECT, welke
 * KLANT, WAT hij wil registreren — meer niet. Onder de motorkap mag alles
 * zwaar georganiseerd zijn, daar moet de vakman niets van merken."
 *
 * Wat de vakman ziet:
 *   • 4 context-chips bovenaan (adres · klant · project · discipline)
 *   • Eén grote 📷 Foto-knop
 *   • Bevestiging "✓ Verzonden" na opslaan
 *
 * Wat onder de motor draait (onzichtbaar):
 *   • EXIF / GPS extractie
 *   • SHA-256 hash voor non-repudiation
 *   • OfflinePhotoStore (IndexedDB) bij geen netwerk
 *   • syncEvidenceQueue voor stilletjes uploaden
 *   • Tenant + RLS-isolatie via Supabase
 *
 * Vakman tikt: 2× setup (project + discipline) + N× foto's (1 tap).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import * as Location from 'expo-location';
import { designTokens } from '../theme/designTokens';
import { useProject, type Project } from '../context/ProjectContext';
import { supabase } from '../lib/supabase';
import { persistOfflinePhoto } from '../services/OfflinePhotoStore';
import { saveEvidenceLocally } from '../database/database';
import { syncEvidenceQueue } from '../services/sync';
import { createEvidenceHash, createEvidenceId } from '../services/evidenceIntegrity';
import { useWkbAuth } from '../hooks/useWkbAuth';
import { isWeb } from '../lib/platform';
import type { WkbEvidence } from '../types/Evidence';

const theme = designTokens;

// ─── Disciplines (kortere set dan StartFlow, alleen wat vakman doet) ───────

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

// ─── Component ──────────────────────────────────────────────────────────────

interface MobileVakmanQuickCaptureProps {
  /** Trigger om project-picker modal te openen (vanuit parent). */
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

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ─── GPS adres reverse-geocoding (alleen 1x bij mount, zachte fout) ──────
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
      } catch {
        // Geen toegang of fout — laat adres-chip leeg, geen storend bericht
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Klant + project info ────────────────────────────────────────────────
  const klantNaam =
    (activeProject as { initiatorName?: string | null })?.initiatorName ??
    user?.companyName ??
    null;

  const projectNaam = activeProject?.name ?? 'Geen project';

  // ─── Foto maken — opent native camera, slaat lokaal op + sync ────────────
  const handlePhotoTap = useCallback(() => {
    if (uploadState === 'uploading') return;
    if (!discipline) {
      setShowDisciplinePicker(true);
      return;
    }
    if (!activeProject || activeProject.id === 'demo-default') {
      setShowProjectPicker(true);
      return;
    }
    // Trigger hidden file input — opent native camera op mobiel
    fileInputRef.current?.click();
  }, [uploadState, discipline, activeProject]);

  const handleFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input zodat dezelfde foto opnieuw kan
    e.target.value = '';
    if (!discipline || !activeProject) return;

    setUploadState('uploading');
    setErrorMsg(null);

    try {
      // Foto → blob URL → IndexedDB (overleeft refresh)
      const blobUri = URL.createObjectURL(file);
      const evidenceId = createEvidenceId();
      const persistedUri = (await persistOfflinePhoto(blobUri, evidenceId).catch(() => null)) ?? blobUri;

      // GPS — best effort, niet blokkerend
      let lat = 0;
      let lng = 0;
      let acc: number | null = null;
      let hasGps = false;
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        acc = pos.coords.accuracy ?? null;
        hasGps = true;
      } catch { /* geen GPS — gewoon doorsturen */ }

      // Server-side timestamp via Supabase wordt bij sync ingevuld; lokaal nu
      const timestamp = new Date().toISOString();

      // Hash voor non-repudiation (light versie; native build doet hardware-signing)
      const exifHash = await createEvidenceHash(persistedUri).catch(() => '');

      const newEvidence: WkbEvidence = {
        id: evidenceId,
        mediaUri: persistedUri,
        latitude: lat,
        longitude: lng,
        gpsAccuracy: acc,
        timestamp,
        projectId: activeProject.id,
        // Discipline-based inspection point — vakman koos discipline, AI vult later
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

      setUploadState('success');
      // Reset naar idle na 2.5s
      setTimeout(() => setUploadState('idle'), 2500);
    } catch (err) {
      setUploadState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Onbekende fout');
      setTimeout(() => setUploadState('idle'), 3500);
    }
  }, [discipline, activeProject, user?.id]);

  // ─── Render ──────────────────────────────────────────────────────────────

  if (!isWeb) {
    return (
      <View style={styles.fullscreen}>
        <Text style={styles.fallbackText}>📷 Snel-vakman is alleen op web beschikbaar.</Text>
      </View>
    );
  }

  return (
    <View style={styles.fullscreen}>
      {/* Hidden file input — opent native camera op mobiel */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' } as React.CSSProperties}
        onChange={handleFileSelected}
      />

      {/* ── Context chips bovenaan ─────────────────────────────────── */}
      <View style={styles.contextWrap}>
        <Chip
          icon="📍"
          label={address ?? 'GPS laden…'}
          muted
        />
        {klantNaam ? <Chip icon="👤" label={klantNaam} muted /> : null}
        <ChipPressable
          icon="📁"
          label={projectNaam}
          onPress={() => setShowProjectPicker(true)}
        />
        <ChipPressable
          icon="🎯"
          label={discipline?.label ?? 'Kies wat je registreert'}
          onPress={() => setShowDisciplinePicker(true)}
          highlight={!discipline}
        />
      </View>

      {/* ── Grote camera-knop ───────────────────────────────────────── */}
      <View style={styles.cameraWrap}>
        <Pressable
          onPress={handlePhotoTap}
          disabled={uploadState === 'uploading'}
          style={({ pressed }) => [
            styles.cameraBtn,
            uploadState === 'success' && styles.cameraBtnSuccess,
            uploadState === 'error' && styles.cameraBtnError,
            pressed && styles.cameraBtnPressed,
          ]}
          accessibilityLabel="Foto maken"
          accessibilityRole="button"
        >
          {uploadState === 'uploading' ? (
            <>
              <ActivityIndicator color="#fff" size="large" />
              <Text style={styles.cameraBtnText}>Verzenden…</Text>
            </>
          ) : uploadState === 'success' ? (
            <>
              <Text style={styles.cameraBtnIcon}>✓</Text>
              <Text style={styles.cameraBtnText}>Verzonden</Text>
            </>
          ) : uploadState === 'error' ? (
            <>
              <Text style={styles.cameraBtnIcon}>⚠️</Text>
              <Text style={styles.cameraBtnText}>Probeer opnieuw</Text>
              {errorMsg ? <Text style={styles.cameraBtnSub}>{errorMsg.slice(0, 60)}</Text> : null}
            </>
          ) : (
            <>
              <Text style={styles.cameraBtnIcon}>📷</Text>
              <Text style={styles.cameraBtnText}>Foto maken</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* ── Discipline picker modal ────────────────────────────────── */}
      <Modal visible={showDisciplinePicker} animationType="slide" transparent onRequestClose={() => setShowDisciplinePicker(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Wat ga je registreren?</Text>
            <ScrollView>
              {DISCIPLINES.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={[
                    styles.modalItem,
                    discipline?.id === d.id && styles.modalItemActive,
                  ]}
                  onPress={() => {
                    setDiscipline(d);
                    saveLastDiscipline(d);
                    setShowDisciplinePicker(false);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.modalItemEmoji}>{d.emoji}</Text>
                  <Text style={styles.modalItemText}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowDisciplinePicker(false)} style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseText}>Sluit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Project picker modal ───────────────────────────────────── */}
      <Modal visible={showProjectPicker} animationType="slide" transparent onRequestClose={() => setShowProjectPicker(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Welk project?</Text>
            <ScrollView>
              {projects.map((p: Project) => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.modalItem,
                    activeProject?.id === p.id && styles.modalItemActive,
                  ]}
                  onPress={() => {
                    setActiveProject(p);
                    setShowProjectPicker(false);
                    if (onChangeProject) onChangeProject();
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.modalItemEmoji}>📁</Text>
                  <Text style={styles.modalItemText}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowProjectPicker(false)} style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseText}>Sluit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Sub-componenten ──────────────────────────────────────────────────────

interface ChipProps {
  icon: string;
  label: string;
  muted?: boolean;
}
const Chip: React.FC<ChipProps> = ({ icon, label, muted }) => (
  <View style={[styles.chip, muted && styles.chipMuted]}>
    <Text style={styles.chipIcon}>{icon}</Text>
    <Text style={[styles.chipText, muted && styles.chipTextMuted]} numberOfLines={1}>{label}</Text>
  </View>
);

interface ChipPressableProps extends ChipProps {
  onPress: () => void;
  highlight?: boolean;
}
const ChipPressable: React.FC<ChipPressableProps> = ({ icon, label, onPress, highlight }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.chip,
      styles.chipPressable,
      highlight && styles.chipHighlight,
      pressed && styles.chipPressed,
    ]}
    accessibilityRole="button"
    accessibilityLabel={`${icon} ${label} — tap om te wijzigen`}
  >
    <Text style={styles.chipIcon}>{icon}</Text>
    <Text style={styles.chipText} numberOfLines={1}>{label}</Text>
    <Text style={styles.chipChevron}>›</Text>
  </Pressable>
);

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  fallbackText: {
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 20,
  },
  contextWrap: {
    paddingHorizontal: 16,
    paddingTop: 18,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderWarm,
    gap: 10,
  },
  chipMuted: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
  },
  chipPressable: {
    backgroundColor: theme.colors.surface,
  },
  chipHighlight: {
    borderColor: theme.colors.statusSuccess,
    backgroundColor: theme.colors.statusSuccess + '12',
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipIcon: {
    fontSize: 18,
  },
  chipText: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  chipTextMuted: {
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  chipChevron: {
    color: theme.colors.textSecondary,
    fontSize: 22,
    fontWeight: '300',
  },
  cameraWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  cameraBtn: {
    width: '100%',
    minHeight: 220,
    backgroundColor: theme.colors.statusSuccess,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 32,
  },
  cameraBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  cameraBtnSuccess: {
    backgroundColor: theme.colors.statusSuccess,
  },
  cameraBtnError: {
    backgroundColor: '#dc2626',
  },
  cameraBtnIcon: {
    fontSize: 72,
    color: '#fff',
  },
  cameraBtnText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  cameraBtnSub: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.85,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 28,
    maxHeight: '75%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 14,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 12,
    marginBottom: 4,
  },
  modalItemActive: {
    backgroundColor: theme.colors.statusSuccess + '15',
  },
  modalItemEmoji: {
    fontSize: 24,
  },
  modalItemText: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  modalCloseBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderWarm,
  },
  modalCloseText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
