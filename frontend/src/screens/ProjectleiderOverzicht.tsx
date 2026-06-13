/**
 * ProjectleiderOverzicht — desktop master-detail, mobile stack
 *
 * Desktop (≥768px):
 *   ┌──────────────┬──────────────────────────────────────┐
 *   │  Project-    │  Detail workspace                    │
 *   │  lijst       │  (Bewijs | Bonnen | Notities)        │
 *   │  280px       │  flex: 1                             │
 *   └──────────────┴──────────────────────────────────────┘
 *
 * Mobile (<768px):
 *   Kaartenoverzicht → klik → detail (full screen, terug-knop)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useProject, type Project } from '../context/ProjectContext';
import { useTheme } from '../theme/ThemeProvider';
import TenantBrandMark from '../components/TenantBrandMark';
import { EmptyProjectWizard } from '../components/ui/EmptyProjectWizard';
import ProjectAanmakenModal from '../components/ProjectAanmakenModal';
// SpeeQ-assets (alleen nog gebruikt op entry-screens; in-app draait op klant-branding).
const speeqLogoFull = require('../assets/speeq-logo-full.png');
const speeqQLogo    = require('../assets/speeq-q-logo.png');
const speeqQ3D      = require('../assets/speeq-q-3d.png');
const speeqLogo3D   = require('../assets/speeq-logo-3d.png');

// ─── Types ────────────────────────────────────────────────────────────────────

interface EvidenceRow {
  id: string;
  project_id: string | null;
  inspection_point_id: string | null;
  media_uri: string | null;
  photo_uri: string | null;
  timestamp: string | null;
  ai_status: string | null;
  sync_status: string | null;
  user_id: string | null;
  field_note?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface Bon {
  id: string;
  omschrijving: string;
  bedrag: string;
  datum: string;
  categorie: string;
  toegevoegd_door: string;
  notitie?: string;
}

interface ProjectStats {
  total: number;
  goedgekeurd: number;
  review: number;
  vandaag: number;
}

type DetailTab = 'bewijs' | 'bonnen' | 'notities';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isToday(ts: string | null): boolean {
  if (!ts) return false;
  try {
    return new Date(ts).toDateString() === new Date().toDateString();
  } catch { return false; }
}

function fmtDate(ts: string | null): string {
  if (!ts) return '—';
  try {
    return new Intl.DateTimeFormat('nl-NL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(ts));
  } catch { return ts; }
}

function aiBadge(status: string | null) {
  switch (status) {
    case 'PASSED':       return { bg: 'rgba(5,150,105,0.12)',  text: '#059669', label: '✓ Akkoord' };
    case 'FAILED':       return { bg: 'rgba(239,68,68,0.12)',  text: '#ef4444', label: '✗ Afgekeurd' };
    case 'NEEDS_REVIEW': return { bg: 'rgba(245,158,11,0.12)', text: '#d97706', label: '⚠ Review' };
    default:             return { bg: 'rgba(148,163,184,0.1)', text: '#64748b', label: '● Pending' };
  }
}

function syncColor(s: string | null) {
  if (s === 'SYNCED' || s === 'synced') return '#059669';
  if (s === 'FAILED' || s === 'error')  return '#ef4444';
  return '#d97706';
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function ProjectleiderOverzicht() {
  const { theme } = useTheme();
  const isDark = theme.name === 'dark';
  const { projects, setActiveProject } = useProject();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [allEvidence, setAllEvidence] = useState<EvidenceRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  // showCreate state staat in DesktopLayout (waar modal rendert) — zie regel ~278.

  const projectIds = useMemo(() => projects.map(p => p.id), [projects]);

  const loadAll = useCallback(async () => {
    if (!projectIds.length) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('evidence')
        .select('id, project_id, inspection_point_id, media_uri, photo_uri, timestamp, ai_status, sync_status, user_id, field_note, latitude, longitude')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false })
        .limit(500);
      setAllEvidence((data ?? []) as EvidenceRow[]);
    } catch { /* stil */ }
    finally { setLoading(false); }
  }, [projectIds]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const statsMap = useMemo(() => {
    const map = new Map<string, ProjectStats>();
    for (const p of projects) map.set(p.id, { total: 0, goedgekeurd: 0, review: 0, vandaag: 0 });
    for (const e of allEvidence) {
      if (!e.project_id) continue;
      const s = map.get(e.project_id);
      if (!s) continue;
      s.total++;
      if (e.ai_status === 'PASSED')       s.goedgekeurd++;
      if (e.ai_status === 'NEEDS_REVIEW') s.review++;
      if (isToday(e.timestamp))           s.vandaag++;
    }
    return map;
  }, [allEvidence, projects]);

  const detailEvidence = useMemo(() =>
    selectedProject
      ? allEvidence.filter(e => e.project_id === selectedProject.id)
      : [],
  [allEvidence, selectedProject]);

  // Totalen voor hero KPI strip (mobile + desktop welcome panel)
  const totals = useMemo(() => {
    let total = 0, review = 0, vandaag = 0, goedgekeurd = 0;
    for (const s of statsMap.values()) {
      total       += s.total;
      review      += s.review;
      vandaag     += s.vandaag;
      goedgekeurd += s.goedgekeurd;
    }
    return { total, review, vandaag, goedgekeurd, projectCount: projects.length };
  }, [statsMap, projects.length]);

  const handleSelect = useCallback((p: Project) => {
    setSelectedProject(p);
    setActiveProject(p);
  }, [setActiveProject]);

  // ── Desktop: master-detail ──────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <DesktopLayout
        projects={projects}
        statsMap={statsMap}
        loading={loading}
        selectedProject={selectedProject}
        detailEvidence={detailEvidence}
        onSelect={handleSelect}
        onProjectUpdated={(updated) => setSelectedProject(updated)}
        theme={theme}
        isDark={isDark}
        totals={totals}
      />
    );
  }

  // ── Mobile: stack navigatie ─────────────────────────────────────────────────
  const styles = createMobileStyles(theme, isDark);

  if (selectedProject) {
    const stats = statsMap.get(selectedProject.id) ?? { total: 0, goedgekeurd: 0, review: 0, vandaag: 0 };
    return (
      <DetailPanel
        project={selectedProject}
        stats={stats}
        evidence={detailEvidence}
        onBack={() => setSelectedProject(null)}
        onProjectUpdated={(updated) => setSelectedProject(updated)}
        theme={theme}
        isDark={isDark}
        isDesktop={false}
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <HeroCard totals={totals} theme={theme} />
        <KpiStrip totals={totals} theme={theme} />
        {loading ? (
          <View style={styles.centeredBox}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {projects.map(p => (
              <ProjectListItem
                key={p.id}
                project={p}
                stats={statsMap.get(p.id) ?? { total: 0, goedgekeurd: 0, review: 0, vandaag: 0 }}
                isActive={false}
                onPress={() => handleSelect(p)}
                theme={theme}
                compact={false}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Desktop layout ───────────────────────────────────────────────────────────

interface Totals {
  total: number;
  review: number;
  vandaag: number;
  goedgekeurd: number;
  projectCount: number;
}

interface DesktopLayoutProps {
  projects: Project[];
  statsMap: Map<string, ProjectStats>;
  loading: boolean;
  selectedProject: Project | null;
  detailEvidence: EvidenceRow[];
  onSelect: (p: Project) => void;
  onProjectUpdated: (p: Project) => void;
  theme: { name?: string; colors: Record<string, string> };
  isDark: boolean;
  totals: Totals;
}

function DesktopLayout({ projects, statsMap, loading, selectedProject, detailEvidence, onSelect, onProjectUpdated, theme, isDark, totals }: DesktopLayoutProps) {
  const [search, setSearch] = useState('');
  /** Per Johnny 25 mei: "+ Nieuw project" voorop in hero ipv achter modal. */
  const [showCreate, setShowCreate] = useState(false);
  /** Forceer refresh van projectenlijst na aanmaken (loadAll zit in parent). */
  const { refreshProjects } = useProject();

  const filtered = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.address ?? '').toLowerCase().includes(q)
    );
  }, [projects, search]);

  const totalPhotos   = useMemo(() => [...statsMap.values()].reduce((a, s) => a + s.total, 0), [statsMap]);
  const totalReview   = useMemo(() => [...statsMap.values()].reduce((a, s) => a + s.review, 0), [statsMap]);
  const totalVandaag  = useMemo(() => [...statsMap.values()].reduce((a, s) => a + s.vandaag, 0), [statsMap]);

  return (
    <View style={[desktopSt.root, { backgroundColor: theme.colors.background }]}>

      {/* ── Sidebar ── */}
      <View style={[desktopSt.sidebar, { backgroundColor: theme.colors.surface, borderRightColor: theme.colors.border }]}>

        {/* Sidebar header */}
        <View style={[desktopSt.sidebarHeader, { borderBottomColor: theme.colors.border }]}>
          <Text style={[desktopSt.sidebarTitle, { color: theme.colors.textPrimary }]}>📋 Projecten</Text>
          <Text style={[desktopSt.sidebarSub, { color: theme.colors.textSecondary }]}>
            {projects.length} projecten
          </Text>

          {/* Snelle totalen */}
          <View style={desktopSt.summaryRow}>
            <View style={desktopSt.summaryPill}>
              <Text style={[desktopSt.summaryNum, { color: theme.colors.accent }]}>{totalPhotos}</Text>
              <Text style={[desktopSt.summaryLabel, { color: theme.colors.textSecondary }]}>foto's</Text>
            </View>
            {totalReview > 0 && (
              <View style={[desktopSt.summaryPill, { backgroundColor: 'rgba(217,119,6,0.1)' }]}>
                <Text style={[desktopSt.summaryNum, { color: '#d97706' }]}>{totalReview}</Text>
                <Text style={[desktopSt.summaryLabel, { color: '#d97706' }]}>review</Text>
              </View>
            )}
            {totalVandaag > 0 && (
              <View style={[desktopSt.summaryPill, { backgroundColor: 'rgba(5,150,105,0.1)' }]}>
                <Text style={[desktopSt.summaryNum, { color: '#059669' }]}>{totalVandaag}</Text>
                <Text style={[desktopSt.summaryLabel, { color: '#059669' }]}>vandaag</Text>
              </View>
            )}
          </View>

          {/* Zoekbalk */}
          <View style={[desktopSt.searchWrap, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
            <Text style={desktopSt.searchIcon}>🔍</Text>
            <TextInput
              style={[desktopSt.searchInput, { color: theme.colors.textPrimary, outlineStyle: 'none' } as ReturnType<typeof StyleSheet.create>[string]]}
              value={search}
              onChangeText={setSearch}
              placeholder="Zoek project..."
              placeholderTextColor={theme.colors.textSecondary + '88'}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Project lijst */}
        {loading ? (
          <View style={desktopSt.loadingBox}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        ) : (
          <ScrollView style={desktopSt.list} showsVerticalScrollIndicator={false}>
            {filtered.length === 0 ? (
              <View style={desktopSt.loadingBox}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Geen resultaten</Text>
              </View>
            ) : (
              filtered.map(p => (
                <ProjectListItem
                  key={p.id}
                  project={p}
                  stats={statsMap.get(p.id) ?? { total: 0, goedgekeurd: 0, review: 0, vandaag: 0 }}
                  isActive={selectedProject?.id === p.id}
                  onPress={() => onSelect(p)}
                  theme={theme}
                  compact
                />
              ))
            )}
          </ScrollView>
        )}
      </View>

      {/* ── Detail paneel ── */}
      <View style={desktopSt.detail}>
        {selectedProject ? (
          <DetailPanel
            project={selectedProject}
            stats={statsMap.get(selectedProject.id) ?? { total: 0, goedgekeurd: 0, review: 0, vandaag: 0 }}
            evidence={detailEvidence}
            onBack={undefined}
            onProjectUpdated={onProjectUpdated}
            theme={theme}
            isDark={isDark}
            isDesktop
          />
        ) : (
          <WelcomePanel
            theme={theme}
            projectCount={projects.length}
            totals={totals}
            onCreate={() => setShowCreate(true)}
          />
        )}
      </View>

      {/* "+ Nieuw project" modal — globaal in deze screen, opent vanuit hero. */}
      <ProjectAanmakenModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          // Forceer refresh van projects-context — KPI/lijst werken bij.
          void refreshProjects();
        }}
        theme={theme as any}
      />
    </View>
  );
}

// ─── Welcome panel (lege staat desktop) ──────────────────────────────────────

function WelcomePanel({ theme, projectCount, totals, onCreate }: { theme: { colors: Record<string, string> }; projectCount: number; totals: Totals; onCreate?: () => void }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 32, paddingBottom: 60, maxWidth: 980, alignSelf: 'center', width: '100%' }}>
      {/* Hero card — tonen de klant-branding (logo + bedrijfsnaam) i.p.v. SpeeQ.
          Geen klant-branding ingesteld? Dan tonen we alleen de tekst, zonder logo. */}
      <View style={[welcomeSt.heroCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={welcomeSt.heroRow}>
          <TenantBrandMark size="lg" showName={false} theme={theme as any} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[welcomeSt.eyebrow, { color: theme.colors.textSecondary }]}>PORTEFEUILLE</Text>
            <Text style={[welcomeSt.heroTitle, { color: theme.colors.textPrimary }]}>Projectoverzicht</Text>
            <Text style={[welcomeSt.heroSub, { color: theme.colors.textSecondary }]}>
              {projectCount} project{projectCount !== 1 ? 'en' : ''} · alle lopende dossiers en kwaliteitsborgingen.
            </Text>
          </View>
          {/* Prominente "+ Nieuw project" CTA — Johnny 25 mei: "voorop, niet
              achter een deur". onCreate-callback bubbelt naar parent. */}
          {onCreate ? (
            <TouchableOpacity
              onPress={onCreate}
              activeOpacity={0.85}
              style={{
                backgroundColor: theme.colors.accent,
                paddingHorizontal: 18,
                paddingVertical: 12,
                borderRadius: 10,
                alignSelf: 'flex-start',
                marginLeft: 'auto' as unknown as number,
              }}
              accessibilityRole="button"
              accessibilityLabel="Nieuw project aanmaken"
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
                + Nieuw project
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* KPI strip */}
      <View style={{ marginTop: 16 }}>
        <KpiStrip totals={totals} theme={theme} />
      </View>

      {/* Onboarding hint */}
      <View style={{ marginTop: 28, padding: 24, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 12 }}>
          👈 Kies een project in de lijst links
        </Text>
        <View style={{ gap: 10 }}>
          {[
            { icon: '📸', label: 'Bewijsstukken bekijken & annoteren' },
            { icon: '📄', label: 'Bonnen registreren per categorie' },
            { icon: '📝', label: 'Projectnotities bijhouden' },
            { icon: '✏️', label: 'Projectgegevens bewerken' },
          ].map(item => (
            <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 18 }}>{item.icon}</Text>
              <Text style={{ fontSize: 13, color: theme.colors.textSecondary }}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

// ─── ProjectListItem ──────────────────────────────────────────────────────────

interface ProjectListItemProps {
  project: Project;
  stats: ProjectStats;
  isActive: boolean;
  onPress: () => void;
  theme: { colors: Record<string, string> };
  compact: boolean;
}

function ProjectListItem({ project, stats, isActive, onPress, theme, compact }: ProjectListItemProps) {
  const ini = initials(project.name);
  const pct = stats.total > 0 ? Math.round((stats.goedgekeurd / stats.total) * 100) : 0;
  const hasReview = stats.review > 0;

  if (compact) {
    // Sidebar rij
    return (
      <TouchableOpacity
        style={[
          sidebarItemSt.row,
          isActive && { backgroundColor: theme.colors.accent + '18' },
          { borderLeftColor: isActive ? theme.colors.accent : 'transparent' },
        ]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={[sidebarItemSt.avatar, { backgroundColor: isActive ? theme.colors.accent : theme.colors.accent + '22' }]}>
          <Text style={[sidebarItemSt.avatarText, { color: isActive ? '#fff' : theme.colors.accent }]}>{ini}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={[sidebarItemSt.name, { color: isActive ? theme.colors.accent : theme.colors.textPrimary }]}
            numberOfLines={1}
          >
            {project.name}
          </Text>
          {project.address ? (
            <Text style={[sidebarItemSt.address, { color: theme.colors.textSecondary }]} numberOfLines={1}>
              {project.address}
            </Text>
          ) : null}
          {/* Mini stats */}
          <View style={sidebarItemSt.miniStats}>
            <Text style={[sidebarItemSt.miniStat, { color: theme.colors.textSecondary }]}>
              {stats.total} foto's
            </Text>
            {hasReview && (
              <View style={sidebarItemSt.reviewDot}>
                <Text style={sidebarItemSt.reviewDotText}>{stats.review}</Text>
              </View>
            )}
          </View>
        </View>
        {isActive && <Text style={{ color: theme.colors.accent, fontSize: 14 }}>›</Text>}
      </TouchableOpacity>
    );
  }

  // Mobile kaart
  return (
    <TouchableOpacity
      style={[
        cardSt.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: hasReview ? '#d97706' : theme.colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={cardSt.header}>
        <View style={[cardSt.avatar, { backgroundColor: theme.colors.accent + '22' }]}>
          <Text style={[cardSt.avatarText, { color: theme.colors.accent }]}>{ini}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[cardSt.name, { color: theme.colors.textPrimary }]} numberOfLines={2}>{project.name}</Text>
          {project.address ? (
            <Text style={[cardSt.address, { color: theme.colors.textSecondary }]} numberOfLines={1}>📍 {project.address}</Text>
          ) : null}
        </View>
        {hasReview && (
          <View style={cardSt.reviewBadge}>
            <Text style={cardSt.reviewBadgeText}>{stats.review}</Text>
          </View>
        )}
      </View>
      {/* ── Eén-regel status — was 4-stats grid + progress bar.
          Per Johnny ultraplan 25 mei: "naam + stoplicht + 1 knop".
          Detail-paneel toont nog steeds alle stats — hier alleen kern. */}
      {stats.total > 0 ? (
        <View style={[cardSt.progressWrap, { borderTopColor: theme.colors.border, borderTopWidth: 1, paddingTop: 10 }]}>
          <View style={[cardSt.progressBg, { backgroundColor: theme.colors.border }]}>
            <View style={[cardSt.progressFill, { width: `${pct}%` as `${number}%` }]} />
          </View>
          <Text style={[cardSt.progressLabel, { color: theme.colors.textSecondary }]}>
            {stats.goedgekeurd} van {stats.total} goedgekeurd
            {stats.review > 0 ? ` · ${stats.review} wachten op review` : ''}
          </Text>
        </View>
      ) : (
        <View style={[{ borderTopColor: theme.colors.border, borderTopWidth: 1, paddingTop: 10 }]}>
          <Text style={[cardSt.progressLabel, { color: theme.colors.textSecondary }]}>
            Nog geen foto's
          </Text>
        </View>
      )}
      <Text style={[cardSt.arrow, { color: theme.colors.textSecondary }]}>Open project →</Text>
    </TouchableOpacity>
  );
}

// ─── DetailPanel ──────────────────────────────────────────────────────────────

interface DetailPanelProps {
  project: Project;
  stats: ProjectStats;
  evidence: EvidenceRow[];
  onBack: (() => void) | undefined;
  onProjectUpdated: (p: Project) => void;
  theme: { name?: string; colors: Record<string, string> };
  isDark: boolean;
  isDesktop: boolean;
}

function DetailPanel({ project, stats, evidence, onBack, onProjectUpdated, theme, isDark, isDesktop }: DetailPanelProps) {
  // Gebruik centrale rename-helper voor consistente UI updates over alle
  // schermen (projectlijst + header + picker). Fix voor "rename werkt in
  // header maar niet in projectenlijst" (Johnny 24 mei).
  const { renameProject, refreshProjects } = useProject();
  const [activeTab, setActiveTab] = useState<DetailTab>('bewijs');

  // Edit header state
  const [editing, setEditing]         = useState(false);
  const [editName, setEditName]       = useState(project.name);
  const [editAddress, setEditAddress] = useState(project.address ?? '');
  const [headerSaving, setHeaderSaving] = useState(false);
  const [headerError, setHeaderError]   = useState<string | null>(null);

  // Reset edit state als project verandert
  useEffect(() => {
    setEditName(project.name);
    setEditAddress(project.address ?? '');
    setEditing(false);
    setHeaderError(null);
    setActiveTab('bewijs');
  }, [project.id]);

  const saveHeader = async () => {
    setHeaderSaving(true);
    setHeaderError(null);
    try {
      // Naam → via centrale renameProject (optimistic + DB + refresh)
      // zodat ProjectPicker, kop-header en projectenlijst allemaal updaten.
      const ok = await renameProject(project.id, editName);
      if (!ok) throw new Error('rename mislukt');
      // Adres apart updaten (geen aparte helper) en refresh
      if (editAddress !== project.address) {
        const { error } = await supabase
          .from('projects')
          .update({ address: editAddress })
          .eq('id', project.id);
        if (error) throw error;
        await refreshProjects();
      }
      onProjectUpdated({ ...project, name: editName, address: editAddress });
      setEditing(false);
    } catch {
      setHeaderError('Opslaan mislukt.');
    } finally {
      setHeaderSaving(false);
    }
  };

  const TABS: { id: DetailTab; label: string; count?: number }[] = [
    { id: 'bewijs',   label: '📸 Bewijs',   count: evidence.length },
    { id: 'bonnen',   label: '📄 Bonnen' },
    { id: 'notities', label: '📝 Notities' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: isDesktop ? 28 : 16,
          paddingBottom: 60,
          maxWidth: 860,
          alignSelf: 'center',
          width: '100%',
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Terug (alleen mobile) */}
        {onBack && (
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 }}
            onPress={onBack}
          >
            <Text style={{ fontSize: 20, color: theme.colors.accent }}>←</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.accent }}>Alle projecten</Text>
          </TouchableOpacity>
        )}

        {/* Project header */}
        <View style={[detailSt.headerCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={detailSt.headerTop}>
            <View style={[detailSt.headerAvatar, { backgroundColor: theme.colors.accent + '22' }]}>
              <Text style={[detailSt.headerAvatarText, { color: theme.colors.accent }]}>
                {initials(project.name)}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              {editing ? (
                <View style={{ gap: 8 }}>
                  <TextInput
                    style={[detailSt.editInput, { color: theme.colors.textPrimary, borderColor: theme.colors.accent, backgroundColor: theme.colors.background }]}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Projectnaam"
                    placeholderTextColor={theme.colors.textSecondary}
                  />
                  <TextInput
                    style={[detailSt.editInputSm, { color: theme.colors.textPrimary, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                    value={editAddress}
                    onChangeText={setEditAddress}
                    placeholder="Adres"
                    placeholderTextColor={theme.colors.textSecondary}
                  />
                  {headerError ? <Text style={{ color: '#ef4444', fontSize: 12 }}>{headerError}</Text> : null}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={[detailSt.btnSm, { backgroundColor: theme.colors.accent }]}
                      onPress={saveHeader}
                      disabled={headerSaving}
                    >
                      <Text style={detailSt.btnSmText}>{headerSaving ? 'Opslaan…' : '✓ Opslaan'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[detailSt.btnSm, { backgroundColor: theme.colors.border }]}
                      onPress={() => { setEditing(false); setHeaderError(null); }}
                    >
                      <Text style={[detailSt.btnSmText, { color: theme.colors.textPrimary }]}>Annuleren</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={[detailSt.projectName, { color: theme.colors.textPrimary }]} numberOfLines={2}>
                    {project.name}
                  </Text>
                  <Text style={[detailSt.projectMeta, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                    {[project.address && `📍 ${project.address}`, project.initiatorName && `👤 ${project.initiatorName}`].filter(Boolean).join('  ·  ')}
                  </Text>
                </>
              )}
            </View>
            {!editing && (
              <TouchableOpacity
                style={[detailSt.editBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                onPress={() => setEditing(true)}
              >
                <Text style={[detailSt.editBtnText, { color: theme.colors.textPrimary }]}>✏️ Bewerken</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Stats strip */}
          <View style={[detailSt.statsStrip, { borderTopColor: theme.colors.border }]}>
            {[
              { label: "Foto's",     value: stats.total,       color: theme.colors.textPrimary },
              { label: 'Vandaag',    value: stats.vandaag,     color: theme.colors.accent },
              { label: 'Goedgekeurd',value: stats.goedgekeurd, color: '#059669' },
              { label: 'Review',     value: stats.review,      color: stats.review > 0 ? '#d97706' : theme.colors.textSecondary },
            ].map(s => (
              <View key={s.label} style={detailSt.statItem}>
                <Text style={[detailSt.statNum, { color: s.color }]}>{s.value}</Text>
                <Text style={[detailSt.statLabel, { color: theme.colors.textSecondary }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Tabs */}
        <View style={[detailSt.tabRow, { borderBottomColor: theme.colors.border }]}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[detailSt.tabItem, activeTab === tab.id && detailSt.tabItemActive]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[detailSt.tabLabel, { color: activeTab === tab.id ? theme.colors.accent : theme.colors.textSecondary }]}>
                  {tab.label}
                </Text>
                {tab.count !== undefined && tab.count > 0 && (
                  <View style={[detailSt.tabBadge, { backgroundColor: activeTab === tab.id ? theme.colors.accent : theme.colors.border }]}>
                    <Text style={[detailSt.tabBadgeText, { color: activeTab === tab.id ? '#fff' : theme.colors.textSecondary }]}>
                      {tab.count}
                    </Text>
                  </View>
                )}
              </View>
              {activeTab === tab.id && (
                <View style={[detailSt.tabUnderline, { backgroundColor: theme.colors.accent }]} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab inhoud */}
        {activeTab === 'bewijs'   && <BewijsTab evidence={evidence} theme={theme} isDark={isDark} projectId={project.id} />}
        {activeTab === 'bonnen'   && <BonnenTab projectId={project.id} theme={theme} />}
        {activeTab === 'notities' && <NotitiesTab projectId={project.id} theme={theme} />}

      </ScrollView>
    </View>
  );
}

// ─── Tab: Bewijs ─────────────────────────────────────────────────────────────

function BewijsTab({ evidence, theme, isDark, projectId }: { evidence: EvidenceRow[]; theme: { colors: Record<string, string> }; isDark: boolean; projectId?: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteMap, setNoteMap]       = useState<Record<string, string>>({});
  const [savingId, setSavingId]     = useState<string | null>(null);
  const [savedId, setSavedId]       = useState<string | null>(null);

  if (evidence.length === 0) {
    return (
      <View style={tabSt.emptyBox}>
        <EmptyProjectWizard projectId={projectId} />
      </View>
    );
  }

  const saveNote = async (item: EvidenceRow) => {
    const note = noteMap[item.id] ?? item.field_note ?? '';
    setSavingId(item.id);
    try {
      await supabase.from('evidence').update({ field_note: note }).eq('id', item.id);
      setSavedId(item.id);
      setTimeout(() => setSavedId(prev => prev === item.id ? null : prev), 3000);
    } catch { /* stil */ }
    finally { setSavingId(null); }
  };

  return (
    <View style={{ gap: 8 }}>
      {evidence.map(item => {
        const badge  = aiBadge(item.ai_status);
        const uri    = item.media_uri ?? item.photo_uri ?? null;
        const isOpen = expandedId === item.id;
        const note   = noteMap[item.id] !== undefined ? noteMap[item.id] : (item.field_note ?? '');

        return (
          <View key={item.id} style={[tabSt.evidenceCard, { backgroundColor: theme.colors.surface, borderColor: isOpen ? theme.colors.accent : theme.colors.border }]}>
            <TouchableOpacity
              style={tabSt.evidenceRow}
              onPress={() => setExpandedId(isOpen ? null : item.id)}
              activeOpacity={0.75}
            >
              <View style={{ position: 'relative', flexShrink: 0 }}>
                {uri
                  ? <Image source={{ uri }} style={tabSt.thumb} resizeMode="cover" />
                  : <View style={[tabSt.thumbEmpty, { backgroundColor: theme.colors.border }]}><Text style={{ fontSize: 18 }}>📷</Text></View>
                }
                <View style={[tabSt.syncDot, { backgroundColor: syncColor(item.sync_status), borderColor: isDark ? '#111' : '#fff' }]} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[tabSt.evidencePid, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                  {item.inspection_point_id ?? '—'}
                </Text>
                <Text style={[tabSt.evidenceMeta, { color: theme.colors.textSecondary }]}>🕐 {fmtDate(item.timestamp)}</Text>
                {item.field_note ? (
                  <Text style={[tabSt.evidenceMeta, { color: theme.colors.textSecondary }]} numberOfLines={1}>📝 {item.field_note}</Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <View style={[tabSt.aiBadge, { backgroundColor: badge.bg }]}>
                  <Text style={[tabSt.aiBadgeText, { color: badge.text }]}>{badge.label}</Text>
                </View>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>{isOpen ? '▲' : '▼'}</Text>
              </View>
            </TouchableOpacity>

            {isOpen && (
              <View style={[tabSt.expanded, { borderTopColor: theme.colors.border }]}>
                {uri && <Image source={{ uri }} style={tabSt.thumbLarge} resizeMode="cover" />}
                <View style={{ gap: 4, marginTop: 8 }}>
                  {item.latitude != null && item.longitude != null && (
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>📍 GPS: {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}</Text>
                  )}
                  {item.user_id && (
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>👤 {item.user_id}</Text>
                  )}
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>Status: <Text style={{ color: badge.text }}>{badge.label}</Text></Text>
                </View>
                <TextInput
                  style={[tabSt.noteInput, { color: theme.colors.textPrimary, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                  value={note}
                  onChangeText={text => setNoteMap(prev => ({ ...prev, [item.id]: text }))}
                  placeholder="Jouw aantekening bij dit bewijsstuk..."
                  placeholderTextColor={theme.colors.textSecondary}
                  multiline
                />
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 }}>
                  <TouchableOpacity
                    style={[tabSt.btnSm, { backgroundColor: theme.colors.accent }]}
                    onPress={() => saveNote(item)}
                    disabled={savingId === item.id}
                  >
                    <Text style={tabSt.btnSmText}>{savingId === item.id ? 'Opslaan…' : 'Opslaan'}</Text>
                  </TouchableOpacity>
                  {savedId === item.id && <Text style={{ color: '#059669', fontSize: 12, fontWeight: '600' }}>✓ Opgeslagen</Text>}
                  <TouchableOpacity style={{ marginLeft: 'auto' as unknown as number }} onPress={() => setExpandedId(null)}>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>Inklappen ▲</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Tab: Bonnen ─────────────────────────────────────────────────────────────

const CATEGORIEEN = ['Materiaal', 'Arbeid', 'Transport', 'Overig'];

function BonnenTab({ projectId, theme }: { projectId: string; theme: { colors: Record<string, string> } }) {
  const [bonnen, setBonnen]       = useState<Bon[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const [form, setForm] = useState({ omschrijving: '', bedrag: '', datum: '', categorie: 'Materiaal', door: '', notitie: '' });

  const loadBonnen = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('projects').select('bonnen').eq('id', projectId).single();
      const raw = (data as { bonnen?: unknown } | null)?.bonnen;
      setBonnen(Array.isArray(raw) ? (raw as Bon[]) : []);
    } catch { setBonnen([]); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { void loadBonnen(); }, [loadBonnen]);

  const persist = async (updated: Bon[]) => {
    const { error } = await supabase.from('projects').update({ bonnen: updated }).eq('id', projectId);
    if (error) throw error;
    setBonnen(updated);
  };

  const addBon = async () => {
    if (!form.omschrijving.trim()) { setError('Omschrijving is verplicht.'); return; }
    setSaving(true);
    setError(null);
    try {
      const bon: Bon = { id: genId(), omschrijving: form.omschrijving.trim(), bedrag: form.bedrag.trim(), datum: form.datum.trim(), categorie: form.categorie, toegevoegd_door: form.door.trim(), notitie: form.notitie.trim() || undefined };
      await persist([...bonnen, bon]);
      setShowForm(false);
      setForm({ omschrijving: '', bedrag: '', datum: '', categorie: 'Materiaal', door: '', notitie: '' });
    } catch { setError('Opslaan mislukt.'); }
    finally { setSaving(false); }
  };

  const deleteBon = async (id: string) => {
    try { await persist(bonnen.filter(b => b.id !== id)); } catch { /* stil */ }
  };

  const catColor = (cat: string) => {
    switch (cat) {
      case 'Materiaal':  return { bg: 'rgba(99,102,241,0.12)',  text: '#6366f1' };
      case 'Arbeid':     return { bg: 'rgba(5,150,105,0.12)',   text: '#059669' };
      case 'Transport':  return { bg: 'rgba(245,158,11,0.12)',  text: '#d97706' };
      default:           return { bg: 'rgba(148,163,184,0.12)', text: '#64748b' };
    }
  };

  if (loading) return <View style={tabSt.emptyBox}><ActivityIndicator color={theme.colors.accent} /></View>;

  return (
    <View style={{ gap: 10 }}>
      {bonnen.length === 0 && !showForm ? (
        <View style={tabSt.emptyBox}>
          <Text style={{ fontSize: 40 }}>🧾</Text>
          <Text style={[tabSt.emptyTitle, { color: theme.colors.textPrimary }]}>Nog geen bonnen</Text>
          <Text style={[tabSt.emptyBody, { color: theme.colors.textSecondary }]}>
            Registreer hier kosten per categorie: materiaal, arbeid of transport.
          </Text>
        </View>
      ) : (
        bonnen.map(bon => {
          const cc = catColor(bon.categorie);
          return (
            <View key={bon.id} style={[tabSt.bonCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: theme.colors.textPrimary, fontWeight: '700', fontSize: 14 }}>{bon.omschrijving}</Text>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {bon.bedrag ? <Text style={{ color: theme.colors.textPrimary, fontWeight: '800', fontSize: 15 }}>{bon.bedrag}</Text> : null}
                  {bon.datum  ? <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>📅 {bon.datum}</Text> : null}
                  <View style={[tabSt.aiBadge, { backgroundColor: cc.bg }]}>
                    <Text style={[tabSt.aiBadgeText, { color: cc.text }]}>{bon.categorie}</Text>
                  </View>
                </View>
                {bon.toegevoegd_door ? <Text style={{ color: theme.colors.textSecondary, fontSize: 11 }}>👤 {bon.toegevoegd_door}</Text> : null}
                {bon.notitie ? <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>📝 {bon.notitie}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => deleteBon(bon.id)} style={{ padding: 4 }}>
                <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: '700' }}>×</Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}

      {!showForm && (
        <TouchableOpacity
          style={[tabSt.addBtn, { borderColor: theme.colors.accent }]}
          onPress={() => setShowForm(true)}
        >
          <Text style={[tabSt.addBtnText, { color: theme.colors.accent }]}>＋ Bon toevoegen</Text>
        </TouchableOpacity>
      )}

      {showForm && (
        <View style={[tabSt.bonForm, { backgroundColor: theme.colors.surface, borderColor: theme.colors.accent }]}>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: '800', fontSize: 14, marginBottom: 10 }}>Nieuwe bon</Text>
          {[
            { key: 'omschrijving', placeholder: 'Omschrijving *' },
            { key: 'bedrag',       placeholder: 'Bedrag (bijv. € 450,00)' },
            { key: 'datum',        placeholder: 'Datum (bijv. 2-5-2026)' },
            { key: 'door',         placeholder: 'Toegevoegd door' },
            { key: 'notitie',      placeholder: 'Notitie (optioneel)' },
          ].map(f => (
            <TextInput
              key={f.key}
              style={[tabSt.formInput, { color: theme.colors.textPrimary, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
              value={(form as Record<string, string>)[f.key]}
              onChangeText={v => setForm(prev => ({ ...prev, [f.key]: v }))}
              placeholder={f.placeholder}
              placeholderTextColor={theme.colors.textSecondary}
            />
          ))}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginVertical: 4 }}>
            {CATEGORIEEN.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[tabSt.catChip, { backgroundColor: form.categorie === cat ? theme.colors.accent : theme.colors.border }]}
                onPress={() => setForm(prev => ({ ...prev, categorie: cat }))}
              >
                <Text style={{ color: form.categorie === cat ? '#fff' : theme.colors.textPrimary, fontSize: 12, fontWeight: '600' }}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {error ? <Text style={{ color: '#ef4444', fontSize: 12 }}>{error}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={[tabSt.btnSm, { backgroundColor: theme.colors.accent }]} onPress={addBon} disabled={saving}>
              <Text style={tabSt.btnSmText}>{saving ? 'Opslaan…' : 'Opslaan'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[tabSt.btnSm, { backgroundColor: theme.colors.border }]} onPress={() => { setShowForm(false); setError(null); }}>
              <Text style={[tabSt.btnSmText, { color: theme.colors.textPrimary }]}>Annuleren</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Tab: Notities ────────────────────────────────────────────────────────────

function NotitiesTab({ projectId, theme }: { projectId: string; theme: { colors: Record<string, string> } }) {
  const [notes, setNotes]   = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let ok = true;
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from('projects').select('notes').eq('id', projectId).single();
        if (ok) setNotes((data as { notes?: string | null } | null)?.notes ?? '');
      } catch { /* stil */ }
      finally { if (ok) setLoading(false); }
    };
    void load();
    return () => { ok = false; };
  }, [projectId]);

  const saveNotes = async () => {
    setSaving(true);
    setError(null);
    try {
      const { error } = await supabase.from('projects').update({ notes }).eq('id', projectId);
      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { setError('Opslaan mislukt.'); }
    finally { setSaving(false); }
  };

  if (loading) return <View style={tabSt.emptyBox}><ActivityIndicator color={theme.colors.accent} /></View>;

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 13, color: theme.colors.textSecondary, lineHeight: 20 }}>
        Gebruik dit veld voor afspraken, bijzonderheden en opmerkingen die bij dit project horen. Wordt automatisch opgeslagen.
      </Text>
      <TextInput
        style={[tabSt.notesInput, { color: theme.colors.textPrimary, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
        value={notes}
        onChangeText={setNotes}
        onBlur={saveNotes}
        placeholder="Schrijf hier je projectnotities..."
        placeholderTextColor={theme.colors.textSecondary}
        multiline
        textAlignVertical="top"
      />
      {error ? <Text style={{ color: '#ef4444', fontSize: 12 }}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <TouchableOpacity style={[tabSt.btnSm, { backgroundColor: theme.colors.accent }]} onPress={saveNotes} disabled={saving}>
          <Text style={tabSt.btnSmText}>{saving ? 'Opslaan…' : 'Opslaan'}</Text>
        </TouchableOpacity>
        {saved && <Text style={{ color: '#059669', fontSize: 12, fontWeight: '600' }}>✓ Opgeslagen</Text>}
      </View>
    </View>
  );
}

// ─── HeroCard (mobile) ────────────────────────────────────────────────────────
//   Hero blok bovenaan de mobiele projectenlijst — Lovable Govtech stijl.
//   Toont SpeeQ logo + titel + korte status-zin. Q-logo wordt subtiel als
//   watermerk rechtsboven gerendered (opacity ~7%).

function HeroCard({ totals, theme }: { totals: Totals; theme: { colors: Record<string, string> } }) {
  const statusLine =
    totals.review > 0
      ? `${totals.review} bewijsstuk${totals.review !== 1 ? 'ken' : ''} vraagt review`
      : totals.total > 0
        ? `${totals.total} foto${totals.total !== 1 ? "'s" : ''} verwerkt`
        : 'Nog geen bewijsstukken — vaklieden uploaden via mobiel';

  return (
    <View style={[heroSt.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={heroSt.row}>
        <TenantBrandMark size="lg" showName={false} theme={theme as any} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[heroSt.eyebrow, { color: theme.colors.textSecondary }]}>PORTEFEUILLE</Text>
          <Text style={[heroSt.title, { color: theme.colors.textPrimary }]}>Projectoverzicht</Text>
          <Text style={[heroSt.subtitle, { color: theme.colors.textSecondary }]} numberOfLines={2}>
            {totals.projectCount} project{totals.projectCount !== 1 ? 'en' : ''} · {statusLine}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── KpiStrip ─────────────────────────────────────────────────────────────────
//   4 KPI cellen op een rij — projecten, vandaag, akkoord, review.
//   Lovable's "border-grid" stijl: alle cellen op witte achtergrond met
//   1px scheiding via een gemeenschappelijke border container.

function KpiStrip({ totals, theme }: { totals: Totals; theme: { colors: Record<string, string> } }) {
  const items: { label: string; value: number; dot: string; tone?: 'warning' | 'success' }[] = [
    { label: 'PROJECTEN', value: totals.projectCount, dot: theme.colors.accent, tone: 'success' },
    { label: 'VANDAAG',   value: totals.vandaag,      dot: theme.colors.accent },
    { label: 'AKKOORD',   value: totals.goedgekeurd,  dot: '#7CB94B', tone: 'success' },
    { label: 'REVIEW',    value: totals.review,       dot: totals.review > 0 ? '#D97706' : theme.colors.textSecondary, tone: totals.review > 0 ? 'warning' : undefined },
  ];

  return (
    <View style={[kpiSt.wrap, { backgroundColor: theme.colors.border, borderColor: theme.colors.border }]}>
      {items.map(it => (
        <View key={it.label} style={[kpiSt.cell, { backgroundColor: theme.colors.surface }]}>
          <View style={kpiSt.dotRow}>
            <View style={[kpiSt.dot, { backgroundColor: it.dot }]} />
            <Text style={[kpiSt.label, { color: theme.colors.textSecondary }]}>{it.label}</Text>
          </View>
          <Text style={[
            kpiSt.value,
            { color: it.tone === 'warning' ? '#D97706' : theme.colors.textPrimary },
          ]}>
            {it.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

// Hero card (mobile + desktop welcome)
const heroSt = StyleSheet.create({
  card:       { borderRadius: 16, borderWidth: 1, padding: 18, position: 'relative', overflow: 'hidden' },
  watermark:  { position: 'absolute', right: -24, top: -24, width: 140, height: 140, opacity: 0.07 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logo:       { width: 96, height: 96 },
  eyebrow:    { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  title:      { fontSize: 22, fontWeight: '900', letterSpacing: -0.5, marginTop: 2, marginBottom: 4 },
  subtitle:   { fontSize: 13, lineHeight: 19 },
});

// KPI strip (4 cells)
const kpiSt = StyleSheet.create({
  wrap:       { flexDirection: 'row', borderRadius: 12, borderWidth: 1, gap: 1, overflow: 'hidden' },
  cell:       { flex: 1, paddingVertical: 14, paddingHorizontal: 12, gap: 6 },
  dotRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:        { width: 6, height: 6, borderRadius: 3 },
  label:      { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  value:      { fontSize: 26, fontWeight: '800', letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
});

// Welcome panel (desktop, geen project gekozen)
const welcomeSt = StyleSheet.create({
  heroCard:    { borderRadius: 16, borderWidth: 1, padding: 28, position: 'relative', overflow: 'hidden' },
  watermark:   { position: 'absolute', right: -40, top: -40, width: 220, height: 220, opacity: 0.07 },
  heroRow:     { flexDirection: 'row', alignItems: 'center', gap: 24 },
  heroLogo:    { width: 140, height: 140 },
  eyebrow:     { fontSize: 11, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase' },
  heroTitle:   { fontSize: 36, fontFamily: '"Bricolage Grotesque", "Plus Jakarta Sans", system-ui, sans-serif', fontWeight: '700', letterSpacing: -1.2, marginTop: 4, marginBottom: 6 },
  heroSub:     { fontSize: 14, lineHeight: 22, maxWidth: 560 },
});

// Desktop root
const desktopSt = StyleSheet.create({
  root:          { flex: 1, flexDirection: 'row' },
  sidebar:       { width: 300, borderRightWidth: 1, flexShrink: 0 },
  sidebarHeader: { padding: 16, borderBottomWidth: 1, gap: 4 },
  sidebarTitle:  { fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  sidebarSub:    { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  summaryRow:    { flexDirection: 'row', gap: 6, marginTop: 8, marginBottom: 4 },
  summaryPill:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, backgroundColor: 'rgba(148,163,184,0.1)' },
  summaryNum:    { fontSize: 13, fontWeight: '800' },
  summaryLabel:  { fontSize: 11, fontWeight: '600' },
  searchWrap:    { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  searchIcon:    { fontSize: 12 },
  searchInput:   { flex: 1, fontSize: 13 },
  list:          { flex: 1 },
  loadingBox:    { padding: 24, alignItems: 'center' },
  detail:        { flex: 1, overflow: 'hidden' },
});

// Sidebar lijst item
const sidebarItemSt = StyleSheet.create({
  row:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderLeftWidth: 3 },
  avatar:       { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:   { fontSize: 13, fontWeight: '800' },
  name:         { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  address:      { fontSize: 11, marginTop: 1 },
  miniStats:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  miniStat:     { fontSize: 10, fontWeight: '500' },
  reviewDot:    { backgroundColor: '#d97706', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  reviewDotText:{ color: '#fff', fontSize: 9, fontWeight: '800' },
});

// Mobile kaart
const cardSt = StyleSheet.create({
  card:         { borderRadius: 16, borderWidth: 1.5, overflow: 'hidden' },
  header:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  avatar:       { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:   { fontSize: 16, fontWeight: '800' },
  name:         { fontSize: 14, fontWeight: '800', lineHeight: 20, marginBottom: 3 },
  address:      { fontSize: 11 },
  reviewBadge:  { backgroundColor: '#d97706', borderRadius: 10, minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  reviewBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  statsRow:     { flexDirection: 'row', borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  stat:         { flex: 1, alignItems: 'center', gap: 2 },
  statNum:      { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  statLabel:    { fontSize: 10, fontWeight: '600' },
  progressWrap: { paddingHorizontal: 14, paddingBottom: 4, gap: 3 },
  progressBg:   { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: '#059669' },
  progressLabel:{ fontSize: 10 },
  arrow:        { paddingHorizontal: 14, paddingBottom: 12, paddingTop: 6, fontSize: 12, fontWeight: '600' },
});

// Detail panel
const detailSt = StyleSheet.create({
  headerCard:     { borderRadius: 16, borderWidth: 1, marginBottom: 16, overflow: 'hidden' },
  headerTop:      { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 16 },
  headerAvatar:   { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerAvatarText:{ fontSize: 20, fontWeight: '800' },
  projectName:    { fontSize: 20, fontWeight: '900', letterSpacing: -0.3, lineHeight: 26, marginBottom: 4 },
  projectMeta:    { fontSize: 12 },
  editBtn:        { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, flexShrink: 0 },
  editBtnText:    { fontSize: 13, fontWeight: '600' },
  editInput:      { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 17, fontWeight: '800' },
  editInputSm:    { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, fontSize: 14 },
  btnSm:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnSmText:      { color: '#fff', fontSize: 13, fontWeight: '700' },
  statsStrip:     { flexDirection: 'row', borderTopWidth: 1 },
  statItem:       { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 3 },
  statNum:        { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  statLabel:      { fontSize: 10, fontWeight: '600' },
  tabRow:         { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 16 },
  tabItem:        { paddingHorizontal: 16, paddingVertical: 10, position: 'relative' },
  tabItemActive:  {},
  tabLabel:       { fontSize: 14, fontWeight: '700' },
  tabBadge:       { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, minWidth: 18, alignItems: 'center' },
  tabBadgeText:   { fontSize: 10, fontWeight: '800' },
  tabUnderline:   { position: 'absolute', bottom: -1, left: 16, right: 16, height: 2, borderRadius: 1 },
});

// Tab shared
const tabSt = StyleSheet.create({
  emptyBox:       { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyTitle:     { fontSize: 16, fontWeight: '800' },
  emptyBody:      { fontSize: 13, textAlign: 'center', maxWidth: 320, lineHeight: 20 },
  evidenceCard:   { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  evidenceRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  thumb:          { width: 52, height: 52, borderRadius: 8 },
  thumbEmpty:     { width: 52, height: 52, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  thumbLarge:     { width: '100%', height: 180, borderRadius: 10 },
  syncDot:        { position: 'absolute', bottom: 2, right: 2, width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },
  evidencePid:    { fontSize: 13, fontWeight: '700' },
  evidenceMeta:   { fontSize: 11 },
  aiBadge:        { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  aiBadgeText:    { fontSize: 11, fontWeight: '700' },
  expanded:       { borderTopWidth: 1, padding: 12, gap: 6 },
  noteInput:      { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, minHeight: 72, marginTop: 8 },
  bonCard:        { borderRadius: 14, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  addBtn:         { borderWidth: 1.5, borderStyle: 'dashed' as const, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  addBtnText:     { fontSize: 14, fontWeight: '700' },
  bonForm:        { borderWidth: 1.5, borderRadius: 14, padding: 16, gap: 8 },
  formInput:      { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13 },
  catChip:        { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  notesInput:     { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 14, minHeight: 200, lineHeight: 22 },
  btnSm:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnSmText:      { color: '#fff', fontSize: 13, fontWeight: '700' },
});

// Mobile container
function createMobileStyles(theme: { colors: Record<string, string> }, _isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scroll:    { flex: 1 },
    content:   { padding: 16, paddingBottom: 60, gap: 10 },
    pageTitle:    { fontSize: 22, fontWeight: '900', color: theme.colors.textPrimary, letterSpacing: -0.5, marginBottom: 4 },
    pageSubtitle: { fontSize: 13, marginBottom: 16 },
    centeredBox:  { alignItems: 'center', paddingVertical: 48 },
  });
}
