import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { CodeBlock } from '../../components/ui/code-block';
import { Activity, FileText, AlertTriangle, Clock, Server, ArrowRight } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { trpc } from '../../lib/trpc';
import { formatDuration } from '../../lib/utils';

export function HomePage() {
  const { currentProject } = useProjectStore();

  const { data: services, isLoading: servicesLoading } = trpc.traces.services.useQuery(
    {},
    { enabled: !!currentProject }
  );

  // Calculate aggregated stats from services data
  const totalSpans = services?.reduce((sum, s) => sum + s.spanCount, 0) || 0;
  const totalErrors = services?.reduce((sum, s) => sum + s.errorCount, 0) || 0;
  const avgLatency = services && services.length > 0
    ? services.reduce((sum, s) => sum + s.avgDurationMs, 0) / services.length
    : 0;

  const stats = [
    {
      title: 'Total Spans',
      value: totalSpans.toLocaleString(),
      icon: Activity,
    },
    {
      title: 'Total Errors',
      value: totalErrors.toLocaleString(),
      icon: AlertTriangle,
    },
    {
      title: 'Avg Latency',
      value: formatDuration(avgLatency),
      icon: Clock,
    },
  ];

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-muted-foreground">
          Overview of all services in {currentProject.name}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {servicesLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-4 w-4 bg-muted rounded" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 w-16 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Getting Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4">
              <h3 className="font-medium mb-2">1. Create an API Key</h3>
              <p className="text-sm text-muted-foreground">
                Go to Settings &gt; API Keys to create an API key for your project.
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="font-medium mb-2">2. Instrument your application</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Install OpenTelemetry SDK and configure the exporters:
              </p>
              <CodeBlock
                language="typescript"
                showLineNumbers={true}
                highlightLines={[8, 11, 12, 17, 18, 23, 24]}
                code={`import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';

const headers = { 'Authorization': 'Bearer <your-api-key>' };

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: '${window.location.origin}/v1/traces',
    headers,
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: '${window.location.origin}/v1/metrics',
      headers,
    }),
  }),
  logRecordProcessor: new BatchLogRecordProcessor(
    new OTLPLogExporter({
      url: '${window.location.origin}/v1/logs',
      headers,
    })
  ),
});

sdk.start();`}
              />
              <div className="mt-3">
                <Link
                  to="/docs/instrumentation"
                  className="text-primary hover:underline text-sm flex items-center gap-1"
                >
                  View examples for all languages
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="font-medium mb-2">3. Start sending data</h3>
              <p className="text-sm text-muted-foreground">
                Once your application is instrumented, traces will appear here automatically.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Services Overview</CardTitle>
            <Link to="/services" className="text-sm text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {servicesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-muted rounded-md" />
                      <div className="h-4 w-24 bg-muted rounded" />
                    </div>
                    <div className="h-4 w-16 bg-muted rounded" />
                  </div>
                ))}
              </div>
            ) : !services || services.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Server className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No services detected yet</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {services.slice(0, 5).map((service) => {
                  const errorRate = service.spanCount > 0
                    ? (service.errorCount / service.spanCount) * 100
                    : 0;
                  return (
                    <Link
                      key={service.serviceName}
                      to={`/traces?service=${encodeURIComponent(service.serviceName)}`}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-primary/10">
                          <Server className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{service.serviceName}</div>
                          <div className="text-xs text-muted-foreground">
                            {service.traceCount.toLocaleString()} traces
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-medium ${
                          errorRate > 5 ? 'text-red-500' : errorRate > 1 ? 'text-yellow-500' : 'text-green-500'
                        }`}>
                          {errorRate.toFixed(1)}% errors
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDuration(service.avgDurationMs)} avg
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
    </div>
  );
}
