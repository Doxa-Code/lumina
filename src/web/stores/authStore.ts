import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  role?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  organizations: Organization[];
  currentOrganization: Organization | null;
  setAuth: (user: User, token: string, organizations: Organization[]) => void;
  setCurrentOrganization: (org: Organization) => void;
  setOrganizations: (orgs: Organization[]) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      organizations: [],
      currentOrganization: null,
      setAuth: (user, token, organizations) => {
        localStorage.setItem('token', token);
        set({
          user,
          token,
          organizations,
          currentOrganization: organizations[0] || null,
        });
      },
      setCurrentOrganization: (org) => {
        set({ currentOrganization: org });
      },
      setOrganizations: (orgs) => {
        set({ organizations: orgs });
      },
      logout: () => {
        localStorage.removeItem('token');
        set({
          user: null,
          token: null,
          organizations: [],
          currentOrganization: null,
        });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        organizations: state.organizations,
        currentOrganization: state.currentOrganization,
      }),
    }
  )
);
