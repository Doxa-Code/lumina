import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Edit, Clock, RefreshCw, Plus, Filter } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { trpc } from '../../lib/trpc';
import { useProjectStore } from '../../stores/projectStore';
import { DashboardGrid } from '../../components/dashboards/DashboardGrid';

const TIME_RANGES = [
  { label: '15 minutes', value: '15m' },
  { label: '1 hour', value: '1h' },
  { label: '6 hours', value: '6h' },
  { label: '24 hours', value: '24h' },
  { label: '7 days', value: '7d' },
] as const;

const REFRESH_INTERVALS = [
  { label: 'Off', value: 0 },
  { label: '10s', value: 10000 },
  { label: '30s', value: 30000 },
  { label: '1m', value: 60000 },
  { label: '5m', value: 300000 },
] as const;

export function DashboardViewPage() {
  const { id } = useParams<{ id: string }>();
  const { currentProject } = useProjectStore();
  const [timeRange, setTimeRange] = useState<string>('24h');
  const [refreshInterval, setRefreshInterval] = useState<number>(0);
  const [isEditMode, setIsEditMode] = useState(false);

  const { data: dashboard, isLoading } = trpc.dashboards.get.useQuery(
    { id: id! },
    {
      enabled: !!currentProject && !!id,
      refetchInterval: refreshInterval || false,
    }
  );

  // Calculate time bounds based on selected range
  const timeBounds = useMemo(() => {
    const now = new Date();
    const to = now.toISOString();

    const match = timeRange.match(/^(\d+)([mhd])$/);
    if (!match) return { from: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(), to };

    const amount = parseInt(match[1]);
    const unit = match[2];
    const from = new Date(now);

    switch (unit) {
      case 'm':
        from.setMinutes(from.getMinutes() - amount);
        break;
      case 'h':
        from.setHours(from.getHours() - amount);
        break;
      case 'd':
        from.setDate(from.getDate() - amount);
        break;
    }

    return { from: from.toISOString(), to };
  }, [timeRange]);

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Select a project to view dashboard</p>
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
          <Link to="/dashboards">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{dashboard.name}</h1>
            {dashboard.description && (
              <p className="text-sm text-muted-foreground">{dashboard.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link to={`/dashboards/${id}/edit`}>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between bg-muted/50 p-4 border-2 border-border rounded">
        <div className="flex items-center gap-4">
          {/* Time Range Selector */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGES.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Auto-refresh */}
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            <Select
              value={refreshInterval.toString()}
              onValueChange={(value) => setRefreshInterval(Number(value))}
            >
              <SelectTrigger className="w-[100px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REFRESH_INTERVALS.map((interval) => (
                  <SelectItem key={interval.value} value={interval.value.toString()}>
                    {interval.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Global Filters (placeholder) */}
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {refreshInterval > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              Auto-refreshing
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            Last updated: {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Dashboard Content */}
      {dashboard.widgets && dashboard.widgets.length > 0 ? (
        <DashboardGrid
          widgets={dashboard.widgets}
          isEditMode={isEditMode}
          dashboardId={dashboard.id}
          timeBounds={timeBounds}
        />
      ) : (
        <div className="flex items-center justify-center h-[400px] border-2 border-dashed border-border rounded">
          <div className="text-center">
            <Plus className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="font-medium mb-2">No widgets yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add widgets to start visualizing your data
            </p>
            <Link to={`/dashboards/${id}/edit`}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Widget
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
