import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Plus, Copy, Trash2, Eye, Edit, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { trpc } from '../../lib/trpc';
import { useProjectStore } from '../../stores/projectStore';
import { timeAgo } from '../../lib/utils';

interface DashboardCardProps {
  dashboard: {
    id: string;
    name: string;
    description: string | null;
    updatedAt: string;
    isDefault: boolean;
  };
  widgetCount: number;
  onDuplicate: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

function DashboardCard({ dashboard, widgetCount, onDuplicate, onDelete }: DashboardCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateName, setDuplicateName] = useState(`${dashboard.name} (Copy)`);

  const handleDuplicate = () => {
    onDuplicate(dashboard.id, duplicateName);
    setShowDuplicateDialog(false);
    setDuplicateName(`${dashboard.name} (Copy)`);
  };

  const handleDelete = () => {
    onDelete(dashboard.id);
    setShowDeleteDialog(false);
  };

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <LayoutDashboard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{dashboard.name}</CardTitle>
              {dashboard.description && (
                <CardDescription className="text-xs mt-1">
                  {dashboard.description}
                </CardDescription>
              )}
            </div>
          </div>
          {dashboard.isDefault && (
            <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded font-bold uppercase">
              Default
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
          <div className="flex items-center gap-1">
            <LayoutDashboard className="h-3 w-3" />
            <span>{widgetCount} widgets</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{timeAgo(dashboard.updatedAt)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Link to={`/dashboards/${dashboard.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <Eye className="h-3 w-3 mr-1" />
              View
            </Button>
          </Link>
          <Link to={`/dashboards/${dashboard.id}/edit`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
          </Link>

          <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <Copy className="h-3 w-3" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Duplicate Dashboard</DialogTitle>
                <DialogDescription>
                  Create a copy of this dashboard with all its widgets
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="duplicate-name">Dashboard Name</Label>
                  <Input
                    id="duplicate-name"
                    value={duplicateName}
                    onChange={(e) => setDuplicateName(e.target.value)}
                    placeholder="Enter dashboard name"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDuplicateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleDuplicate} disabled={!duplicateName.trim()}>
                  Duplicate
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <Trash2 className="h-3 w-3 text-red-500" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Dashboard</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete "{dashboard.name}"? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardsPage() {
  const { currentProject } = useProjectStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState('');
  const [newDashboardDescription, setNewDashboardDescription] = useState('');

  const utils = trpc.useUtils();

  const { data: dashboards, isLoading } = trpc.dashboards.list.useQuery(
    { isTemplate: false },
    { enabled: !!currentProject }
  );

  const createMutation = trpc.dashboards.create.useMutation({
    onSuccess: () => {
      utils.dashboards.list.invalidate();
      setShowCreateDialog(false);
      setNewDashboardName('');
      setNewDashboardDescription('');
    },
  });

  const duplicateMutation = trpc.dashboards.duplicate.useMutation({
    onSuccess: () => {
      utils.dashboards.list.invalidate();
    },
  });

  const deleteMutation = trpc.dashboards.delete.useMutation({
    onSuccess: () => {
      utils.dashboards.list.invalidate();
    },
  });

  const handleCreateDashboard = () => {
    createMutation.mutate({
      name: newDashboardName,
      description: newDashboardDescription || undefined,
      visibility: 'private',
    });
  };

  const handleDuplicate = (id: string, name: string) => {
    duplicateMutation.mutate({ id, name });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ id });
  };

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Select a project to view dashboards</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboards</h1>
          <p className="text-muted-foreground">
            Create and manage custom dashboards to visualize your data
          </p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Dashboard
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Dashboard</DialogTitle>
              <DialogDescription>
                Create a new custom dashboard to visualize your telemetry data
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Dashboard Name</Label>
                <Input
                  id="name"
                  value={newDashboardName}
                  onChange={(e) => setNewDashboardName(e.target.value)}
                  placeholder="e.g., API Performance Overview"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  value={newDashboardDescription}
                  onChange={(e) => setNewDashboardDescription(e.target.value)}
                  placeholder="e.g., Monitor API latency and error rates"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateDashboard}
                disabled={!newDashboardName.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-muted h-9 w-9" />
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-24 bg-muted rounded" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded mb-4" />
                <div className="flex gap-2">
                  <div className="h-8 flex-1 bg-muted rounded" />
                  <div className="h-8 flex-1 bg-muted rounded" />
                  <div className="h-8 w-8 bg-muted rounded" />
                  <div className="h-8 w-8 bg-muted rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !dashboards || dashboards.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <LayoutDashboard className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="font-medium mb-2">No dashboards yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first dashboard to start visualizing your telemetry data
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboards.map((dashboard) => (
            <DashboardCard
              key={dashboard.id}
              dashboard={dashboard}
              widgetCount={0}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
