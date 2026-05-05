/**
 * ProjectPicker — slim project-switcher voor dagelijks gebruik.
 *
 * Patroon (bewezen in Jira / Linear / Asana):
 *   • Header toont huidig project + chevron → één tap
 *   • Modal opent met: zoekbalk · recente projecten · alle projecten
 *   • Recents opgeslagen in localStorage (max 3)
 *   • Bij 1 project: alleen naam, geen picker
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useProject } from '../context/ProjectContext';
import { useTheme } from '../theme/ThemeProvider';
import type { Project } from '../context/ProjectContext';

// ─── Recents helpers ──────────────────────────────────────────────────────────

const RECENTS_KEY = 'wkb_recent_projects';
const MAX_RECENTS = 3;

function loadRecents(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(projectId: string) {
  if (typeof window === 'undefined') return;
  try {
    const prev = loadRecents().filter((id) => id !== projectId);
    const next = [projectId, ...prev].slice(0, MAX_RECENTS);
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProjectPicker() {
  const { theme } = useTheme();
  const { projects, activeProject, setActiveProject, loadingProjects } = useProject();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [recentIds, setRecentIds] = useState<string[]>(() => loadRecents());
  const searchRef = useRef<TextInput>(null);

  // Focusseer zoekbalk zodra modal opent
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 150);
    } else {
      setQuery('');
    }
  }, [open]);

  const handleSelect = useCallback(
    (project: Project) => {
      setActiveProject(project);
      saveRecent(project.id);
      setRecentIds(loadRecents());
      setOpen(false);
    },
    [setActiveProject]
  );

  // Gefilterde lijst op zoekterm
  const filtered = useMemo(() => {
    if (!query.trim()) return projects;
    const q = query.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.address ?? '').toLowerCase().includes(q) ||
        (p.initiatorName ?? '').toLowerCase().includes(q)
    );
  }, [projects, query]);

  // Recente projecten (alleen als geen zoekterm)
  const recentProjects = useMemo(() => {
    if (query.trim()) return [];
    return recentIds
      .map((id) => projects.find((p) => p.id === id))
      .filter((p): p is Project => !!p && p.id !== activeProject.id);
  }, [recentIds, projects, query, activeProject.id]);

  // Overige projecten (zonder actief en recents)
  const otherProjects = useMemo(() => {
    if (query.trim()) return filtered;
    const excluded = new Set([activeProject.id, ...recentIds]);
    return projects.filter((p) => !excluded.has(p.id));
  }, [filtered, projects, activeProject.id, recentIds, query]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loadingProjects) {
    return (
      <View style={styles.header}>
        <ActivityIndicator size="small" color={theme.colors.accent} />
        <Text style={styles.headerSub}>Projecten laden…</Text>
      </View>
    );
  }

  // ── Enkel project — geen switcher ─────────────────────────────────────────
  if (projects.length <= 1) {
    return (
      <View style={styles.header}>
        <Text style={styles.headerLabel}>PROJECT</Text>
        <Text style={styles.headerName} numberOfLines={1}>
          {activeProject.name}
        </Text>
      </View>
    );
  }

  // ── Meerdere projecten — switcher knop ────────────────────────────────────
  return (
    <>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setOpen(true)}
        activeOpacity={0.75}
      >
        <View style={styles.headerInner}>
          <View style={styles.headerText}>
            <Text style={styles.headerLabel}>PROJECT</Text>
            <Text style={styles.headerName} numberOfLines={1}>
              {activeProject.name}
            </Text>
            {activeProject.address ? (
              <Text style={styles.headerAddress} numberOfLines={1}>
                {activeProject.address}
              </Text>
            ) : null}
          </View>
          <View style={styles.chevronBox}>
            <Text style={styles.chevron}>⌄</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* ── Modal ── */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View style={styles.sheet}>
          {/* Zoekbalk */}
          <View style={styles.searchRow}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              ref={searchRef}
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Zoek project op naam of adres…"
              placeholderTextColor={theme.colors.textSecondary + '88'}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {query ? (
              <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Actief project */}
          {!query.trim() && (
            <ProjectRow
              project={activeProject}
              isActive
              onPress={() => setOpen(false)}
              styles={styles}
              theme={theme}
            />
          )}

          {/* Recente projecten */}
          {recentProjects.length > 0 && !query.trim() && (
            <>
              <Text style={styles.sectionLabel}>Recent</Text>
              {recentProjects.map((p) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  isActive={false}
                  onPress={() => handleSelect(p)}
                  styles={styles}
                  theme={theme}
                />
              ))}
            </>
          )}

          {/* Alle / gefilterde projecten */}
          {(otherProjects.length > 0 || query.trim()) && (
            <>
              <Text style={styles.sectionLabel}>
                {query.trim() ? `${filtered.length} resultaten` : 'Alle projecten'}
              </Text>
              <FlatList
                data={query.trim() ? filtered : otherProjects}
                keyExtractor={(p) => p.id}
                renderItem={({ item }) => (
                  <ProjectRow
                    project={item}
                    isActive={item.id === activeProject.id}
                    onPress={() => handleSelect(item)}
                    styles={styles}
                    theme={theme}
                  />
                )}
                style={styles.list}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              />
            </>
          )}

          {query.trim() && filtered.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Geen projecten gevonden voor "{query}"</Text>
            </View>
          )}

          <TouchableOpacity style={styles.cancelBtn} onPress={() => setOpen(false)}>
            <Text style={styles.cancelBtnText}>Annuleren</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

