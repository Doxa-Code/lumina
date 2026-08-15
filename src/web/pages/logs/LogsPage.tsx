import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Search,
  Filter,
  Play,
  ChevronDown,
  ChevronRight,
  X,
  Copy,
  Check,
  Terminal,
  Code,
  BarChart3,
  FileText,
} from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { useProjectStore } from '../../stores/projectStore';
import { getSeverityColor } from '../../lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../components/ui/popover';
import { Label } from '../../components/ui/label';
import { useLogsFilters, severityOptions, PAGE_SIZE } from '../../hooks/useLogsFilters';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface LogEntry {
  id: string;
  projectId: string;
  traceId?: string | null;
  spanId?: string | null;
  serviceName: string;
  serviceNamespace?: string | null;
  timestamp: string;
  observedTimestamp: string;
  severityNumber: number;
  severityText?: string | null;
  body?: string | null;
  attributes: Record<string, unknown>;
  resourceAttributes: Record<string, unknown>;
}

function LogAttribute({ name, value }: { name: string; value: unknown }) {
  const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const isString = typeof value === 'string';
  const isNumber = typeof value === 'number';
  const isBoolean = typeof value === 'boolean';

  return (
    <div className="flex items-start gap-2 font-mono text-sm">
      <span className="text-blue-400">@{name}:</span>
      <span
        className={
          isString
            ? 'text-green-400'
            : isNumber
            ? 'text-yellow-400'
            : isBoolean
            ? 'text-purple-400'
            : 'text-foreground'
        }
      >
        {isString ? `"${displayValue}"` : displayValue}
        {!isBoolean && ','}
      </span>
    </div>
  );
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

function LogRow({
  log,
  isExpanded,
  onToggle,
}: {
  log: LogEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const allAttributes = useMemo(() => {
    return {
      ...log.attributes,
      ...log.resourceAttributes,
      ...(log.traceId && { traceId: log.traceId }),
      ...(log.spanId && { spanId: log.spanId }),
    };
  }, [log]);

  // Extract environment from resource attributes (OpenTelemetry convention)
  const environment = useMemo(() => {
    const attrs = log.resourceAttributes || {};
    return (
      attrs['deployment.environment'] ||
      attrs['deployment.environment.name'] ||
      attrs['environment'] ||
      attrs['env'] ||
      null
    ) as string | null;
  }, [log.resourceAttributes]);

  return (
    <div className="border-b border-border/50">
      <div
        className="flex items-start py-2 px-4 cursor-pointer hover:bg-muted/50 transition-colors gap-4"
        onClick={onToggle}
      >
        <button className="mt-1 text-muted-foreground">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs text-muted-foreground font-mono">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded font-medium ${getSeverityColor(
                log.severityNumber
              )} bg-current/10`}
            >
              {log.severityText || 'INFO'}
            </span>
            <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded font-medium">
              {log.serviceName}
            </span>
            {environment && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getEnvironmentColor(environment)}`}>
                {environment}
              </span>
            )}
          </div>
          <div className="text-sm font-mono truncate text-muted-foreground">
            {log.body || '(empty)'}
          </div>
        </div>

        {log.traceId && (
          <Link
            to={`/traces/${log.traceId}`}
            className="text-xs text-primary hover:underline shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            View trace
          </Link>
        )}
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pt-2 bg-muted/30 border-t border-border/50 ml-8">
          <div className="bg-background rounded-lg p-4 border border-border/50">
            {log.body && (
              <LogAttribute name="message" value={log.body} />
            )}
            <LogAttribute name="timestamp" value={log.timestamp} />
            <LogAttribute name="severity" value={log.severityText || 'INFO'} />
            <LogAttribute name="severityNumber" value={log.severityNumber} />
            <LogAttribute name="service" value={log.serviceName} />
            {Object.entries(allAttributes).map(([key, value]) => (
              <LogAttribute key={key} name={key} value={value} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2">
      {copied ? (
        <Check className="h-3 w-3 mr-1" />
      ) : (
        <Copy className="h-3 w-3 mr-1" />
      )}
      {label}
    </Button>
  );
}

function EmptyState() {
  const endpoint = window.location.origin;
  const curlExample = `curl -X POST ${endpoint}/v1/logs \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -d '{
    "resourceLogs": [{
      "resource": {
        "attributes": [{
          "key": "service.name",
          "value": { "stringValue": "my-service" }
        }]
      },
      "scopeLogs": [{
        "logRecords": [{
          "timeUnixNano": "'$(date +%s)000000000'",
          "severityNumber": 9,
          "severityText": "INFO",
          "body": { "stringValue": "Hello from my application!" },
          "attributes": [{
            "key": "user.id",
            "value": { "stringValue": "user-123" }
          }]
        }]
      }]
    }]
  }'`;

  const nodeExample = `import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { LoggerProvider, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';

const logExporter = new OTLPLogExporter({
  url: '${endpoint}/v1/logs',
  headers: {
    'Authorization': 'Bearer <YOUR_API_KEY>',
  },
});

const loggerProvider = new LoggerProvider();
loggerProvider.addLogRecordProcessor(new SimpleLogRecordProcessor(logExporter));

const logger = loggerProvider.getLogger('my-service');
logger.emit({ body: 'Hello from my application!' });`;

  const [activeTab, setActiveTab] = useState<'curl' | 'node'>('curl');

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Terminal className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No logs yet</h3>
          <p className="text-muted-foreground">
            Start sending logs to see them here. Use the OpenTelemetry Protocol
            (OTLP) to ingest logs.
          </p>
        </div>

        <div className="text-left bg-muted/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-2">
              <Button
                variant={activeTab === 'curl' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('curl')}
              >
                <Terminal className="h-4 w-4 mr-2" />
                cURL
              </Button>
              <Button
                variant={activeTab === 'node' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('node')}
              >
                <Code className="h-4 w-4 mr-2" />
                Node.js
              </Button>
            </div>
            <CopyButton
              text={activeTab === 'curl' ? curlExample : nodeExample}
              label="Copy"
            />
          </div>
          <pre className="text-xs bg-background p-4 rounded overflow-x-auto font-mono whitespace-pre-wrap">
            {activeTab === 'curl' ? curlExample : nodeExample}
          </pre>
        </div>

        <p className="text-sm text-muted-foreground mt-4">
          Need an API key?{' '}
          <Link to="/settings/api-keys" className="text-primary hover:underline">
            Create one in Settings
          </Link>
        </p>
      </div>
    </div>
  );
}

