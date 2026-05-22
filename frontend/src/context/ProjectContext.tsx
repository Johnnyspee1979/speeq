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

  // Laad projecten uit Supabase
  useEffect(() => {
    const load = async () => {
      setLoadingProjects(true);
      try {
        // Bepaal welke projecten deze gebruiker mag zien
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

        // Tenant-isolatie: bij een actieve klant-tenant alleen hun projecten.
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

        // Als huidig actief project niet in de lijst staat → zet naar eerste
        const stillValid = mapped.some((p) => p.id === activeProject.id);
        if (!stillValid && mapped[0]) {
          setActiveProject(mapped[0]);
        }
      } catch {
        // Gebruik fallback als Supabase niet bereikbaar is
      } finally {
        setLoadingProjects(false);
      }
    };

    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ activeProject, setActiveProject, projects, loadingProjects }),
    [activeProject, setActiveProject, projects, loadingProjects]
  );

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProject() {
  return useContext(ProjectContext);
}
