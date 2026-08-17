import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Settings, Key, Users, Bell, Shield, Database, Trash2, Save, AlertTriangle, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { trpc } from '../../lib/trpc';
import { useProjectStore } from '../../stores/projectStore';

const settingsSections = [
  {
    id: 'general',
    name: 'General',
    description: 'Basic project settings',
    icon: Settings,
  },
  {
    id: 'api-keys',
    name: 'API Keys',
    description: 'Manage API keys for data ingestion',
    icon: Key,
    href: '/settings/api-keys',
  },
  {
    id: 'team',
    name: 'Team Members',
    description: 'Manage team access and permissions',
    icon: Users,
    href: '/settings/team',
  },
  {
    id: 'alerts',
    name: 'Alerts & Notifications',
    description: 'Configure alerting and notification channels',
    icon: Bell,
    href: '/alerts',
  },
  {
    id: 'retention',
    name: 'Data Retention',
    description: 'Configure data retention policies',
    icon: Database,
    href: '/settings/retention',
  },
  {
    id: 'security',
    name: 'Security',
    description: 'Security and compliance settings',
    icon: Shield,
    href: '/settings/security',
  },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const { currentProject, setCurrentProject, clearProject } = useProjectStore();
  const [projectName, setProjectName] = useState(currentProject?.name || '');
  const [environment, setEnvironment] = useState(currentProject?.environment || 'production');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const utils = trpc.useUtils();

  // Update local state when currentProject changes
  useEffect(() => {
    if (currentProject) {
      setProjectName(currentProject.name);
      setEnvironment(currentProject.environment || 'production');
    }
  }, [currentProject]);

  // Update project mutation
  const updateProjectMutation = trpc.projects.update.useMutation({
    onSuccess: (updated) => {
      // Update the project store with new values
      if (currentProject) {
        setCurrentProject({
          ...currentProject,
          name: updated.name,
          environment: updated.environment,
          retentionDays: updated.retentionDays,
        });
      }
      utils.projects.list.invalidate();
    },
  });

  // Delete project mutation
  const deleteProjectMutation = trpc.projects.delete.useMutation({
    onSuccess: () => {
      clearProject();
      setDeleteDialogOpen(false);
      navigate('/');
    },
  });

  const handleSave = () => {
    if (!currentProject) return;
    updateProjectMutation.mutate({
      projectId: currentProject.id,
      name: projectName,
      environment: environment as 'production' | 'staging' | 'development',
    });
  };

  const handleDeleteProject = () => {
    if (!currentProject || deleteConfirmation !== currentProject.name) return;
    deleteProjectMutation.mutate({ projectId: currentProject.id });
  };

  const isSaving = updateProjectMutation.isPending;

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Select a project to view settings</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage settings for {currentProject.name}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {settingsSections.map((section) => (
          <Card
            key={section.id}
            className={section.href ? 'cursor-pointer hover:border-primary/50 transition-colors' : ''}
          >
            {section.href ? (
              <Link to={section.href}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-primary/10">
                      <section.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{section.name}</CardTitle>
                      <CardDescription className="text-xs">{section.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Link>
            ) : (
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-muted">
                    <section.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{section.name}</CardTitle>
                    <CardDescription className="text-xs">{section.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            )}
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Settings</CardTitle>
          <CardDescription>Update your project configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Project Name</label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="My Project"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Environment</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
              >
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
              </select>
            </div>

          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>OTLP Endpoint Configuration</CardTitle>
          <CardDescription>Configure your applications to send data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">OTLP HTTP Endpoint</label>
            <div className="flex gap-2">
              <code className="flex-1 bg-muted p-3 rounded font-mono text-sm">
                {window.location.origin}
              </code>
              <Button
                variant="outline"
                onClick={() => navigator.clipboard.writeText(window.location.origin)}
              >
                Copy
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Traces Endpoint</label>
            <code className="bg-muted p-3 rounded font-mono text-sm">
              POST {window.location.origin}/v1/traces
            </code>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Logs Endpoint</label>
            <code className="bg-muted p-3 rounded font-mono text-sm">
              POST {window.location.origin}/v1/logs
            </code>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Metrics Endpoint</label>
            <code className="bg-muted p-3 rounded font-mono text-sm">
              POST {window.location.origin}/v1/metrics
            </code>
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-500/20">
        <CardHeader>
          <CardTitle className="text-red-500">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions for this project</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg border-red-500/50">
            <div>
              <h4 className="font-medium text-red-500">Delete Project</h4>
              <p className="text-sm text-muted-foreground">
                Permanently delete this project and all associated data
              </p>
            </div>
            <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Project
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              Delete Project
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the project
              <strong> {currentProject.name}</strong> and all associated data including
              traces, logs, metrics, and API keys.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">
              Type <strong>{currentProject.name}</strong> to confirm:
            </label>
            <Input
              className="mt-2"
              placeholder="Project name"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDeleteDialogOpen(false);
              setDeleteConfirmation('');
            }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteProject}
              disabled={deleteConfirmation !== currentProject.name || deleteProjectMutation.isPending}
            >
              {deleteProjectMutation.isPending ? 'Deleting...' : 'Delete Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
