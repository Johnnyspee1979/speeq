import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CameraView as ExpoCameraView,
  useCameraPermissions,
} from 'expo-camera';
import { Accelerometer } from 'expo-sensors';
import { Directory, File, Paths } from 'expo-file-system';
import * as Location from 'expo-location';
import {
  getInspectionPresets,
  getProjectPresets,
  saveEvidenceLocally,
} from '../database/database';
import { syncEvidenceQueue, uploadEvidenceDirectly } from '../services/sync';
import { persistOfflinePhoto } from '../services/OfflinePhotoStore';
import { registerBgSync } from '../hooks/useNetworkSync';
import {
  findNenTaskContextByInspectionPointId,
  toNenCaptureTask,
} from '../constants/NenStandards';
import {
  getCaptureTimerBadgeLabel,
  getNen1006TimerDurationLabel,
  getNen1006TimerDurationMinutes,
  isNen1006TimerConfig,
  isNen1078TimerConfig,
} from '../constants/Nen1006TimerProfiles';
import Nen1006TimerOverlay from './Nen1006TimerOverlay';
import Nen1078TimerOverlay from './Nen1078TimerOverlay';
import {
  DEFAULT_PROJECT_ID,
  LOCATION_MAX_ACCURACY_METERS,
  PROJECT_LOCATION,
  PROJECT_RADIUS_METERS,
} from '../config/app';
import { findWkbTaskTemplateByInspectionPointId } from '../data/WkbTemplates';
import { isWeb } from '../lib/platform';
import { supabase } from '../lib/supabase';
import { fetchWeather, type WeatherSnapshot } from '../services/WeatherService';
import VoiceNoteButton from './VoiceNoteButton';
import ContextForm, { defaultContextData, type ContextData } from './ContextForm';
import { checkImageSharpnessLocal } from '../services/EdgeAIValidation';
import { createEvidenceHash, createEvidenceId } from '../services/evidenceIntegrity';
import { validateCaptureOnDevice } from '../services/aiEdge';
import { evaluateLocationSecurity } from '../services/LocationSecurityService';
import {
  BLURRY_PHOTO_MESSAGE,
  triggerBlurryPhotoAlert,
} from '../services/NotificationService';
import { useTheme } from '../theme/ThemeProvider';
import type { Theme } from '../theme/theme';
import { useVoicePlayback } from '../hooks/useVoicePlayback';
import CaptureSuccessCard from './CaptureSuccessCard';
import { AiSuggestionCard } from './AiSuggestionCard';
import FloorPlanPinPicker from './FloorPlanPinPicker';
import { getFloorPlansForProject, type FloorPlan } from '../services/FloorPlanService';
import BonScannerModal from './BonScannerModal';
import type { SharePayload } from '../services/ShareService';
import type {
  CaptureTask,
  Nen1006TimerProfileId,
  Nen1078CaptureTimerConfig,
} from '../types/CaptureTask';
import type { WkbEvidence } from '../types/Evidence';
import type { InspectionRouteIntent } from '../services/deepLinking';

type LiveLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  isMocked: boolean | null;
};

const LEVEL_TRACK_WIDTH = 160;
const LEVEL_ALIGNMENT_THRESHOLD = 0.09;
const FLAT_ALIGNMENT_THRESHOLD = 0.12;
const EVIDENCE_DIRECTORY_NAME = 'wkb-evidence';
const DEFAULT_TIMER_DURATION_SECONDS = 15 * 60;

