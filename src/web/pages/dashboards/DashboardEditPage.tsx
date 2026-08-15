import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Save } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { trpc } from '../../lib/trpc';
import { useProjectStore } from '../../stores/projectStore';
import { DashboardGrid } from '../../components/dashboards/DashboardGrid';
import { WidgetPicker } from '../../components/dashboards/WidgetPicker';

export function DashboardEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentProject } = useProjectStore();
  const [showWidgetPicker, setShowWidgetPicker] = useState(false);
  const [dashboardName, setDashboardName] = useState('');
  const [dashboardDescription, setDashboardDescription] = useState('');

  const utils = trpc.useUtils();

  const { data: dashboard, isLoading } = trpc.dashboards.get.useQuery(
    { id: id! },
    {
      enabled: !!currentProject && !!id,
    }
  );

  useEffect(() => {
    if (dashboard) {
      setDashboardName(dashboard.name);
      setDashboardDescription(dashboard.description || '');
    }
  }, [dashboard]);

  const updateMutation = trpc.dashboards.update.useMutation({
    onSuccess: () => {
      utils.dashboards.get.invalidate({ id: id! });
      utils.dashboards.list.invalidate();
    },
  });

  const addWidgetMutation = trpc.dashboards.addWidget.useMutation({
    onSuccess: () => {
      utils.dashboards.get.invalidate({ id: id! });
    },
  });

  const handleSave = () => {
    if (!id) return;

    updateMutation.mutate({
      id,
      name: dashboardName,
      description: dashboardDescription || undefined,
    });
  };

  const handleAddWidget = (type: string, config: Record<string, any>) => {
    if (!id) return;

    const { title, ...widgetConfig } = config;

    // Calculate next position (simple stacking)
    const widgets = dashboard?.widgets || [];
    const nextY = widgets.length > 0
      ? Math.max(...widgets.map((w) => w.position.y + w.position.h))
      : 0;

    addWidgetMutation.mutate({
      dashboardId: id,
      type,
      title: title || undefined,
      config: widgetConfig,
      position: {
        x: 0,
        y: nextY,
        w: 6,
        h: 3,
      },
    });
  };

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Select a project to edit dashboard</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h3 className="font-medium mb-2">Dashboard not found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            The dashboard you're looking for doesn't exist or you don't have access to it.
          </p>
          <Link to="/dashboards">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboards
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/dashboards/${id}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Edit Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Customize your dashboard layout and widgets
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/dashboards/${id}`)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!dashboardName.trim() || updateMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {updateMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Dashboard Settings */}
      <div className="bg-muted/50 p-4 border-2 border-border rounded">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Dashboard Name</Label>
            <Input
              id="name"
              value={dashboardName}
              onChange={(e) => setDashboardName(e.target.value)}
              placeholder="Enter dashboard name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={dashboardDescription}
              onChange={(e) => setDashboardDescription(e.target.value)}
              placeholder="Enter dashboard description"
            />
          </div>
        </div>
      </div>

      {/* Add Widget Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Widgets</h2>
        <Button onClick={() => setShowWidgetPicker(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Widget
        </Button>
      </div>

      {/* Dashboard Grid (Edit Mode) */}
      {dashboard.widgets && dashboard.widgets.length > 0 ? (
        <DashboardGrid
          widgets={dashboard.widgets}
          isEditMode={true}
          dashboardId={dashboard.id}
          timeBounds={{
            from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            to: new Date().toISOString(),
          }}
        />
      ) : (
        <div className="flex items-center justify-center h-[400px] border-2 border-dashed border-border rounded">
          <div className="text-center">
            <Plus className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="font-medium mb-2">No widgets yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add your first widget to get started
            </p>
            <Button onClick={() => setShowWidgetPicker(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Widget
            </Button>
          </div>
        </div>
      )}

      {/* Widget Picker Dialog */}
      <WidgetPicker
        open={showWidgetPicker}
        onOpenChange={setShowWidgetPicker}
        onSelect={handleAddWidget}
      />
    </div>
  );
}
