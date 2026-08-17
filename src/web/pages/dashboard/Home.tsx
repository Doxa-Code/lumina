import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
  Activity,
  AlertTriangle,
  Clock,
  Server,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Zap,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { trpc } from '../../lib/trpc';
import { formatDuration, timeAgo } from '../../lib/utils';

function HealthIndicator({ errorRate }: { errorRate: number }) {
  if (errorRate === 0) {
    return (
      <div className="flex items-center gap-2 text-green-500">
        <CheckCircle2 className="h-5 w-5" />
        <span className="font-medium">Healthy</span>
      </div>
    );
  }
  if (errorRate < 1) {
    return (
      <div className="flex items-center gap-2 text-green-500">
        <CheckCircle2 className="h-5 w-5" />
        <span className="font-medium">Good</span>
      </div>
    );
  }
  if (errorRate < 5) {
    return (
      <div className="flex items-center gap-2 text-yellow-500">
        <AlertCircle className="h-5 w-5" />
        <span className="font-medium">Degraded</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-red-500">
      <XCircle className="h-5 w-5" />
      <span className="font-medium">Unhealthy</span>
    </div>
  );
}

export function HomePage() {
  const { currentProject } = useProjectStore();
  const navigate = useNavigate();

  const { data: services, isLoading: servicesLoading } = trpc.traces.services.useQuery(
    {},
    { enabled: !!currentProject }
  );

  const { data: slowestEndpoints, isLoading: slowestLoading } = trpc.traces.slowestEndpoints.useQuery(
    { limit: 5 },
    { enabled: !!currentProject }
  );

  const { data: errorEndpoints, isLoading: errorsLoading } = trpc.traces.errorEndpoints.useQuery(
    { limit: 5 },
    { enabled: !!currentProject }
  );

  const { data: recentErrors, isLoading: recentErrorsLoading } = trpc.traces.recentErrors.useQuery(
    { limit: 5 },
    { enabled: !!currentProject }
  );

  // Calculate aggregated stats
  const totalRequests = services?.reduce((sum, s) => sum + s.traceCount, 0) || 0;
  const totalErrors = services?.reduce((sum, s) => sum + s.errorCount, 0) || 0;
  const totalSpans = services?.reduce((sum, s) => sum + s.spanCount, 0) || 0;
  const overallErrorRate = totalSpans > 0 ? (totalErrors / totalSpans) * 100 : 0;
  const avgLatency = services && services.length > 0
    ? services.reduce((sum, s) => sum + s.avgDurationMs, 0) / services.length
    : 0;

  // Find problematic services (error rate > 1%)
  const problematicServices = services?.filter(s => {
    const errorRate = s.spanCount > 0 ? (s.errorCount / s.spanCount) * 100 : 0;
    return errorRate > 1;
  }).sort((a, b) => {
    const rateA = a.spanCount > 0 ? (a.errorCount / a.spanCount) * 100 : 0;
    const rateB = b.spanCount > 0 ? (b.errorCount / b.spanCount) * 100 : 0;
    return rateB - rateA;
  }) || [];

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">No project selected</h2>
          <p className="text-muted-foreground mt-2">
            Select a project from the header to get started
          </p>
        </div>
      </div>
    );
  }

  const isLoading = servicesLoading || slowestLoading || errorsLoading;
  const hasData = services && services.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          {currentProject.name} health and performance overview
        </p>
      </div>

      {/* Health Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-7 w-24 bg-muted rounded animate-pulse" />
            ) : (
              <HealthIndicator errorRate={overallErrorRate} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Requests
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-8 w-16 bg-muted rounded animate-pulse" />
            ) : (
              <div className="text-2xl font-bold">{totalRequests.toLocaleString()}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Error Rate
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-8 w-16 bg-muted rounded animate-pulse" />
            ) : (
              <div className={`text-2xl font-bold ${overallErrorRate > 5 ? 'text-red-500' : overallErrorRate > 1 ? 'text-yellow-500' : 'text-green-500'}`}>
                {overallErrorRate.toFixed(2)}%
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Latency
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-8 w-16 bg-muted rounded animate-pulse" />
            ) : (
              <div className="text-2xl font-bold">{formatDuration(avgLatency)}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {!hasData && !isLoading ? (
        /* Getting Started */
        <Card>
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
            <CardDescription>
              Start sending telemetry data to see insights here
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Link to="/settings/api-keys" className="block p-4 rounded-lg border hover:border-primary/50 transition-colors">
                <div className="font-medium mb-1">1. Create API Key</div>
                <p className="text-sm text-muted-foreground">Generate a key to authenticate your telemetry</p>
              </Link>
              <Link to="/docs/instrumentation" className="block p-4 rounded-lg border hover:border-primary/50 transition-colors">
                <div className="font-medium mb-1">2. Instrument App</div>
                <p className="text-sm text-muted-foreground">Add OpenTelemetry to your application</p>
              </Link>
              <div className="p-4 rounded-lg border bg-muted/30">
                <div className="font-medium mb-1">3. View Data</div>
                <p className="text-sm text-muted-foreground">Data will appear here automatically</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Problematic Services Alert */}
          {problematicServices.length > 0 && (
            <Card className="border-yellow-500/30 bg-yellow-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                  <AlertCircle className="h-5 w-5" />
                  Services Needing Attention
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {problematicServices.slice(0, 5).map((service) => {
                    const errorRate = service.spanCount > 0 ? (service.errorCount / service.spanCount) * 100 : 0;
                    return (
                      <Link
                        key={service.serviceName}
                        to={`/traces?service=${encodeURIComponent(service.serviceName)}`}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-sm hover:bg-yellow-500/20 transition-colors"
                      >
                        <span className="font-medium">{service.serviceName}</span>
                        <span className="text-yellow-600/70 dark:text-yellow-400/70">{errorRate.toFixed(1)}% errors</span>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Slowest Endpoints */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Slowest Endpoints
                  </CardTitle>
                  <CardDescription>Endpoints with highest average latency</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {slowestLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                    ))}
                  </div>
                ) : !slowestEndpoints || slowestEndpoints.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>
                ) : (
                  <div className="space-y-2">
                    {slowestEndpoints.map((endpoint, i) => (
                      <div
                        key={`${endpoint.serviceName}-${endpoint.name}`}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/traces?search=${encodeURIComponent(endpoint.name)}`)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{endpoint.name}</div>
                          <div className="text-xs text-muted-foreground">{endpoint.serviceName}</div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="font-mono text-sm font-medium text-orange-500">
                            {formatDuration(endpoint.avgDurationMs)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            p95: {formatDuration(endpoint.p95DurationMs)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Error Prone Endpoints */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    Error Prone Endpoints
                  </CardTitle>
                  <CardDescription>Endpoints with most errors</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {errorsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                    ))}
                  </div>
                ) : !errorEndpoints || errorEndpoints.length === 0 ? (
                  <div className="text-center py-4">
                    <CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-2" />
                    <p className="text-sm text-muted-foreground">No errors detected</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {errorEndpoints.map((endpoint) => (
                      <div
                        key={`${endpoint.serviceName}-${endpoint.name}`}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/traces?search=${encodeURIComponent(endpoint.name)}&status=ERROR`)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{endpoint.name}</div>
                          <div className="text-xs text-muted-foreground">{endpoint.serviceName}</div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="font-mono text-sm font-medium text-red-500">
                            {endpoint.errorCount} errors
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {endpoint.errorRate.toFixed(1)}% rate
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Recent Errors */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    Recent Errors
                  </CardTitle>
                  <CardDescription>Latest error occurrences</CardDescription>
                </div>
                <Link to="/errors" className="text-sm text-primary hover:underline flex items-center gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </CardHeader>
              <CardContent>
                {recentErrorsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                    ))}
                  </div>
                ) : !recentErrors || recentErrors.length === 0 ? (
                  <div className="text-center py-4">
                    <CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-2" />
                    <p className="text-sm text-muted-foreground">No recent errors</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentErrors.map((error) => (
                      <Link
                        key={`${error.traceId}-${error.spanId}`}
                        to={`/traces/${error.traceId}`}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate text-red-500">{error.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {error.statusMessage || error.serviceName}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-xs text-muted-foreground">
                            {timeAgo(error.startTime)}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Services */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Server className="h-4 w-4 text-muted-foreground" />
                    Services
                  </CardTitle>
                  <CardDescription>All detected services</CardDescription>
                </div>
                <Link to="/services" className="text-sm text-primary hover:underline flex items-center gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </CardHeader>
              <CardContent>
                {servicesLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                    ))}
                  </div>
                ) : !services || services.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No services yet</p>
                ) : (
                  <div className="space-y-2">
                    {services.slice(0, 5).map((service) => {
                      const errorRate = service.spanCount > 0 ? (service.errorCount / service.spanCount) * 100 : 0;
                      return (
                        <Link
                          key={service.serviceName}
                          to={`/traces?service=${encodeURIComponent(service.serviceName)}`}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${errorRate > 5 ? 'bg-red-500' : errorRate > 1 ? 'bg-yellow-500' : 'bg-green-500'}`} />
                            <div>
                              <div className="font-medium text-sm">{service.serviceName}</div>
                              <div className="text-xs text-muted-foreground">
                                {service.traceCount.toLocaleString()} requests
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-mono">{formatDuration(service.avgDurationMs)}</div>
                            <div className={`text-xs ${errorRate > 1 ? 'text-red-500' : 'text-muted-foreground'}`}>
                              {errorRate.toFixed(1)}% errors
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
