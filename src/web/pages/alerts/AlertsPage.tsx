import { useState } from 'react';
import { Bell, BellOff, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { trpc } from '../../lib/trpc';
import { useProjectStore } from '../../stores/projectStore';
import { AlertCard, type Alert } from '../../components/alerts/AlertCard';
import { CreateAlertDialog } from '../../components/alerts/CreateAlertDialog';
import type { AlertState } from '../../components/alerts/AlertStatusBadge';
import type { AlertFormData } from '../../components/alerts/CreateAlertDialog';

type StateFilter = 'all' | AlertState;
type SeverityFilter = 'all' | Alert['severity'];

export function AlertsPage() {
  const { currentProject } = useProjectStore();
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [search, setSearch] = useState('');

  const utils = trpc.useUtils();

  // Fetch alerts from API
  const { data: alerts, isLoading } = trpc.alerts.list.useQuery(
    {
      state: stateFilter === 'all' ? undefined : stateFilter,
      severity: severityFilter === 'all' ? undefined : severityFilter,
      search: search || undefined,
    },
    { enabled: !!currentProject }
  );

  // Fetch stats for overview cards
  const { data: stats } = trpc.alerts.stats.useQuery(undefined, {
    enabled: !!currentProject,
  });

  // Fetch available channels
  const { data: channels } = trpc.alerts.listChannels.useQuery(undefined, {
    enabled: !!currentProject,
  });

  // Mutations
  const createMutation = trpc.alerts.create.useMutation({
    onSuccess: () => {
      utils.alerts.list.invalidate();
      utils.alerts.stats.invalidate();
    },
  });

  const updateMutation = trpc.alerts.update.useMutation({
    onSuccess: () => {
      utils.alerts.list.invalidate();
      utils.alerts.stats.invalidate();
    },
  });

  const deleteMutation = trpc.alerts.delete.useMutation({
    onSuccess: () => {
      utils.alerts.list.invalidate();
      utils.alerts.stats.invalidate();
    },
  });

  const enableMutation = trpc.alerts.enable.useMutation({
    onSuccess: () => {
      utils.alerts.list.invalidate();
      utils.alerts.stats.invalidate();
    },
  });

  const disableMutation = trpc.alerts.disable.useMutation({
    onSuccess: () => {
      utils.alerts.list.invalidate();
      utils.alerts.stats.invalidate();
    },
  });

  const silenceMutation = trpc.alerts.silence.useMutation({
    onSuccess: () => {
      utils.alerts.list.invalidate();
      utils.alerts.stats.invalidate();
    },
  });

  const handleCreate = async (alertData: AlertFormData) => {
    await createMutation.mutateAsync(alertData);
  };

  const handleDelete = async (alertId: string) => {
    await deleteMutation.mutateAsync({ id: alertId });
  };

  const handleToggleEnabled = async (alertId: string, enabled: boolean) => {
    if (enabled) {
      await enableMutation.mutateAsync({ id: alertId });
    } else {
      await disableMutation.mutateAsync({ id: alertId });
    }
  };

  const handleSilence = async (alertId: string) => {
    await silenceMutation.mutateAsync({ id: alertId });
  };

  const filteredAlerts = alerts || [];

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Select a project to view alerts</p>
      </div>
    );
  }

  const firingCount = stats?.firing || 0;
  const totalAlerts = stats?.total || 0;
  const silencedCount = stats?.silenced || 0;
  const okCount = stats?.ok || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Alerts</h1>
          <p className="text-muted-foreground">
            Monitor and manage your alert configurations
          </p>
        </div>
        <CreateAlertDialog
          channels={channels?.map((c) => ({ id: c.id, name: c.name, type: c.type })) || []}
          onSubmit={handleCreate}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-red-500">{firingCount}</div>
                <div className="text-sm text-muted-foreground">Firing</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-500">{okCount}</div>
                <div className="text-sm text-muted-foreground">OK</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-500/10 rounded">
                <BellOff className="h-5 w-5 text-gray-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-500">{silencedCount}</div>
                <div className="text-sm text-muted-foreground">Silenced</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totalAlerts}</div>
                <div className="text-sm text-muted-foreground">Total Alerts</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search alerts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <span className="text-sm font-medium text-muted-foreground">State:</span>
          {(['all', 'firing', 'ok', 'silenced', 'pending'] as const).map((state) => (
            <Button
              key={state}
              variant={stateFilter === state ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStateFilter(state)}
            >
              {state === 'all' ? 'All' : state.charAt(0).toUpperCase() + state.slice(1)}
              {state === 'firing' && firingCount > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 rounded-full">
                  {firingCount}
                </span>
              )}
            </Button>
          ))}
        </div>

        <div className="flex gap-2">
          <span className="text-sm font-medium text-muted-foreground">Severity:</span>
          {(['all', 'critical', 'warning', 'info'] as const).map((severity) => (
            <Button
              key={severity}
              variant={severityFilter === severity ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSeverityFilter(severity)}
            >
              {severity.charAt(0).toUpperCase() + severity.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="h-5 w-3/4 bg-muted rounded" />
                  <div className="h-4 w-full bg-muted rounded" />
                  <div className="h-4 w-1/2 bg-muted rounded" />
                  <div className="flex gap-2 pt-2">
                    <div className="h-8 w-20 bg-muted rounded" />
                    <div className="h-8 w-20 bg-muted rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredAlerts.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="font-medium mb-2">No alerts found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {search || stateFilter !== 'all' || severityFilter !== 'all'
                  ? 'Try adjusting your filters or search query'
                  : 'Create your first alert to start monitoring your application'}
              </p>
              {!search && stateFilter === 'all' && severityFilter === 'all' && (
                <CreateAlertDialog
                  channels={channels?.map((c) => ({ id: c.id, name: c.name, type: c.type })) || []}
                  onSubmit={handleCreate}
                  trigger={
                    <Button>
                      <Bell className="h-4 w-4 mr-2" />
                      Create Your First Alert
                    </Button>
                  }
                />
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onDelete={handleDelete}
              onToggleEnabled={handleToggleEnabled}
              onSilence={handleSilence}
            />
          ))}
        </div>
      )}
    </div>
  );
}
