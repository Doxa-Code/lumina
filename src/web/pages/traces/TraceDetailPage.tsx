import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Share2, RefreshCw, Copy, FileText, ZoomIn, ZoomOut, Maximize2, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { TraceTree } from '../../components/traces/TraceTree';
import { TraceWaterfall } from '../../components/traces/TraceWaterfall';
import { SpanDetail } from '../../components/traces/SpanDetail';
import { ToastContainer } from '../../components/ui/toast';
import { trpc } from '../../lib/trpc';
import { useProjectStore } from '../../stores/projectStore';
import { formatDuration, timeAgo } from '../../lib/utils';
import { useToast } from '../../hooks/useToast';

type ViewType = 'tree' | 'waterfall';
type TabType = 'logs' | 'trace';

interface Log {
  id: string;
  traceId: string | null;
  spanId: string | null;
  serviceName: string;
  timestamp: string;
  severityNumber: number;
  severityText: string | null;
  body: string | null;
  attributes: unknown;
  resourceAttributes?: unknown;
}

function LogEntry({ log }: { log: Log }) {
  const severityColors: Record<string, string> = {
    TRACE: 'text-gray-400',
    DEBUG: 'text-blue-400',
    INFO: 'text-green-400',
    WARN: 'text-yellow-400',
    ERROR: 'text-red-400',
    FATAL: 'text-red-600',
  };

  const severityColor = severityColors[log.severityText || 'INFO'] || 'text-muted-foreground';

  return (
    <div className="flex items-start gap-3 py-2 px-4 border-b hover:bg-accent/30 font-mono text-xs">
      <span className="text-muted-foreground whitespace-nowrap">
        {new Date(log.timestamp).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          fractionalSecondDigits: 3,
        })}
      </span>
      <span className={`${severityColor} font-medium w-12`}>
        {log.severityText || 'INFO'}
      </span>
      <span className="text-muted-foreground">
        {log.serviceName}
      </span>
      <span className="flex-1 truncate">
        {log.body || JSON.stringify(log.attributes)}
      </span>
    </div>
  );
}

