import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, Search, Plus, LogOut, Check, Building2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { useAuthStore } from '../../stores/authStore';
import { useProjectStore } from '../../stores/projectStore';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../lib/trpc';

export function Header() {
  const { user, currentOrganization, organizations, setCurrentOrganization, setOrganizations, logout } = useAuthStore();
  const { currentProject, projects, setCurrentProject, setProjects } = useProjectStore();
  const navigate = useNavigate();
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false);
  const [isCreateOrgDialogOpen, setIsCreateOrgDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newOrgName, setNewOrgName] = useState('');
  const [createProjectError, setCreateProjectError] = useState('');
  const [createOrgError, setCreateOrgError] = useState('');

  const utils = trpc.useUtils();

  // Cmd+K keyboard shortcut handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      navigate('/queries');
    }
  }, [navigate]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const createProjectMutation = trpc.projects.create.useMutation({
    onSuccess: (newProject) => {
      // Update store immediately for instant UI feedback
      setProjects([...projects, newProject]);
      setCurrentProject(newProject);
      setIsCreateProjectDialogOpen(false);
      setNewProjectName('');
      setCreateProjectError('');
      // Invalidate queries to sync with server
      utils.projects.list.invalidate();
      utils.traces.invalidate();
      utils.logs.invalidate();
      utils.errors.invalidate();
      utils.metrics.invalidate();
    },
    onError: (err) => {
      setCreateProjectError(err.message);
    },
  });

  const createOrgMutation = trpc.organizations.create.useMutation({
    onSuccess: (result) => {
      const newOrg = { ...result.organization, role: 'OWNER' };
      // Update store immediately for instant UI feedback
      setOrganizations([...organizations, newOrg]);
      setCurrentOrganization(newOrg);
      setProjects([result.project]);
      setCurrentProject(result.project);
      setIsCreateOrgDialogOpen(false);
      setNewOrgName('');
      setCreateOrgError('');
      // Invalidate queries to sync with server
      utils.organizations.list.invalidate();
      utils.projects.list.invalidate();
    },
    onError: (err) => {
      setCreateOrgError(err.message);
    },
  });

  const handleCreateProject = () => {
    if (!currentOrganization || !newProjectName.trim()) return;
    setCreateProjectError('');
    createProjectMutation.mutate({
      organizationId: currentOrganization.id,
      name: newProjectName.trim(),
    });
  };

  const handleCreateOrganization = () => {
    if (!newOrgName.trim()) return;
    setCreateOrgError('');
    createOrgMutation.mutate({
      name: newOrgName.trim(),
    });
  };

  const handleProjectChange = (project: typeof currentProject) => {
    if (project && project.id !== currentProject?.id) {
      setCurrentProject(project);
      // Invalidate only project-related queries for better performance
      utils.traces.invalidate();
      utils.logs.invalidate();
      utils.errors.invalidate();
      utils.metrics.invalidate();
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {currentOrganization?.name || 'Select Organization'}
              </span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Organizations</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => setCurrentOrganization(org)}
                className="flex items-center justify-between"
              >
                <span>{org.name}</span>
                {currentOrganization?.id === org.id && (
                  <Check className="h-4 w-4" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setIsCreateOrgDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <Building2 className="h-4 w-4" />
              <span>New Organization</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {currentProject && (
          <>
            <span className="text-muted-foreground">/</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <span className="text-sm">{currentProject.name}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Projects</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {projects.map((project) => (
                  <DropdownMenuItem
                    key={project.id}
                    onClick={() => handleProjectChange(project)}
                    className="flex items-center justify-between"
                  >
                    <span>{project.name}</span>
                    {currentProject?.id === project.id && (
                      <Check className="h-4 w-4" />
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setIsCreateProjectDialogOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>New Project</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search Baselime"
            className="w-64 pl-9 bg-background"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">Cmd</span>K
          </kbd>
        </div>

        <Button size="sm" className="gap-2" onClick={() => navigate('/queries')}>
          <Plus className="h-4 w-4" />
          New query
        </Button>

        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={isCreateProjectDialogOpen} onOpenChange={setIsCreateProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Add a new project to your organization to organize your telemetry data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {createProjectError && (
              <div className="text-sm text-red-500 bg-red-500/10 p-3 rounded-md">
                {createProjectError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g., my-api, ecommerce-backend"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateProjectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={!newProjectName.trim() || createProjectMutation.isPending}
            >
              {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateOrgDialogOpen} onOpenChange={setIsCreateOrgDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Organization</DialogTitle>
            <DialogDescription>
              Create a new organization to manage separate teams, projects, and billing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {createOrgError && (
              <div className="text-sm text-red-500 bg-red-500/10 p-3 rounded-md">
                {createOrgError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="e.g., Acme Inc, My Team"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOrgDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateOrganization}
              disabled={!newOrgName.trim() || createOrgMutation.isPending}
            >
              {createOrgMutation.isPending ? 'Creating...' : 'Create Organization'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
