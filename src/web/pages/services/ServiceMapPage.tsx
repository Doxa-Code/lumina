import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ArrowLeft, RefreshCw, Clock } from 'lucide-react';
import { ServiceMap, ServiceNode, ServiceEdge } from '../../components/visualizations/ServiceMap';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { trpc } from '../../lib/trpc';
import { useProjectStore } from '../../stores/projectStore';
import { formatDuration } from '../../lib/utils';
import { serializeTracesFilters } from '../../hooks/useTracesFilters';

const TIME_RANGES = [
  { value: '15m', label: 'Last 15 minutes', ms: 15 * 60 * 1000 },
  { value: '1h', label: 'Last hour', ms: 60 * 60 * 1000 },
  { value: '6h', label: 'Last 6 hours', ms: 6 * 60 * 60 * 1000 },
  { value: '24h', label: 'Last 24 hours', ms: 24 * 60 * 60 * 1000 },
  { value: '7d', label: 'Last 7 days', ms: 7 * 24 * 60 * 60 * 1000 },
];

export function ServiceMapPage() {
  const navigate = useNavigate();
  const { currentProject } = useProjectStore();
  const [timeRange, setTimeRange] = useState('15m');
  const [selectedService, setSelectedService] = useState<ServiceNode | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Stabilize time range values to avoid infinite re-renders
  const { from, to } = useMemo(() => {
    const timeRangeMs = TIME_RANGES.find(r => r.value === timeRange)?.ms || (15 * 60 * 1000);
    const now = Date.now();
    return {
      from: new Date(now - timeRangeMs).toISOString(),
      to: new Date(now).toISOString(),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, refreshKey]);

  // Fetch service statistics for the selected time range
  const { data: services, isLoading, isError, error, refetch } = trpc.traces.services.useQuery(
    { from, to },
    { enabled: !!currentProject }
  );

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
    refetch();
  };

  // Build service map data from service statistics
  // Note: For a real service dependency map, we would need to query all spans
  // and analyze parent-child relationships. For now, we'll create a simplified
  // visualization showing services without edges (connections).
  const { nodes, edges } = useMemo(() => {
    if (!services || services.length === 0) {
      return { nodes: [], edges: [] };
    }

    // Build nodes from service statistics
    const nodes: ServiceNode[] = services.map(service => ({
      id: service.serviceName,
      name: service.serviceName,
      requestCount: service.spanCount,
      errorRate: service.spanCount > 0 ? (service.errorCount / service.spanCount) * 100 : 0,
      avgLatency: service.avgDurationMs || 0,
    }));

    // For a complete service map, we would need to query all spans and analyze
    // their parent-child relationships across different services.
    // This would require a new tRPC endpoint that returns span relationships.
    // For now, we'll return an empty edges array.
    const edges: ServiceEdge[] = [];

    return { nodes, edges };
  }, [services]);

  const handleNodeClick = (node: ServiceNode) => {
    setSelectedService(node);
  };

  const handleViewTraces = (serviceName: string) => {
    const url = '/traces' + serializeTracesFilters({ serviceName });
    navigate(url);
  };

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Select a project to view service map</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/services')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Services
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Service Dependency Map</h1>
            <p className="text-muted-foreground text-sm">
              Visualize service relationships and health
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="border-2 border-border rounded px-3 py-1 text-sm bg-background"
            >
              {TIME_RANGES.map(range => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Legend */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="font-bold">Node Size:</div>
              <div className="text-muted-foreground">Request volume</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="font-bold">Edge Thickness:</div>
              <div className="text-muted-foreground">Call volume</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="font-bold">Health:</div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded-full bg-green-500" />
                <span className="text-muted-foreground">Healthy (&lt;1% errors)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded-full bg-yellow-500" />
                <span className="text-muted-foreground">Degraded (1-5% errors)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded-full bg-red-500" />
                <span className="text-muted-foreground">Unhealthy (&gt;5% errors)</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service Map */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-2">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading services...</p>
            </div>
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Activity className="h-12 w-12 mx-auto mb-4 text-red-500/50" />
              <h3 className="font-medium mb-2">Failed to load service data</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {error?.message || 'An error occurred while fetching services'}
              </p>
              <Button onClick={handleRefresh} variant="outline">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : nodes.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="font-medium mb-2">No service data available</h3>
              <p className="text-sm text-muted-foreground mb-4">
                No traces found in the selected time range
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ServiceMap
          nodes={nodes}
          edges={edges}
          onNodeClick={handleNodeClick}
        />
      )}

      {/* Service Details Panel */}
      {selectedService && (
        <Card>
          <CardHeader>
            <CardTitle>Service Details: {selectedService.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Total Requests</div>
                <div className="text-2xl font-bold font-mono">
                  {selectedService.requestCount.toLocaleString()}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Error Rate</div>
                <div className={`text-2xl font-bold font-mono ${
                  selectedService.errorRate > 5 ? 'text-red-500' :
                  selectedService.errorRate > 1 ? 'text-yellow-500' :
                  'text-green-500'
                }`}>
                  {selectedService.errorRate.toFixed(2)}%
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Avg Latency</div>
                <div className="text-2xl font-bold font-mono">
                  {formatDuration(selectedService.avgLatency)}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Health Status</div>
                <div className={`text-2xl font-bold ${
                  selectedService.errorRate > 5 ? 'text-red-500' :
                  selectedService.errorRate > 1 ? 'text-yellow-500' :
                  'text-green-500'
                }`}>
                  {selectedService.errorRate > 5 ? 'Unhealthy' :
                   selectedService.errorRate > 1 ? 'Degraded' :
                   'Healthy'}
                </div>
              </div>
            </div>

            {/* Dependencies */}
            <div className="space-y-4">
              <div>
                <h3 className="font-bold mb-2">Downstream Dependencies</h3>
                <div className="space-y-2">
                  {edges.filter(e => e.source === selectedService.id).length > 0 ? (
                    edges.filter(e => e.source === selectedService.id).map(edge => (
                      <div key={edge.target} className="flex items-center justify-between p-2 bg-muted/20 rounded">
                        <span className="font-mono text-sm">{edge.target}</span>
                        <span className="text-sm text-muted-foreground">
                          {edge.requestCount.toLocaleString()} calls
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">No downstream dependencies</div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-bold mb-2">Upstream Dependencies</h3>
                <div className="space-y-2">
                  {edges.filter(e => e.target === selectedService.id).length > 0 ? (
                    edges.filter(e => e.target === selectedService.id).map(edge => (
                      <div key={edge.source} className="flex items-center justify-between p-2 bg-muted/20 rounded">
                        <span className="font-mono text-sm">{edge.source}</span>
                        <span className="text-sm text-muted-foreground">
                          {edge.requestCount.toLocaleString()} calls
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">No upstream dependencies</div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <Button onClick={() => handleViewTraces(selectedService.name)}>
                View Traces
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
