import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Project {
  id: string;
  name: string;
  slug: string;
  retentionDays?: number;
}

interface ProjectState {
  currentProject: Project | null;
  projects: Project[];
  setCurrentProject: (project: Project) => void;
  setProjects: (projects: Project[]) => void;
  clearProject: () => void;
  clear: () => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      currentProject: null,
      projects: [],
      setCurrentProject: (project) => {
        set({ currentProject: project });
      },
      setProjects: (projects) => {
        set((state) => ({
          projects,
          currentProject: state.currentProject || projects[0] || null,
        }));
      },
      clearProject: () => {
        set({ currentProject: null });
      },
      clear: () => {
        set({ currentProject: null, projects: [] });
      },
    }),
    {
      name: 'project-storage',
      partialize: (state) => ({
        currentProject: state.currentProject,
      }),
    }
  )
);
