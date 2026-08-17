import React, { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { trpc } from '../../lib/trpc';
import { useAuthStore } from '../../stores/authStore';
import { useProjectStore } from '../../stores/projectStore';

export function Layout() {
  const { currentOrganization, setOrganizations, setCurrentOrganization, organizations } = useAuthStore();
  const { setProjects, setCurrentProject, currentProject, clearProject } = useProjectStore();
  const previousOrgId = useRef<string | null>(null);
  const utils = trpc.useUtils();

  // Fetch user's organizations on mount to keep them in sync
  const { data: orgsData } = trpc.organizations.list.useQuery(undefined, {
    staleTime: 60000, // Refetch every minute
  });

  // Update organizations when fetched
  useEffect(() => {
    if (orgsData && orgsData.length > 0) {
      setOrganizations(orgsData);
      // If no current organization or current one is not in the list, set the first one
      if (!currentOrganization || !orgsData.find(o => o.id === currentOrganization.id)) {
        setCurrentOrganization(orgsData[0]);
      }
    }
  }, [orgsData, currentOrganization, setOrganizations, setCurrentOrganization]);

  const { data: projects } = trpc.projects.list.useQuery(
    { organizationId: currentOrganization?.id! },
    { enabled: !!currentOrganization?.id }
  );

  // Reset project state when organization changes
  useEffect(() => {
    if (currentOrganization?.id && previousOrgId.current !== null && previousOrgId.current !== currentOrganization.id) {
      clearProject();
      setProjects([]);
      // Invalidate all queries when switching organizations
      utils.invalidate();
    }
    previousOrgId.current = currentOrganization?.id ?? null;
  }, [currentOrganization?.id, clearProject, setProjects, utils]);

  useEffect(() => {
    if (projects && projects.length > 0) {
      setProjects(projects);
      // Check if currentProject belongs to the current organization
      const projectBelongsToOrg = projects.some(p => p.id === currentProject?.id);
      if (!currentProject || !projectBelongsToOrg) {
        setCurrentProject(projects[0]);
      }
    }
  }, [projects, currentProject, setProjects, setCurrentProject]);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
