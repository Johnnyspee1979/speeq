import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import {
  Camera,
  FolderOpen,
  ClipboardCheck,
  ShieldCheck,
  SlidersHorizontal,
  Building2,
  Info,
  Users,
  Map,
  BarChart2,
  Hammer,
} from 'lucide-react-native';
import CameraView from './src/components/CameraView';
import EvidenceList from './src/components/EvidenceList';
import RejectionBanner from './src/components/RejectionBanner';
import VakmanTutorialModal from './src/components/VakmanTutorialModal';
import PresetsManager from './src/components/PresetsManager';
import DsoLog from './src/components/DsoLog';
import About from './src/components/About';
import QualityDashboard from './src/components/QualityDashboard';
import AiValidationDashboard from './src/components/AiValidationDashboard';
import WkbTaskSelector from './src/components/WkbTaskSelector';
import QuickCaptureView from './src/components/QuickCaptureView';
import WkbOpleveringsCheck from './src/components/WkbOpleveringsCheck';
import {
  ResponsiveLayout,
  type ResponsiveLayoutItem,
} from './src/components/layout/ResponsiveLayout';
import { APP_TITLE, DEFAULT_PROJECT_ID } from './src/config/app';
import { initDatabase, initWatermelonDatabase } from './src/database/database';
import {
  type SyncResult,
} from './src/services/sync';
import { registerAutoSync, triggerSyncIfOnline } from './src/services/autoSync';
import { runSyncEngine } from './src/services/SyncEngine';
import {
  registerForReviewNotifications,
  requestNotificationPermissions,
} from './src/services/NotificationService';
import { subscribeToRejections } from './src/services/VakmanFeedbackService';
import { useNotificationRouting } from './src/hooks/useNotificationRouting';
import { useWkbAuth } from './src/hooks/useWkbAuth';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import type { CaptureTask } from './src/types/CaptureTask';
import { findNenCaptureTaskByInspectionPointId } from './src/constants/NenStandards';
import { wkbTaskTemplates } from './src/data/WkbTemplates';
import type { InspectionRouteIntent } from './src/services/deepLinking';
import StartFlow, { type StartFlowResumeContext } from './src/screens/StartFlow';
import ConsumentenDossierScherm from './src/screens/ConsumentenDossierScherm';
import WerkvoorbereiderDashboard from './src/screens/WerkvoorbereiderDashboard';
import LoginScreen from './src/screens/LoginScreen';
import TeamBeheerScreen from './src/screens/TeamBeheerScreen';
import EvidenceMapView from './src/components/EvidenceMapView';
import JoinScreen from './src/screens/JoinScreen';
import TekenGoedkeuringScreen from './src/screens/TekenGoedkeuringScreen';
import OpdrachtgeverPortaal from './src/screens/OpdrachtgeverPortaal';
import ProjectPicker from './src/components/ProjectPicker';
import ProjectleiderOverzicht from './src/screens/ProjectleiderOverzicht';
import VakmanWorkspace from './src/screens/VakmanWorkspace';
import { ProjectProvider, useProject } from './src/context/ProjectContext';
import { LanguageProvider } from './src/i18n';
import { ActivityIndicator } from 'react-native';
import { getTenantConfig } from './src/config/tenant';
import { initSupabase } from './src/lib/supabase';
import TenantLoginScreen from './src/screens/TenantLoginScreen';
import LandingScreen from './src/screens/LandingScreen';
import CodeGateScreen, { hasPassedGate } from './src/screens/CodeGateScreen';

type Tab =
  | 'camera'
  | 'dossier'
  | 'kaart'
  | 'oplevering'
  | 'review'
  | 'portal'
  | 'presets'
  | 'dso'
  | 'team'
  | 'about'
  | 'overzicht'
  | 'vakman';

type CameraEntryContext = 'selector' | 'oplevering';
type OpleveringView = 'checklist' | 'consumentendossier';
type ReviewView = 'werkvoorbereider' | 'kwaliteitsborger' | 'ai-dashboard';
type CameraFocusRequest = InspectionRouteIntent & { nonce: number };