interface LogsChartProps {
  data: Array<{
    timestamp: string;
    count: number;
    errorCount: number;
    warnCount: number;
  }>;
}

function LogsChart({ data }: LogsChartProps) {
  const chartData = useMemo(() => {
    return data.map((item) => ({
      time: new Date(item.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      total: item.count,
      errors: item.errorCount,
      warnings: item.warnCount,
      info: item.count - item.errorCount - item.warnCount,
    }));
  }, [data]);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <div className="h-32 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} barCategoryGap={1}>
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis hide />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              fontSize: '12px',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Bar dataKey="info" stackId="a" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
          <Bar dataKey="warnings" stackId="a" fill="#eab308" radius={0} />
          <Bar dataKey="errors" stackId="a" fill="#ef4444" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type ViewTab = 'chart' | 'raw';

export function LogsPage() {
  const { currentProject } = useProjectStore();
  const [filters, setFilters] = useLogsFilters();
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>('chart');

  // Get time range for stats (last hour)
  const timeRange = useMemo(() => {
    const now = new Date();
    const from = new Date(now.getTime() - 60 * 60 * 1000);
    return {
      from: from.toISOString(),
      to: now.toISOString(),
    };
  }, []);

  const { data: logs, isLoading } = trpc.logs.list.useQuery(
    {
      search: filters.search || undefined,
      severityNumber: filters.severity ?? undefined,
      serviceName: filters.serviceName ?? undefined,
      limit: PAGE_SIZE,
    },
    {
      enabled: !!currentProject,
      refetchInterval: filters.live ? 2000 : false,
    }
  );

  const { data: stats } = trpc.logs.stats.useQuery(
    {
      from: timeRange.from,
      to: timeRange.to,
      interval: '5m',
    },
    {
      enabled: !!currentProject && activeTab === 'chart',
      refetchInterval: filters.live ? 5000 : false,
    }
  );

  const toggleLog = (logId: string) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const handleToggleLive = () => {
    setFilters({ live: !filters.live });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ search: e.target.value || '' });
  };

  const handleSeverityChange = (value: number | undefined) => {
    setFilters({ severity: value ?? null });
  };

  const handleServiceNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ serviceName: e.target.value || null });
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      severity: null,
      serviceName: null,
    });
  };

  const hasActiveFilters =
    filters.serviceName || filters.severity !== null || filters.search;

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Select a project to view logs</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Logs</h1>
          <p className="text-muted-foreground">
            View and search application logs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="relative">
                <Filter className="h-4 w-4 mr-2" />
                Filter
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Filters</h4>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Service Name</Label>
                  <Input
                    placeholder="Filter by service name"
                    value={filters.serviceName ?? ''}
                    onChange={handleServiceNameChange}
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={() => setFilterOpen(false)}
                >
                  Apply Filters
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Button size="sm" variant="outline" onClick={handleToggleLive}>
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

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Full text logs search"
            value={filters.search}
            onChange={handleSearchChange}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {severityOptions.map((option) => (
            <Button
              key={option.label}
              variant={(filters.severity ?? undefined) === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSeverityChange(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        {/* Tabs */}
        <div className="flex items-center justify-between border-b px-4">
          <div className="flex">
            <button
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'chart'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('chart')}
            >
              <BarChart3 className="h-4 w-4" />
              Visualisation
            </button>
            <button
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'raw'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('raw')}
            >
              <FileText className="h-4 w-4" />
              Raw data
            </button>
          </div>
          {logs && logs.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {logs.length} logs
            </span>
          )}
        </div>

        {/* Chart */}
        {activeTab === 'chart' && stats && stats.length > 0 && (
          <div className="p-4 border-b">
            <LogsChart data={stats} />
          </div>
        )}

        {/* Logs List */}
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            Loading logs...
          </div>
        ) : logs?.length === 0 ? (
          <EmptyState />
        ) : activeTab === 'raw' ? (
          <div className="p-4">
            <pre className="text-xs font-mono whitespace-pre-wrap overflow-auto max-h-[600px] bg-muted/50 rounded-lg p-4">
              {JSON.stringify(logs, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {logs?.map((log) => (
              <LogRow
                key={log.id}
                log={log}
                isExpanded={expandedLogs.has(log.id)}
                onToggle={() => toggleLog(log.id)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
