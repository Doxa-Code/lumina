import { useState } from 'react';
import { Database, Save, AlertTriangle, Trash2, Clock } from 'lucide-react';
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

const retentionOptions = [
  { days: 7, label: '7 days', description: 'Minimal retention for development' },
  { days: 14, label: '14 days', description: 'Short-term retention' },
  { days: 30, label: '30 days', description: 'Standard retention (recommended)' },
  { days: 60, label: '60 days', description: 'Extended retention' },
  { days: 90, label: '90 days', description: 'Long-term retention' },
  { days: 180, label: '180 days', description: 'Extended compliance retention' },
  { days: 365, label: '365 days', description: 'Annual retention' },
];

function formatCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return count.toLocaleString();
}

export function DataRetentionPage() {
  const { currentProject, setCurrentProject } = useProjectStore();
  const [retentionDays, setRetentionDays] = useState(currentProject?.retentionDays || 30);
  const [customDays, setCustomDays] = useState('');
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [purgeConfirmation, setPurgeConfirmation] = useState('');

  const utils = trpc.useUtils();

  const storageStatsQuery = trpc.projects.getStorageStats.useQuery(
    { projectId: currentProject?.id ?? '' },
    { enabled: !!currentProject?.id }
  );

  const updateProjectMutation = trpc.projects.update.useMutation({
    onSuccess: (updated) => {
      if (currentProject) {
        setCurrentProject({
          ...currentProject,
          retentionDays: updated.retentionDays,
        });
      }
      utils.projects.list.invalidate();
    },
  });

  const purgeDataMutation = trpc.projects.purgeData.useMutation({
    onSuccess: () => {
      setPurgeDialogOpen(false);
      setPurgeConfirmation('');
      storageStatsQuery.refetch();
    },
  });

  const handleSave = () => {
    if (!currentProject) return;
    updateProjectMutation.mutate({
      projectId: currentProject.id,
      retentionDays,
    });
  };

  const handleSelectRetention = (days: number) => {
    setRetentionDays(days);
    setCustomDays('');
  };

  const handleCustomRetention = () => {
    const days = parseInt(customDays);
    if (days >= 7 && days <= 365) {
      setRetentionDays(days);
    }
  };

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Select a project to manage data retention</p>
      </div>
    );
  }

  const hasChanges = retentionDays !== (currentProject.retentionDays || 30);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="h-6 w-6" />
          Data Retention
        </h1>
        <p className="text-muted-foreground">
          Configure how long data is stored for {currentProject.name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Retention Period</CardTitle>
          <CardDescription>
            Data older than the retention period will be automatically deleted.
            This applies to traces, logs, and metrics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {retentionOptions.map((option) => (
              <button
                key={option.days}
                onClick={() => handleSelectRetention(option.days)}
                className={`p-4 rounded-lg border text-left transition-colors ${
                  retentionDays === option.days
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <p className="font-medium">{option.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 pt-4 border-t">
            <div className="flex-1">
              <label className="text-sm font-medium">Custom retention (days)</label>
              <div className="flex gap-2 mt-2">
                <Input
                  type="number"
                  placeholder="Enter days (7-365)"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  min={7}
                  max={365}
                  className="w-48"
                />
                <Button
                  variant="outline"
                  onClick={handleCustomRetention}
                  disabled={!customDays || parseInt(customDays) < 7 || parseInt(customDays) > 365}
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                Current retention: <strong className="text-foreground">{currentProject.retentionDays || 30} days</strong>
              </span>
              {hasChanges && (
                <span className="text-primary">
                  → {retentionDays} days
                </span>
              )}
            </div>
            <Button onClick={handleSave} disabled={!hasChanges || updateProjectMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {updateProjectMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Storage Usage</CardTitle>
          <CardDescription>
            Current data storage for this project
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Traces</p>
              <p className="text-2xl font-bold">
                {storageStatsQuery.isLoading ? '--' : formatCount(storageStatsQuery.data?.traces ?? 0)}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Logs</p>
              <p className="text-2xl font-bold">
                {storageStatsQuery.isLoading ? '--' : formatCount(storageStatsQuery.data?.logs ?? 0)}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Metrics</p>
              <p className="text-2xl font-bold">
                {storageStatsQuery.isLoading ? '--' : formatCount(storageStatsQuery.data?.metrics ?? 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-500/20">
        <CardHeader>
          <CardTitle className="text-red-500 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible data operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border rounded-lg border-red-500/50">
            <div>
              <h4 className="font-medium text-red-500">Purge All Data</h4>
              <p className="text-sm text-muted-foreground">
                Permanently delete all traces, logs, and metrics for this project
              </p>
            </div>
            <Button variant="destructive" onClick={() => setPurgeDialogOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Purge Data
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={purgeDialogOpen} onOpenChange={setPurgeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              Purge All Data
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete all telemetry data
              (traces, logs, and metrics) for <strong>{currentProject.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">
              Type <strong>PURGE</strong> to confirm:
            </label>
            <Input
              className="mt-2"
              placeholder="PURGE"
              value={purgeConfirmation}
              onChange={(e) => setPurgeConfirmation(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setPurgeDialogOpen(false);
              setPurgeConfirmation('');
            }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={purgeConfirmation !== 'PURGE' || purgeDataMutation.isPending}
              onClick={() => {
                if (!currentProject) return;
                purgeDataMutation.mutate({
                  projectId: currentProject.id,
                  confirmation: 'PURGE',
                });
              }}
            >
              {purgeDataMutation.isPending ? 'Purging...' : 'Purge All Data'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