const NAV_ITEMS: ResponsiveLayoutItem[] = [
  { key: 'overzicht', label: 'Overzicht', desktopLabel: 'Projectoverzicht', icon: BarChart2 },
  { key: 'vakman',   label: 'Mijn werk', desktopLabel: 'Mijn werkruimte',  icon: Hammer },
  { key: 'camera', label: 'Camera', desktopLabel: 'Veldcamera', icon: Camera },
  { key: 'dossier', label: 'Dossier', desktopLabel: 'Dossier', icon: FolderOpen },
  { key: 'kaart', label: 'Kaart', desktopLabel: 'GPS Kaart', icon: Map },
  { key: 'oplevering', label: 'Oplevering', desktopLabel: 'Punchlist', icon: ClipboardCheck },
  { key: 'review', label: 'Review', desktopLabel: 'Kwaliteitsborger', icon: ShieldCheck },
  { key: 'portal', label: 'Portaal', desktopLabel: 'Opdrachtgever', icon: Building2 },
  { key: 'team', label: 'Team', desktopLabel: 'Team Beheer', icon: Users },
  { key: 'presets', label: 'Presets', desktopLabel: 'Presets', icon: SlidersHorizontal },
  { key: 'dso', label: 'DSO', desktopLabel: 'DSO', icon: Building2 },
  { key: 'about', label: 'Info', desktopLabel: 'Info', icon: Info },
];

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message?: string }
> {
  state = { hasError: false, message: undefined };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
            Er ging iets mis in de app
          </Text>
          <Text style={{ fontSize: 13 }}>
            {this.state.message ?? 'Onbekende fout'}
          </Text>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

/**
 * PublicGate — toont eerst Landing + CodeGate vóór de echte app.
 *
 * Doel: SpeeQ WKB Tool niet open op het publieke web — bezoeker landt
 * op een marketing landing, klikt "Open de tool", typt de toegangscode.
 *
 * Bypass-regels:
 *   - Native (iOS/Android): altijd doorgang — gate is web-only
 *   - URL bevat ?join= of ?approve=: legitieme deep-links, gate skippen
 *   - localStorage `speeq_gate_passed_v1`: bezoeker heeft eerder code ingevoerd
 */
function PublicGate({ children }: { children: React.ReactNode }) {
  // Native apps slaan de gate over — die zijn bewust geïnstalleerd.
  const isWeb = Platform.OS === 'web';

  // Deep-link bypass: vakman join + tekening approve flows.
  const hasDeepLinkBypass = React.useMemo(() => {
    if (!isWeb || typeof window === 'undefined') return false;
    try {
      const params = new URLSearchParams(window.location.search);
      return params.has('join') || params.has('approve');
    } catch {
      return false;
    }
  }, [isWeb]);

  type View = 'landing' | 'codegate' | 'passthrough';
  const initial: View =
    !isWeb || hasDeepLinkBypass || hasPassedGate() ? 'passthrough' : 'landing';

  const [view, setView] = useState<View>(initial);

  if (view === 'landing') {
    return <LandingScreen onEnterTool={() => setView('codegate')} />;
  }
  if (view === 'codegate') {
    return (
      <CodeGateScreen
        onCodeAccepted={() => setView('passthrough')}
        onBack={() => setView('landing')}
      />
    );
  }

  return <>{children}</>;
}

function TenantGate({ children }: { children: React.ReactNode }) {
  const [tenantReady, setTenantReady] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getTenantConfig().then(config => {
      if (config) {
        initSupabase(config.supabaseUrl, config.supabaseAnonKey);
        setTenantReady(true);
      }
      setChecking(false);
    });
  }, []);

  if (checking) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0F19', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#A40D2F" />
      </SafeAreaView>
    );
  }

  if (!tenantReady) {
    return <TenantLoginScreen onLoginSuccess={() => setTenantReady(true)} />;
  }

  return <>{children}</>;
}

