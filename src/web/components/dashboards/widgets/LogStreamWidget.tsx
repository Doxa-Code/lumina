import React from 'react';
import { getSeverityColor } from '../../../lib/utils';

interface LogStreamWidgetProps {
  data: Array<{
    id: string;
    timestamp: string;
    severityNumber: number;
    severityText: string | null;
    body: string | null;
    serviceName: string;
    attributes: Record<string, any>;
  }>;
  config: {
    serviceName?: string;
    limit?: number;
  };
}

export function LogStreamWidget({ data, config }: LogStreamWidgetProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">No logs found</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 font-mono text-xs">
      {data.map((log) => (
        <div
          key={log.id}
          className="p-2 rounded hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
        >
          <div className="flex items-start gap-2">
            <span className="text-muted-foreground shrink-0">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <span
              className={`${getSeverityColor(
                log.severityNumber
              )} shrink-0 font-medium`}
            >
              {log.severityText || 'INFO'}
            </span>
            <span className="text-primary shrink-0">
              [{log.serviceName}]
            </span>
            <span className="truncate text-muted-foreground">
              {log.body || '(empty)'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
