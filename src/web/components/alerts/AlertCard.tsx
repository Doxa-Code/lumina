import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Edit, Trash2, BellOff, Bell, Clock } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { AlertStatusBadge, type AlertState } from './AlertStatusBadge';
import { timeAgo } from '../../lib/utils';

export interface Alert {
  id: string;
  name: string;
  state: AlertState;
  severity: 'critical' | 'warning' | 'info';
  description?: string;
  lastTriggered?: string;
  enabled: boolean;
  query?: string;
  threshold?: number;
  channel?: string;
}

interface AlertCardProps {
  alert: Alert;
  onEdit?: (alert: Alert) => void;
  onDelete?: (alertId: string) => void;
  onToggleEnabled?: (alertId: string, enabled: boolean) => void;
  onSilence?: (alertId: string) => void;
}

const SEVERITY_CONFIG: Record<
  Alert['severity'],
  { bgClass: string; textClass: string; icon: typeof AlertTriangle }
> = {
  critical: {
    bgClass: 'bg-red-500/10',
    textClass: 'text-red-500',
    icon: AlertTriangle,
  },
  warning: {
    bgClass: 'bg-yellow-500/10',
    textClass: 'text-yellow-500',
    icon: AlertTriangle,
  },
  info: {
    bgClass: 'bg-blue-500/10',
    textClass: 'text-blue-500',
    icon: AlertTriangle,
  },
};

export function AlertCard({
  alert,
  onEdit,
  onDelete,
  onToggleEnabled,
  onSilence,
}: AlertCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const severityConfig = SEVERITY_CONFIG[alert.severity];
  const SeverityIcon = severityConfig.icon;

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(alert.id);
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Link
                  to={`/alerts/${alert.id}`}
                  className="text-base font-semibold hover:text-primary transition-colors truncate"
                >
                  {alert.name}
                </Link>
                {!alert.enabled && (
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-500/10 text-gray-500">
                    DISABLED
                  </span>
                )}
              </div>
              {alert.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {alert.description}
                </p>
              )}
            </div>
            <AlertStatusBadge state={alert.state} />
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className={`flex items-center gap-1.5 px-2 py-1 rounded ${severityConfig.bgClass} ${severityConfig.textClass}`}>
              <SeverityIcon className="h-3 w-3" />
              {alert.severity.toUpperCase()}
            </span>
            {alert.lastTriggered && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last triggered {timeAgo(alert.lastTriggered)}
              </span>
            )}
          </div>

          {(alert.query || alert.threshold !== undefined || alert.channel) && (
            <div className="pt-3 border-t space-y-1 text-xs">
              {alert.query && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground">Query:</span>
                  <code className="font-mono text-xs bg-muted px-1 rounded truncate">
                    {alert.query}
                  </code>
                </div>
              )}
              {alert.threshold !== undefined && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground">Threshold:</span>
                  <span className="font-mono">{alert.threshold}</span>
                </div>
              )}
              {alert.channel && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground">Channel:</span>
                  <span>{alert.channel}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(alert)}
                className="flex-1"
              >
                <Edit className="h-3 w-3 mr-1" />
                Edit
              </Button>
            )}
            {onSilence && alert.state === 'firing' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSilence(alert.id)}
              >
                <BellOff className="h-3 w-3 mr-1" />
                Silence
              </Button>
            )}
            {onToggleEnabled && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onToggleEnabled(alert.id, !alert.enabled)}
              >
                {alert.enabled ? (
                  <>
                    <BellOff className="h-3 w-3 mr-1" />
                    Disable
                  </>
                ) : (
                  <>
                    <Bell className="h-3 w-3 mr-1" />
                    Enable
                  </>
                )}
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={isDeleting}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Delete Alert"
        description={`Are you sure you want to delete "${alert.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />
    </Card>
  );
}
