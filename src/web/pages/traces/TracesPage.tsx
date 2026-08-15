import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Search, Play, ChevronRight, ChevronLeft } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { useProjectStore } from '../../stores/projectStore';
import { formatDuration, timeAgo, getStatusColor } from '../../lib/utils';
import { useTracesFilters, PAGE_SIZE } from '../../hooks/useTracesFilters';
import { TracesFilters } from '../../components/traces/TracesFilters';

function getEnvironmentFromAttributes(resourceAttributes: Record<string, unknown> | null | undefined): string | null {
  if (!resourceAttributes) return null;
  return (
    resourceAttributes['deployment.environment'] ||
    resourceAttributes['deployment.environment.name'] ||
    resourceAttributes['environment'] ||
    resourceAttributes['env'] ||
    null
  ) as string | null;
}

function getEnvironmentColor(environment: string) {
  switch (environment?.toLowerCase()) {
    case 'production':
    case 'prod':
      return 'bg-green-500/20 text-green-400';
    case 'staging':
    case 'stage':
      return 'bg-yellow-500/20 text-yellow-400';
    case 'development':
    case 'dev':
      return 'bg-blue-500/20 text-blue-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function TracesPage() {
  const { currentProject } = useProjectStore();
  const [filters, setFilters] = useTracesFilters();
  const navigate = useNavigate();

  const offset = (filters.page - 1) * PAGE_SIZE;

  const { data: traces, isLoading } = trpc.traces.list.useQuery(
    {
      search: filters.search || undefined,
      serviceName: filters.serviceName ?? undefined,
      statusCode: filters.status ?? undefined,
      limit: PAGE_SIZE + 1,
      offset,
    },
    {
      enabled: !!currentProject,
      refetchInterval: filters.live ? 2000 : false,
    }
  );

  const hasNextPage = (traces?.length ?? 0) > PAGE_SIZE;
  const hasPrevPage = filters.page > 1;

  const displayTraces = useMemo(() => {
    if (!traces) return [];
    const sorted = [...traces].sort((a, b) =>
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
    return sorted.slice(0, PAGE_SIZE);
  }, [traces]);

  const handleToggleLive = () => {
    setFilters({ live: !filters.live });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ search: e.target.value || null, page: 1 });
  };

  const handleNextPage = () => {
    setFilters({ page: filters.page + 1 });
  };

  const handlePrevPage = () => {
    setFilters({ page: Math.max(1, filters.page - 1) });
  };

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Select a project to view traces</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Requests</h1>
          <p className="text-muted-foreground">
            View and analyze distributed traces
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TracesFilters />
          <Button
            size="sm"
            variant="outline"
            onClick={handleToggleLive}
          >
            {filters.live ? (
              <>
                <span className="relative mr-2 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75"></span>
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500"></span>
                </span>
                Stop
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start
              </>
            )}
          </Button>
        </div>
      </div>

      {filters.live && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75"></span>
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500"></span>
          </span>
          <span className="text-sm font-medium text-green-600 dark:text-green-400">
            Live tail active
          </span>
          <span className="text-sm text-green-600/70 dark:text-green-400/70">
            — refreshing every 2 seconds
          </span>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search for a request"
            value={filters.search}
            onChange={handleSearchChange}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-muted-foreground">
                <th className="px-4 py-3 font-medium">Timestamp</th>
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Environment</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Spans</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    Loading traces...
                  </td>
                </tr>
              ) : displayTraces.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No traces found. Start sending telemetry data to see traces here.
                  </td>
                </tr>
              ) : (
                displayTraces.map((trace) => {
                  const environment = getEnvironmentFromAttributes(trace.resourceAttributes as Record<string, unknown>);
                  return (
                    <tr
                      key={trace.traceId}
                      className="border-b hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/traces/${trace.traceId}`)}
                    >
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-col">
                          <span>{new Date(trace.startTime).toLocaleTimeString()}</span>
                          <span className="text-xs text-muted-foreground">
                            {timeAgo(trace.startTime)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-muted-foreground">{trace.serviceName}</span>
                      </td>
                      <td className="px-4 py-3">
                        {environment ? (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getEnvironmentColor(environment)}`}>
                            {environment}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-primary">|</span>
                          <span className="text-sm">{trace.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono">
                        {formatDuration(trace.durationMs || 0)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {trace.spanCount}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm ${getStatusColor(trace.statusCode)}`}>
                          {trace.errorCount > 0 ? `${trace.errorCount} errors` : 'OK'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/traces/${trace.traceId}`}>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {(hasPrevPage || hasNextPage) && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-sm text-muted-foreground">
              Page {filters.page}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={!hasPrevPage}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={!hasNextPage}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
