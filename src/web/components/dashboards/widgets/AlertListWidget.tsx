import React from 'react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { timeAgo } from '../../../lib/utils';

interface AlertListWidgetProps {
  data: Array<{
    id: string;
    name: string;
    severity: 'info' | 'warning' | 'critical';
    state: 'ok' | 'pending' | 'firing' | 'silenced';
    lastTriggeredAt: string | null;
    lastEvaluatedAt: string | null;
  }>;
  config: {
    states?: Array<'ok' | 'pending' | 'firing' | 'silenced'>;
    severities?: Array<'info' | 'warning' | 'critical'>;
    limit?: number;
  };
}

export function AlertListWidget({ data, config }: AlertListWidgetProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">No alerts found</p>
      </div>
    );
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'firing':
        return 'bg-red-500/20 text-red-500';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-500';
      case 'silenced':
        return 'bg-gray-500/20 text-gray-500';
      case 'ok':
        return 'bg-green-500/20 text-green-500';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-2">
      {data.map((alert) => (
        <div
          key={alert.id}
          className="p-3 rounded border border-border hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              {getSeverityIcon(alert.severity)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium truncate">
                  {alert.name}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${getStateColor(
                    alert.state
                  )}`}
                >
                  {alert.state}
                </span>
              </div>
              {alert.lastTriggeredAt && (
                <p className="text-xs text-muted-foreground">
                  Triggered {timeAgo(alert.lastTriggeredAt)}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
