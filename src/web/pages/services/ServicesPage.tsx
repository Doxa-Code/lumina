import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Server, Activity, AlertCircle, Clock, TrendingUp, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { trpc } from '../../lib/trpc';
import { useProjectStore } from '../../stores/projectStore';
import { formatDuration } from '../../lib/utils';
import { serializeTracesFilters } from '../../hooks/useTracesFilters';

interface ServiceStats {
  serviceName: string;
  spanCount: number;
  errorCount: number;
  avgDurationMs: number;
  p99DurationMs: number;
  traceCount: number;
  lastSeen: string;
}

function ServiceCard({ service }: { service: ServiceStats }) {
  const errorRate = service.spanCount > 0 ? (service.errorCount / service.spanCount) * 100 : 0;
  const serviceUrl = '/traces' + serializeTracesFilters({ serviceName: service.serviceName });

  return (
    <Link to={serviceUrl} className="block">
      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Server className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">{service.serviceName}</CardTitle>
                <CardDescription className="text-xs">
                  Last seen: {new Date(service.lastSeen).toLocaleString()}
                </CardDescription>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Activity className="h-3 w-3" />
              Traces
            </div>
            <div className="text-lg font-semibold">{service.traceCount.toLocaleString()}</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              Spans
            </div>
            <div className="text-lg font-semibold">{service.spanCount.toLocaleString()}</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Avg Duration
            </div>
            <div className="text-lg font-semibold">{formatDuration(service.avgDurationMs)}</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertCircle className="h-3 w-3" />
              Error Rate
            </div>
            <div className={`text-lg font-semibold ${errorRate > 5 ? 'text-red-500' : errorRate > 1 ? 'text-yellow-500' : 'text-green-500'}`}>
              {errorRate.toFixed(2)}%
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>P99 Latency</span>
            <span className="font-mono">{formatDuration(service.p99DurationMs)}</span>
          </div>
        </div>
      </CardContent>
      </Card>
    </Link>
  );
}

export function ServicesPage() {
  const { currentProject } = useProjectStore();
  const navigate = useNavigate();

  const { data: services, isLoading } = trpc.traces.services.useQuery(
    {},
    { enabled: !!currentProject }
  );

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Select a project to view services</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Services</h1>
        <p className="text-muted-foreground">
          Overview of all services sending telemetry data
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-muted h-9 w-9" />
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-24 bg-muted rounded" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="space-y-2">
                      <div className="h-3 w-16 bg-muted rounded" />
                      <div className="h-6 w-12 bg-muted rounded" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !services || services.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Server className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="font-medium mb-2">No services detected</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start sending traces to see your services here
              </p>
              <Link to="/settings/api-keys">
                <Button>
                  Get API Key
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => (
            <ServiceCard key={service.serviceName} service={service} />
          ))}
        </div>
      )}

      {services && services.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Service Health Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Service</th>
                    <th className="text-right py-2 font-medium">Traces</th>
                    <th className="text-right py-2 font-medium">Spans</th>
                    <th className="text-right py-2 font-medium">Errors</th>
                    <th className="text-right py-2 font-medium">Error Rate</th>
                    <th className="text-right py-2 font-medium">Avg Duration</th>
                    <th className="text-right py-2 font-medium">P99</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((service) => {
                    const errorRate = service.spanCount > 0
                      ? (service.errorCount / service.spanCount) * 100
                      : 0;
                    const serviceUrl = '/traces' + serializeTracesFilters({ serviceName: service.serviceName });
                    return (
                      <tr
                        key={service.serviceName}
                        className="border-b hover:bg-muted/50 cursor-pointer"
                        onClick={() => navigate(serviceUrl)}
                      >
                        <td className="py-2 text-primary">
                          {service.serviceName}
                        </td>
                        <td className="text-right py-2 font-mono">
                          {service.traceCount.toLocaleString()}
                        </td>
                        <td className="text-right py-2 font-mono">
                          {service.spanCount.toLocaleString()}
                        </td>
                        <td className="text-right py-2 font-mono text-red-500">
                          {service.errorCount.toLocaleString()}
                        </td>
                        <td className={`text-right py-2 font-mono ${
                          errorRate > 5 ? 'text-red-500' : errorRate > 1 ? 'text-yellow-500' : 'text-green-500'
                        }`}>
                          {errorRate.toFixed(2)}%
                        </td>
                        <td className="text-right py-2 font-mono">
                          {formatDuration(service.avgDurationMs)}
                        </td>
                        <td className="text-right py-2 font-mono">
                          {formatDuration(service.p99DurationMs)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
