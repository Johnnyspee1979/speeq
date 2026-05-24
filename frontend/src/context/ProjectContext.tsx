/**
 * ProjectContext — actief project voor de hele app.
 *
 * Laadt alle projecten uit Supabase bij inloggen.
 * Slaat de keuze op in localStorage zodat na refresh het project
 * geselecteerd blijft.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase } from '../lib/supabase';
import { DEFAULT_PROJECT_ID, DEFAULT_PROJECT_NAME } from '../config/app';
import { getActiveTenantId } from '../config/tenant';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  address?: string | null;
  initiatorName?: string | null;
}

interface ProjectContextType {
  /** Het actief geselecteerde project */
  activeProject: Project;
  /** Zet het actieve project (en sla op in localStorage) */
  setActiveProject: (project: Project) => void;
  /** Alle beschikbare projecten */
  projects: Project[];
  loadingProjects: boolean;
  /**
   * Herlaad projecten uit Supabase. Aanroepen na elke server-side mutatie
   * (rename, status-wijziging, archive) zodat de UI consistent blijft.
   */
  refreshProjects: () => Promise<void>;
  /**
   * Hernoem een project. Doet optimistic-update in lokale state + refresh
   * vanuit Supabase om "single source of truth" te garanderen. Fix voor
   * "rename verandert wel header maar niet projectenlijst" (Johnny 24 mei).
   */
  renameProject: (id: string, newName: string) => Promise<boolean>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'wkb_active_project';

const fallbackProject: Project = {
  id: DEFAULT_PROJECT_ID,
  name: DEFAULT_PROJECT_NAME,
};

const ProjectContext = createContext<ProjectContextType>({
  activeProject: fallbackProject,
  setActiveProject: () => undefined,
  projects: [fallbackProject],
  loadingProjects: false,
  refreshProjects: async () => undefined,
  renameProject: async () => false,
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([fallbackProject]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Herstel vorige keuze uit localStorage
  const [activeProject, setActiveProjectState] = useState<Project>(() => {
    if (typeof window === 'undefined') return fallbackProject;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored) as Project;
    } catch {
      // ignore
    }
    return fallbackProject;
  });

  const setActiveProject = useCallback((project: Project) => {
    setActiveProjectState(project);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      } catch {
        // ignore
      }
    }
  }, []);

  /**
   * Laad alle voor deze gebruiker zichtbare projecten uit Supabase.
   * Geëxporteerd via context zodat schermen na een mutatie (rename,
   * status-wijziging) een verse lijst kunnen ophalen — single source
   * of truth uit de DB, niet uit lokale React-state.
   */
  const refreshProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let allowedIds: string[] = [];
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('project_ids, role')
          .eq('id', session.user.id)
          .maybeSingle();
        const role = (profile?.role as string | null) ?? '';
        const projectIds = (profile?.project_ids as string[] | null) ?? [];
        const restrictedRoles = ['WERKVOORBEREIDER', 'VAKMAN', 'VOORMAN'];
        if (restrictedRoles.includes(role) && projectIds.length > 0) {
          allowedIds = projectIds;
        }
      }

      let query = supabase
        .from('projects')
        .select('id, name, address, initiator_name')
        .order('created_at', { ascending: true });

      if (allowedIds.length > 0) {
        query = query.in('id', allowedIds);
      }

      const activeTenantId = getActiveTenantId();
      if (activeTenantId) {
        query = query.eq('tenant_id', activeTenantId);
      }

      const { data, error } = await query;

      if (error || !data?.length) return;

      const mapped: Project[] = data.map((p) => ({
        id: p.id as string,
        name: (p.name as string | null) ?? (p.id as string),
        address: p.address as string | null,
        initiatorName: p.initiator_name as string | null,
      }));

      setProjects(mapped);

      // Sync activeProject met server-versie (naam kan gewijzigd zijn)
      setActiveProjectState((prev) => {
        const fresh = mapped.find((p) => p.id === prev.id);
        if (fresh && fresh.name !== prev.name) {
          // Persist nieuwe naam in localStorage
          if (typeof window !== 'undefined') {
            try {
              window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
            } catch { /* ignore */ }
          }
          return fresh;
        }
        return prev;
      });

      // Als huidig actief project niet meer in de lijst staat → eerste
      setActiveProjectState((prev) => {
        const stillValid = mapped.some((p) => p.id === prev.id);
        if (!stillValid && mapped[0]) return mapped[0];
        return prev;
      });
    } catch {
      // Gebruik fallback als Supabase niet bereikbaar is
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  /**
   * Rename helper — fix voor "projectenlijst toont oude naam na rename".
   * Optimistic update (direct in lokale state) + server-write + refresh.
   */
  const renameProject = useCallback(async (id: string, newName: string): Promise<boolean> => {
    const trimmed = newName.trim();
    if (!trimmed) return false;
    // Optimistic update — UI reageert direct, zelfs als netwerk traag is
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name: trimmed } : p)));
    setActiveProjectState((prev) => {
      if (prev.id !== id) return prev;
      const next = { ...prev, name: trimmed };
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch { /* ignore */ }
      }
      return next;
    });
    // Persist naar Supabase
    const { error } = await supabase.from('projects').update({ name: trimmed }).eq('id', id);
    if (error) {
      // Bij fout: herlaad waarheid uit DB
      await refreshProjects();
      return false;
    }
    return true;
  }, [refreshProjects]);

  const value = useMemo(
    () => ({ activeProject, setActiveProject, projects, loadingProjects, refreshProjects, renameProject }),
    [activeProject, setActiveProject, projects, loadingProjects, refreshProjects, renameProject]
  );

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProject() {
  return useContext(ProjectContext);
}