function AppShell() {
  const { theme } = useTheme();
  const { user, loading: authLoading, enableDevBypass } = useWkbAuth();
  const { activeProject } = useProject();

  // Detecteer ?join=TOKEN in URL voor vakman-uitnodiging
  const joinToken = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      return new URLSearchParams(window.location.search).get('join');
    } catch {
      return null;
    }
  }, []);

  // Detecteer ?approve=TOKEN in URL voor bouwtekening-goedkeuring (publiek, geen login)
  const approveToken = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      return new URLSearchParams(window.location.search).get('approve');
    } catch {
      return null;
    }
  }, []);
  const [activeTab, setActiveTab] = useState<Tab>('camera');
  const [selectedTask, setSelectedTask] = useState<CaptureTask | null>(null);
  const [startFlowResumeContext, setStartFlowResumeContext] = useState<StartFlowResumeContext | null>(null);
  const [cameraEntryContext, setCameraEntryContext] =
    useState<CameraEntryContext>('selector');
  const [opleveringView, setOpleveringView] =
    useState<OpleveringView>('checklist');
  const [reviewView, setReviewView] = useState<ReviewView>('werkvoorbereider');
  const [cameraFocusRequest, setCameraFocusRequest] =
    useState<CameraFocusRequest | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncResult>({
    status: 'idle',
    count: 0,
  });
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const opleveringStyles = useMemo(
    () => createOpleveringStyles(theme),
    [theme]
  );
  const syncLabel = useMemo(() => {
    if (syncStatus.status === 'synced') {
      return `✅ Gesynct (${syncStatus.count})`;
    }
    if (syncStatus.status === 'idle') {
      return '🕒 Geen nieuwe uploads';
    }
    if (syncStatus.status === 'skipped') {
      return syncStatus.message ?? '⚠️ Supabase niet ingesteld';
    }
    if (syncStatus.status === 'error') {
      return syncStatus.message ?? '❌ Sync fout';
    }
    return '🕒 Klaar voor sync';
  }, [syncStatus]);

  const navItems = useMemo(() => {
    const role = user?.role;
    const isDesktop = !isMobile;

    if (role === 'OPDRACHTGEVER') {
      return NAV_ITEMS.filter((item) => item.key === 'portal');
    }
    if (role === 'ADMIN') {
      // Desktop: geen camera — start op review/dossier
      if (isDesktop) return NAV_ITEMS.filter((item) => item.key !== 'camera');
      // Mobiel: camera + kaart (geen team op telefoon)
      return NAV_ITEMS.filter((item) => ['camera', 'kaart'].includes(item.key));
    }
    if (role === 'PROJECTLEIDER') {
      // Desktop: overzicht + dossier + kaart + team
      if (isDesktop) return NAV_ITEMS.filter((item) => ['overzicht', 'dossier', 'kaart', 'team'].includes(item.key));
      // Mobiel: geen team
      return NAV_ITEMS.filter((item) => ['overzicht', 'dossier', 'kaart'].includes(item.key));
    }
    if (role === 'WERKVOORBEREIDER') {
      // Desktop: review (dashboard) + dossier + kaart — geen camera
      if (isDesktop) return NAV_ITEMS.filter((item) => ['review', 'dossier', 'kaart'].includes(item.key));
      // Mobiel: camera + kaart
      return NAV_ITEMS.filter((item) => ['camera', 'kaart'].includes(item.key));
    }
    if (role === 'VOORMAN') {
      // Desktop: vakman workspace + kaart — geen camera
      if (isDesktop) return NAV_ITEMS.filter((item) => ['vakman', 'kaart'].includes(item.key));
      // Mobiel: camera + kaart
      return NAV_ITEMS.filter((item) => ['camera', 'kaart'].includes(item.key));
    }
    if (role === 'VAKMAN') {
      // Desktop: eigen werkruimte
      if (isDesktop) return NAV_ITEMS.filter((item) => item.key === 'vakman');
      // Mobiel: camera + kaart
      return NAV_ITEMS.filter((item) => ['camera', 'kaart'].includes(item.key));
    }
    // Overige rollen (ONDERAANNEMER, AANNEMER, KWALITEITSBORGER)
    if (isDesktop) return NAV_ITEMS.filter((item) => !['camera', 'review', 'dso', 'team', 'portal', 'overzicht'].includes(item.key));
    return NAV_ITEMS.filter((item) => !['review', 'dso', 'team', 'portal', 'overzicht'].includes(item.key));
  }, [user, isMobile]);

  const handleSelectTask = (task: CaptureTask, context?: StartFlowResumeContext) => {
    setCameraEntryContext('selector');
    setCameraFocusRequest(null);
    setStartFlowResumeContext(context ?? null);
    setSelectedTask({
      ...task,
      selectionSource: task.selectionSource ?? 'WKB',
    });
    setActiveTab('camera');
  };

  const handleOpenPunchlistCamera = (task: CaptureTask) => {
    setCameraEntryContext('oplevering');
    setCameraFocusRequest(null);
    setSelectedTask({
      ...task,
      selectionSource: task.selectionSource ?? 'OPLEVERING',
    });
    setOpleveringView('checklist');
    setActiveTab('camera');
  };

  const handleRouteToInspectionPoint = useCallback(
    (intent: InspectionRouteIntent) => {
      const matchingWkbTask = wkbTaskTemplates.find(
        (task) => task.inspectionPointId === intent.inspectionPointId
      );
      const matchingTask: CaptureTask | undefined = matchingWkbTask
        ? {
            id: matchingWkbTask.id,
            title: matchingWkbTask.title,
            description: matchingWkbTask.description,
            inspectionPointId: matchingWkbTask.inspectionPointId,
            selectionSource: 'WKB',
          }
        : findNenCaptureTaskByInspectionPointId(intent.inspectionPointId);

      setCameraEntryContext('selector');
      setSelectedTask({
        id: matchingTask?.id ?? `route-${intent.inspectionPointId}`,
        title: matchingTask?.title ?? 'Herstel bewijsstuk',
        description:
          matchingTask?.description ??
          'Direct geopend vanuit een deep-link of kwaliteitsmelding.',
        inspectionPointId: intent.inspectionPointId,
        instruction: matchingTask?.instruction,
        standards: matchingTask?.standards,
        disciplineTitle: matchingTask?.disciplineTitle,
        requiresExif: matchingTask?.requiresExif,
        selectionSource: matchingTask?.selectionSource ?? 'ROUTING',
      });
      setCameraFocusRequest({
        ...intent,
        nonce: Date.now(),
      });
      setActiveTab('camera');
    },
    []
  );

  useNotificationRouting(handleRouteToInspectionPoint);

  // ↩️ Ander borgingspunt: bewaar resumeContext, terug naar StartFlow borgingspunt-stap
  const handleBackToProject = () => {
    setCameraFocusRequest(null);
    setSelectedTask(null);          // StartFlow mount fresh met resumeContext
    setCameraEntryContext('selector');
    // startFlowResumeContext blijft behouden → StartFlow opent op borgingspunt-stap
  };

  // 🏠 Hoofdmenu: wis alles
  const handleBackToMain = () => {
    if (cameraEntryContext === 'oplevering') {
      setActiveTab('oplevering');
    }
    setCameraFocusRequest(null);
    setSelectedTask(null);
    setStartFlowResumeContext(null);  // wis context → StartFlow begint bij welkom
    setCameraEntryContext('selector');
  };

  // Backward compat (voor terug-knopen buiten CaptureSuccessCard)
  const handleBackFromCamera = handleBackToMain;

  const renderActiveTab = () => {
    if (activeTab === 'overzicht') return (
      <View style={{ flex: 1 }}>
        <ProjectleiderOverzicht />
      </View>
    );
    if (activeTab === 'camera') {
      // Als er een taak geselecteerd is → direct naar camera
      if (selectedTask) {
        return (
          <CameraView
            selectedTask={selectedTask}
            focusRequest={cameraFocusRequest}
            onBackToTasks={handleBackFromCamera}
            onBackToProject={startFlowResumeContext ? handleBackToProject : undefined}
            onBackToMain={handleBackToMain}
          />
        );
      }
      // Begeleide startflow: welkom → klant → project → discipline → borgingspunt
      return <StartFlow onSelectTask={handleSelectTask} resumeContext={startFlowResumeContext} />;
    }
    if (activeTab === 'dossier') return (
      <View style={{ flex: 1 }}>
        <ProjectPicker />
        <EvidenceList />
      </View>
    );
    if (activeTab === 'oplevering') {
      return (
        <View style={opleveringStyles.container}>
          <View style={opleveringStyles.switchRow}>
            <TouchableOpacity
              style={[
                opleveringStyles.switchButton,
                opleveringView === 'checklist' &&
                  opleveringStyles.switchButtonActive,
              ]}
              onPress={() => setOpleveringView('checklist')}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  opleveringStyles.switchButtonText,
                  opleveringView === 'checklist' &&
                    opleveringStyles.switchButtonTextActive,
                ]}
              >
                Punchlist
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                opleveringStyles.switchButton,
                opleveringView === 'consumentendossier' &&
                  opleveringStyles.switchButtonActive,
              ]}
              onPress={() => setOpleveringView('consumentendossier')}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  opleveringStyles.switchButtonText,
                  opleveringView === 'consumentendossier' &&
                    opleveringStyles.switchButtonTextActive,
                ]}
              >
                Consumentendossier
              </Text>
            </TouchableOpacity>
          </View>
          <View style={opleveringStyles.content}>
            {opleveringView === 'checklist' ? (
              <WkbOpleveringsCheck onOpenCamera={handleOpenPunchlistCamera} />
            ) : (
              <ConsumentenDossierScherm />
            )}
          </View>
        </View>
      );
    }
    if (activeTab === 'review') {
      return (
        <View style={opleveringStyles.container}>
          <ProjectPicker />
          <View style={opleveringStyles.switchRow}>
            <TouchableOpacity
              style={[
                opleveringStyles.switchButton,
                reviewView === 'werkvoorbereider' &&
                  opleveringStyles.switchButtonActive,
              ]}
              onPress={() => setReviewView('werkvoorbereider')}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  opleveringStyles.switchButtonText,
                  reviewView === 'werkvoorbereider' &&
                    opleveringStyles.switchButtonTextActive,
                ]}
              >
                Werkvoorbereider
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                opleveringStyles.switchButton,
                reviewView === 'kwaliteitsborger' &&
                  opleveringStyles.switchButtonActive,
              ]}
              onPress={() => setReviewView('kwaliteitsborger')}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  opleveringStyles.switchButtonText,
                  reviewView === 'kwaliteitsborger' &&
                    opleveringStyles.switchButtonTextActive,
                ]}
              >
                Kwaliteitsborger
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                opleveringStyles.switchButton,
                reviewView === 'ai-dashboard' &&
                  opleveringStyles.switchButtonActive,
              ]}
              onPress={() => setReviewView('ai-dashboard')}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  opleveringStyles.switchButtonText,
                  reviewView === 'ai-dashboard' &&
                    opleveringStyles.switchButtonTextActive,
                ]}
              >
                AI Model
              </Text>
            </TouchableOpacity>
          </View>
          <View style={opleveringStyles.content}>
            {reviewView === 'werkvoorbereider' ? (
              <WerkvoorbereiderDashboard
                projectId={activeProject.id}
                projectName={activeProject.name}
              />
            ) : reviewView === 'kwaliteitsborger' ? (
              <QualityDashboard />
            ) : (
              <AiValidationDashboard />
            )}
          </View>
        </View>
      );
    }
    if (activeTab === 'kaart') return (
      <View style={{ flex: 1 }}>
        <ProjectPicker />
        <EvidenceMapView />
      </View>
    );
    if (activeTab === 'portal') return (
      <View style={{ flex: 1 }}>
        <ProjectPicker />
        <OpdrachtgeverPortaal />
      </View>
    );
    if (activeTab === 'team') return <TeamBeheerScreen />;
    if (activeTab === 'presets') return <PresetsManager />;
    if (activeTab === 'dso') return <DsoLog />;
    if (activeTab === 'vakman') return (
      <View style={{ flex: 1 }}>
        <ProjectPicker />
        <VakmanWorkspace
          projectId={activeProject.id}
          projectName={activeProject.name}
        />
      </View>
    );
    return <About />;
  };

  useEffect(() => {
    const role = user?.role;
    const isDesktop = !isMobile;

    if (role === 'OPDRACHTGEVER') {
      if (activeTab !== 'portal') setActiveTab('portal');
      return;
    }

    if (role === 'PROJECTLEIDER') {
      const allowed: Tab[] = ['overzicht', 'dossier', 'kaart', 'team'];
      if (!allowed.includes(activeTab)) setActiveTab('overzicht');
      return;
    }

    if (role === 'ADMIN') {
      if (isDesktop && activeTab === 'camera') setActiveTab('review');
      return;
    }

    if (role === 'WERKVOORBEREIDER') {
      if (isDesktop) {
        const allowed: Tab[] = ['review', 'dossier', 'kaart'];
        if (!allowed.includes(activeTab)) setActiveTab('review');
      } else {
        const allowed: Tab[] = ['camera', 'kaart'];
        if (!allowed.includes(activeTab)) setActiveTab('camera');
      }
      return;
    }

    if (role === 'VOORMAN') {
      if (isDesktop) {
        const allowed: Tab[] = ['vakman', 'kaart'];
        if (!allowed.includes(activeTab)) setActiveTab('vakman');
      } else {
        const allowed: Tab[] = ['camera', 'kaart'];
        if (!allowed.includes(activeTab)) setActiveTab('camera');
      }
      return;
    }

    if (role === 'VAKMAN') {
      if (isDesktop) {
        if (activeTab !== 'vakman') setActiveTab('vakman');
      } else {
        const allowed: Tab[] = ['camera', 'kaart'];
        if (!allowed.includes(activeTab)) setActiveTab('camera');
      }
      return;
    }

    // Overige rollen
    const restrictedTabs: Tab[] = ['review', 'dso', 'team', 'portal', 'overzicht'];
    if (restrictedTabs.includes(activeTab)) setActiveTab(isDesktop ? 'dossier' : 'camera');
  }, [activeTab, user, isMobile]);

  useEffect(() => {
    if (!user || user.role === 'KWALITEITSBORGER') {
      return;
    }

    void registerForReviewNotifications(
      DEFAULT_PROJECT_ID,
      `${user.role.toLowerCase()}-${user.companyName || 'wkb-device'}`
    ).catch((error) => {
      console.warn('⚠️ Review-pushregistratie mislukt:', error);
    });
  }, [user]);

  // Vakman feedback loop: luister naar afgekeurde foto's (Sprint 3)
  // Alleen voor rollen die zelf foto's maken — vakman & voorman.
  useEffect(() => {
    if (!user) return;
    const eligibleRoles: typeof user.role[] = ['VAKMAN', 'VOORMAN'];
    if (!eligibleRoles.includes(user.role)) return;

    const stop = subscribeToRejections(user.id, (item) => {
      console.warn(
        `🔴 Foto afgekeurd voor borgingspunt ${item.inspectionPointId} (${item.reason})`,
        item.notes ?? ''
      );
      // Dispatch een event zodat een eventueel banner-component hierop kan haken
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        try {
          window.dispatchEvent(new CustomEvent('wkb:rejection', { detail: item }));
        } catch {
          /* native or older browsers */
        }
      }
    });

    return () => {
      try { stop(); } catch (e) { console.warn('VakmanFeedback stop error:', e); }
    };
  }, [user?.id, user?.role]);

  // Opdrachtgever: stuur direct naar portaal tab
  useEffect(() => {
    if (user?.role === 'OPDRACHTGEVER' && activeTab !== 'portal') {
      setActiveTab('portal');
    }
  }, [user, activeTab]);

  // Projectleider: stuur direct naar overzicht tab
  useEffect(() => {
    if (user?.role === 'PROJECTLEIDER' && activeTab !== 'overzicht') {
      const projectleiderTabs: Tab[] = ['overzicht', 'dossier', 'kaart', 'team'];
      if (!projectleiderTabs.includes(activeTab)) {
        setActiveTab('overzicht');
      }
    }
  }, [user, activeTab]);

  // Op web: automatisch dev bypass activeren zodat de tool meteen werkt
  useEffect(() => {
    if (!user && !authLoading && typeof window !== 'undefined') {
      enableDevBypass();
    }
  }, [user, authLoading]);

  // Start de lokale database direct bij het laden van de app
  useEffect(() => {
    let isMounted = true;
    let interval: ReturnType<typeof setInterval> | null = null;
    let unsubscribe: (() => void) | null = null;

    const bootstrap = async () => {
      await initDatabase();
      if (process.env.EXPO_PUBLIC_WKB_STORAGE_ENGINE === 'watermelon') {
        await initWatermelonDatabase();
      }
      await requestNotificationPermissions();
      if (!isMounted) {
        return;
      }

      const runSync = async () => {
        const result = await runSyncEngine();
        if (isMounted) {
          setSyncStatus(result);
        }
      };

      await runSync();
      if (!isMounted) {
        return;
      }

      interval = setInterval(runSync, 30000);
      unsubscribe = registerAutoSync();
      await triggerSyncIfOnline();
    };

    void bootstrap();

    return () => {
      isMounted = false;
      if (interval) {
        clearInterval(interval);
      }
      unsubscribe?.();
    };
  }, []);

  if (authLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </SafeAreaView>
    );
  }

  // Goedkeuring bouwtekening: iedereen mag dit zien, geen login vereist
  if (approveToken) {
    return <TekenGoedkeuringScreen token={approveToken} />;
  }

  // Invite flow: vakman opent /?join=TOKEN
  if (joinToken && !user) {
    return <JoinScreen token={joinToken} />;
  }

  if (!user) {
    return <LoginScreen onDevBypass={enableDevBypass} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} />
      {(user.role === 'VAKMAN' || user.role === 'VOORMAN') && <RejectionBanner />}
      {/* Sprint 6 — eerste-keer onboarding voor vakmannen */}
      {(user.role === 'VAKMAN' || user.role === 'VOORMAN') && <VakmanTutorialModal />}
      <ResponsiveLayout
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as Tab)}
        items={navItems}
        title={APP_TITLE}
        statusLabel={syncLabel}
        desktopSubtitle="Offline-first Wkb workflow voor desktop, laptop en mobiel."
        userName={user?.displayName ? user.displayName.split(' ')[0] : undefined}
      >
        {renderActiveTab()}
      </ResponsiveLayout>
    </SafeAreaView>
  );
}

const createOpleveringStyles = (
  theme: ReturnType<typeof useTheme>['theme']
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    switchRow: {
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 10,
      backgroundColor: theme.colors.background,
      padding: 4,
    },
    switchButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 10,
    },
    switchButtonActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    switchButtonText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'center',
    },
    switchButtonTextActive: {
      color: '#FFFFFF',
    },
    content: {
      flex: 1,
      overflow: 'hidden',
    },
  });

export default function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <ProjectProvider>
          <AppErrorBoundary>
            <PublicGate>
              <TenantGate>
                <AppShell />
              </TenantGate>
            </PublicGate>
          </AppErrorBoundary>
        </ProjectProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