export function TraceDetailPage() {
  const { traceId } = useParams<{ traceId: string }>();
  const { currentProject } = useProjectStore();
  const [selectedSpanId, setSelectedSpanId] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<TabType>('trace');
  const [viewType, setViewType] = useState<ViewType>('tree');
  const [isExpanded, setIsExpanded] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const { toasts, showToast, dismissToast } = useToast();

  const { data: trace, isLoading, refetch, isFetching } = trpc.traces.get.useQuery(
    { traceId: traceId! },
    { enabled: !!currentProject && !!traceId }
  );

  const { data: traceLogs, isLoading: isLoadingLogs } = trpc.logs.list.useQuery(
    { traceId: traceId!, limit: 100 },
    { enabled: !!currentProject && !!traceId && activeTab === 'logs' }
  );

  const selectedSpan = trace?.spans.find((s) => s.spanId === selectedSpanId);

  const handleRefresh = useCallback(async () => {
    await refetch();
    showToast('Trace refreshed', 'success');
  }, [refetch, showToast]);

  const handleShare = useCallback(() => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    showToast('Link copied to clipboard', 'success');
  }, [showToast]);

  const handleCopyId = useCallback(() => {
    if (trace) {
      navigator.clipboard.writeText(trace.traceId);
      showToast('Trace ID copied to clipboard', 'success');
    }
  }, [trace, showToast]);

  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 2));
    showToast(`Zoom: ${Math.round((zoomLevel + 0.25) * 100)}%`, 'info');
  }, [zoomLevel, showToast]);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
    showToast(`Zoom: ${Math.round((zoomLevel - 0.25) * 100)}%`, 'info');
  }, [zoomLevel, showToast]);

  const handleToggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Select a project</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading trace...
        </div>
      </div>
    );
  }

  if (!trace) {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-4">
        <p className="text-muted-foreground">Trace not found</p>
        <Link to="/traces">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to traces
          </Button>
        </Link>
      </div>
    );
  }

  const rootSpan = trace.spans.find((s) => !s.parentSpanId);

  return (
    <div className="h-full flex flex-col">
      {/* Header with trace info */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/traces">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {new Date(trace.startTime).toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">
                ({timeAgo(trace.startTime)})
              </span>
            </div>
            <h1 className="text-lg font-semibold">{rootSpan?.name || 'Trace'}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyId}>
            <Copy className="h-4 w-4 mr-2" />
            Copy ID
          </Button>
        </div>
      </div>

      {/* Summary row like Baselime */}
      <div className="bg-card border rounded-lg mb-4 shrink-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="text-left py-2 px-4 font-medium">Timestamp (UTC)</th>
              <th className="text-left py-2 px-4 font-medium">Namespace</th>
              <th className="text-left py-2 px-4 font-medium">Duration</th>
              <th className="text-left py-2 px-4 font-medium">Spans</th>
              <th className="text-left py-2 px-4 font-medium">Services</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-3 px-4 font-mono text-xs">
                {new Date(trace.startTime).toISOString().replace('T', ', ').slice(0, -5)}
              </td>
              <td className="py-3 px-4">{rootSpan?.serviceName || '-'}</td>
              <td className="py-3 px-4 font-mono">{formatDuration(trace.durationMs)}</td>
              <td className="py-3 px-4 font-mono">{trace.spanCount}</td>
              <td className="py-3 px-4">{trace.services.join(', ')}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Tabs: Logs | Trace */}
      <div className="flex items-center justify-between border-b mb-4 shrink-0">
        <div className="flex">
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'logs'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('logs')}
          >
            Logs
            {traceLogs && traceLogs.length > 0 && (
              <span className="ml-2 bg-primary/20 text-primary text-xs px-1.5 rounded">
                {traceLogs.length}
              </span>
            )}
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'trace'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('trace')}
          >
            Trace
            <span className="bg-primary/20 text-primary text-xs px-1.5 rounded">
              {trace.spanCount}
            </span>
          </button>
        </div>

        {/* View controls */}
        {activeTab === 'trace' && (
          <div className="flex items-center gap-2 pb-2">
            <div className="flex bg-muted rounded-md p-0.5">
              <button
                className={`px-3 py-1 text-xs rounded ${
                  viewType === 'tree' ? 'bg-background shadow' : 'text-muted-foreground'
                }`}
                onClick={() => setViewType('tree')}
              >
                Tree
              </button>
              <button
                className={`px-3 py-1 text-xs rounded ${
                  viewType === 'waterfall' ? 'bg-background shadow' : 'text-muted-foreground'
                }`}
                onClick={() => setViewType('waterfall')}
              >
                Waterfall
              </button>
            </div>
            <div className="flex items-center gap-1 border-l pl-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 2}
                title="Zoom in"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.5}
                title="Zoom out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleToggleExpand}
                title="Expand view"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Expanded fullscreen overlay */}
      {isExpanded && activeTab === 'trace' && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          {/* Expanded header */}
          <div className="flex items-center justify-between p-4 border-b shrink-0">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold">{rootSpan?.name || 'Trace'}</h2>
              <span className="text-sm text-muted-foreground">
                {trace.spanCount} spans
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-muted rounded-md p-0.5">
                <button
                  className={`px-3 py-1 text-xs rounded ${
                    viewType === 'tree' ? 'bg-background shadow' : 'text-muted-foreground'
                  }`}
                  onClick={() => setViewType('tree')}
                >
                  Tree
                </button>
                <button
                  className={`px-3 py-1 text-xs rounded ${
                    viewType === 'waterfall' ? 'bg-background shadow' : 'text-muted-foreground'
                  }`}
                  onClick={() => setViewType('waterfall')}
                >
                  Waterfall
                </button>
              </div>
              <div className="flex items-center gap-1 border-l pl-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 2}
                  title="Zoom in"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 0.5}
                  title="Zoom out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleToggleExpand}
                title="Close expanded view"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* Expanded content */}
          <div className="flex-1 flex overflow-hidden">
            <div
              className="flex-1 overflow-auto"
              style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}
            >
              {viewType === 'tree' ? (
                <TraceTree
                  spans={trace.spans}
                  selectedSpanId={selectedSpanId}
                  onSpanClick={(span) => setSelectedSpanId(span.spanId)}
                />
              ) : (
                <TraceWaterfall
                  spans={trace.spans}
                  selectedSpanId={selectedSpanId}
                  onSpanClick={(span) => setSelectedSpanId(span.spanId)}
                  traceStartTime={trace.startTime}
                  traceDurationMs={trace.durationMs}
                />
              )}
            </div>
            {selectedSpan && (
              <SpanDetail
                span={selectedSpan}
                onClose={() => setSelectedSpanId(undefined)}
                onCopySuccess={() => showToast('Copied to clipboard', 'success')}
              />
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex overflow-hidden rounded-lg border bg-card">
        {activeTab === 'trace' && (
          <>
            <div
              className="flex-1 overflow-auto"
              style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}
            >
              {viewType === 'tree' ? (
                <TraceTree
                  spans={trace.spans}
                  selectedSpanId={selectedSpanId}
                  onSpanClick={(span) => setSelectedSpanId(span.spanId)}
                />
              ) : (
                <TraceWaterfall
                  spans={trace.spans}
                  selectedSpanId={selectedSpanId}
                  onSpanClick={(span) => setSelectedSpanId(span.spanId)}
                  traceStartTime={trace.startTime}
                  traceDurationMs={trace.durationMs}
                />
              )}
            </div>
            {selectedSpan && (
              <SpanDetail
                span={selectedSpan}
                onClose={() => setSelectedSpanId(undefined)}
                onCopySuccess={() => showToast('Copied to clipboard', 'success')}
              />
            )}
          </>
        )}

        {activeTab === 'logs' && (
          <div className="flex-1 flex flex-col">
            {isLoadingLogs ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                Loading logs...
              </div>
            ) : traceLogs && traceLogs.length > 0 ? (
              <div className="flex-1 overflow-auto">
                {traceLogs.map((log) => (
                  <LogEntry key={log.id} log={log} />
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Logs correlated with this trace</p>
                  <p className="text-sm">No logs found for this trace</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