type TimerPhase = 'IDLE' | 'RUNNING' | 'AWAITING_END_CAPTURE' | 'COMPLETE';

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const formatTimestamp = (date: Date) =>
  date
    .toLocaleString('nl-NL', {
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    .replace(',', '');

const formatCoordinate = (value: number | null) =>
  value == null ? '--.--' : value.toFixed(5);

const formatAccuracy = (value: number | null) =>
  value == null ? '--' : `${value.toFixed(1)}m`;

const formatCountdown = (remainingSeconds: number) => {
  const safeSeconds = Math.max(remainingSeconds, 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const getTaskInstruction = (task?: CaptureTask | null) =>
  task?.instruction?.trim() || task?.description || '';

const inferTaskByInspectionPointId = (
  inspectionPointId: string
): CaptureTask | null => {
  const wkbTemplate = findWkbTaskTemplateByInspectionPointId(inspectionPointId);

  if (wkbTemplate) {
    return {
      id: wkbTemplate.id,
      title: wkbTemplate.title,
      description: wkbTemplate.description,
      inspectionPointId: wkbTemplate.inspectionPointId,
      instruction: wkbTemplate.instruction,
      standards: wkbTemplate.standards,
      disciplineTitle: wkbTemplate.disciplineTitle,
      requiresExif: wkbTemplate.requiresExif,
      requiresMeasurementTool: wkbTemplate.requiresMeasurementTool,
      requiresTimer: wkbTemplate.requiresTimer,
      timerConfig: wkbTemplate.timerConfig,
      stopMoment: wkbTemplate.stopMoment,
      aiValidationKey: wkbTemplate.aiValidationKey,
      selectionSource: 'WKB',
    };
  }

  const nenContext = findNenTaskContextByInspectionPointId(inspectionPointId);

  if (nenContext) {
    return toNenCaptureTask(nenContext.discipline, nenContext.task);
  }

  return null;
};

const buildTimerEvidenceNote = (
  baseFieldNote: string,
  phaseLabel: string,
  fallbackTitle: string
) => {
  const trimmedFieldNote = baseFieldNote.trim();
  const combined = trimmedFieldNote
    ? `${phaseLabel} | ${trimmedFieldNote}`
    : `${fallbackTitle} | ${phaseLabel}`;

  return combined.slice(0, 180);
};

const getPermanentEvidenceUri = async (evidenceId: string, sourceUri: string) => {
  const evidenceDirectory = new Directory(Paths.document, EVIDENCE_DIRECTORY_NAME);
  evidenceDirectory.create({ idempotent: true, intermediates: true });

  const extensionMatch = sourceUri.match(/\.[a-zA-Z0-9]+(?=($|\?))/);
  const extension = extensionMatch?.[0] ?? '.jpg';
  const fileName = `${evidenceId}-${Date.now()}${extension}`;
  const targetFile = new File(evidenceDirectory, fileName);

  return targetFile.uri;
};

const getAuthenticatedUserId = async () => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user?.id ?? null;
  } catch {
    return null;
  }
};

interface CameraViewProps {
  selectedTask?: CaptureTask | null;
  focusRequest?: (InspectionRouteIntent & { nonce: number }) | null;
  onBackToTasks?: () => void;
  onBackToProject?: () => void;  // ↩️ Ander borgingspunt in zelfde project
  onBackToMain?: () => void;     // 🏠 Terug naar hoofdmenu
}

// ─── Discipline-specifieke locatie opties ─────────────────────────────────────

function getLocatieOpties(disciplineTitle: string | undefined, bb: 'BINNEN' | 'BUITEN'): string[] {
  const d = (disciplineTitle ?? '').toLowerCase();

  // Brand- & Rookwerendheid
  if (d.includes('brand') || d.includes('rook')) {
    return bb === 'BUITEN'
      ? ['Gevel doorvoer', 'Dak doorvoer', 'Buitenwand', 'Voorgevel', 'Achtergevel',
         'Zijgevel links', 'Zijgevel rechts', 'Gevel Noord', 'Gevel Oost', 'Gevel Zuid', 'Gevel West']
      : ['Doorvoer wand', 'Doorvoer plafond', 'Doorvoer vloer', 'Brandwerende deur',
         'Leidingschacht', 'Plenum', 'Systeemplafond', 'Stookruimte', 'Vluchtroute',
         'Kelder', 'Tech. ruimte', 'Trap'];
  }

  // Water, Gas & Klimaat / Installatie
  if (d.includes('water') || d.includes('gas') || d.includes('klimaat') || d.includes('installatie')) {
    return bb === 'BUITEN'
      ? ['Meterbox buiten', 'Gasaansluiting', 'Wateraansluiting', 'CV-afvoer buiten',
         'Ventilatiekanaal', 'Luchthapper', 'Dakdoorvoer', 'Gevelrooster', 'Fundering']
      : ['Meterkast', 'CV-ruimte', 'Stookruimte', 'Badkamer', 'Keuken', 'Toilet',
         'Kruipruimte', 'Leidingschacht', 'Wasmachinehoek', 'Vloer', 'Zolder',
         'Kelder', 'Garage', 'Tech. ruimte'];
  }

  // Elektrotechniek
  if (d.includes('elektro') || d.includes('elektra')) {
    return bb === 'BUITEN'
      ? ['Meterkast extern', 'PV-installatie / zonnepanelen', 'Aardaansluiting',
         'Gevelarmatuur', 'Buitenverlichting', 'Oplaadpunt', 'Dakinstallatie']
      : ['Groepenkast / meterkast', 'Badkamer', 'Keuken', 'Zolder', 'Kelder',
         'Leidingschacht', 'Vloer', 'Systeemplafond', 'Garage', 'Tech. ruimte',
         'Woonkamer', 'Slaapkamer 1', 'Slaapkamer 2', 'Hal / Gang'];
  }

  // Bouwfysica & Energie / Gebruik
  if (d.includes('bouwfysica') || d.includes('energie') || d.includes('gebruik')) {
    return bb === 'BUITEN'
      ? ['Spouwmuur', 'Buitenisolatie', 'Kozijn', 'Dakisolatie', 'Dakrand',
         'Voorgevel', 'Achtergevel', 'Zijgevel links', 'Zijgevel rechts',
         'Gevel Noord', 'Gevel Oost', 'Gevel Zuid', 'Gevel West',
         'Balkon', 'Fundering', 'Sokkel']
      : ['Vloerisolatie', 'Dakisolatie binnenzijde', 'Dampscherm', 'Binnenwand isolatie',
         'Kozijn binnen', 'Ventilatierooster', 'Spouwmuur binnenzijde',
         'Zolder', 'Kelder', 'Kruipruimte', 'Badkamer', 'Woonkamer', 'Tech. ruimte'];
  }

  // Constructie & Fundering / Constructieve Veiligheid
  if (d.includes('construct') || d.includes('fundering') || d.includes('structur')) {
    return bb === 'BUITEN'
      ? ['Fundering', 'Vloerplaat', 'Metselwerk', 'Betonwerk', 'Staalconstructie',
         'Ankerbout / verbinding', 'Spouwmuur', 'BG wand', 'Kolom', 'Balk',
         'Voorgevel', 'Achtergevel', 'Zijgevel links', 'Zijgevel rechts',
         'Gevel Noord', 'Gevel Oost', 'Gevel Zuid', 'Gevel West']
      : ['Draagwand', 'Draagkolom', 'Staalconstructie', 'Vloer', 'Balk', 'Trap',
         'Fundering binnenwand', 'Kelder', 'Kruipruimte', 'Zolder', 'Tech. ruimte'];
  }

  // Afbouw & Glas
  if (d.includes('afbouw') || d.includes('glas') || d.includes('schilder')) {
    return bb === 'BUITEN'
      ? ['Kozijn buiten', 'Beglazing buiten', 'Gevelplaat', 'Buitendorpel',
         'Voorgevel', 'Achtergevel', 'Zijgevel links', 'Zijgevel rechts',
         'Gevel Noord', 'Gevel Oost', 'Gevel Zuid', 'Gevel West',
         'Balkon', 'Dak', 'Luifel']
      : ['Systeemwand', 'Systeemplafond', 'Binnendeur', 'Glaswand', 'Beglazing binnen',
         'Vloerafwerking', 'Plint', 'Woonkamer', 'Keuken', 'Badkamer', 'Slaapkamer 1',
         'Slaapkamer 2', 'Hal / Gang', 'Trap', 'Zolder'];
  }

  // Bouwkundig Algemeen / fallback
  return bb === 'BUITEN'
    ? ['Voorgevel', 'Achtergevel', 'Zijgevel links', 'Zijgevel rechts',
       'Gevel Noord', 'Gevel Oost', 'Gevel Zuid', 'Gevel West',
       'BG wand', 'Kozijn', 'Dorpel / drempel', 'Voegwerk',
       'Dak', 'Dakrand', 'Balkon', 'Luifel', 'Sokkel', 'Fundering',
       'Metselwerk', 'Stucwerk', 'Houtwerk', 'Glas', 'Staalwerk / ijzer', 'Betonwerk',
       'Garage', 'Tech. ruimte']
    : ['Woonkamer', 'Keuken', 'Badkamer', 'Toilet',
       'Slaapkamer 1', 'Slaapkamer 2', 'Slaapkamer 3', 'Slaapkamer 4',
       'Hal / Gang', 'Bergruimte', 'Zolder', 'Trap',
       'Kelder', 'Garage', 'Tech. ruimte'];
}

// ──────────────────────────────────────────────────────────────────────────────

export default function CameraView({
  selectedTask = null,
  focusRequest = null,
  onBackToTasks,
  onBackToProject,
  onBackToMain,
}: CameraViewProps) {
  const { theme } = useTheme();
  const { playVoice } = useVoicePlayback();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<ExpoCameraView | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  // Web-only: bewaart de browser geolocation foutcode zodat we de juiste
  // platform-instructie kunnen tonen (Safari iOS, Chrome Android, etc).
  const [webGeoErrorCode, setWebGeoErrorCode] = useState<number | null>(null);
  const [liveLocation, setLiveLocation] = useState<LiveLocation | null>(null);
  const [projectId, setProjectId] = useState(DEFAULT_PROJECT_ID);
  const [inspectionPointId, setInspectionPointId] = useState('kik-wapening-002');
  const [fieldNote, setFieldNote] = useState('');
  // Toont na succesvol opslaan een keuzemenu: nog een foto, ander punt, of klaar.
  const [postSaveResult, setPostSaveResult] = useState<null | {
    aiStatus: string | null;
    aiNotes: string | null;
    uploadOk: boolean;
  }>(null);
  const [contextData, setContextData] = useState<ContextData>(() => ({
    ...defaultContextData(),
    binnenbuiten: selectedTask?.defaultBinnenBuiten ?? 'BINNEN',
    etage: selectedTask?.defaultEtage ?? '',
    huisnummer: '',
  }));

  // Sync etage + binnenbuiten als de gekozen task wijzigt.
  // Belangrijk: FORCE de task-waarde — niet terugvallen op prev.etage,
  // want na een save staat prev.etage op '' en dat is wat we willen.
  // Als StartFlow expliciet "-4" doorgaf moet dat ALTIJD landen.
  useEffect(() => {
    if (!selectedTask) return;
    setContextData((prev) => ({
      ...prev,
      binnenbuiten: selectedTask.defaultBinnenBuiten ?? prev.binnenbuiten,
      etage: selectedTask.defaultEtage ?? '',
    }));
  }, [selectedTask?.id, selectedTask?.defaultEtage, selectedTask?.defaultBinnenBuiten]);
  const [desktopPhoto, setDesktopPhoto] = useState<File | null>(null);
  const [mobileWebPhotoUri, setMobileWebPhotoUri] = useState<string | null>(null);
  const mobileWebInputRef = useRef<HTMLInputElement | null>(null);
  /**
   * Throttle voor watchPosition updates op web. iOS Safari geeft GPS
   * micro-fluctuaties (4.83 → 4.79 → 4.81) die elke keer 4 setStates
   * triggerden — resultaat: continu re-rendering loop die het scherm
   * liet 'springen' en knoppen onaantikbaar maakte.
   */
  const lastGpsUpdateRef = useRef<number>(0);
  const lastWeatherFetchRef = useRef<number>(0);
  const [mobileWizardStep, setMobileWizardStep] = useState<'photo' | 'confirm'>('photo');
  const [mobileAddress, setMobileAddress] = useState<string | null>(null);
  const [desktopLatitude, setDesktopLatitude] = useState('52.36760');
  const [desktopLongitude, setDesktopLongitude] = useState('4.90410');
  const [desktopAccuracy, setDesktopAccuracy] = useState('5.0');
  const [desktopAltitude, setDesktopAltitude] = useState<string | null>(null);
  const [projectPresets, setProjectPresets] = useState<string[]>([]);
  const [inspectionPresets, setInspectionPresets] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [accelerometer, setAccelerometer] = useState({ x: 0, y: 0, z: 0 });
  const [isCapturing, setIsCapturing] = useState(false);
  const [stopMomentConfirmed, setStopMomentConfirmed] = useState(true);
  const [measurementToolConfirmed, setMeasurementToolConfirmed] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [weatherSnapshot, setWeatherSnapshot] = useState<WeatherSnapshot | null>(null);
  const [timerStartedAt, setTimerStartedAt] = useState<string | null>(null);
  const [timerCompleted, setTimerCompleted] = useState(true);
  const [timerPhase, setTimerPhase] = useState<TimerPhase>('COMPLETE');
  const [timerStartCapturedAt, setTimerStartCapturedAt] = useState<string | null>(null);
  const [timerEndCapturedAt, setTimerEndCapturedAt] = useState<string | null>(null);
  const [timerInstanceKey, setTimerInstanceKey] = useState(0);
  const [timerProfileId, setTimerProfileId] =
    useState<Nen1006TimerProfileId>('WATER_PRESSURE_RESISTANCE_10_MIN');
  const [timerFixedDurationMinutes, setTimerFixedDurationMinutes] = useState(0);
  const [timerExtraVolumeBlocks, setTimerExtraVolumeBlocks] = useState(0);
  const [lastCapture, setLastCapture] = useState<SharePayload | null>(null);
  // Floor plan annotation state
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [showFloorPlanPicker, setShowFloorPlanPicker] = useState(false);
  const pendingEvidenceRef = useRef<WkbEvidence | null>(null);
  // Bon-scanner modal (OCR voor leveringsbonnen, certificaten, facturen)
  const [showBonScanner, setShowBonScanner] = useState(false);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const activeTask = useMemo(
    () => selectedTask ?? inferTaskByInspectionPointId(inspectionPointId),
    [inspectionPointId, selectedTask]
  );
  const activeCategoryId = useMemo(
    () => findWkbTaskTemplateByInspectionPointId(inspectionPointId)?.categoryId,
    [inspectionPointId]
  );
  const activeTimerConfig = activeTask?.timerConfig;
  const usesNen1006TimerOverlay = isNen1006TimerConfig(activeTimerConfig);
  const usesNen1078TimerOverlay = isNen1078TimerConfig(activeTimerConfig);
  const usesStructuredPressureTestOverlay =
    usesNen1006TimerOverlay || usesNen1078TimerOverlay;
  const nen1078TimerConfig: Nen1078CaptureTimerConfig | null =
    isNen1078TimerConfig(activeTimerConfig) ? activeTimerConfig : null;
  const timerBadgeLabel = getCaptureTimerBadgeLabel(activeTask ?? {});

  // Laad beschikbare bouwtekeningen voor het huidige project
  useEffect(() => {
    getFloorPlansForProject(projectId).then(setFloorPlans).catch(() => {});
  }, [projectId]);

  useEffect(() => {
    let isMounted = true;
    let locationSubscription: Location.LocationSubscription | null = null;

    const bootstrap = async () => {
      const [projects, inspections] = await Promise.all([
        getProjectPresets(),
        getInspectionPresets(),
      ]);

      if (!isMounted) {
        return;
      }

      setProjectPresets(projects);
      setInspectionPresets(inspections);

      if (projects.length > 0) {
        const fallbackProject = projects[0] ?? DEFAULT_PROJECT_ID;
        setProjectId((current: string) => current || fallbackProject);
      }

      if (inspections.length > 0) {
        const fallbackInspection = inspections[0] ?? 'kik-wapening-002';
        setInspectionPointId((current: string) => current || fallbackInspection);
      }

      if (isWeb) {
        // Browser GPS + automatisch weer ophalen op web — watchPosition voor real-time updates.
        // We zetten permission op true ZODRA we daadwerkelijk een coördinaat krijgen.
        // Bij PERMISSION_DENIED (code 1) zetten we 'm op false zodat de uitleg-schermen verschijnen.
        if (typeof window !== 'undefined' && navigator.geolocation) {
          // Optimistic: ga er vanuit dat het lukt; geo error callback corrigeert anders.
          setLocationPermission(true);
          const watchId = navigator.geolocation.watchPosition(
            (pos) => {
              if (!isMounted) return;
              // Throttle: max 1 GPS-update per 3 seconden. iOS Safari
              // geeft micro-fluctuaties (4.83→4.79→4.81→...) waardoor
              // het scherm continu re-renderde en knoppen onaantikbaar
              // werden ('halve cm springen' — bug-rapport Johnny 24 mei).
              const now = Date.now();
              if (now - lastGpsUpdateRef.current < 3000) return;
              lastGpsUpdateRef.current = now;

              setWebGeoErrorCode(null);
              setLocationPermission(true);
              setDesktopLatitude(pos.coords.latitude.toFixed(6));
              setDesktopLongitude(pos.coords.longitude.toFixed(6));
              setDesktopAccuracy(String(Math.round(pos.coords.accuracy)));
              // Toon ruwe altitude voor indicatie. WGS84-offset is in NL
              // ~40-50m, dus we tonen 'm met disclaimer-aantekening.
              // Verdieping blijft handmatig instelbaar via StartFlow.
              if (pos.coords.altitude != null && Number.isFinite(pos.coords.altitude)) {
                setDesktopAltitude(pos.coords.altitude.toFixed(0));
              } else {
                setDesktopAltitude(null);
              }
              // Weer alleen 1× per 5 min ophalen — voorheen elke GPS-tick
              if (now - lastWeatherFetchRef.current > 5 * 60 * 1000) {
                lastWeatherFetchRef.current = now;
                fetchWeather(pos.coords.latitude, pos.coords.longitude)
                  .then((w) => { if (isMounted && w) setWeatherSnapshot(w); })
                  .catch(() => {});
              }
            },
            (err) => {
              if (!isMounted) return;
              setWebGeoErrorCode(err.code);
              // PERMISSION_DENIED = 1 → blokkeer; andere fouten (timeout/unavailable)
              // niet meteen blokkeren want die kunnen tijdelijk zijn.
              if (err.code === 1) {
                setLocationPermission(false);
              }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
          );
          return () => {
            isMounted = false;
            navigator.geolocation.clearWatch(watchId);
          };
        }
        // Geen geolocation API beschikbaar — markeer als geweigerd
        setLocationPermission(false);
        setWebGeoErrorCode(2); // POSITION_UNAVAILABLE
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!isMounted) {
        return;
      }

      const granted = status === 'granted';
      setLocationPermission(granted);

      if (!granted) {
        return;
      }

      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      if (!isMounted) {
        return;
      }

      setLiveLocation({
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
        accuracy: currentPosition.coords.accuracy ?? null,
        isMocked:
          (currentPosition as { mocked?: boolean }).mocked ??
          ((currentPosition.coords as { mocked?: boolean }).mocked ?? null),
      });

      // Haal automatisch het weer op zodra GPS bekend is
      fetchWeather(currentPosition.coords.latitude, currentPosition.coords.longitude)
        .then((w) => { if (isMounted && w) setWeatherSnapshot(w); })
        .catch(() => {});

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 1,
          timeInterval: 2000,
        },
        (position) => {
          setLiveLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy ?? null,
            isMocked:
              (position as { mocked?: boolean }).mocked ??
              ((position.coords as { mocked?: boolean }).mocked ?? null),
          });
        }
      );
    };

    void bootstrap();

    return () => {
      isMounted = false;
      locationSubscription?.remove();
    };
  }, []);

  useEffect(() => {
    if (!activeTask) {
      setStopMomentConfirmed(true);
      setMeasurementToolConfirmed(true);
      setTimerStartedAt(null);
      setTimerCompleted(true);
      setTimerPhase('COMPLETE');
      setTimerStartCapturedAt(null);
      setTimerEndCapturedAt(null);
      setTimerInstanceKey(0);
      setTimerFixedDurationMinutes(0);
      setTimerExtraVolumeBlocks(0);
      return;
    }

    setInspectionPointId(activeTask.inspectionPointId);
    // BEHOUD etage + binnenbuiten uit StartFlow — anders wist 'ie de -4
    // die de vakman zojuist op het verdieping-scherm intypte.
    setContextData({
      ...defaultContextData(),
      etage: activeTask.defaultEtage ?? '',
      huisnummer: activeTask.defaultHuisnummer ?? '',
      binnenbuiten: activeTask.defaultBinnenBuiten ?? 'BINNEN',
    });
    // Notitie blijft leeg tot de vakman zelf iets typt of inspreekt.
    // Geen voorgevulde "Title - Standard" tekst meer — die werd vaak
    // per ongeluk meegestuurd en zorgde voor verwarring.
    setFieldNote((current) => (current.trim() ? current : ''));
    setStopMomentConfirmed(!activeTask.stopMoment);
    setMeasurementToolConfirmed(!activeTask.requiresMeasurementTool);
    setTimerStartedAt(null);
    setTimerCompleted(!activeTask.requiresTimer);
    setTimerPhase(activeTask.requiresTimer ? 'IDLE' : 'COMPLETE');
    setTimerStartCapturedAt(null);
    setTimerEndCapturedAt(null);
    setTimerInstanceKey(0);
    setTimerFixedDurationMinutes(0);
    setTimerExtraVolumeBlocks(0);

    if (isNen1006TimerConfig(activeTask.timerConfig)) {
      setTimerProfileId(activeTask.timerConfig.defaultProfileId);
    }

    if (isNen1078TimerConfig(activeTask.timerConfig)) {
      setTimerFixedDurationMinutes(activeTask.timerConfig.defaultDurationMinutes);
    }
  }, [activeTask]);

  useEffect(() => {
    if (!focusRequest) {
      return;
    }

    setInspectionPointId(focusRequest.inspectionPointId);
    setFieldNote((current) =>
      current.trim()
        ? current
        : focusRequest.reason
          ? `Herstel vereist: ${focusRequest.reason}`
          : 'Heropname geopend vanuit deep-link of kwaliteitsmelding.'
    );

    Alert.alert(
      focusRequest.source === 'notification'
        ? 'Wkb actie vereist'
        : 'Inspectiepunt geopend',
      focusRequest.reason
        ? `Open direct ${focusRequest.inspectionPointId}. Reden: ${focusRequest.reason}`
        : `Camera geopend voor inspectiepunt ${focusRequest.inspectionPointId}.`
    );
  }, [focusRequest]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const activeTimerDurationSeconds = useMemo(() => {
    if (!activeTask?.requiresTimer) {
      return 0;
    }

    if (usesNen1006TimerOverlay) {
      return getNen1006TimerDurationMinutes(
        timerProfileId,
        timerExtraVolumeBlocks
      ) * 60;
    }

    if (usesNen1078TimerOverlay) {
      return timerFixedDurationMinutes * 60;
    }

    return DEFAULT_TIMER_DURATION_SECONDS;
  }, [
    activeTask?.requiresTimer,
    timerFixedDurationMinutes,
    timerExtraVolumeBlocks,
    timerProfileId,
    usesNen1006TimerOverlay,
    usesNen1078TimerOverlay,
  ]);

  const timerRemainingSeconds = useMemo(() => {
    if (!activeTask?.requiresTimer) {
      return 0;
    }

    if (!timerStartedAt) {
      return activeTimerDurationSeconds;
    }

    const startedAt = new Date(timerStartedAt).getTime();
    const now = currentTime.getTime();
    const elapsedSeconds = Math.floor((now - startedAt) / 1000);

    return Math.max(activeTimerDurationSeconds - elapsedSeconds, 0);
  }, [activeTask?.requiresTimer, activeTimerDurationSeconds, currentTime, timerStartedAt]);

  useEffect(() => {
    if (
      activeTask?.requiresTimer &&
      timerStartedAt &&
      !timerCompleted &&
      timerRemainingSeconds <= 0
    ) {
      if (usesNen1006TimerOverlay) {
        setTimerPhase('AWAITING_END_CAPTURE');
        return;
      }

      setTimerCompleted(true);
      setTimerPhase('COMPLETE');
    }
  }, [
    activeTask?.requiresTimer,
    timerCompleted,
    timerRemainingSeconds,
    timerStartedAt,
    usesNen1006TimerOverlay,
  ]);

  useEffect(() => {
    if (isWeb) {
      return;
    }

    Accelerometer.setUpdateInterval(180);
    const subscription = Accelerometer.addListener((next) => {
      setAccelerometer(next);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleGrantAccess = async () => {
    // Op web: een nieuwe getCurrentPosition triggert de browser-prompt weer
    // (mits gebruiker hem nog niet permanent geblokkeerd heeft).
    if (isWeb) {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          () => {
            setWebGeoErrorCode(null);
            setLocationPermission(true);
          },
          (err) => {
            setWebGeoErrorCode(err.code);
            setLocationPermission(false);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
      return;
    }
    await requestCameraPermission();
    const result = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(result.status === 'granted');
  };

  // Detecteert welke browser/OS we draaien zodat we de juiste instructies
  // kunnen tonen wanneer locatie geweigerd is.
  const webPlatformHint = useMemo(() => {
    if (typeof navigator === 'undefined') return null;
    const ua = navigator.userAgent ?? '';
    const isIos = /iPhone|iPad|iPod/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
    const isChromeIos = /CriOS/i.test(ua);
    if (isIos && isSafari) return 'safari-ios';
    if (isIos && isChromeIos) return 'chrome-ios';
    if (isAndroid) return 'android';
    if (isSafari) return 'safari-mac';
    return 'desktop';
  }, []);

  const webGeoHelpText = useMemo(() => {
    if (webGeoErrorCode === null) return null;
    if (webGeoErrorCode === 3) {
      return 'GPS reageerde niet binnen 10 seconden. Loop even naar buiten of probeer opnieuw.';
    }
    if (webGeoErrorCode === 2) {
      return 'Je apparaat kan op dit moment geen GPS-positie bepalen. Controleer of locatie aanstaat in je systeeminstellingen en probeer opnieuw.';
    }
    // PERMISSION_DENIED
    if (webPlatformHint === 'safari-ios') {
      return 'Tik op het "AA"-icoon links in de adresbalk → Website-instellingen → Locatie → Sta toe. Of: Instellingen → Safari → Locatie → Vraag.';
    }
    if (webPlatformHint === 'chrome-ios') {
      return 'iOS-Chrome heeft een eigen locatie-instelling: Instellingen-app → Chrome → Locatie → "Bij gebruik". Daarna deze pagina opnieuw laden.';
    }
    if (webPlatformHint === 'android') {
      return 'Tik op het slotje links in de adresbalk → Toestemmingen → Locatie → Toestaan. Daarna de pagina opnieuw laden.';
    }
    if (webPlatformHint === 'safari-mac') {
      return 'Safari → Instellingen → Websites → Locatie → kies "Toestaan" voor deze site.';
    }
    return 'Klik op het slotje of locatie-icoon links in de adresbalk en kies "Toestaan". Daarna de pagina opnieuw laden.';
  }, [webGeoErrorCode, webPlatformHint]);

  // Detect mobile browser (Android / iOS / iPadOS) on web
  const isMobileWebDevice =
    isWeb &&
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent ?? '');

  const handlePickDesktopPhoto = async () => {
    if (isMobileWebDevice) {
      // On phone/tablet browser: trigger the hidden <input capture="environment">
      // so the native camera opens directly.
      if (mobileWebInputRef.current) {
        mobileWebInputRef.current.value = '';
        mobileWebInputRef.current.click();
      }
      return;
    }
    // Desktop web: use expo-file-system picker (opens file browser)
    try {
      const selected = await File.pickFileAsync(undefined, 'image/*');
      const pickedFile = Array.isArray(selected) ? selected[0] : selected;
      if (!pickedFile) return;
      setDesktopPhoto(pickedFile);
      setMobileWebPhotoUri(null);
    } catch (error) {
      console.error('Desktop foto selecteren faalde:', error);
      Alert.alert('Selectie mislukt', 'Kon geen foto kiezen.');
    }
  };

  const handleMobileWebPhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setMobileWebPhotoUri(objectUrl);
    setDesktopPhoto(null);
  };

  // Reset wizard step wanneer foto wordt gewist
  useEffect(() => {
    if (!desktopPhoto && !mobileWebPhotoUri) {
      setMobileWizardStep('photo');
    }
  }, [desktopPhoto, mobileWebPhotoUri]);

  // Reverse geocoding: haal straat + nummer op zodra bevestigingsstap zichtbaar wordt
  useEffect(() => {
    if (mobileWizardStep !== 'confirm') return;
    const lat = Number(desktopLatitude);
    const lng = Number(desktopLongitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    setMobileAddress(null);
    void fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'nl' } }
    )
      .then((r) => r.json())
      .then((data: { address?: { road?: string; house_number?: string; city?: string; town?: string; village?: string } }) => {
        const a = data.address;
        if (!a) return;
        const road = a.road ?? '';
        const number = a.house_number ? ` ${a.house_number}` : '';
        const place = a.city ?? a.town ?? a.village ?? '';
        const parts = [road + number, place].filter(Boolean);
        if (parts.length > 0) setMobileAddress(parts.join(', '));
      })
      .catch(() => {});
  }, [mobileWizardStep, desktopLatitude, desktopLongitude]);

  const levelState = useMemo(() => {
    const portraitAligned =
      Math.abs(accelerometer.x) <= LEVEL_ALIGNMENT_THRESHOLD &&
      Math.abs(Math.abs(accelerometer.y) - 1) <= 0.18;
    const flatAligned =
      Math.abs(accelerometer.x) <= FLAT_ALIGNMENT_THRESHOLD &&
      Math.abs(accelerometer.y) <= FLAT_ALIGNMENT_THRESHOLD &&
      Math.abs(Math.abs(accelerometer.z) - 1) <= 0.18;

    const mode = Math.abs(accelerometer.z) > 0.72 ? 'flat' : 'upright';
    const rawOffset = mode === 'flat' ? accelerometer.y : accelerometer.x;
    const bubbleOffset = clamp(
      rawOffset * (LEVEL_TRACK_WIDTH / 2),
      -(LEVEL_TRACK_WIDTH / 2),
      LEVEL_TRACK_WIDTH / 2
    );

    return {
      bubbleOffset,
      mode,
      isAligned: portraitAligned || flatAligned,
      label:
        portraitAligned || flatAligned
          ? mode === 'flat'
            ? 'Waterpas plat'
            : 'Waterpas recht'
          : mode === 'flat'
            ? 'Houd telefoon vlak'
            : 'Houd telefoon recht',
    };
  }, [accelerometer]);

  const desktopLocationInput = useMemo(() => {
    const latitude = Number(desktopLatitude);
    const longitude = Number(desktopLongitude);
    const accuracy = Number(desktopAccuracy);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return {
      latitude,
      longitude,
      accuracy: Number.isFinite(accuracy) ? accuracy : null,
      isMocked: null,
    };
  }, [desktopAccuracy, desktopLatitude, desktopLongitude]);

  const locationSecurity = useMemo(
    () =>
      evaluateLocationSecurity(isWeb ? desktopLocationInput : liveLocation, {
        projectLocation: PROJECT_LOCATION,
        allowedRadiusMeters: PROJECT_RADIUS_METERS,
        maxAccuracyMeters: LOCATION_MAX_ACCURACY_METERS,
      }),
    [desktopLocationInput, liveLocation]
  );

  const timerAwaitingEndCapture =
    activeTask?.requiresTimer &&
    usesStructuredPressureTestOverlay &&
    timerPhase === 'AWAITING_END_CAPTURE';
  const timerIsRunning =
    activeTask?.requiresTimer &&
    Boolean(timerStartedAt) &&
    !timerCompleted &&
    timerPhase === 'RUNNING';
  const timerDurationLabel = useMemo(() => {
    if (!activeTask?.requiresTimer) {
      return null;
    }

    if (usesNen1006TimerOverlay) {
      return getNen1006TimerDurationLabel(timerProfileId, timerExtraVolumeBlocks);
    }

    if (usesNen1078TimerOverlay) {
      return timerFixedDurationMinutes > 0 ? `${timerFixedDurationMinutes} min` : null;
    }

    return `${Math.floor(activeTimerDurationSeconds / 60)} min`;
  }, [
    activeTask?.requiresTimer,
    activeTimerDurationSeconds,
    timerFixedDurationMinutes,
    timerExtraVolumeBlocks,
    timerProfileId,
    usesNen1006TimerOverlay,
    usesNen1078TimerOverlay,
  ]);

  const timerStartTask = useMemo(() => {
    if (!usesStructuredPressureTestOverlay || !activeTimerConfig) {
      return null;
    }

    return inferTaskByInspectionPointId(activeTimerConfig.startInspectionPointId);
  }, [activeTimerConfig, usesStructuredPressureTestOverlay]);

  const timerProcedureLabel = useMemo(() => {
    if (usesNen1078TimerOverlay) {
      return 'dichtheidsbeproeving';
    }

    if (usesNen1006TimerOverlay) {
      return 'persproef';
    }

    return 'timer';
  }, [usesNen1006TimerOverlay, usesNen1078TimerOverlay]);

  const timerEvidencePrefix = useMemo(() => {
    if (usesNen1078TimerOverlay) {
      return 'NEN 1078 dichtheidsbeproeving';
    }

    if (usesNen1006TimerOverlay) {
      return 'NEN 1006 persproef';
    }

    return 'Installatiebeproeving';
  }, [usesNen1006TimerOverlay, usesNen1078TimerOverlay]);

  const timerStatusText = useMemo(() => {
    if (!activeTask?.requiresTimer) {
      return null;
    }

    if (usesStructuredPressureTestOverlay) {
      if (timerCompleted && timerEndCapturedAt) {
        return 'Beginfoto, wachttijd en eindfoto afgerond';
      }

      if (timerAwaitingEndCapture) {
        return 'Wachttijd voltooid, maak nu de eindfoto';
      }

      if (timerPhase === 'RUNNING' && timerStartedAt) {
        return `Timer loopt: nog ${formatCountdown(timerRemainingSeconds)}`;
      }

      if (timerStartCapturedAt) {
        return 'Beginfoto vastgelegd, timer klaar voor herstart';
      }

      return timerDurationLabel
        ? `Nog starten (${timerDurationLabel})`
        : 'Nog starten';
    }

    if (timerCompleted && timerStartedAt) {
      return 'Afgerond';
    }

    if (timerStartedAt) {
      return `Nog ${formatCountdown(timerRemainingSeconds)}`;
    }

    return 'Nog starten';
  }, [
    activeTask?.requiresTimer,
    timerAwaitingEndCapture,
    timerCompleted,
    timerDurationLabel,
    timerEndCapturedAt,
    timerPhase,
    timerRemainingSeconds,
    timerStartCapturedAt,
    timerStartedAt,
    usesStructuredPressureTestOverlay,
  ]);

  const captureEnabled =
    (isWeb ||
      (Boolean(cameraPermission?.granted) &&
        locationPermission === true &&
        liveLocation != null)) &&
    locationSecurity.allowed &&
    stopMomentConfirmed &&
    measurementToolConfirmed &&
    timerCompleted &&
    !isCapturing;

  const captureComplianceReady =
    stopMomentConfirmed && measurementToolConfirmed && timerCompleted;

  const captureBlockingMessage = usesStructuredPressureTestOverlay
    ? 'Leg via de Timer Overlay eerst de beginfoto vast, wacht de volledige normtijd af en maak daarna de eindfoto.'
    : 'Bevestig eerst het vereiste stopmoment, het meetmiddel in beeld en rond indien nodig de beproevingstimer af.';

  // Bouwt een duidelijk lijstje van wat de vakman nog moet doen voordat
  // hij kan opslaan. Voorkomt de stille "save doet niets" bug.
  const captureMissingChecklist = (): string[] => {
    const missing: string[] = [];
    if (activeTask?.stopMoment && !stopMomentConfirmed) {
      missing.push(`• Tik op het bolletje "${activeTask.stopMoment}" om te bevestigen`);
    }
    if (activeTask?.requiresMeasurementTool && !measurementToolConfirmed) {
      missing.push('• Tik op "Meetmiddel in beeld" om te bevestigen');
    }
    if (activeTask?.requiresTimer && !timerCompleted) {
      missing.push('• Rond eerst de beproevingstimer af');
    }
    return missing;
  };

  const handleMobileSavePress = () => {
    if (isCapturing) return;
    if (!captureComplianceReady) {
      const missing = captureMissingChecklist();
      Alert.alert(
        'Nog één stap',
        missing.length
          ? `Voordat je kunt opslaan:\n\n${missing.join('\n')}`
          : captureBlockingMessage,
      );
      return;
    }
    void saveDesktopEvidence();
  };

  const saveDesktopEvidenceForTask = async (
    task: CaptureTask,
    options?: {
      fieldNoteOverride?: string | null;
      preserveFieldNote?: boolean;
    }
  ) => {
    const hasPhoto = !!desktopPhoto || !!mobileWebPhotoUri;
    if (!hasPhoto) {
      Alert.alert('Geen foto gekozen', 'Neem eerst een foto.');
      return null;
    }

    const latitude = Number(desktopLatitude);
    const longitude = Number(desktopLongitude);
    const accuracy = Number(desktopAccuracy);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      Alert.alert('GPS ontbreekt', 'Vul geldige latitude en longitude in.');
      return null;
    }

    if (!locationSecurity.allowed) {
      Alert.alert('Locatiecontrole geblokkeerd', locationSecurity.message);
      return null;
    }

    setIsCapturing(true);

    try {
      const evidenceId = createEvidenceId();
      const userId = await getAuthenticatedUserId();
      const timestamp = new Date().toISOString();
      let permanentUri: string;
      if (mobileWebPhotoUri) {
        // Mobile web: blob URL is the captured photo — use directly as media URI
        permanentUri = mobileWebPhotoUri;
      } else {
        permanentUri = await getPermanentEvidenceUri(evidenceId, desktopPhoto!.uri);
        desktopPhoto!.copy(new File(permanentUri));
      }

      const aiResult = await validateCaptureOnDevice(permanentUri, task.aiValidationKey);
      const exifHash = await createEvidenceHash(permanentUri);
      const noteCandidate = options?.fieldNoteOverride ?? fieldNote;
      const resolvedFieldNote = noteCandidate.trim()
        ? noteCandidate.trim()
        : 'Desktop simulatie via MacBook';

      const newEvidence: WkbEvidence = {
        id: evidenceId,
        mediaUri: permanentUri,
        latitude,
        longitude,
        gpsAccuracy: Number.isFinite(accuracy) ? accuracy : null,
        altitude: null,
        altitudeAccuracy: null,
        timestamp,
        projectId: projectId.trim() || 'onbekend',
        inspectionPointId: task.inspectionPointId.trim() || 'onbekend',
        exifHash,
        exifVerified: false,
        userId,
        fieldNote: resolvedFieldNote,
        weatherLabel: weatherSnapshot?.label ?? null,
        stopMomentConfirmed: task.stopMoment ? stopMomentConfirmed : null,
        measurementToolConfirmed: task.requiresMeasurementTool
          ? measurementToolConfirmed
          : null,
        locationVerified: locationSecurity.allowed,
        locationSpoofRisk: locationSecurity.spoofRisk,
        locationSecurityMessage: locationSecurity.message,
        etage: contextData.etage || null,
        huisnummer: contextData.huisnummer || null,
        ruimtenummer: contextData.ruimtenummer.trim() || null,
        binnenbuiten: contextData.binnenbuiten,
        locatieDetail: contextData.locatieDetail.trim() || null,
        context_extra: Object.keys(contextData.extra).length > 0 ? contextData.extra : null,
        floorPlanId: null,
        pinX: null,
        pinY: null,
        syncStatus: 'PENDING',
      };

      // Toon floor plan picker als tekeningen beschikbaar zijn
      if (floorPlans.length > 0) {
        pendingEvidenceRef.current = newEvidence;
        setShowFloorPlanPicker(true);
        setIsCapturing(false);
        return null;
      }

      // Directe upload naar Supabase — met 6s timeout zodat de knop
      // nooit eindeloos blijft hangen op een traag/offline mobiel netwerk.
      let uploadOk = false;
      try {
        const uploadResult = await Promise.race([
          uploadEvidenceDirectly(newEvidence, permanentUri),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
        ]);
        uploadOk = !!uploadResult;
      } catch {
        uploadOk = false;
      }

      if (!uploadOk) {
        // Fallback: foto persisteren in IndexedDB (overleeft page refresh)
        // dan metadata opslaan + background sync registreren
        try {
          // Blob-URL → base64 data-URL → IndexedDB (overleeft tab-sluiting)
          const persistedUri = await persistOfflinePhoto(permanentUri, newEvidence.id);
          const evidenceToSave = persistedUri
            ? { ...newEvidence, mediaUri: persistedUri }
            : newEvidence;
          await saveEvidenceLocally(evidenceToSave);
          // Registreer SW Background Sync — sync ook als app in achtergrond is
          void registerBgSync();
          // Directe poging als al online
          if (typeof navigator !== 'undefined' && navigator.onLine) {
            void syncEvidenceQueue();
          }
        } catch {
          console.warn('Zowel Supabase upload als lokale opslag mislukt — bewijs getoond maar nog niet gesynchroniseerd');
        }
      }

      if (!options?.preserveFieldNote) {
        setFieldNote('');
        // Behoud verdieping + binnen/buiten + locatieDetail.
        // De vakman maakt vaak meerdere foto's op dezelfde verdieping —
        // hij hoeft -4 niet 8x in te typen.
        setContextData((prev) => ({
          ...defaultContextData(),
          etage: prev.etage,
          binnenbuiten: prev.binnenbuiten,
          locatieDetail: prev.locatieDetail,
        }));
      }

      setDesktopPhoto(null);
      setMobileWebPhotoUri(null);

      return {
        timestamp,
        aiStatus: aiResult.status,
        aiNotes: aiResult.notes,
        uploadOk,
      };
    } catch (error) {
      console.error('Desktop bewijs opslaan faalde:', error);
      Alert.alert('Opslaan mislukt', String(error));
      return null;
    } finally {
      setIsCapturing(false);
    }
  };

  const captureCameraEvidenceForTask = async (
    task: CaptureTask,
    options?: {
      fieldNoteOverride?: string | null;
      preserveFieldNote?: boolean;
    }
  ) => {
    if (!cameraRef.current) {
      return null;
    }

    setIsCapturing(true);

    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      const freshLocationSecurity = evaluateLocationSecurity(
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy ?? null,
          isMocked:
            (position as { mocked?: boolean }).mocked ??
            ((position.coords as { mocked?: boolean }).mocked ?? null),
        },
        {
          projectLocation: PROJECT_LOCATION,
          allowedRadiusMeters: PROJECT_RADIUS_METERS,
          maxAccuracyMeters: LOCATION_MAX_ACCURACY_METERS,
        }
      );

      if (!freshLocationSecurity.allowed) {
        Alert.alert('Locatiecontrole geblokkeerd', freshLocationSecurity.message);
        return null;
      }

      const evidenceId = createEvidenceId();
      const userId = await getAuthenticatedUserId();
      const timestamp = new Date().toISOString();

      const photo = await cameraRef.current.takePictureAsync({
        exif: true,
        base64: true,
        quality: 0.9,
      });

      if (!photo.base64) {
        throw new Error('Geen afbeeldingsdata ontvangen.');
      }

      const isSharp = await checkImageSharpnessLocal(photo.base64);

      if (!isSharp) {
        await triggerBlurryPhotoAlert();
        void playVoice('Foto te wazig. Maak een nieuwe foto.');
        Alert.alert('Kwaliteitswaarschuwing', BLURRY_PHOTO_MESSAGE);
        return null;
      }

      const aiResult = await validateCaptureOnDevice(photo.uri, task.aiValidationKey);

      if (aiResult.status === 'FAILED') {
        await triggerBlurryPhotoAlert();
        void playVoice('Foto afgekeurd. Maak een nieuwe foto.');
        Alert.alert('Kwaliteitswaarschuwing', aiResult.notes ?? BLURRY_PHOTO_MESSAGE);
        return null;
      }

      const permanentUri = await getPermanentEvidenceUri(evidenceId, photo.uri);
      const capturedFile = new File(photo.uri);
      const destinationFile = new File(permanentUri);
      capturedFile.move(destinationFile);

      const exifHash = await createEvidenceHash(permanentUri);
      const exifVerified = Boolean(photo.exif && Object.keys(photo.exif).length > 0);
      const noteCandidate = options?.fieldNoteOverride ?? fieldNote;
      const resolvedFieldNote = noteCandidate.trim() ? noteCandidate.trim() : null;

      const newEvidence: WkbEvidence = {
        id: evidenceId,
        mediaUri: permanentUri,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        gpsAccuracy: position.coords.accuracy ?? null,
        timestamp,
        projectId: projectId.trim() || 'onbekend',
        inspectionPointId: task.inspectionPointId.trim() || 'onbekend',
        exifHash,
        exifVerified,
        userId,
        fieldNote: resolvedFieldNote,
        weatherLabel: weatherSnapshot?.label ?? null,
        stopMomentConfirmed: task.stopMoment ? stopMomentConfirmed : null,
        measurementToolConfirmed: task.requiresMeasurementTool
          ? measurementToolConfirmed
          : null,
        locationVerified: freshLocationSecurity.allowed,
        locationSpoofRisk: freshLocationSecurity.spoofRisk,
        locationSecurityMessage: freshLocationSecurity.message,
        etage: contextData.etage || null,
        huisnummer: contextData.huisnummer || null,
        ruimtenummer: contextData.ruimtenummer.trim() || null,
        binnenbuiten: contextData.binnenbuiten,
        locatieDetail: contextData.locatieDetail.trim() || null,
        context_extra: Object.keys(contextData.extra).length > 0 ? contextData.extra : null,
        floorPlanId: null,
        pinX: null,
        pinY: null,
        syncStatus: 'PENDING',
      };

      // Op web: foto persisteren in IndexedDB zodat ze ook na page-refresh bewaard blijven
      let evidenceToSave = newEvidence;
      if (isWeb) {
        const captureUri = (newEvidence as { mediaUri?: string }).mediaUri ?? '';
        const persistedUri = await persistOfflinePhoto(captureUri, newEvidence.id).catch(() => null);
        if (persistedUri) evidenceToSave = { ...newEvidence, mediaUri: persistedUri };
      }

      await saveEvidenceLocally(evidenceToSave);

      // Auto-sync op achtergrond — gebruiker hoeft niets te doen
      void registerBgSync();
      void syncEvidenceQueue();

      if (!options?.preserveFieldNote) {
        setFieldNote('');
      }

      // Voice-feedback: kort hands-free bevestiging voor de vakman.
      // No-op als voice uit staat (zie #60).
      if (aiResult.status === 'PASSED') {
        void playVoice('Foto goedgekeurd.');
      } else if (aiResult.status === 'PENDING') {
        void playVoice('Foto opgeslagen, gaat naar handmatige review.');
      } else {
        void playVoice('Foto opgeslagen.');
      }

      return {
        timestamp,
        aiStatus: aiResult.status,
        aiNotes: aiResult.notes,
      };
    } catch (error) {
      console.error('Fout bij vastleggen van Wkb-bewijs:', error);
      Alert.alert('Fout', 'Kon geen Wkb-conforme foto vastleggen.');
      return null;
    } finally {
      setIsCapturing(false);
    }
  };

  const captureEvidenceForTask = async (
    task: CaptureTask,
    options?: {
      fieldNoteOverride?: string | null;
      preserveFieldNote?: boolean;
    }
  ) => {
    if (isWeb) {
      return saveDesktopEvidenceForTask(task, options);
    }

    return captureCameraEvidenceForTask(task, options);
  };

  const saveDesktopEvidence = async () => {
    if (!activeTask) {
      return;
    }

    if (!captureComplianceReady) {
      Alert.alert('Wkb bevestiging ontbreekt', captureBlockingMessage);
      return;
    }

    // ⏱️ Backstop: 15s harde deadline. Als de hele save-flow nog steeds hangt
    // (ondanks de upload + hash timeouts), reset isCapturing en toon foutmelding.
    const result = await Promise.race([
      saveDesktopEvidenceForTask(activeTask),
      new Promise<null>((resolve) =>
        setTimeout(() => {
          setIsCapturing(false);
          resolve(null);
        }, 15000)
      ),
    ]);

    if (!result) {
      Alert.alert(
        'Opslaan duurde te lang',
        'Probeer het opnieuw. Je foto is mogelijk lokaal bewaard en wordt later gesynchroniseerd.'
      );
      return;
    }

    // Toon post-save scherm met vervolg-opties i.p.v. losse Alert.
    setPostSaveResult({
      aiStatus: result.aiStatus,
      aiNotes: result.aiNotes,
      uploadOk: Boolean(result.uploadOk),
    });

    if (!(result as { uploadOk?: boolean }).uploadOk) {
      // Niet blokkeren — bewijs staat lokaal opgeslagen en sync loopt op achtergrond
      console.info('Bewijs lokaal opgeslagen — wordt gesynchroniseerd zodra verbinding beschikbaar is.');
    }

    // Toon de success card met deel-opties
    const lat = parseFloat(desktopLatitude);
    const lon = parseFloat(desktopLongitude);
    setLastCapture({
      projectId: projectId.trim() || 'onbekend',
      taskTitle: activeTask.title,
      inspectionPointId: activeTask.inspectionPointId,
      timestamp: result.timestamp,
      latitude: Number.isFinite(lat) ? lat : 0,
      longitude: Number.isFinite(lon) ? lon : 0,
      weatherLabel: weatherSnapshot?.label ?? null,
    });
  };

  const handleGenericTimerStart = () => {
    setTimerStartedAt(new Date().toISOString());
    setTimerCompleted(false);
    setTimerPhase('RUNNING');
  };

  const handleGenericTimerReset = () => {
    setTimerStartedAt(null);
    setTimerCompleted(false);
    setTimerPhase('IDLE');
  };

  const handleStructuredPressureTestTimerFinish = () => {
    if (!usesStructuredPressureTestOverlay) {
      return;
    }

    setTimerPhase('AWAITING_END_CAPTURE');
  };

  const handleStructuredPressureTestTimerReset = () => {
    setTimerStartedAt(null);
    setTimerCompleted(false);
    setTimerPhase('IDLE');
    setTimerStartCapturedAt(null);
    setTimerEndCapturedAt(null);
    setTimerInstanceKey((current) => current + 1);
  };

  const handleStructuredPressureTestStartCapture = async () => {
    if (!activeTask || !timerStartTask) {
      Alert.alert(
        'Timerconfiguratie ontbreekt',
        'Kon het startpunt voor de beproeving niet vinden.'
      );
      return;
    }

    if (usesNen1078TimerOverlay && timerFixedDurationMinutes <= 0) {
      Alert.alert(
        'Beproevingstijd ontbreekt',
        'Stel eerst de exacte beproevingstijd uit NEN 1078 Tabel A.1 in voordat je de beginfoto maakt.'
      );
      return;
    }

    const startNote = buildTimerEvidenceNote(
      fieldNote,
      `${timerEvidencePrefix} beginfoto (${timerDurationLabel ?? 'timer'})`,
      timerStartTask.title
    );
    const result = await captureEvidenceForTask(timerStartTask, {
      fieldNoteOverride: startNote,
      preserveFieldNote: true,
    });

    if (!result) {
      return;
    }

    setTimerStartedAt(result.timestamp);
    setTimerCompleted(false);
    setTimerPhase('RUNNING');
    setTimerStartCapturedAt(result.timestamp);
    setTimerEndCapturedAt(null);
    setTimerInstanceKey((current) => current + 1);

    Alert.alert(
      'Beginfoto vastgelegd',
      `De ${timerProcedureLabel} is gestart. Houd de druk nu exact ${timerDurationLabel ?? 'de vereiste tijd'} vast voordat je de eindfoto maakt.`
    );
  };

  const handleStructuredPressureTestEndCapture = async () => {
    if (!activeTask) {
      return;
    }

    if (!timerAwaitingEndCapture) {
      Alert.alert(
        'Timer loopt nog',
        'De eindfoto komt pas beschikbaar nadat de volledige normtijd is verstreken.'
      );
      return;
    }

    const endNote = buildTimerEvidenceNote(
      fieldNote,
      `${timerEvidencePrefix} eindfoto (${timerDurationLabel ?? 'timer'})`,
      activeTask.title
    );
    const result = await captureEvidenceForTask(activeTask, {
      fieldNoteOverride: endNote,
    });

    if (!result) {
      return;
    }

    setTimerCompleted(true);
    setTimerPhase('COMPLETE');
    setTimerEndCapturedAt(result.timestamp);

    Alert.alert(
      `${timerProcedureLabel.charAt(0).toUpperCase()}${timerProcedureLabel.slice(1)} afgerond`,
      'De eindfoto is vastgelegd. Deze timer-sessie voldoet nu aan de vereiste beginfoto, wachttijd en eindfoto.'
    );
  };

  const takePicture = async () => {
    if (!activeTask || !cameraRef.current || !captureEnabled) {
      if (!captureComplianceReady) {
        Alert.alert('Wkb bevestiging ontbreekt', captureBlockingMessage);
      }
      return;
    }

    const result = await captureCameraEvidenceForTask(activeTask);

    if (!result) {
      return;
    }

    Alert.alert(
      'Wkb-bewijs opgeslagen',
      'Foto, GPS, timestamp en hash zijn lokaal veilig vastgelegd.'
    );
  };

  if (isWeb) {
    // Na een succesvolle opslag → toon de deelkaart
    if (lastCapture) {
      return (
        <View style={[styles.webContainer, { justifyContent: 'center' }]}>
          <CaptureSuccessCard
            payload={lastCapture}
            onNewCapture={() => {
              setLastCapture(null);
              setDesktopPhoto(null);
            }}
            onBackToProject={onBackToProject ? () => {
              setLastCapture(null);
              setDesktopPhoto(null);
              onBackToProject();
            } : undefined}
            onBackToMain={() => {
              setLastCapture(null);
              (onBackToMain ?? onBackToTasks)?.();
            }}
          />
        </View>
      );
    }

    // ── Mobiele wizard: Stap 1 — Foto nemen ────────────────────────────────────
    if (isMobileWebDevice && mobileWizardStep === 'photo') {
      const photoUri = desktopPhoto?.uri ?? mobileWebPhotoUri;
      return (
        <View style={styles.mobileWizardScreen}>
          {/* Hidden camera input */}
          <input
            ref={mobileWebInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' } as React.CSSProperties}
            onChange={handleMobileWebPhotoSelected}
          />

          {/* Back — foto-state eerst opruimen vóór teruggaan */}
          {onBackToTasks ? (
            <TouchableOpacity
              style={styles.mobileWizardBack}
              onPress={() => {
                try {
                  // Revoke blob URL om geheugenlekken + expo-fs fouten te voorkomen
                  if (mobileWebPhotoUri) {
                    URL.revokeObjectURL(mobileWebPhotoUri);
                  }
                  setMobileWebPhotoUri(null);
                  setDesktopPhoto(null);
                } catch {
                  // Stil falen — navigeer altijd terug
                }
                onBackToTasks();
              }}
              activeOpacity={0.75}
            >
              <Text style={[styles.mobileWizardBackText, { color: theme.colors.accent }]}>← Andere taak</Text>
            </TouchableOpacity>
          ) : null}

          {/* Task info */}
          {activeTask ? (
            <View style={[styles.mobileTaskHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.mobileTaskId, { color: theme.colors.accent }]}>
                {activeTask.inspectionPointId}
              </Text>
              <Text style={[styles.mobileTaskTitle, { color: theme.colors.textPrimary }]}>
                {activeTask.title}
              </Text>
            </View>
          ) : null}

          {/* 📄 Bon-scanner shortcut — altijd zichtbaar tijdens foto-stap */}
          <TouchableOpacity
            style={[
              styles.mobileBonBtn,
              { backgroundColor: '#f97316', borderColor: '#ea580c' },
            ]}
            onPress={() => {
              console.log('[BonScanner] knop tap');
              setShowBonScanner(true);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.mobileBonBtnText, { color: '#fff' }]}>
              📄 Bon / leveringsbrief scannen
            </Text>
          </TouchableOpacity>

          {/* Timer overlays */}
          {usesNen1006TimerOverlay ? (
            <View style={styles.embeddedTimerOverlay}>
              <Nen1006TimerOverlay
                profileId={timerProfileId}
                extraVolumeBlocks={timerExtraVolumeBlocks}
                timerInstanceKey={timerInstanceKey}
                isRunning={Boolean(timerIsRunning)}
                isCapturing={isCapturing}
                hasStarted={Boolean(timerStartCapturedAt)}
                isAwaitingEndCapture={Boolean(timerAwaitingEndCapture)}
                isComplete={timerCompleted}
                startCapturedAt={timerStartCapturedAt}
                endCapturedAt={timerEndCapturedAt}
                onProfileChange={setTimerProfileId}
                onExtraVolumeBlocksChange={setTimerExtraVolumeBlocks}
                onStartCapture={handleStructuredPressureTestStartCapture}
                onEndCapture={handleStructuredPressureTestEndCapture}
                onReset={handleStructuredPressureTestTimerReset}
                onTimerFinish={handleStructuredPressureTestTimerFinish}
              />
            </View>
          ) : usesNen1078TimerOverlay && nen1078TimerConfig ? (
            <View style={styles.embeddedTimerOverlay}>
              <Nen1078TimerOverlay
                durationMinutes={timerFixedDurationMinutes}
                minDurationMinutes={nen1078TimerConfig.minDurationMinutes}
                maxDurationMinutes={nen1078TimerConfig.maxDurationMinutes}
                stepMinutes={nen1078TimerConfig.stepMinutes}
                timerInstanceKey={timerInstanceKey}
                isRunning={Boolean(timerIsRunning)}
                isCapturing={isCapturing}
                hasStarted={Boolean(timerStartCapturedAt)}
                isAwaitingEndCapture={Boolean(timerAwaitingEndCapture)}
                isComplete={timerCompleted}
                startCapturedAt={timerStartCapturedAt}
                endCapturedAt={timerEndCapturedAt}
                onDurationChange={setTimerFixedDurationMinutes}
                onStartCapture={handleStructuredPressureTestStartCapture}
                onEndCapture={handleStructuredPressureTestEndCapture}
                onReset={handleStructuredPressureTestTimerReset}
                onTimerFinish={handleStructuredPressureTestTimerFinish}
              />
            </View>
          ) : null}

          {/* Big photo area */}
          <TouchableOpacity
            style={styles.mobileBigPhotoArea}
            onPress={handlePickDesktopPhoto}
            activeOpacity={0.8}
          >
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.mobileBigPhotoPreview} />
            ) : (
              <View style={styles.mobileBigPhotoEmpty}>
                <Text style={styles.mobileBigPhotoIcon}>📷</Text>
                <Text style={[styles.mobileBigPhotoTitle, { color: theme.colors.textPrimary }]}>
                  Tik om camera te openen
                </Text>
                <Text style={[styles.mobileBigPhotoHint, { color: theme.colors.textSecondary }]}>
                  Camera opent direct
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Retake button */}
          {photoUri ? (
            <TouchableOpacity style={[styles.mobileRetakeBtn, { borderColor: theme.colors.border }]} onPress={handlePickDesktopPhoto} activeOpacity={0.75}>
              <Text style={[styles.mobileRetakeBtnText, { color: theme.colors.textSecondary }]}>📷 Nieuwe foto nemen</Text>
            </TouchableOpacity>
          ) : null}

          {/* Next button */}
          <TouchableOpacity
            style={[
              styles.mobileNextBtn,
              { backgroundColor: theme.colors.accent },
              !photoUri && styles.mobileNextBtnDisabled,
            ]}
            onPress={() => setMobileWizardStep('confirm')}
            disabled={!photoUri}
            activeOpacity={0.85}
          >
            <Text style={styles.mobileNextBtnText}>
              {photoUri ? 'Volgende →' : 'Eerst een foto nemen'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    // ── Mobiele wizard: Stap 2 — Bevestigen & opslaan ──────────────────────────
    if (isMobileWebDevice && mobileWizardStep === 'confirm') {
      const photoUri = desktopPhoto?.uri ?? mobileWebPhotoUri;
      const lat = Number(desktopLatitude);
      const lng = Number(desktopLongitude);
      const acc = Number(desktopAccuracy);
      const hasGps = Number.isFinite(lat) && Number.isFinite(lng);

      return (
        <View style={styles.mobileWizardScreen}>
          {/* Back to photo step */}
          <TouchableOpacity style={styles.mobileWizardBack} onPress={() => setMobileWizardStep('photo')} activeOpacity={0.75}>
            <Text style={[styles.mobileWizardBackText, { color: theme.colors.accent }]}>← Foto opnieuw</Text>
          </TouchableOpacity>

          {/* AI-suggestie — vakman tikt 'klopt' = direct opslaan, geen velden invullen */}
          <AiSuggestionCard
            photoUri={photoUri}
            onAccept={(prediction) => {
              // Vul AI-categorie als field-note vooraf en sla direct op
              const aiNote = `AI: ${prediction.category} (${Math.round(
                prediction.confidence * 100
              )}%)${prediction.rawLabel ? ` — ${prediction.rawLabel}` : ''}`;
              if (!fieldNote.trim()) {
                setFieldNote(aiNote);
              }
              // Trigger de bestaande save-flow (gaat door alle checks heen)
              handleMobileSavePress();
            }}
            onReject={() => {
              // Niets doen — bestaande UI met velden blijft staan
            }}
          />

          {/* Photo thumbnail */}
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={[styles.mobileThumb, { borderColor: theme.colors.border }]} />
          ) : null}

          {/* GPS card */}
          <View style={[
            styles.mobileGpsCard,
            { backgroundColor: hasGps ? (theme.name === 'dark' ? 'rgba(5,150,105,0.15)' : 'rgba(5,150,105,0.08)') : theme.colors.surface,
              borderColor: hasGps ? '#059669' : theme.colors.border }
          ]}>
            <Text style={[styles.mobileGpsTitle, { color: hasGps ? '#059669' : theme.colors.textSecondary }]}>
              {hasGps ? '📍 GPS bevestigd' : '⚠️ GPS laden…'}
            </Text>
            {hasGps && mobileAddress ? (
              <Text style={[styles.mobileGpsAddress, { color: '#059669' }]}>
                {mobileAddress}
              </Text>
            ) : null}
            {contextData.etage ? (
              <Text style={[styles.mobileGpsAltitude, { color: '#059669' }]}>
                🏗️ Verdieping: {contextData.etage}
              </Text>
            ) : null}
            {hasGps ? (
              <Text style={[styles.mobileGpsCoords, { color: theme.colors.textSecondary }]}>
                {lat.toFixed(5)}, {lng.toFixed(5)} · ±{Math.round(acc)}m
              </Text>
            ) : null}
            {hasGps && desktopAltitude != null ? (
              <Text style={[styles.mobileGpsCoords, { color: theme.colors.textSecondary }]}>
                ⛰ Hoogte: {desktopAltitude}m boven NAP (± WGS84-offset ~45m in NL)
              </Text>
            ) : null}
          </View>

          {/* Exacte locatie */}
          <View style={[styles.mobileLocatieCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.mobileLocatieTitle, { color: theme.colors.textSecondary }]}>
              📍 Exacte locatie
            </Text>

            {/* Verdieping — alleen tonen als StartFlow het NIET heeft gevuld.
                Geen dubbele invoer: vakman koos al verdieping in StartFlow. */}
            {!contextData.etage ? (
              <View style={styles.mobileField}>
                <Text style={styles.mobileLabel}>Verdieping</Text>
                <TextInput
                  style={[
                    styles.mobileNoteInput,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      color: theme.colors.textPrimary,
                    },
                  ]}
                  placeholder="bv. -4, BG, 1, 7"
                  placeholderTextColor={theme.colors.textSecondary + '88'}
                  value={contextData.etage}
                  onChangeText={(v) => setContextData((prev) => ({ ...prev, etage: v }))}
                  keyboardType="default"
                  autoCapitalize="none"
                  maxLength={20}
                />
              </View>
            ) : (
              <View style={styles.mobileField}>
                <Text style={styles.mobileLabel}>Verdieping</Text>
                <Text style={[styles.mobileLabel, { fontWeight: '400', color: theme.colors.textSecondary }]}>
                  ✓ {contextData.etage} (uit StartFlow — wijzig via ‹ Foto opnieuw)
                </Text>
              </View>
            )}
            {/* Huisnummer — GPS vult straat, vakman vult nummer */}
            <View style={styles.mobileField}>
              <Text style={styles.mobileLabel}>Huisnummer</Text>
              <TextInput
                style={[
                  styles.mobileNoteInput,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    color: theme.colors.textPrimary,
                  },
                ]}
                placeholder="bv. 12A"
                placeholderTextColor={theme.colors.textSecondary + '88'}
                value={contextData.huisnummer}
                onChangeText={(v) => setContextData((prev) => ({ ...prev, huisnummer: v }))}
                keyboardType="default"
                autoCapitalize="characters"
                maxLength={10}
              />
              {mobileAddress ? (
                <Text style={styles.mobileHelperText}>GPS: {mobileAddress}</Text>
              ) : null}
            </View>

            <View style={styles.mobileLocatieChips}>
              {getLocatieOpties(activeTask?.disciplineTitle, contextData.binnenbuiten).map((opt) => {
                const active = contextData.locatieDetail === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.mobileLocatieChip,
                      {
                        backgroundColor: active ? theme.colors.accent : (theme.name === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                        borderColor: active ? theme.colors.accent : theme.colors.border,
                      },
                    ]}
                    onPress={() =>
                      setContextData((prev) => ({ ...prev, locatieDetail: active ? '' : opt }))
                    }
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.mobileLocatieChipText, { color: active ? '#fff' : theme.colors.textPrimary }]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              style={[styles.mobileLocatieInput, { backgroundColor: theme.name === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderColor: contextData.locatieDetail ? theme.colors.accent : theme.colors.border, color: theme.colors.textPrimary }]}
              value={contextData.locatieDetail}
              onChangeText={(v) => setContextData((prev) => ({ ...prev, locatieDetail: v }))}
              placeholder="Of typ zelf, bijv. Gevel West 3e"
              placeholderTextColor={theme.colors.textSecondary + '88'}
              autoCapitalize="words"
            />
          </View>

          {/* Task confirmation */}
          {activeTask ? (
            <View style={[styles.mobileConfirmTask, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.mobileConfirmTaskId, { color: theme.colors.accent }]}>
                {activeTask.inspectionPointId}
              </Text>
              <Text style={[styles.mobileConfirmTaskTitle, { color: theme.colors.textPrimary }]}>
                {activeTask.title}
              </Text>
            </View>
          ) : null}

          {/* WKB confirmations */}
          {activeTask?.stopMoment || activeTask?.requiresMeasurementTool ? (
            <View style={styles.webChecklistRow}>
              {activeTask.stopMoment ? (
                <TouchableOpacity
                  style={[styles.webCheckItem, stopMomentConfirmed && styles.webCheckItemDone]}
                  onPress={() => setStopMomentConfirmed((c) => !c)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.webCheckDot}>{stopMomentConfirmed ? '✓' : '○'}</Text>
                  <Text style={styles.webCheckText}>{activeTask.stopMoment}</Text>
                </TouchableOpacity>
              ) : null}
              {activeTask.requiresMeasurementTool ? (
                <TouchableOpacity
                  style={[styles.webCheckItem, measurementToolConfirmed && styles.webCheckItemDone]}
                  onPress={() => setMeasurementToolConfirmed((c) => !c)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.webCheckDot}>{measurementToolConfirmed ? '✓' : '○'}</Text>
                  <Text style={styles.webCheckText}>Meetmiddel in beeld</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {/* Weerkaart */}
          {weatherSnapshot ? (
            <View style={[styles.mobileWeatherCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.mobileWeatherTitle, { color: theme.colors.textSecondary }]}>🌤️ Weer op dit moment</Text>
              <View style={styles.mobileWeatherGrid}>
                <View style={styles.mobileWeatherCell}>
                  <Text style={[styles.mobileWeatherVal, { color: theme.colors.textPrimary }]}>{weatherSnapshot.tempC}°C</Text>
                  <Text style={[styles.mobileWeatherKey, { color: theme.colors.textSecondary }]}>Temperatuur</Text>
                </View>
                <View style={styles.mobileWeatherCell}>
                  <Text style={[styles.mobileWeatherVal, { color: theme.colors.textPrimary }]}>{weatherSnapshot.apparentTempC}°C</Text>
                  <Text style={[styles.mobileWeatherKey, { color: theme.colors.textSecondary }]}>Gevoelstemperatuur</Text>
                </View>
                <View style={styles.mobileWeatherCell}>
                  <Text style={[styles.mobileWeatherVal, { color: theme.colors.textPrimary }]}>{weatherSnapshot.windSpeedKmh} km/h</Text>
                  <Text style={[styles.mobileWeatherKey, { color: theme.colors.textSecondary }]}>Windsnelheid</Text>
                </View>
                <View style={styles.mobileWeatherCell}>
                  <Text style={[styles.mobileWeatherVal, { color: theme.colors.textPrimary }]}>{weatherSnapshot.windDirectionLabel} ({weatherSnapshot.windDirectionDeg}°)</Text>
                  <Text style={[styles.mobileWeatherKey, { color: theme.colors.textSecondary }]}>Windrichting</Text>
                </View>
                <View style={styles.mobileWeatherCell}>
                  <Text style={[styles.mobileWeatherVal, { color: theme.colors.textPrimary }]}>{weatherSnapshot.humidityPct}%</Text>
                  <Text style={[styles.mobileWeatherKey, { color: theme.colors.textSecondary }]}>Luchtvochtigheid</Text>
                </View>
                <View style={styles.mobileWeatherCell}>
                  <Text style={[styles.mobileWeatherVal, { color: theme.colors.textPrimary }]}>{weatherSnapshot.precipitationMm} mm</Text>
                  <Text style={[styles.mobileWeatherKey, { color: theme.colors.textSecondary }]}>Neerslag</Text>
                </View>
                {weatherSnapshot.rainMm > 0 ? (
                  <View style={styles.mobileWeatherCell}>
                    <Text style={[styles.mobileWeatherVal, { color: '#3B82F6' }]}>{weatherSnapshot.rainMm} mm</Text>
                    <Text style={[styles.mobileWeatherKey, { color: theme.colors.textSecondary }]}>Regen</Text>
                  </View>
                ) : null}
                {weatherSnapshot.snowMm > 0 ? (
                  <View style={styles.mobileWeatherCell}>
                    <Text style={[styles.mobileWeatherVal, { color: '#93C5FD' }]}>{weatherSnapshot.snowMm} mm</Text>
                    <Text style={[styles.mobileWeatherKey, { color: theme.colors.textSecondary }]}>Sneeuw</Text>
                  </View>
                ) : null}
                <View style={[styles.mobileWeatherCell, styles.mobileWeatherCellWide]}>
                  <Text style={[styles.mobileWeatherVal, { color: theme.colors.textPrimary }]}>{weatherSnapshot.description}</Text>
                  <Text style={[styles.mobileWeatherKey, { color: theme.colors.textSecondary }]}>Omschrijving</Text>
                </View>
              </View>
            </View>
          ) : hasGps ? (
            <View style={[styles.mobileWeatherCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.mobileWeatherTitle, { color: theme.colors.textSecondary }]}>🌤️ Weer ophalen…</Text>
            </View>
          ) : null}

          {/* Notitie — duidelijk gelabeld zodat de vakman weet dat dit kan */}
          <View style={[styles.mobileLocatieCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, marginBottom: 12 }]}>
            <Text style={[styles.mobileLocatieTitle, { color: theme.colors.textSecondary }]}>
              📝 Notitie (optioneel) — typen of inspreken
            </Text>
            <View style={styles.mobileNoteRow}>
              <TextInput
                style={[
                  styles.mobileNoteInputFlex,
                  {
                    backgroundColor: theme.name === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                    borderColor: theme.colors.border,
                    color: theme.colors.textPrimary,
                    minHeight: 64,
                  },
                ]}
                value={fieldNote}
                onChangeText={setFieldNote}
                placeholder="Bijv. 'doorvoering achter wand, kit nog niet gedroogd'"
                placeholderTextColor={theme.colors.textSecondary + '88'}
                maxLength={180}
                multiline
              />
              <VoiceNoteButton onResult={(text) => setFieldNote(text)} />
            </View>
          </View>

          {/* Save button — altijd tikbaar; bij ontbrekende stap toont een Alert wat nog moet. */}
          <TouchableOpacity
            style={[
              styles.mobileSaveBtn,
              { backgroundColor: theme.colors.accent },
              (isCapturing || !captureComplianceReady) && styles.mobileSaveBtnDisabled,
            ]}
            onPress={handleMobileSavePress}
            disabled={isCapturing}
            activeOpacity={0.85}
          >
            <Text style={styles.mobileSaveBtnText}>
              {isCapturing ? '⏳ Opslaan…' : '✅ Opslaan als bewijs'}
            </Text>
          </TouchableOpacity>
          {!captureComplianceReady && !isCapturing ? (
            <Text style={[styles.mobileSaveHint, { color: theme.colors.textSecondary }]}>
              ⚠️ Tik eerst de gevraagde bevestigingen aan (bolletjes hierboven)
            </Text>
          ) : null}
        </View>
      );
    }

    return (
      <View style={styles.webContainer}>

        {/* Back button */}
        {onBackToTasks ? (
          <TouchableOpacity
            style={styles.webBackButton}
            onPress={() => {
              try {
                if (mobileWebPhotoUri) URL.revokeObjectURL(mobileWebPhotoUri);
                setMobileWebPhotoUri(null);
                setDesktopPhoto(null);
              } catch { /* stil falen */ }
              onBackToTasks();
            }}
            activeOpacity={0.75}
          >
            <Text style={styles.webBackButtonText}>‹ Andere taak</Text>
          </TouchableOpacity>
        ) : null}

        {/* Task card */}
        {activeTask ? (
          <View style={styles.webTaskCard}>
            <View style={styles.webTaskCardLeft}>
              <Text style={styles.webTaskEyebrow}>{activeTask.inspectionPointId}</Text>
              <Text style={styles.webTaskTitle}>{activeTask.title}</Text>
              <View style={styles.webTaskBadgeRow}>
                {activeTask.stopMoment ? (
                  <View style={styles.webTaskBadge}>
                    <Text style={styles.webTaskBadgeText}>{activeTask.stopMoment}</Text>
                  </View>
                ) : null}
                {activeTask.requiresMeasurementTool ? (
                  <View style={styles.webTaskBadge}>
                    <Text style={styles.webTaskBadgeText}>MEETMIDDEL</Text>
                  </View>
                ) : null}
                {activeTask.aiValidationKey ? (
                  <View style={[styles.webTaskBadge, styles.webTaskBadgeAi]}>
                    <Text style={[styles.webTaskBadgeText, styles.webTaskBadgeTextAi]}>AI</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        {/* Timer overlay (if needed) */}
        {usesNen1006TimerOverlay ? (
          <View style={styles.embeddedTimerOverlay}>
            <Nen1006TimerOverlay
              profileId={timerProfileId}
              extraVolumeBlocks={timerExtraVolumeBlocks}
              timerInstanceKey={timerInstanceKey}
              isRunning={Boolean(timerIsRunning)}
              isCapturing={isCapturing}
              hasStarted={Boolean(timerStartCapturedAt)}
              isAwaitingEndCapture={Boolean(timerAwaitingEndCapture)}
              isComplete={timerCompleted}
              startCapturedAt={timerStartCapturedAt}
              endCapturedAt={timerEndCapturedAt}
              onProfileChange={setTimerProfileId}
              onExtraVolumeBlocksChange={setTimerExtraVolumeBlocks}
              onStartCapture={handleStructuredPressureTestStartCapture}
              onEndCapture={handleStructuredPressureTestEndCapture}
              onReset={handleStructuredPressureTestTimerReset}
              onTimerFinish={handleStructuredPressureTestTimerFinish}
            />
          </View>
        ) : usesNen1078TimerOverlay && nen1078TimerConfig ? (
          <View style={styles.embeddedTimerOverlay}>
            <Nen1078TimerOverlay
              durationMinutes={timerFixedDurationMinutes}
              minDurationMinutes={nen1078TimerConfig.minDurationMinutes}
              maxDurationMinutes={nen1078TimerConfig.maxDurationMinutes}
              stepMinutes={nen1078TimerConfig.stepMinutes}
              timerInstanceKey={timerInstanceKey}
              isRunning={Boolean(timerIsRunning)}
              isCapturing={isCapturing}
              hasStarted={Boolean(timerStartCapturedAt)}
              isAwaitingEndCapture={Boolean(timerAwaitingEndCapture)}
              isComplete={timerCompleted}
              startCapturedAt={timerStartCapturedAt}
              endCapturedAt={timerEndCapturedAt}
              onDurationChange={setTimerFixedDurationMinutes}
              onStartCapture={handleStructuredPressureTestStartCapture}
              onEndCapture={handleStructuredPressureTestEndCapture}
              onReset={handleStructuredPressureTestTimerReset}
              onTimerFinish={handleStructuredPressureTestTimerFinish}
            />
          </View>
        ) : null}

        {/* WKB bevestigingen (compact) */}
        {activeTask?.stopMoment || activeTask?.requiresMeasurementTool || activeTask?.requiresTimer ? (
          <View style={styles.webChecklistRow}>
            {activeTask.stopMoment ? (
              <TouchableOpacity
                style={[styles.webCheckItem, stopMomentConfirmed && styles.webCheckItemDone]}
                onPress={() => setStopMomentConfirmed((c) => !c)}
                activeOpacity={0.8}
              >
                <Text style={styles.webCheckDot}>{stopMomentConfirmed ? '✓' : '○'}</Text>
                <Text style={styles.webCheckText}>{activeTask.stopMoment}</Text>
              </TouchableOpacity>
            ) : null}
            {activeTask.requiresMeasurementTool ? (
              <TouchableOpacity
                style={[styles.webCheckItem, measurementToolConfirmed && styles.webCheckItemDone]}
                onPress={() => setMeasurementToolConfirmed((c) => !c)}
                activeOpacity={0.8}
              >
                <Text style={styles.webCheckDot}>{measurementToolConfirmed ? '✓' : '○'}</Text>
                <Text style={styles.webCheckText}>Meetmiddel in beeld</Text>
              </TouchableOpacity>
            ) : null}
            {activeTask.requiresTimer && !usesStructuredPressureTestOverlay ? (
              <TouchableOpacity
                style={[styles.webCheckItem, timerCompleted && styles.webCheckItemDone]}
                onPress={timerCompleted ? undefined : handleGenericTimerStart}
                activeOpacity={0.8}
              >
                <Text style={styles.webCheckDot}>{timerCompleted ? '✓' : '○'}</Text>
                <Text style={styles.webCheckText}>{timerStatusText ?? 'Timer'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* Photo area */}
        <TouchableOpacity
          style={styles.webPhotoArea}
          onPress={handlePickDesktopPhoto}
          activeOpacity={0.8}
        >
          {desktopPhoto || mobileWebPhotoUri ? (
            <Image
              source={{ uri: desktopPhoto?.uri ?? mobileWebPhotoUri! }}
              style={styles.webPhotoPreview}
            />
          ) : (
            <View style={styles.webPhotoEmpty}>
              <Text style={styles.webPhotoIcon}>📷</Text>
              <Text style={styles.webPhotoEmptyTitle}>
                {isMobileWebDevice ? 'Tik om camera te openen' : 'Tik om foto te kiezen'}
              </Text>
              <Text style={styles.webPhotoEmptyHint}>
                {isMobileWebDevice
                  ? 'Camera opent direct — GPS wordt automatisch meegestuurd'
                  : 'Kies een foto van je apparaat'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {desktopPhoto || mobileWebPhotoUri ? (
          <TouchableOpacity style={styles.webChangePhotoBtn} onPress={handlePickDesktopPhoto} activeOpacity={0.75}>
            <Text style={styles.webChangePhotoBtnText}>
              {isMobileWebDevice ? 'Nieuwe foto nemen' : 'Andere foto kiezen'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Weer banner */}
        {weatherSnapshot ? (
          <View style={styles.webWeatherBanner}>
            <Text style={styles.webWeatherText}>🌤️ {weatherSnapshot.label}</Text>
          </View>
        ) : null}

        {/* Locatie & discipline context */}
        <ContextForm
          value={contextData}
          onChange={setContextData}
          categoryId={activeCategoryId}
        />

        {/* Note input + spraak */}
        <View style={styles.webNoteRow}>
          <TextInput
            style={[styles.webNoteInput, { flex: 1 }]}
            value={fieldNote}
            onChangeText={setFieldNote}
            placeholder="Veldnotitie (optioneel) — of gebruik 🎤"
            placeholderTextColor={theme.colors.textSecondary + '88'}
            multiline
            maxLength={180}
            textAlignVertical="top"
          />
          <VoiceNoteButton onResult={(text) => setFieldNote(text)} />
        </View>

        {/* Primary capture button */}
        {!usesStructuredPressureTestOverlay ? (
          <TouchableOpacity
            style={[
              styles.webCaptureBtn,
              (!(desktopPhoto || mobileWebPhotoUri) || isCapturing || !captureComplianceReady) && styles.webCaptureBtnDisabled,
            ]}
            onPress={saveDesktopEvidence}
            disabled={!(desktopPhoto || mobileWebPhotoUri) || isCapturing || !captureComplianceReady}
            activeOpacity={0.85}
          >
            <Text style={styles.webCaptureBtnText}>
              {isCapturing ? 'Opslaan…' : 'Bewijs vastleggen'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Advanced toggle */}
        <TouchableOpacity
          style={styles.webAdvancedToggle}
          onPress={() => setShowAdvanced((v) => !v)}
          activeOpacity={0.75}
        >
          <Text style={styles.webAdvancedToggleText}>
            {showAdvanced ? '▾ Verberg instellingen' : '▸ Geavanceerde instellingen'}
          </Text>
        </TouchableOpacity>

        {showAdvanced ? (
          <View style={styles.webAdvancedPanel}>
            <Text style={styles.webAdvancedLabel}>PROJECT</Text>
            <TextInput
              style={styles.webAdvancedInput}
              value={projectId}
              onChangeText={setProjectId}
              placeholder="Project ID"
              placeholderTextColor="rgba(255,255,255,0.25)"
              autoCapitalize="characters"
            />
            <View style={styles.webAdvancedPresets}>
              {projectPresets.slice(0, 6).map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[styles.webAdvancedChip, projectId === preset && styles.webAdvancedChipActive]}
                  onPress={() => setProjectId(preset)}
                >
                  <Text style={[styles.webAdvancedChipText, projectId === preset && styles.webAdvancedChipTextActive]}>
                    {preset}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.webAdvancedLabel}>LOCATIE</Text>
            <View style={styles.webCoordinateRow}>
              <TextInput
                style={[styles.webAdvancedInput, styles.webCoordinateInput]}
                value={desktopLatitude}
                onChangeText={setDesktopLatitude}
                placeholder="Lat"
                placeholderTextColor="rgba(255,255,255,0.25)"
              />
              <TextInput
                style={[styles.webAdvancedInput, styles.webCoordinateInput]}
                value={desktopLongitude}
                onChangeText={setDesktopLongitude}
                placeholder="Lon"
                placeholderTextColor="rgba(255,255,255,0.25)"
              />
              <TextInput
                style={[styles.webAdvancedInput, styles.webAccuracyInput]}
                value={desktopAccuracy}
                onChangeText={setDesktopAccuracy}
                placeholder="±m"
                placeholderTextColor="rgba(255,255,255,0.25)"
              />
            </View>

            <View
              style={[
                styles.locationSecurityCard,
                locationSecurity.allowed ? styles.locationSecurityCardOk : styles.locationSecurityCardWarn,
              ]}
            >
              <Text style={styles.locationSecurityTitle}>Locatiecontrole</Text>
              <Text style={styles.locationSecurityText}>{locationSecurity.message}</Text>
            </View>
          </View>
        ) : null}

        {/* 📄 Bon Scanner modal — OCR voor leveringsbonnen, certificaten, facturen */}
        <BonScannerModal
          visible={showBonScanner}
          projectId={projectId.trim() || 'onbekend'}
          theme={theme}
          onClose={() => setShowBonScanner(false)}
        />

        {/* ✅ Post-save scherm — vervolgkeuze na succesvolle opslag */}
        <PostSaveSheet
          result={postSaveResult}
          theme={theme}
          taskTitle={activeTask?.title ?? null}
          onAnother={() => setPostSaveResult(null)}
          onBackToProject={onBackToProject ?? onBackToTasks ?? null}
          onDone={onBackToMain ?? onBackToTasks ?? null}
        />

      </View>
    );
  }

  if (!cameraPermission || locationPermission === null) {
    return (
      <View style={styles.centeredState}>
        <Text style={styles.stateTitle}>Steiger-camera laadt…</Text>
        <Text style={styles.infoText}>
          We controleren camera, GPS en de lokale Wkb-instellingen.
        </Text>
      </View>
    );
  }

  if (!cameraPermission.granted || !locationPermission) {
    const cameraMissing = !cameraPermission.granted;
    const gpsMissing = !locationPermission;
    return (
      <View style={styles.centeredState}>
        <Text style={styles.stateTitle}>
          {cameraMissing && gpsMissing
            ? 'Camera en GPS zijn verplicht'
            : cameraMissing
              ? 'Camera-toegang nodig'
              : '📍 Locatie-toegang nodig'}
        </Text>
        <Text style={styles.infoText}>
          Zonder camera, GPS en tijdstempel is de bewijslast niet Wkb-proof.
        </Text>

        {gpsMissing && webGeoHelpText ? (
          <View
            style={{
              backgroundColor: 'rgba(217, 119, 6, 0.10)',
              borderColor: '#d97706',
              borderWidth: 1,
              borderRadius: 12,
              padding: 14,
              marginVertical: 16,
              alignSelf: 'stretch',
              maxWidth: 460,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '800',
                color: '#9a3412',
                marginBottom: 6,
              }}
            >
              {webPlatformHint === 'safari-ios'
                ? 'Zo zet je het aan op Safari (iPhone/iPad):'
                : webPlatformHint === 'chrome-ios'
                  ? 'Zo zet je het aan op Chrome iOS:'
                  : webPlatformHint === 'android'
                    ? 'Zo zet je het aan op Android:'
                    : 'Zo geef je toegang:'}
            </Text>
            <Text style={{ fontSize: 14, color: '#7c2d12', lineHeight: 20 }}>
              {webGeoHelpText}
            </Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.permissionButton} onPress={handleGrantAccess}>
          <Text style={styles.permissionButtonText}>
            {gpsMissing ? 'Opnieuw vragen om toegang' : 'Geef toegang'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ExpoCameraView ref={cameraRef} style={styles.camera} facing="back">
        <SafeAreaView style={styles.overlay}>
          {activeTask?.requiresTimer && usesNen1006TimerOverlay ? (
            <View style={styles.timerOverlay}>
              <Nen1006TimerOverlay
                profileId={timerProfileId}
                extraVolumeBlocks={timerExtraVolumeBlocks}
                timerInstanceKey={timerInstanceKey}
                isRunning={Boolean(timerIsRunning)}
                isCapturing={isCapturing}
                hasStarted={Boolean(timerStartCapturedAt)}
                isAwaitingEndCapture={Boolean(timerAwaitingEndCapture)}
                isComplete={timerCompleted}
                startCapturedAt={timerStartCapturedAt}
                endCapturedAt={timerEndCapturedAt}
                onProfileChange={setTimerProfileId}
                onExtraVolumeBlocksChange={setTimerExtraVolumeBlocks}
                onStartCapture={handleStructuredPressureTestStartCapture}
                onEndCapture={handleStructuredPressureTestEndCapture}
                onReset={handleStructuredPressureTestTimerReset}
                onTimerFinish={handleStructuredPressureTestTimerFinish}
              />
            </View>
          ) : activeTask?.requiresTimer && usesNen1078TimerOverlay && nen1078TimerConfig ? (
            <View style={styles.timerOverlay}>
              <Nen1078TimerOverlay
                durationMinutes={timerFixedDurationMinutes}
                minDurationMinutes={nen1078TimerConfig.minDurationMinutes}
                maxDurationMinutes={nen1078TimerConfig.maxDurationMinutes}
                stepMinutes={nen1078TimerConfig.stepMinutes}
                timerInstanceKey={timerInstanceKey}
                isRunning={Boolean(timerIsRunning)}
                isCapturing={isCapturing}
                hasStarted={Boolean(timerStartCapturedAt)}
                isAwaitingEndCapture={Boolean(timerAwaitingEndCapture)}
                isComplete={timerCompleted}
                startCapturedAt={timerStartCapturedAt}
                endCapturedAt={timerEndCapturedAt}
                onDurationChange={setTimerFixedDurationMinutes}
                onStartCapture={handleStructuredPressureTestStartCapture}
                onEndCapture={handleStructuredPressureTestEndCapture}
                onReset={handleStructuredPressureTestTimerReset}
                onTimerFinish={handleStructuredPressureTestTimerFinish}
              />
            </View>
          ) : null}
          <View style={styles.topStack}>
            <View style={styles.briefingCard}>
              <Text style={styles.briefingEyebrow}>WKB CAPTURE MODE</Text>
              <Text style={styles.briefingTitle}>
                {activeTask ? activeTask.title : 'Fotografeer het controlepunt strak en volledig'}
              </Text>
              <Text style={styles.briefingText}>
                {activeTask
                  ? getTaskInstruction(activeTask)
                  : 'Richt de camera recht op de aansluiting of recht boven het detail. Zorg dat het bewijs zichtbaar is voordat het wordt ingestort of afgewerkt.'}
              </Text>
              {activeTask?.standards || activeTask?.disciplineTitle ? (
                <View style={styles.briefingMetaRow}>
                  {activeTask.disciplineTitle ? (
                    <View style={styles.briefingBadge}>
                      <Text style={styles.briefingBadgeText}>
                        {activeTask.disciplineTitle}
                      </Text>
                    </View>
                  ) : null}
                  {activeTask.standards ? (
                    <View style={styles.briefingBadge}>
                      <Text style={styles.briefingBadgeText}>
                        {activeTask.standards}
                      </Text>
                    </View>
                  ) : null}
                  {activeTask.requiresExif ? (
                    <View style={styles.briefingBadge}>
                      <Text style={styles.briefingBadgeText}>EXIF VERPLICHT</Text>
                    </View>
                  ) : null}
                  {activeTask.stopMoment ? (
                    <View style={styles.briefingBadge}>
                      <Text style={styles.briefingBadgeText}>
                        {activeTask.stopMoment}
                      </Text>
                    </View>
                  ) : null}
                  {activeTask.requiresMeasurementTool ? (
                    <View style={styles.briefingBadge}>
                      <Text style={styles.briefingBadgeText}>MEETMIDDEL IN BEELD</Text>
                    </View>
                  ) : null}
                  {activeTask.requiresTimer ? (
                    <View style={styles.briefingBadge}>
                      <Text style={styles.briefingBadgeText}>{timerBadgeLabel}</Text>
                    </View>
                  ) : null}
                  {activeTask.aiValidationKey ? (
                    <View style={styles.briefingBadge}>
                      <Text style={styles.briefingBadgeText}>
                        AI: {activeTask.aiValidationKey}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              {onBackToTasks ? (
                <TouchableOpacity style={styles.taskInlineButton} onPress={onBackToTasks}>
                  <Text style={styles.taskInlineButtonText}>Andere taak kiezen</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.stampCard}>
              <View style={styles.stampHeader}>
                <Text style={styles.stampTitle}>Live Wkb-stempel</Text>
                <View style={styles.exifBadge}>
                  <Text style={styles.exifBadgeText}>EXIF AAN</Text>
                </View>
              </View>
              <View style={styles.stampGrid}>
                <View style={styles.stampItem}>
                  <Text style={styles.stampLabel}>Tijd</Text>
                  <Text style={styles.stampValue}>{formatTimestamp(currentTime)}</Text>
                </View>
                <View style={styles.stampItem}>
                  <Text style={styles.stampLabel}>Inspectiepunt</Text>
                  <Text style={styles.stampValue}>{inspectionPointId || 'onbekend'}</Text>
                </View>
                <View style={styles.stampItem}>
                  <Text style={styles.stampLabel}>Latitude</Text>
                  <Text style={styles.stampValue}>
                    {formatCoordinate(liveLocation?.latitude ?? null)}
                  </Text>
                </View>
                <View style={styles.stampItem}>
                  <Text style={styles.stampLabel}>Longitude</Text>
                  <Text style={styles.stampValue}>
                    {formatCoordinate(liveLocation?.longitude ?? null)}
                  </Text>
                </View>
              </View>
              <Text style={styles.stampMeta}>
                GPS nauwkeurigheid: {formatAccuracy(liveLocation?.accuracy ?? null)}
              </Text>
              <View
                style={[
                  styles.locationSecurityCard,
                  locationSecurity.allowed
                    ? styles.locationSecurityCardOk
                    : styles.locationSecurityCardWarn,
                ]}
              >
                <Text style={styles.locationSecurityTitle}>Locatiecontrole</Text>
                <Text style={styles.locationSecurityText}>{locationSecurity.message}</Text>
              </View>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.formLabel}>Project</Text>
              <TextInput
                style={styles.input}
                value={projectId}
                onChangeText={setProjectId}
                placeholder="Project ID"
                placeholderTextColor="#8FA0B6"
                autoCapitalize="characters"
              />
              <View style={styles.presetRow}>
                {projectPresets.map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    style={[
                      styles.presetButton,
                      projectId === preset && styles.presetButtonActive,
                    ]}
                    onPress={() => setProjectId(preset)}
                  >
                    <Text
                      style={[
                        styles.presetButtonText,
                        projectId === preset && styles.presetButtonTextActive,
                      ]}
                    >
                      {preset}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Inspectiepunt</Text>
              <TextInput
                style={styles.input}
                value={inspectionPointId}
                onChangeText={setInspectionPointId}
                placeholder="Inspectiepunt ID"
                placeholderTextColor="#8FA0B6"
              />
              <View style={styles.presetRow}>
                {inspectionPresets.map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    style={[
                      styles.presetButton,
                      inspectionPointId === preset && styles.presetButtonActive,
                    ]}
                    onPress={() => setInspectionPointId(preset)}
                  >
                    <Text
                      style={[
                        styles.presetButtonText,
                        inspectionPointId === preset && styles.presetButtonTextActive,
                      ]}
                    >
                      {preset}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Veldnotitie</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={fieldNote}
                onChangeText={setFieldNote}
                placeholder="Bijv. overlap gecontroleerd, afstandhouders zichtbaar"
                placeholderTextColor="#8FA0B6"
                multiline
                maxLength={180}
                textAlignVertical="top"
              />
              <Text style={styles.notesHint}>
                Korte notitie voor het Wkb-dossier. Maximaal 180 tekens.
              </Text>

              {activeTask?.stopMoment ||
              activeTask?.requiresMeasurementTool ||
              activeTask?.requiresTimer ? (
                <View style={styles.captureChecklistCard}>
                  <Text style={styles.captureChecklistTitle}>Wkb bevestigingen</Text>
                  {activeTask.stopMoment ? (
                    <TouchableOpacity
                      style={[
                        styles.captureChecklistItem,
                        stopMomentConfirmed && styles.captureChecklistItemActive,
                      ]}
                      onPress={() => setStopMomentConfirmed((current) => !current)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.captureChecklistLabel}>
                        Stopmoment bevestigd: {activeTask.stopMoment}
                      </Text>
                      <Text style={styles.captureChecklistState}>
                        {stopMomentConfirmed ? 'Bevestigd' : 'Nog bevestigen'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  {activeTask.requiresMeasurementTool ? (
                    <TouchableOpacity
                      style={[
                        styles.captureChecklistItem,
                        measurementToolConfirmed && styles.captureChecklistItemActive,
                      ]}
                      onPress={() => setMeasurementToolConfirmed((current) => !current)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.captureChecklistLabel}>
                        Meetmiddel zichtbaar in beeld
                      </Text>
                      <Text style={styles.captureChecklistState}>
                        {measurementToolConfirmed ? 'Bevestigd' : 'Nog bevestigen'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  {activeTask.requiresTimer ? (
                    <>
                      <View
                        style={[
                          styles.captureChecklistItem,
                          timerCompleted &&
                            timerStartedAt &&
                            styles.captureChecklistItemActive,
                        ]}
                      >
                        <Text style={styles.captureChecklistLabel}>
                          {usesStructuredPressureTestOverlay
                            ? `Beproevingstimer: ${timerDurationLabel ?? 'normtijd'}`
                            : 'Persproef timer: 15 minuten drukbehoud'}
                        </Text>
                        <Text style={styles.captureChecklistState}>
                          {timerStatusText}
                        </Text>
                      </View>
                      {!usesStructuredPressureTestOverlay ? (
                        <View style={styles.captureChecklistActions}>
                          <TouchableOpacity
                            style={styles.captureChecklistButton}
                            onPress={handleGenericTimerStart}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.captureChecklistButtonText}>
                              {timerStartedAt
                                ? 'Timer opnieuw starten'
                                : '15 min timer starten'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.bottomStack}>
            <View style={styles.levelCard}>
              <View style={styles.levelHeader}>
                <Text style={styles.levelTitle}>Waterpas-indicator</Text>
                <View
                  style={[
                    styles.levelStatusPill,
                    levelState.isAligned ? styles.levelStatusOk : styles.levelStatusWarn,
                  ]}
                >
                  <Text style={styles.levelStatusText}>{levelState.label}</Text>
                </View>
              </View>
              <View style={styles.levelTrack}>
                <View style={styles.levelCenterLine} />
                <View
                  style={[
                    styles.levelBubble,
                    levelState.isAligned && styles.levelBubbleAligned,
                    { transform: [{ translateX: levelState.bubbleOffset }] },
                  ]}
                />
              </View>
              <Text style={styles.levelHint}>
                Groen = recht voor wanddetails of vlak voor vloeren / wapening.
              </Text>
            </View>

            <View style={styles.capturePanel}>
              <Text style={styles.captureHint}>
                {usesStructuredPressureTestOverlay
                  ? timerCompleted
                    ? 'Beginfoto en eindfoto zijn via de Timer Overlay vastgelegd. Gebruik deze knop alleen voor extra bewijsfoto’s.'
                    : 'Gebruik de Timer Overlay voor de verplichte beginfoto en eindfoto van de beproeving.'
                  : liveLocation
                    ? locationSecurity.allowed
                      ? 'Wkb-proof metadata actief. Vastleggen zodra het detail volledig in beeld staat.'
                      : locationSecurity.message
                    : 'Zoekt GPS-signaal voor juridische vastlegging…'}
              </Text>
              <TouchableOpacity
                style={[
                  styles.captureButton,
                  !captureEnabled && styles.captureButtonDisabled,
                ]}
                onPress={takePicture}
                disabled={!captureEnabled}
              >
                <View style={styles.captureButtonOuter}>
                  <View
                    style={[
                      styles.captureButtonInner,
                      isCapturing && styles.captureButtonInnerBusy,
                    ]}
                  />
                </View>
                <Text style={styles.captureButtonText}>
                  {isCapturing
                    ? 'VERWERKEN…'
                    : usesStructuredPressureTestOverlay
                      ? 'EXTRA FOTO'
                      : 'VASTLEGGEN'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </ExpoCameraView>

      {/* 📄 Bon Scanner modal — OCR voor leveringsbonnen, certificaten, facturen */}
      <BonScannerModal
        visible={showBonScanner}
        projectId={projectId.trim() || 'onbekend'}
        theme={theme}
        onClose={() => setShowBonScanner(false)}
      />

      {/* Floor Plan Pin Picker modal */}
      {showFloorPlanPicker && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          alignItems: 'center', justifyContent: 'center',
          padding: 16, zIndex: 999,
        }}>
          <View style={{ width: '100%', maxWidth: 560 }}>
            <FloorPlanPinPicker
              floorPlans={floorPlans}
              theme={theme}
              onConfirm={(pin) => {
                setShowFloorPlanPicker(false);
                const base = pendingEvidenceRef.current;
                pendingEvidenceRef.current = null;
                if (base) {
                  const withPin: WkbEvidence = { ...base, floorPlanId: pin.floorPlanId, pinX: pin.pinX, pinY: pin.pinY };
                  uploadEvidenceDirectly(withPin, withPin.mediaUri)
                    .catch(async () => {
                      const persisted = await persistOfflinePhoto(withPin.mediaUri, withPin.id).catch(() => null);
                      const ev = persisted ? { ...withPin, mediaUri: persisted } : withPin;
                      await saveEvidenceLocally(ev);
                      void registerBgSync();
                      void syncEvidenceQueue();
                    })
                    .finally(() => {
                      setDesktopPhoto(null);
                      setMobileWebPhotoUri(null);
                      const lat = parseFloat(desktopLatitude);
                      const lon = parseFloat(desktopLongitude);
                      setLastCapture({
                        projectId: withPin.projectId,
                        taskTitle: withPin.inspectionPointId,
                        inspectionPointId: withPin.inspectionPointId,
                        timestamp: withPin.timestamp,
                        latitude: Number.isFinite(lat) ? lat : withPin.latitude,
                        longitude: Number.isFinite(lon) ? lon : withPin.longitude,
                        weatherLabel: withPin.weatherLabel ?? null,
                      });
                    });
                }
              }}
              onSkip={() => {
                setShowFloorPlanPicker(false);
                const base = pendingEvidenceRef.current;
                pendingEvidenceRef.current = null;
                if (base) {
                  uploadEvidenceDirectly(base, base.mediaUri)
                    .catch(async () => {
                      const persisted = await persistOfflinePhoto(base.mediaUri, base.id).catch(() => null);
                      const ev = persisted ? { ...base, mediaUri: persisted } : base;
                      await saveEvidenceLocally(ev);
                      void registerBgSync();
                      void syncEvidenceQueue();
                    })
                    .finally(() => {
                      setDesktopPhoto(null);
                      setMobileWebPhotoUri(null);
                      const lat = parseFloat(desktopLatitude);
                      const lon = parseFloat(desktopLongitude);
                      setLastCapture({
                        projectId: base.projectId,
                        taskTitle: base.inspectionPointId,
                        inspectionPointId: base.inspectionPointId,
                        timestamp: base.timestamp,
                        latitude: Number.isFinite(lat) ? lat : base.latitude,
                        longitude: Number.isFinite(lon) ? lon : base.longitude,
                        weatherLabel: base.weatherLabel ?? null,
                      });
                    });
                }
              }}
            />
          </View>
        </View>
      )}

      {/* ✅ Post-save scherm — werkt ook na native camera capture */}
      <PostSaveSheet
        result={postSaveResult}
        theme={theme}
        taskTitle={activeTask?.title ?? null}
        onAnother={() => setPostSaveResult(null)}
        onBackToProject={onBackToProject ?? onBackToTasks ?? null}
        onDone={onBackToMain ?? onBackToTasks ?? null}
      />
    </View>
  );
}

// ─── PostSaveSheet — modal met vervolg-opties na succesvolle save ──────────────

interface PostSaveSheetProps {
  result: { aiStatus: string | null; aiNotes: string | null; uploadOk: boolean } | null;
  theme: Theme;
  taskTitle: string | null;
  onAnother: () => void;
  onBackToProject: (() => void) | null;
  onDone: (() => void) | null;
}

function PostSaveSheet({
  result,
  theme,
  taskTitle,
  onAnother,
  onBackToProject,
  onDone,
}: PostSaveSheetProps) {
  if (!result) return null;
  const failed = result.aiStatus === 'FAILED';
  const headline = failed
    ? '⚠️ Opgeslagen met waarschuwing'
    : '✅ Bewijs opgeslagen';
  const subline = failed
    ? (result.aiNotes ?? 'Edge check markeert deze foto als onvoldoende.')
    : result.uploadOk
      ? 'Foto staat in het dossier en is gesynchroniseerd.'
      : 'Foto staat lokaal opgeslagen — sync volgt zodra je online bent.';
  const accent = failed ? '#d97706' : '#059669';

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onAnother}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 440,
            backgroundColor: theme.colors.surface,
            borderRadius: 18,
            padding: 22,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 22,
              fontWeight: '900',
              color: accent,
              marginBottom: 6,
            }}
          >
            {headline}
          </Text>
          {taskTitle ? (
            <Text
              style={{
                fontSize: 14,
                color: theme.colors.textSecondary,
                marginBottom: 8,
              }}
            >
              {taskTitle}
            </Text>
          ) : null}
          <Text
            style={{
              fontSize: 15,
              color: theme.colors.textPrimary,
              lineHeight: 22,
              marginBottom: 18,
            }}
          >
            {subline}
          </Text>

          <Text
            style={{
              fontSize: 13,
              fontWeight: '700',
              color: theme.colors.textSecondary,
              marginBottom: 10,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
            }}
          >
            Wat wil je nu doen?
          </Text>

          <TouchableOpacity
            onPress={onAnother}
            activeOpacity={0.85}
            style={{
              backgroundColor: theme.colors.accent,
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: 'center',
              marginBottom: 10,
              minHeight: 48,
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>
              📸 Nog een foto van hetzelfde punt
            </Text>
          </TouchableOpacity>

          {onBackToProject ? (
            <TouchableOpacity
              onPress={() => {
                onAnother();
                onBackToProject();
              }}
              activeOpacity={0.85}
              style={{
                backgroundColor: theme.colors.surface,
                borderWidth: 1.5,
                borderColor: theme.colors.accent,
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: 'center',
                marginBottom: 10,
                minHeight: 48,
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: theme.colors.accent, fontSize: 16, fontWeight: '800' }}>
                ↩️ Ander borgingspunt kiezen
              </Text>
            </TouchableOpacity>
          ) : null}

          {onDone ? (
            <TouchableOpacity
              onPress={() => {
                onAnother();
                onDone();
              }}
              activeOpacity={0.85}
              style={{
                backgroundColor: 'transparent',
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: 'center',
                minHeight: 44,
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: theme.colors.textSecondary, fontSize: 15, fontWeight: '700' }}>
                ✅ Klaar voor nu — terug naar start
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: { name?: string; colors: Record<string, string> }) => {
  const isDark = theme.name === 'dark';
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    camera: {
      flex: 1,
    },
    overlay: {
      flex: 1,
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 28,
      backgroundColor: 'rgba(8, 11, 18, 0.22)',
    },
    timerOverlay: {
      position: 'absolute',
      top: 10,
      left: 14,
      right: 14,
      zIndex: 4,
      alignItems: 'center',
    },
    timerCard: {
      width: '100%',
      backgroundColor: 'rgba(8, 11, 18, 0.92)',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: 'rgba(245, 214, 66, 0.36)',
      padding: 16,
      gap: 8,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    timerEyebrow: {
      color: '#F5D642',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.1,
    },
    timerCountdown: {
      color: '#F8FAFC',
      fontSize: 32,
      fontWeight: '800',
      letterSpacing: 1.2,
    },
    timerStatusText: {
      color: '#BFD0E3',
      fontSize: 12,
      fontWeight: '700',
    },
    timerActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 6,
    },
    timerActionPrimary: {
      flex: 1,
      minHeight: 42,
      borderRadius: 12,
      backgroundColor: 'rgba(245, 214, 66, 0.18)',
      borderWidth: 1,
      borderColor: 'rgba(245, 214, 66, 0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    timerActionPrimaryText: {
      color: '#F5D642',
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.4,
    },
    timerActionSecondary: {
      minWidth: 90,
      minHeight: 42,
      borderRadius: 12,
      backgroundColor: 'rgba(148, 163, 184, 0.16)',
      borderWidth: 1,
      borderColor: 'rgba(148, 163, 184, 0.28)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    timerActionSecondaryText: {
      color: '#D7E2F0',
      fontSize: 12,
      fontWeight: '700',
    },
    timerCompleteBadge: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: 'rgba(66, 211, 146, 0.18)',
      borderWidth: 1,
      borderColor: 'rgba(66, 211, 146, 0.35)',
    },
    timerCompleteText: {
      color: '#42D392',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
    },
    topStack: {
      gap: 12,
    },
    briefingCard: {
      backgroundColor: 'rgba(9, 12, 19, 0.88)',
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: 'rgba(164, 13, 47, 0.35)',
    },
    briefingEyebrow: {
      color: '#CC1039',
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 2,
      marginBottom: 8,
    },
    briefingTitle: {
      color: '#F8FAFC',
      fontSize: 20,
      fontWeight: '800',
      marginBottom: 6,
    },
    briefingText: {
      color: '#D7E2F0',
      fontSize: 13,
      lineHeight: 18,
    },
    briefingMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
    },
    briefingBadge: {
      borderRadius: 999,
      backgroundColor: 'rgba(59, 130, 246, 0.14)',
      borderWidth: 1,
      borderColor: 'rgba(59, 130, 246, 0.26)',
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    briefingBadgeText: {
      color: '#D7E2F0',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
    },
    taskInlineButton: {
      alignSelf: 'flex-start',
      marginTop: 12,
      backgroundColor: 'rgba(164, 13, 47, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(164, 13, 47, 0.3)',
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    taskInlineButtonText: {
      color: '#F2697E',
      fontSize: 12,
      fontWeight: '700',
    },
    stampCard: {
      backgroundColor: 'rgba(5, 10, 18, 0.72)',
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: 'rgba(66, 211, 146, 0.24)',
    },
    stampHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      gap: 12,
    },
    stampTitle: {
      color: '#F8FAFC',
      fontSize: 17,
      fontWeight: '700',
    },
    exifBadge: {
      backgroundColor: '#42D392',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    exifBadgeText: {
      color: '#052E1B',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    stampGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    stampItem: {
      minWidth: '47%',
      flexGrow: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.56)',
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    stampLabel: {
      color: '#8FA0B6',
      fontSize: 11,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    stampValue: {
      color: '#F8FAFC',
      fontSize: 13,
      fontWeight: '700',
    },
    stampMeta: {
      color: '#BFD0E3',
      fontSize: 12,
      marginTop: 10,
    },
    locationSecurityCard: {
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 11,
      marginTop: 10,
      borderWidth: 1,
    },
    locationSecurityCardOk: {
      backgroundColor: 'rgba(66, 211, 146, 0.12)',
      borderColor: 'rgba(66, 211, 146, 0.28)',
    },
    locationSecurityCardWarn: {
      backgroundColor: 'rgba(245, 214, 66, 0.12)',
      borderColor: 'rgba(245, 214, 66, 0.28)',
    },
    locationSecurityTitle: {
      color: '#F8FAFC',
      fontSize: 12,
      fontWeight: '800',
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    locationSecurityText: {
      color: '#D7E2F0',
      fontSize: 12,
      lineHeight: 17,
    },
    formCard: {
      backgroundColor: 'rgba(10, 14, 24, 0.86)',
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    formLabel: {
      color: '#DCE7F5',
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    input: {
      backgroundColor: 'rgba(247, 250, 252, 0.96)',
      color: '#07111F',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 13,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.18)',
      fontSize: 16,
      fontWeight: '600',
    },
    notesInput: {
      minHeight: 88,
      paddingTop: 12,
    },
    notesHint: {
      color: '#AEBFD3',
      fontSize: 11,
      lineHeight: 16,
      marginTop: -2,
      marginBottom: 2,
    },
    captureChecklistCard: {
      backgroundColor: 'rgba(15, 23, 42, 0.56)',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
      padding: 12,
      gap: 10,
      marginTop: 14,
      marginBottom: 10,
    },
    captureChecklistTitle: {
      color: '#F8FAFC',
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    captureChecklistItem: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
      backgroundColor: 'rgba(8, 11, 18, 0.54)',
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    captureChecklistItemActive: {
      borderColor: 'rgba(66, 211, 146, 0.42)',
      backgroundColor: 'rgba(66, 211, 146, 0.14)',
    },
    captureChecklistActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: -2,
    },
    captureChecklistButton: {
      minHeight: 42,
      borderRadius: 12,
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      borderWidth: 1,
      borderColor: 'rgba(59, 130, 246, 0.32)',
      paddingHorizontal: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    captureChecklistButtonText: {
      color: '#D7E2F0',
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    captureChecklistLabel: {
      color: '#F8FAFC',
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 20,
      marginBottom: 4,
    },
    captureChecklistState: {
      color: '#AEBFD3',
      fontSize: 12,
      fontWeight: '700',
    },
    presetRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    presetButton: {
      minHeight: 42,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: 'rgba(31, 41, 55, 0.88)',
      borderWidth: 1,
      borderColor: 'rgba(143, 160, 182, 0.18)',
      justifyContent: 'center',
    },
    presetButtonActive: {
      backgroundColor: '#F5D642',
      borderColor: '#F5D642',
    },
    presetButtonText: {
      color: '#D2DCE9',
      fontSize: 13,
      fontWeight: '700',
    },
    presetButtonTextActive: {
      color: '#171A1F',
    },
    bottomStack: {
      gap: 14,
    },
    levelCard: {
      backgroundColor: 'rgba(9, 12, 19, 0.84)',
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: 'rgba(66, 211, 146, 0.18)',
    },
    levelHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
    },
    levelTitle: {
      color: '#F8FAFC',
      fontSize: 16,
      fontWeight: '700',
    },
    levelStatusPill: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    levelStatusOk: {
      backgroundColor: '#42D392',
    },
    levelStatusWarn: {
      backgroundColor: '#F5D642',
    },
    levelStatusText: {
      color: '#10151D',
      fontSize: 12,
      fontWeight: '800',
    },
    levelTrack: {
      height: 24,
      borderRadius: 999,
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    levelCenterLine: {
      position: 'absolute',
      width: 4,
      height: '100%',
      backgroundColor: 'rgba(255, 255, 255, 0.5)',
    },
    levelBubble: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: '#F5D642',
      borderWidth: 3,
      borderColor: '#FCEB84',
    },
    levelBubbleAligned: {
      backgroundColor: '#42D392',
      borderColor: '#9FF0C9',
    },
    levelHint: {
      color: '#BFD0E3',
      fontSize: 12,
      marginTop: 10,
      lineHeight: 17,
    },
    capturePanel: {
      alignItems: 'center',
      backgroundColor: 'rgba(8, 11, 18, 0.88)',
      borderRadius: 24,
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 22,
      borderWidth: 1,
      borderColor: 'rgba(245, 214, 66, 0.18)',
    },
    captureHint: {
      color: '#E6EEF8',
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
      marginBottom: 14,
    },
    captureButton: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 210,
    },
    captureButtonDisabled: {
      opacity: 0.55,
    },
    captureButtonOuter: {
      width: 138,
      height: 138,
      borderRadius: 69,
      backgroundColor: 'rgba(245, 214, 66, 0.18)',
      borderWidth: 4,
      borderColor: '#F5D642',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    captureButtonInner: {
      width: 104,
      height: 104,
      borderRadius: 52,
      backgroundColor: '#42D392',
      borderWidth: 6,
      borderColor: '#D9FFF0',
    },
    captureButtonInnerBusy: {
      backgroundColor: '#F5D642',
      borderColor: '#FFF5B5',
    },
    captureButtonText: {
      color: '#F8FAFC',
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: 1,
    },
    centeredState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      backgroundColor: theme.colors.background,
    },
    stateTitle: {
      color: theme.colors.textPrimary,
      fontSize: 24,
      fontWeight: '800',
      textAlign: 'center',
      marginBottom: 10,
    },
    infoText: {
      color: theme.colors.textSecondary,
      textAlign: 'center',
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 18,
    },
    permissionButton: {
      backgroundColor: '#F5D642',
      paddingHorizontal: 22,
      paddingVertical: 14,
      borderRadius: 14,
    },
    permissionButtonText: {
      color: '#171A1F',
      fontSize: 16,
      fontWeight: '800',
    },
    webContainer: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 20,
      backgroundColor: theme.colors.background,
      overflow: 'auto' as any,
    },
    webHero: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 22,
      padding: 22,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    webEyebrow: {
      color: '#F5D642',
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.9,
      marginBottom: 8,
    },
    webCard: {
      padding: 22,
      borderRadius: 22,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    taskBanner: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 16,
      marginBottom: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    },
    taskBannerCopy: {
      flex: 1,
    },
    taskBannerEyebrow: {
      color: '#F5D642',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    taskBannerTitle: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 4,
    },
    taskBannerText: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    taskMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 10,
    },
    taskMetaBadge: {
      borderRadius: 999,
      backgroundColor: 'rgba(245, 214, 66, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(245, 214, 66, 0.2)',
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    taskMetaBadgeText: {
      color: '#F5D642',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
    },
    taskBannerButton: {
      minHeight: 44,
      borderRadius: 12,
      backgroundColor: theme.colors.accent,
      paddingHorizontal: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    taskBannerButtonText: {
      color: '#F8FAFC',
      fontSize: 13,
      fontWeight: '800',
    },
    webCoordinateRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 4,
    },
    webCoordinateInput: {
      flex: 1,
    },
    webAccuracyInput: {
      width: 140,
    },
    embeddedTimerOverlay: {
      marginTop: 12,
      marginBottom: 14,
    },
    webActionRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 6,
      marginBottom: 16,
    },
    webActionButton: {
      flex: 1,
      minHeight: 52,
      borderRadius: 16,
      backgroundColor: theme.colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
    },
    webActionButtonText: {
      color: '#F8FAFC',
      fontSize: 15,
      fontWeight: '800',
      textAlign: 'center',
    },
    webPreviewCard: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    webPreviewEmpty: {
      minHeight: 120,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 18,
      backgroundColor: theme.colors.surfaceAlt,
    },
    webPreviewImage: {
      width: '100%',
      height: 320,
      borderRadius: 16,
      marginBottom: 12,
      backgroundColor: '#0F172A',
    },
    webPreviewText: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 6,
    },
    webPreviewMeta: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
    },
    webTitle: {
      color: theme.colors.textPrimary,
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 8,
    },

    // ── 2026 Web Camera App UI ──────────────────────────
    webBackButton: {
      alignSelf: 'flex-start',
      paddingVertical: 8,
      paddingHorizontal: 0,
      marginBottom: 14,
    },
    webBackButtonText: {
      color: theme.colors.accent,
      fontSize: 15,
      fontWeight: '700',
    },
    webTaskCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 18,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.accent,
    },
    webTaskCardLeft: {
      gap: 6,
    },
    webTaskEyebrow: {
      color: theme.colors.textSecondary,
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 1,
      fontFamily: 'monospace' as any,
    },
    webTaskTitle: {
      color: theme.colors.textPrimary,
      fontSize: 17,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    webTaskBadgeRow: {
      flexDirection: 'row',
      gap: 6,
      flexWrap: 'wrap',
      marginTop: 4,
    },
    webTaskBadge: {
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    webTaskBadgeAi: {
      backgroundColor: 'rgba(164,13,47,0.12)',
      borderColor: 'rgba(164,13,47,0.25)',
    },
    webTaskBadgeText: {
      color: theme.colors.textSecondary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.4,
    },
    webTaskBadgeTextAi: {
      color: theme.colors.accent,
    },
    // Compact checklist row
    webChecklistRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
      marginBottom: 14,
    },
    webCheckItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    webCheckItemDone: {
      backgroundColor: 'rgba(5,150,105,0.12)',
      borderColor: 'rgba(5,150,105,0.3)',
    },
    webCheckDot: {
      fontSize: 13,
      color: theme.colors.success,
      fontWeight: '800',
    },
    webCheckText: {
      color: theme.colors.textPrimary,
      fontSize: 12,
      fontWeight: '600',
    },
    // Photo area
    webPhotoArea: {
      width: '100%',
      height: 220,
      borderRadius: 20,
      overflow: 'hidden',
      marginBottom: 10,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    webPhotoPreview: {
      width: '100%',
      height: '100%',
    },
    webPhotoEmpty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    webPhotoIcon: {
      fontSize: 36,
      marginBottom: 4,
    },
    webPhotoEmptyTitle: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    webPhotoEmptyHint: {
      color: theme.colors.textSecondary,
      fontSize: 12,
    },
    webChangePhotoBtn: {
      alignSelf: 'flex-end',
      marginBottom: 12,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    webChangePhotoBtnText: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    // Weer banner
    webWeatherBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)',
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 10,
    },
    webWeatherText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    // Note row (input + spraakknop naast elkaar)
    webNoteRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginBottom: 14,
    },
    // Note input
    webNoteInput: {
      backgroundColor: theme.colors.surface,
      color: theme.colors.textPrimary,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 13,
      borderWidth: 1,
      borderColor: theme.colors.border,
      fontSize: 15,
      minHeight: 60,
      textAlignVertical: 'top',
    },
    // Primary capture button
    webCaptureBtn: {
      width: '100%',
      minHeight: 56,
      borderRadius: 16,
      backgroundColor: theme.colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    webCaptureBtnDisabled: {
      opacity: 0.4,
    },
    webCaptureBtnText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    // Advanced toggle
    webAdvancedToggle: {
      alignSelf: 'center',
      paddingVertical: 8,
      paddingHorizontal: 16,
      marginBottom: 10,
    },
    webAdvancedToggleText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    webAdvancedPanel: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 10,
      marginBottom: 20,
    },
    webAdvancedLabel: {
      color: theme.colors.textSecondary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.5,
      marginBottom: -4,
    },
    webAdvancedInput: {
      backgroundColor: theme.colors.surfaceAlt,
      color: theme.colors.textPrimary,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      fontSize: 14,
    },
    webAdvancedPresets: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    webAdvancedChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    webAdvancedChipActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    webAdvancedChipText: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    webAdvancedChipTextActive: {
      color: '#FFFFFF',
    },

    // ── Mobiele wizard ──
    mobileWizardScreen: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 24,
      gap: 12,
    },
    mobileWizardBack: {
      paddingVertical: 4,
    },
    mobileWizardBackText: {
      fontSize: 14,
      fontWeight: '700',
    },
    mobileTaskHeader: {
      borderBottomWidth: 1,
      paddingBottom: 12,
    },
    mobileTaskId: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.5,
      marginBottom: 3,
    },
    mobileTaskTitle: {
      fontSize: 18,
      fontWeight: '900',
      lineHeight: 24,
    },
    mobileBigPhotoArea: {
      flex: 1,
      minHeight: 220,
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: theme.colors.surface,
      borderWidth: 2,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mobileBigPhotoPreview: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    mobileBigPhotoEmpty: {
      alignItems: 'center',
      gap: 8,
    },
    mobileBigPhotoIcon: { fontSize: 52 },
    mobileBigPhotoTitle: {
      fontSize: 18,
      fontWeight: '800',
    },
    mobileBigPhotoHint: {
      fontSize: 14,
    },
    mobileRetakeBtn: {
      borderRadius: 10,
      borderWidth: 1,
      paddingVertical: 12,
      alignItems: 'center',
    },
    mobileRetakeBtnText: {
      fontSize: 14,
      fontWeight: '600',
    },
    mobileNextBtn: {
      borderRadius: 16,
      paddingVertical: 20,
      alignItems: 'center',
    },
    mobileNextBtnDisabled: {
      opacity: 0.4,
    },
    mobileNextBtnText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '800',
    },
    mobileThumb: {
      width: '100%',
      height: 160,
      borderRadius: 14,
      borderWidth: 1,
      resizeMode: 'cover',
    },
    mobileGpsCard: {
      borderRadius: 12,
      borderWidth: 1.5,
      padding: 14,
      gap: 4,
    },
    mobileGpsTitle: {
      fontSize: 15,
      fontWeight: '800',
    },
    mobileGpsAddress: {
      fontSize: 16,
      fontWeight: '700',
    },
    mobileGpsAltitude: {
      fontSize: 15,
      fontWeight: '700',
    },
    mobileGpsCoords: {
      fontSize: 12,
      opacity: 0.7,
    },
    mobileConfirmTask: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 14,
      gap: 4,
    },
    mobileConfirmTaskId: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    mobileConfirmTaskTitle: {
      fontSize: 16,
      fontWeight: '800',
    },
    // Weerkaart (mobiel)
    mobileWeatherCard: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 14,
      marginBottom: 12,
    },
    mobileWeatherTitle: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    mobileWeatherGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    mobileWeatherCell: {
      width: '47%',
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: 'rgba(128,128,128,0.07)',
    },
    mobileWeatherCellWide: {
      width: '100%',
    },
    mobileWeatherVal: {
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 2,
    },
    mobileWeatherKey: {
      fontSize: 11,
      fontWeight: '500',
    },
    // Exacte locatie kaart
    mobileLocatieCard: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 14,
      marginBottom: 12,
    },
    mobileLocatieTitle: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    mobileLocatieBBRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
    },
    mobileLocatieBBBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 2,
      alignItems: 'center',
    },
    mobileLocatieBBText: {
      fontSize: 16,
      fontWeight: '800',
    },
    mobileLocatieEtageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
    },
    mobileLocatieEtageLabel: {
      fontSize: 13,
      fontWeight: '700',
      width: 100,
    },
    mobileLocatieEtageInput: {
      flex: 1,
      borderWidth: 1.5,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 18,
      fontWeight: '800',
      textAlign: 'center',
    },
    mobileLocatieChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 10,
    },
    mobileLocatieChip: {
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 10,
      borderWidth: 1.5,
    },
    mobileLocatieChipText: {
      fontSize: 15,
      fontWeight: '700',
    },
    mobileLocatieInput: {
      borderRadius: 10,
      borderWidth: 1.5,
      paddingHorizontal: 14,
      paddingVertical: 11,
      fontSize: 15,
    },
    mobileNoteInput: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 14,
      fontSize: 15,
      minHeight: 52,
    },
    mobileNoteRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginBottom: 12,
    },
    mobileNoteInputFlex: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      minHeight: 52,
      maxHeight: 140,
    },
    mobileSaveBtn: {
      borderRadius: 16,
      paddingVertical: 22,
      alignItems: 'center',
    },
    mobileBonBtn: {
      marginHorizontal: 14,
      marginTop: 12,
      marginBottom: 4,
      paddingVertical: 18,
      borderWidth: 2,
      borderRadius: 14,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 4,
      elevation: 3,
    },
    mobileBonBtnText: {
      fontSize: 17,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    mobileSaveBtnDisabled: {
      opacity: 0.45,
    },
    mobileSaveBtnText: {
      color: '#fff',
      fontSize: 19,
      fontWeight: '900',
    },
    mobileSaveHint: {
      marginTop: 8,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
    },
    mobileField: {
      marginBottom: 12,
    },
    mobileLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textPrimary,
      marginBottom: 6,
    },
    mobileHelperText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 4,
      fontStyle: 'italic',
    },
  });
};
