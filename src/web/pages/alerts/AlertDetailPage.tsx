import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Trash2,
  BellOff,
  Bell,
  Clock,
  AlertTriangle,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { trpc } from '../../lib/trpc';
import { useProjectStore } from '../../stores/projectStore';
import { AlertStatusBadge } from '../../components/alerts/AlertStatusBadge';
import { CreateAlertDialog } from '../../components/alerts/CreateAlertDialog';
import { timeAgo } from '../../lib/utils';

interface AlertEvent {
  id: string;
  timestamp: string;
  state: 'triggered' | 'resolved' | 'silenced';
  value?: number;
  message?: string;
}

export function AlertDetailPage() {
  const { alertId } = useParams<{ alertId: string }>();
  const navigate = useNavigate();
  const { currentProject } = useProjectStore();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const utils = trpc.useUtils();

  // Fetch alert details
  const { data: alert, isLoading } = trpc.alerts.get.useQuery(
    { id: alertId! },
    { enabled: !!currentProject && !!alertId }
  );

  // Fetch alert event history
  const { data: events } = trpc.alerts.events.useQuery(
    { alertId: alertId! },
    { enabled: !!currentProject && !!alertId }
  );

  // Fetch related insights
  const { data: insights } = trpc.alerts.insights.useQuery(
    { alertId: alertId! },
    { enabled: !!currentProject && !!alertId }
  );

  // Fetch available channels
  const { data: channels } = trpc.alerts.listChannels.useQuery({}, {
    enabled: !!currentProject,
  });

  // Mutations
  const updateMutation = trpc.alerts.update.useMutation({
    onSuccess: () => {
      utils.alerts.get.invalidate({ id: alertId });
      utils.alerts.list.invalidate();
      setIsEditDialogOpen(false);
    },
  });

  const deleteMutation = trpc.alerts.delete.useMutation({
    onSuccess: () => {
      navigate('/alerts');
    },
  });

  const toggleEnabledMutation = trpc.alerts.toggleEnabled.useMutation({
    onSuccess: () => {
      utils.alerts.get.invalidate({ id: alertId });
    },
  });

  const handleUpdate = async (alertData: any) => {
    await updateMutation.mutateAsync({
      id: alertId!,
      ...alertData,
    });
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync({ id: alertId! });
  };

  const handleToggleEnabled = async () => {
    if (!alert) return;
    await toggleEnabledMutation.mutateAsync({
      id: alertId!,
      enabled: !alert.enabled,
    });
  };

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Select a project to view alert details</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-muted rounded animate-pulse" />
          <div className="flex-1">
            <div className="h-8 w-64 bg-muted rounded animate-pulse mb-2" />
            <div className="h-4 w-96 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6 animate-pulse">
                <div className="h-6 w-24 bg-muted rounded mb-2" />
                <div className="h-4 w-32 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!alert) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="font-medium mb-2">Alert not found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            This alert may have been deleted or you don't have access to it
          </p>
          <Link to="/alerts">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Alerts
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const severityColors = {
    critical: 'text-red-500',
    warning: 'text-yellow-500',
    info: 'text-blue-500',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4 flex-1">
          <Link to="/alerts">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold">{alert.name}</h1>
              <AlertStatusBadge state={alert.state} />
              {!alert.enabled && (
                <span className="text-xs px-2 py-0.5 rounded bg-gray-500/10 text-gray-500">
                  DISABLED
                </span>
              )}
            </div>
            {alert.description && (
              <p className="text-muted-foreground">{alert.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleToggleEnabled}>
            {alert.enabled ? (
              <>
                <BellOff className="h-4 w-4 mr-2" />
                Disable
              </>
            ) : (
              <>
                <Bell className="h-4 w-4 mr-2" />
                Enable
              </>
            )}
          </Button>
          <CreateAlertDialog
            channels={channels?.map((c) => c.name) || []}
            onSubmit={handleUpdate}
            editAlert={alert}
            trigger={
              <Button variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            }
          />
          <Button variant="outline" onClick={() => setIsDeleteDialogOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Delete Alert"
        description={`Are you sure you want to delete "${alert.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Severity</div>
              <div className={`text-xl font-semibold ${severityColors[alert.severity]}`}>
                {alert.severity.toUpperCase()}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Threshold</div>
              <div className="text-xl font-semibold">{alert.threshold}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Last Triggered</div>
              <div className="text-xl font-semibold">
                {alert.lastTriggered ? timeAgo(alert.lastTriggered) : 'Never'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Query</div>
              <code className="text-sm bg-muted px-2 py-1 rounded block font-mono">
                {alert.query || 'N/A'}
              </code>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Notification Channel</div>
              <div className="text-sm">{alert.channel || 'Not configured'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Alert ID</div>
              <code className="text-xs bg-muted px-2 py-1 rounded block">
                {alert.id}
              </code>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Status</div>
              <div className="text-sm">
                {alert.enabled ? 'Enabled' : 'Disabled'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Event History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!events || events.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No events recorded yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-4 p-3 rounded border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-shrink-0">
                    {event.state === 'triggered' && (
                      <div className="p-2 bg-red-500/10 rounded">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      </div>
                    )}
                    {event.state === 'resolved' && (
                      <div className="p-2 bg-green-500/10 rounded">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      </div>
                    )}
                    {event.state === 'silenced' && (
                      <div className="p-2 bg-gray-500/10 rounded">
                        <BellOff className="h-4 w-4 text-gray-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm capitalize">
                        {event.state}
                      </span>
                      {event.value !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          Value: {event.value}
                        </span>
                      )}
                    </div>
                    {event.message && (
                      <p className="text-sm text-muted-foreground">{event.message}</p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {timeAgo(event.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {insights && insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Related Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {insights.map((insight: any) => (
                <div
                  key={insight.id}
                  className="p-3 rounded border hover:bg-muted/50 transition-colors"
                >
                  <div className="font-medium text-sm mb-1">{insight.title}</div>
                  <p className="text-sm text-muted-foreground">{insight.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
