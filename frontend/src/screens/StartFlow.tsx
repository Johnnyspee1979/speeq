/**
 * StartFlow — snelle startwizard voor veldgebruik (steiger, bouw, dirty hands).
 *
 * Stap 1: Opdrachtgever kiezen  (groot, direct bij openen)
 * Stap 2: Project kiezen        (adres + naam)
 * Stap 3: Discipline kiezen     (full-width kaarten)
 * Stap 4: Borgingspunt kiezen
 * → onSelectTask(task) → Camera opent
 *
 * Shortcut: "Direct borgingspunt kiezen" slaat stap 1-2 over.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme/ThemeProvider';
import { useProject } from '../context/ProjectContext';
import { useWkbAuth } from '../hooks/useWkbAuth';
import { wkbTaskTemplates } from '../data/WkbTemplates';
import type { CaptureTask } from '../types/CaptureTask';
import type { Project } from '../context/ProjectContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type FlowStep = 'welkom' | 'klant' | 'project' | 'discipline' | 'locatie' | 'verdieping' | 'borgingspunt';
type BinnenBuiten = 'BINNEN' | 'BUITEN';

interface Klant {
  name: string;
  projectCount: number;
}

interface DisciplineCard {
  id: string;
  emoji: string;
  label: string;
  sublabel: string;
  color: string;
  taskCount: number;
}

// ─── Discipline definitie ─────────────────────────────────────────────────────

const DISCIPLINES: DisciplineCard[] = [
  {
    id: 'BOUW',
    emoji: '🏗️',
    label: 'Bouw & Constructie',
    sublabel: 'Funderingen, wanden, vloeren, dak',
    color: '#92400E',
    taskCount: 0,
  },
  {
    id: 'BOUWFYSICA',
    emoji: '🌡️',
    label: 'Isolatie & Bouwfysica',
    sublabel: 'Warmte, vocht, geluid',
    color: '#1E40AF',
    taskCount: 0,
  },
  {
    id: 'BRANDVEILIGHEID',
    emoji: '🔥',
    label: 'Brandveiligheid',
    sublabel: 'Compartimentering, vluchtwegen',
    color: '#DC2626',
    taskCount: 0,
  },
  {
    id: 'INSTALLATIE',
    emoji: '🔧',
    label: 'Sanitair & Installatie',
    sublabel: 'Water, CV, ventilatie',
    color: '#0369A1',
    taskCount: 0,
  },
  {
    id: 'ELEKTRA',
    emoji: '⚡',
    label: 'Elektra & Bedrading',
    sublabel: 'Groepen, aarding, metingen',
    color: '#D97706',
    taskCount: 0,
  },
  {
    id: 'AFBOUW_SCHILDER',
    emoji: '🖌️',
    label: 'Afbouw & Schilder',
    sublabel: 'Afwerking, kit, verf',
    color: '#059669',
    taskCount: 0,
  },
];

function enrichDisciplines(): DisciplineCard[] {
  return DISCIPLINES.map((d) => ({
    ...d,
    taskCount: wkbTaskTemplates.filter(
      (t) => t.categoryId === d.id || (t.categoryId === 'STRUCTURAL' && d.id === 'BOUW')
    ).length,
  }));
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StartFlowResumeContext {
  project: { id: string; name: string; address: string | null; initiatorName: string | null };
  disciplineId: string;
  locatie: BinnenBuiten;
  verdieping: string;
}

interface StartFlowProps {
  onSelectTask: (task: CaptureTask, context: StartFlowResumeContext) => void;
  resumeContext?: StartFlowResumeContext | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StartFlow({ onSelectTask, resumeContext }: StartFlowProps) {
  const { theme } = useTheme();
  const isDark = theme.name === 'dark';
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const styles = useMemo(() => createStyles(theme, isDark, isDesktop), [theme, isDark, isDesktop]);

  const { user } = useWkbAuth();
  const { setActiveProject } = useProject();

  // ── Flow state (initialiseer vanuit resumeContext als beschikbaar) ───────────
  const [step, setStep] = useState<FlowStep>(() => resumeContext ? 'borgingspunt' : 'welkom');
  const [selectedKlant, setSelectedKlant] = useState<Klant | null>(() =>
    resumeContext ? { name: resumeContext.project.initiatorName ?? resumeContext.project.name, projectCount: 1 } : null
  );
  const [selectedProject, setSelectedProject] = useState<Project | null>(() =>
    resumeContext ? { id: resumeContext.project.id, name: resumeContext.project.name, address: resumeContext.project.address, initiatorName: resumeContext.project.initiatorName } : null
  );
  const [selectedDiscipline, setSelectedDiscipline] = useState<DisciplineCard | null>(() =>
    resumeContext ? (DISCIPLINES.find(d => d.id === resumeContext.disciplineId) ?? null) : null
  );
  const [selectedLocatie, setSelectedLocatie] = useState<BinnenBuiten>(() => resumeContext?.locatie ?? 'BINNEN');
  const [selectedVerdieping, setSelectedVerdieping] = useState<string>(() => resumeContext?.verdieping ?? 'BG');

  // Herstel actief project als we vanuit context terugkomen
  useEffect(() => {
    if (resumeContext) {
      setActiveProject({
        id: resumeContext.project.id,
        name: resumeContext.project.name,
        address: resumeContext.project.address,
        initiatorName: resumeContext.project.initiatorName,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Data ────────────────────────────────────────────────────────────────────
  const [klanten, setKlanten] = useState<Klant[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingKlanten, setLoadingKlanten] = useState(false);

  const disciplines = useMemo(() => enrichDisciplines(), []);

  const borgingspunten = useMemo(() => {
    if (!selectedDiscipline) return [];
    return wkbTaskTemplates.filter(
      (t) =>
        t.categoryId === selectedDiscipline.id ||
        (selectedDiscipline.id === 'BOUW' && t.categoryId === 'STRUCTURAL')
    );
  }, [selectedDiscipline]);

  // Laad klanten bij eerste render
  useEffect(() => {
    setLoadingKlanten(true);
    void supabase
      .from('projects')
      .select('id, name, address, initiator_name')
      .then(({ data }) => {
        if (!data) return;
        const map = new Map<string, { name: string; count: number; rows: typeof data }>();
        for (const p of data) {
          const key = (p.initiator_name as string | null) ?? 'Onbekende opdrachtgever';
          if (!map.has(key)) map.set(key, { name: key, count: 0, rows: [] });
          const entry = map.get(key)!;
          entry.count += 1;
          entry.rows.push(p);
        }
        setKlanten([...map.values()].map((e) => ({ name: e.name, projectCount: e.count })));
        setProjects(
          data.map((p) => ({
            id: p.id as string,
            name: (p.name as string | null) ?? (p.id as string),
            address: p.address as string | null,
            initiatorName: p.initiator_name as string | null,
          }))
        );
      })
      .then(() => setLoadingKlanten(false), () => setLoadingKlanten(false));
  }, []);

  // ── Navigatie helpers ───────────────────────────────────────────────────────

  const goTo = useCallback((s: FlowStep) => setStep(s), []);

  const handleSelectKlant = useCallback((klant: Klant) => {
    setSelectedKlant(klant);
    // Auto-advance als er maar 1 project is
    const klantProjects = projects.filter(
      (p) => (p.initiatorName ?? 'Onbekende opdrachtgever') === klant.name
    );
    if (klantProjects.length === 1) {
      setSelectedProject(klantProjects[0]);
      setActiveProject(klantProjects[0]);
      goTo('discipline');
    } else {
      goTo('project');
    }
  }, [goTo, projects, setActiveProject]);

  const handleSelectProject = useCallback((project: Project) => {
    setSelectedProject(project);
    setActiveProject(project);
    goTo('discipline');
  }, [goTo, setActiveProject]);

  const handleSelectDiscipline = useCallback((disc: DisciplineCard) => {
    setSelectedDiscipline(disc);
    goTo('locatie');
  }, [goTo]);

  const handleSelectBorgingspunt = useCallback((template: typeof wkbTaskTemplates[0]) => {
    const task: CaptureTask = {
      id: template.id,
      title: template.title,
      description: template.description,
      inspectionPointId: template.inspectionPointId,
      instruction: template.instruction,
      standards: template.standards,
      disciplineTitle: template.disciplineTitle,
      requiresExif: template.requiresExif,
      requiresMeasurementTool: template.requiresMeasurementTool,
      selectionSource: 'WKB',
      defaultBinnenBuiten: selectedLocatie,
      defaultEtage: selectedVerdieping,
    };
    const context: StartFlowResumeContext = {
      project: {
        id: selectedProject?.id ?? '',
        name: selectedProject?.name ?? '',
        address: selectedProject?.address ?? null,
        initiatorName: selectedProject?.initiatorName ?? null,
      },
      disciplineId: selectedDiscipline?.id ?? '',
      locatie: selectedLocatie,
      verdieping: selectedVerdieping,
    };
    onSelectTask(task, context);
  }, [onSelectTask, selectedProject, selectedDiscipline, selectedLocatie, selectedVerdieping]);

  // Voornaam: display_name → eerste deel van email
  const firstName = useMemo(() => {
    if (!user) return null;
    if (user.displayName) return user.displayName.split(' ')[0];
    return user.email.split('@')[0];
  }, [user]);

  // ─── Render stap: Welkom ────────────────────────────────────────────────────
  if (step === 'welkom') {
    return (
      <View style={styles.screen}>
        <View style={styles.welcomeInner}>
          {/* Logo */}
          <View style={styles.welcomeLogoRow}>
            <Text style={[styles.welcomeLogoText, { color: theme.colors.textPrimary }]}>WKB</Text>
            <View style={[styles.welcomeLogoBadge, { backgroundColor: theme.colors.accent }]}>
              <Text style={styles.welcomeLogoBadgeText}>Snap & Sync</Text>
            </View>
          </View>

          <Text style={[styles.welcomeMadeBy, { color: theme.colors.textSecondary }]}>
            Made by Spee Solutions
          </Text>

          {firstName ? (
            <Text style={[styles.welcomeGreeting, { color: theme.colors.textPrimary }]}>
              Hallo {firstName},
            </Text>
          ) : null}
          <Text style={[styles.welcomeSubline, { color: theme.colors.textSecondary }]}>
            {firstName ? 'Gaan we documenteren vandaag?' : 'Gaan we documenteren vandaag?'}
          </Text>

          {/* Primary button */}
          <TouchableOpacity
            style={[styles.welcomeMainBtn, { backgroundColor: theme.colors.accent }]}
            onPress={() => goTo('klant')}
            activeOpacity={0.85}
          >
            <Text style={styles.welcomeMainBtnText}>Naar mijn werkruimte →</Text>
          </TouchableOpacity>

          {/* Shortcut */}
          <TouchableOpacity
            style={[styles.welcomeShortcut, { borderColor: theme.colors.border }]}
            onPress={() => goTo('discipline')}
            activeOpacity={0.8}
          >
            <Text style={[styles.welcomeShortcutText, { color: theme.colors.accent }]}>
              ⚡ Direct een borgingspunt kiezen
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Render stap: Opdrachtgever ─────────────────────────────────────────────

  if (step === 'klant') {
    return (
      <View style={styles.screen}>
        <StepBar
          title="Opdrachtgever"
          subtitle="Voor wie werk je vandaag?"
          onBack={() => goTo('welkom')}
          theme={theme}
        />

        {/* Sectie label */}
        <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
          OPDRACHTGEVER
        </Text>

        {loadingKlanten ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={theme.colors.accent} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
              Laden…
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            {klanten.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                  Geen opdrachtgevers gevonden.{'\n'}Voeg eerst een project toe via de desktop.
                </Text>
              </View>
            ) : null}
            {klanten.map((klant) => {
              const initials = klant.name
                .split(' ')
                .map((w) => w[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
              return (
                <TouchableOpacity
                  key={klant.name}
                  style={[styles.bigCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                  onPress={() => handleSelectKlant(klant)}
                  activeOpacity={0.82}
                >
                  <View style={[styles.avatar, { backgroundColor: `${theme.colors.accent}18` }]}>
                    <Text style={[styles.avatarText, { color: theme.colors.accent }]}>{initials}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                      {klant.name}
                    </Text>
                    <Text style={[styles.cardSub, { color: theme.colors.textSecondary }]}>
                      {klant.projectCount} {klant.projectCount === 1 ? 'project' : 'projecten'}
                    </Text>
                  </View>
                  <Text style={[styles.arrow, { color: theme.colors.textSecondary }]}>›</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  }

  // ─── Render stap: Project ───────────────────────────────────────────────────

  if (step === 'project') {
    const klantProjects = projects.filter(
      (p) => (p.initiatorName ?? 'Onbekende opdrachtgever') === selectedKlant?.name
    );
    return (
      <View style={styles.screen}>
        <StepBar
          title="Project kiezen"
          subtitle={selectedKlant?.name ?? ''}
          onBack={() => goTo('klant')}
          theme={theme}
        />
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {klantProjects.map((project) => (
            <TouchableOpacity
              key={project.id}
              style={[styles.bigCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={() => handleSelectProject(project)}
              activeOpacity={0.82}
            >
              <View style={[styles.avatar, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                <Text style={styles.avatarEmoji}>🏢</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]} numberOfLines={2}>
                  {project.name}
                </Text>
                {project.address ? (
                  <Text style={[styles.cardSub, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                    📍 {project.address}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.arrow, { color: theme.colors.textSecondary }]}>›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  // ─── Render stap: Discipline ────────────────────────────────────────────────

  if (step === 'discipline') {
    return (
      <View style={styles.screen}>
        <StepBar
          title="Discipline kiezen"
          subtitle={selectedProject?.name ?? 'Geen project gekozen'}
          onBack={() => goTo(selectedProject ? 'project' : 'klant')}
          theme={theme}
        />
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {disciplines.map((disc) => (
            <TouchableOpacity
              key={disc.id}
              style={[
                styles.disciplineCard,
                {
                  backgroundColor: isDark ? `${disc.color}1A` : `${disc.color}0D`,
                  borderColor: `${disc.color}55`,
                },
              ]}
              onPress={() => handleSelectDiscipline(disc)}
              activeOpacity={0.82}
            >
              <Text style={styles.discEmoji}>{disc.emoji}</Text>
              <View style={styles.cardInfo}>
                <Text style={[styles.cardTitle, { color: disc.color }]}>{disc.label}</Text>
                <Text style={[styles.cardSub, { color: theme.colors.textSecondary }]}>
                  {disc.sublabel} · {disc.taskCount} punten
                </Text>
              </View>
              <Text style={[styles.arrow, { color: disc.color }]}>›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  // ─── Render stap: Locatie (Binnen / Buiten) ─────────────────────────────────

  if (step === 'locatie') {
    return (
      <View style={styles.screen}>
        <StepBar
          title="Binnen of buiten?"
          subtitle={selectedDiscipline?.label ?? ''}
          onBack={() => goTo('discipline')}
          theme={theme}
        />
        <View style={styles.locatieScreen}>
          <TouchableOpacity
            style={[
              styles.locatieCard,
              selectedLocatie === 'BINNEN' && styles.locatieCardActive,
              {
                backgroundColor: selectedLocatie === 'BINNEN'
                  ? `${theme.colors.accent}18`
                  : theme.colors.surface,
                borderColor: selectedLocatie === 'BINNEN'
                  ? theme.colors.accent
                  : theme.colors.border,
              },
            ]}
            onPress={() => setSelectedLocatie('BINNEN')}
            activeOpacity={0.82}
          >
            <Text style={styles.locatieEmoji}>🏠</Text>
            <Text style={[styles.locatieLabel, {
              color: selectedLocatie === 'BINNEN' ? theme.colors.accent : theme.colors.textPrimary,
            }]}>
              Binnen
            </Text>
            <Text style={[styles.locatieSub, { color: theme.colors.textSecondary }]}>
              Binnenwerk, installaties, afbouw
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.locatieCard,
              selectedLocatie === 'BUITEN' && styles.locatieCardActive,
              {
                backgroundColor: selectedLocatie === 'BUITEN'
                  ? `${theme.colors.accent}18`
                  : theme.colors.surface,
                borderColor: selectedLocatie === 'BUITEN'
                  ? theme.colors.accent
                  : theme.colors.border,
              },
            ]}
            onPress={() => setSelectedLocatie('BUITEN')}
            activeOpacity={0.82}
          >
            <Text style={styles.locatieEmoji}>🌤️</Text>
            <Text style={[styles.locatieLabel, {
              color: selectedLocatie === 'BUITEN' ? theme.colors.accent : theme.colors.textPrimary,
            }]}>
              Buiten
            </Text>
            <Text style={[styles.locatieSub, { color: theme.colors.textSecondary }]}>
              Gevel, dak, buitenwerk
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.locatieNextBtn, { backgroundColor: theme.colors.accent }]}
            onPress={() => goTo(selectedLocatie === 'BINNEN' ? 'verdieping' : 'borgingspunt')}
            activeOpacity={0.85}
          >
            <Text style={styles.locatieNextBtnText}>
              {selectedLocatie === 'BINNEN' ? '🏠 Binnen — volgende →' : '🌤️ Buiten — direct naar borgingspunt →'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Render stap: Verdieping ────────────────────────────────────────────────

  if (step === 'verdieping') {
    return (
      <View style={styles.screen}>
        <StepBar
          title="Welke verdieping?"
          subtitle="🏠 Binnen"
          onBack={() => goTo('locatie')}
          theme={theme}
        />
        <View style={styles.verdiepingContent}>
          <Text style={[styles.verdiepingHint, { color: theme.colors.textSecondary }]}>
            Typ je verdieping — bijv. BG, -1, -2, 3, 17, 21
          </Text>
          <TextInput
            style={[
              styles.verdiepingInput,
              {
                backgroundColor: theme.colors.surface,
                borderColor: selectedVerdieping.trim() ? theme.colors.accent : theme.colors.border,
                color: theme.colors.textPrimary,
              },
            ]}
            value={selectedVerdieping}
            onChangeText={setSelectedVerdieping}
            placeholder="bijv. BG of 17"
            placeholderTextColor={theme.colors.textSecondary}
            keyboardType="default"
            autoCapitalize="characters"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => { if (selectedVerdieping.trim()) goTo('borgingspunt'); }}
          />
        </View>
        <View style={styles.verdiepingFooter}>
          <TouchableOpacity
            style={[
              styles.locatieNextBtn,
              { backgroundColor: selectedVerdieping.trim() ? theme.colors.accent : theme.colors.border },
            ]}
            onPress={() => { if (selectedVerdieping.trim()) goTo('borgingspunt'); }}
            activeOpacity={0.85}
          >
            <Text style={styles.locatieNextBtnText}>
              {selectedVerdieping.trim() ? `Verdieping ${selectedVerdieping} — volgende →` : 'Voer verdieping in'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Render stap: Borgingspunt ──────────────────────────────────────────────

  return (
    <View style={styles.screen}>
      <StepBar
        title={selectedDiscipline?.label ?? 'Borgingspunten'}
        subtitle={`${selectedLocatie === 'BINNEN' ? `🏠 Binnen · ${selectedVerdieping}` : '🌤️ Buiten'} · ${selectedDiscipline?.label ?? ''}`}
        onBack={() => goTo(selectedLocatie === 'BINNEN' ? 'verdieping' : 'locatie')}
        theme={theme}
      />
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {borgingspunten.map((task) => (
          <TouchableOpacity
            key={task.id}
            style={[styles.bigCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => handleSelectBorgingspunt(task)}
            activeOpacity={0.82}
          >
            <View style={[
              styles.avatar,
              { backgroundColor: selectedDiscipline ? `${selectedDiscipline.color}18` : theme.colors.border }
            ]}>
              <Text style={styles.avatarEmoji}>{selectedDiscipline?.emoji ?? '📋'}</Text>
            </View>
            <View style={styles.cardInfo}>
              <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]} numberOfLines={2}>
                {task.title}
              </Text>
              {task.stopMoment ? (
                <View style={styles.stopBadge}>
                  <Text style={styles.stopBadgeText}>🛑 {task.stopMoment}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.arrow, { color: theme.colors.textSecondary }]}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── StepBar — kleine terugknop + context ─────────────────────────────────────

function StepBar({
  title,
  subtitle,
  onBack,
  theme,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <View style={[stepBarStyles.wrapper, {
      backgroundColor: theme.colors.background,
      borderBottomColor: theme.colors.border,
    }]}>
      {/* Terugknop */}
      <TouchableOpacity onPress={onBack} style={stepBarStyles.back} activeOpacity={0.7}>
        <Text style={[stepBarStyles.backText, { color: theme.colors.accent }]}>← Terug</Text>
      </TouchableOpacity>
      {/* Breadcrumb: discipline boven de titel */}
      {subtitle ? (
        <Text style={[stepBarStyles.breadcrumb, { color: theme.colors.textSecondary }]} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
      {/* Staptitel */}
      <Text style={[stepBarStyles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
    </View>
  );
}

const stepBarStyles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  back: { marginBottom: 4 },
  backText: { fontSize: 14, fontWeight: '700' },
  breadcrumb: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (
  theme: ReturnType<typeof useTheme>['theme'],
  isDark: boolean,
  isDesktop: boolean,
) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },

    // ── Welcome ──
    welcomeInner: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      maxWidth: 480,
      alignSelf: 'center',
      width: '100%',
    },
    welcomeLogoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 8,
    },
    welcomeLogoText: {
      fontSize: 48,
      fontWeight: '900',
      letterSpacing: -2,
    },
    welcomeLogoBadge: {
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    welcomeLogoBadgeText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '800',
    },
    welcomeMadeBy: {
      fontSize: 13,
      fontWeight: '500',
      marginBottom: 20,
    },
    welcomeGreeting: {
      fontSize: 26,
      fontWeight: '900',
      marginBottom: 6,
    },
    welcomeSubline: {
      fontSize: 16,
      fontWeight: '500',
      marginBottom: 36,
    },
    welcomeMainBtn: {
      width: '100%',
      borderRadius: 16,
      paddingVertical: 20,
      alignItems: 'center',
      marginBottom: 14,
    },
    welcomeMainBtnText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '800',
    },
    welcomeShortcut: {
      width: '100%',
      borderRadius: 12,
      borderWidth: 1.5,
      paddingVertical: 16,
      alignItems: 'center',
    },
    welcomeShortcutText: {
      fontSize: 15,
      fontWeight: '700',
    },

    // ── Sectielabel ──
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.8,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
    },

    // ── Loading ──
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 32,
      justifyContent: 'center',
    },
    loadingText: { fontSize: 15 },

    // ── Lijst container ──
    list: {
      padding: 16,
      gap: 10,
      maxWidth: isDesktop ? 700 : undefined,
      alignSelf: isDesktop ? 'center' : undefined,
      width: isDesktop ? '100%' : undefined,
    },

    // ── Grote kaart (opdrachtgever, project, borgingspunt) ──
    bigCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 18,
      gap: 14,
      minHeight: 76,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    avatarText: {
      fontSize: 18,
      fontWeight: '900',
    },
    avatarEmoji: { fontSize: 24 },
    cardInfo: { flex: 1 },
    cardTitle: {
      fontSize: 17,
      fontWeight: '800',
      lineHeight: 22,
      marginBottom: 3,
    },
    cardSub: {
      fontSize: 13,
      lineHeight: 18,
    },
    arrow: {
      fontSize: 26,
      fontWeight: '300',
      marginLeft: 4,
    },

    // ── Discipline kaart (full width) ──
    disciplineCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      borderWidth: 1.5,
      paddingHorizontal: 16,
      paddingVertical: 18,
      gap: 14,
      minHeight: 76,
    },
    discEmoji: { fontSize: 28, flexShrink: 0 },

    // ── Stop moment badge ──
    stopBadge: {
      marginTop: 6,
      backgroundColor: 'rgba(220,38,38,0.1)',
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      alignSelf: 'flex-start',
    },
    stopBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#DC2626',
    },

    // ── Locatie (Binnen / Buiten) ──
    locatieScreen: {
      flex: 1,
      padding: 16,
      paddingTop: 28,
      gap: 12,
      justifyContent: 'center',
      maxWidth: isDesktop ? 500 : undefined,
      alignSelf: isDesktop ? 'center' : undefined,
      width: isDesktop ? '100%' : undefined,
    },
    locatieCard: {
      borderRadius: 16,
      borderWidth: 2,
      paddingVertical: 20,
      paddingHorizontal: 20,
      alignItems: 'center',
      gap: 6,
      justifyContent: 'center',
      overflow: 'hidden',
    },
    locatieCardActive: {},
    locatieEmoji: { fontSize: 34 },
    locatieLabel: {
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    locatieSub: {
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 18,
    },
    locatieNextBtn: {
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
      marginTop: 4,
    },
    locatieNextBtnText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '800',
    },

    // ── Verdieping ──
    verdiepingContent: {
      flex: 1,
      padding: 20,
      maxWidth: isDesktop ? 500 : undefined,
      alignSelf: isDesktop ? 'center' : undefined,
      width: isDesktop ? 500 : '100%',
    },
    verdiepingHint: {
      fontSize: 13,
      marginBottom: 14,
      fontWeight: '500',
    },
    verdiepingInput: {
      borderWidth: 2,
      borderRadius: 16,
      paddingHorizontal: 20,
      paddingVertical: 22,
      fontSize: 36,
      fontWeight: '900',
      textAlign: 'center',
    },
    verdiepingFooter: {
      padding: 16,
      paddingTop: 8,
    },

    // ── Leeg ──
    emptyBox: {
      padding: 24,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 22,
    },
  });
