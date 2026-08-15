import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { formatDuration, getStatusColor } from '../../../lib/utils';

interface TraceListWidgetProps {
  data: Array<{
    id: string;
    traceId: string;
    serviceName: string;
    name: string;
    statusCode: string;
    startTime: string;
    endTime: string;
    durationMs: number;
  }>;
  config: {
    serviceName?: string;
    limit?: number;
  };
}

export function TraceListWidget({ data, config }: TraceListWidgetProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">No traces found</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {data.map((trace) => (
        <Link
          key={trace.id}
          to={`/traces/${trace.traceId}`}
          className="block p-2 rounded hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono truncate">{trace.name}</span>
                <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded font-medium shrink-0">
                  {trace.serviceName}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{new Date(trace.startTime).toLocaleTimeString()}</span>
                <span className={getStatusColor(trace.statusCode)}>
                  {trace.statusCode}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-mono">
                {formatDuration(trace.durationMs)}
              </span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