// ─── Project rij ──────────────────────────────────────────────────────────────

type RowStyles = ReturnType<typeof createStyles>;

function ProjectRow({
  project,
  isActive,
  onPress,
  styles,
  theme,
}: {
  project: Project;
  isActive: boolean;
  onPress: () => void;
  styles: RowStyles;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  const initials = project.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <TouchableOpacity
      style={[styles.row, isActive && { backgroundColor: theme.colors.accent + '18' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.avatar,
          { backgroundColor: isActive ? theme.colors.accent : theme.colors.surface },
        ]}
      >
        <Text style={[styles.avatarText, { color: isActive ? '#fff' : theme.colors.textSecondary }]}>
          {initials}
        </Text>
      </View>
      <View style={styles.rowText}>
        <Text
          style={[styles.rowName, { color: isActive ? theme.colors.accent : theme.colors.textPrimary }]}
          numberOfLines={1}
        >
          {project.name}
        </Text>
        {project.address ? (
          <Text style={styles.rowAddress} numberOfLines={1}>
            {project.address}
          </Text>
        ) : project.initiatorName ? (
          <Text style={styles.rowAddress} numberOfLines={1}>
            {project.initiatorName}
          </Text>
        ) : null}
      </View>
      {isActive && <Text style={[styles.activeCheck, { color: theme.colors.accent }]}>✓</Text>}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    // ── Header (gesloten knop) ─────────────────────────────────────────────
    header: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    headerInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerText: { flex: 1 },
    headerLabel: {
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 2,
      color: theme.colors.textSecondary,
      marginBottom: 2,
    },
    headerName: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    headerAddress: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginTop: 1,
    },
    headerSub: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginLeft: 8,
    },
    chevronBox: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 12,
    },
    chevron: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },

    // ── Modal ─────────────────────────────────────────────────────────────
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
      position: 'absolute',
      top: Platform.OS === 'web' ? 56 : 100,
      left: 0,
      right: 0,
      maxHeight: '75%',
      backgroundColor: theme.colors.background,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 12,
      overflow: 'hidden',
    },

    // ── Zoekbalk ──────────────────────────────────────────────────────────
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      gap: 8,
    },
    searchIcon: { fontSize: 14 },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.textPrimary,
      paddingVertical: 0,
      outlineStyle: 'none',
    } as ReturnType<typeof StyleSheet.create>[string],
    clearBtn: { padding: 4 },
    clearBtnText: { fontSize: 12, color: theme.colors.textSecondary },

    // ── Sectielabels ──────────────────────────────────────────────────────
    sectionLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.5,
      color: theme.colors.textSecondary,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 4,
      textTransform: 'uppercase',
    },

    // ── Project rij ───────────────────────────────────────────────────────
    list: { maxHeight: 320 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 12,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 13, fontWeight: '800' },
    rowText: { flex: 1 },
    rowName: { fontSize: 13, fontWeight: '700' },
    rowAddress: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 1 },
    activeCheck: { fontSize: 16, fontWeight: '700' },

    // ── Leeg / Annuleren ──────────────────────────────────────────────────
    emptyBox: { padding: 24, alignItems: 'center' },
    emptyText: { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center' },
    cancelBtn: {
      margin: 12,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cancelBtnText: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  });
