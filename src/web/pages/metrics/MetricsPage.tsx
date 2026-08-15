import { useState, useCallback } from 'react';
import { BarChart3, TrendingUp, Clock, Filter, RefreshCw, X, Activity } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { trpc } from '../../lib/trpc';
import { useProjectStore } from '../../stores/projectStore';
import { timeAgo } from '../../lib/utils';
import {
  AreaChart,
  Area,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface MetricSummary {
  name: string;
  type: string;
  count: number;
  lastValue: number;
  avgValue: number;
  minValue: number;
  maxValue: number;
  lastSeen: string;
}

const TIME_RANGES = [
  { value: '15m', label: '15m' },
  { value: '1h', label: '1h' },
  { value: '6h', label: '6h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
];

const TYPE_COLORS: Record<string, { bg: string; text: string; chart: string }> = {
  GAUGE: { bg: 'bg-blue-500/10', text: 'text-blue-500', chart: '#3b82f6' },
  COUNTER: { bg: 'bg-green-500/10', text: 'text-green-500', chart: '#22c55e' },
  HISTOGRAM: { bg: 'bg-purple-500/10', text: 'text-purple-500', chart: '#a855f7' },
  SUMMARY: { bg: 'bg-orange-500/10', text: 'text-orange-500', chart: '#f97316' },
};

interface MetricDataPoint {
  timestamp: string;
  value: number;
  attributes?: unknown;
}

// Mini sparkline component for cards
function Sparkline({ data, color }: { data: MetricDataPoint[]; color: string }) {
  if (!data || data.length < 2) {
    return (
      <div className="h-12 flex items-center justify-center text-xs text-muted-foreground">
        <Activity className="h-4 w-4 mr-1 opacity-50" />
        <span>Insufficient data</span>
      </div>
    );
  }

  return (
    <div className="h-12">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#gradient-${color.replace('#', '')})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Detailed time series chart for the detail panel
function TimeSeriesChart({
  data,
  color,
  metricType
}: {
  data: MetricDataPoint[];
  color: string;
  metricType: string;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        <Activity className="h-8 w-8 mr-2 opacity-50" />
        <span>No data available for this time range</span>
      </div>
    );
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toFixed(2);
  };

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTime}
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={formatValue}
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={50}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelFormatter={(label) => new Date(label).toLocaleString()}
            formatter={(value: number) => [formatValue(value), metricType]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill="url(#areaGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Histogram visualization component
function HistogramChart({ data, color }: { data: MetricDataPoint[]; color: string }) {
  // Aggregate data into buckets for histogram visualization
  const values = data.map(d => d.value).filter(v => v !== null && v !== undefined);

  if (values.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-muted-foreground">
        No histogram data available
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const bucketCount = Math.min(10, values.length);
  const bucketSize = (max - min) / bucketCount || 1;

  const buckets: { range: string; count: number; from: number; to: number }[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const from = min + i * bucketSize;
    const to = from + bucketSize;
    buckets.push({
      range: `${from.toFixed(1)}-${to.toFixed(1)}`,
      count: values.filter(v => v >= from && (i === bucketCount - 1 ? v <= to : v < to)).length,
      from,
      to,
    });
  }

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={buckets} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis
            dataKey="range"
            stroke="hsl(var(--muted-foreground))"
            fontSize={10}
            tickLine={false}
            angle={-45}
            textAnchor="end"
            height={50}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value: number) => [`${value} occurrences`, 'Count']}
          />
          <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Metric detail panel (slide-over)
function MetricDetailPanel({
  metric,
  timeRange,
  onClose,
}: {
  metric: MetricSummary;
  timeRange: string;
  onClose: () => void;
}) {
  const { currentProject } = useProjectStore();
  const colors = TYPE_COLORS[metric.type.toUpperCase()] || TYPE_COLORS.GAUGE;

  const { data: dataPoints, isLoading } = trpc.metrics.get.useQuery(
    { name: metric.name, timeRange },
    { enabled: !!currentProject }
  );

  const stats = dataPoints ? {
    min: Math.min(...dataPoints.map(d => d.value)),
    max: Math.max(...dataPoints.map(d => d.value)),
    avg: dataPoints.reduce((sum, d) => sum + d.value, 0) / dataPoints.length,
    count: dataPoints.length,
  } : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-2xl bg-background border-l shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-semibold font-mono">{metric.name}</h2>
            <span className={`text-xs px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
              {metric.type}
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Stats cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-xs text-muted-foreground">Current</div>
                <div className="text-xl font-bold" style={{ color: colors.chart }}>
                  {metric.lastValue.toFixed(2)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-xs text-muted-foreground">Average</div>
                <div className="text-xl font-bold">{metric.avgValue.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-xs text-muted-foreground">Min</div>
                <div className="text-xl font-bold">{metric.minValue.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-xs text-muted-foreground">Max</div>
                <div className="text-xl font-bold">{metric.maxValue.toFixed(2)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Time series chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Time Series ({timeRange})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <TimeSeriesChart
                  data={dataPoints || []}
                  color={colors.chart}
                  metricType={metric.type}
                />
              )}
            </CardContent>
          </Card>

          {/* Histogram for HISTOGRAM type metrics */}
          {metric.type.toUpperCase() === 'HISTOGRAM' && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Value Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="h-48 flex items-center justify-center">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <HistogramChart data={dataPoints || []} color={colors.chart} />
                )}
              </CardContent>
            </Card>
          )}

          {/* Data points info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Data Points Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Points</span>
                  <span className="font-mono">{metric.count.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Seen</span>
                  <span className="font-mono">{timeAgo(metric.lastSeen)}</span>
                </div>
                {stats && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Range</span>
                      <span className="font-mono">
                        {stats.min.toFixed(2)} - {stats.max.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Points in Range</span>
                      <span className="font-mono">{stats.count}</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  metric,
  onClick,
  timeRange,
}: {
  metric: MetricSummary;
  onClick: () => void;
  timeRange: string;
}) {
  const { currentProject } = useProjectStore();
  const colors = TYPE_COLORS[metric.type.toUpperCase()] || TYPE_COLORS.GAUGE;

  // Fetch sparkline data for this metric
  const { data: sparklineData } = trpc.metrics.get.useQuery(
    { name: metric.name, timeRange },
    { enabled: !!currentProject }
  );

  // Calculate trend (comparing last value to average)
  const trend = metric.avgValue > 0
    ? ((metric.lastValue - metric.avgValue) / metric.avgValue) * 100
    : 0;
  const trendColor = trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-muted-foreground';

  return (
    <Card
      className="hover:border-primary/50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-mono truncate">{metric.name}</CardTitle>
            <span className={`text-xs px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
              {metric.type}
            </span>
          </div>
          {trend !== 0 && (
            <span className={`text-xs ${trendColor} font-mono`}>
              {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Sparkline */}
        <div className="mb-3">
          <Sparkline data={sparklineData || []} color={colors.chart} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Current</div>
            <div className="text-2xl font-semibold" style={{ color: colors.chart }}>
              {metric.lastValue.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Average</div>
            <div className="text-2xl font-semibold">{metric.avgValue.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Min</div>
            <div className="text-lg font-mono">{metric.minValue.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Max</div>
            <div className="text-lg font-mono">{metric.maxValue.toFixed(2)}</div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t flex items-center justify-between text-xs text-muted-foreground">
          <span>{metric.count.toLocaleString()} data points</span>
          <span>Updated {timeAgo(metric.lastSeen)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function MetricsPage() {
  const { currentProject } = useProjectStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [timeRange, setTimeRange] = useState('15m');
  const [selectedType, setSelectedType] = useState<string | undefined>();
  const [selectedMetric, setSelectedMetric] = useState<MetricSummary | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch metrics from API
  const { data: metrics, isLoading } = trpc.metrics.list.useQuery(
    { timeRange, type: selectedType, search: search || undefined },
    { enabled: !!currentProject }
  );

  // Refresh all metrics data
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: [['metrics']] });
    setIsRefreshing(false);
  }, [queryClient]);

  // Fetch metric types for filter
  const { data: metricTypesData } = trpc.metrics.types.useQuery(
    undefined,
    { enabled: !!currentProject }
  );

  // Fetch stats for overview cards
  const { data: stats } = trpc.metrics.stats.useQuery(
    undefined,
    { enabled: !!currentProject }
  );

  const filteredMetrics = metrics || [];
  const metricTypes = metricTypesData?.map((t) => t.type) || [];

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Select a project to view metrics</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Metrics</h1>
          <p className="text-muted-foreground">
            Monitor application and infrastructure metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading || isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading || isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{stats?.uniqueMetrics || 0}</div>
                <div className="text-sm text-muted-foreground">Unique Metrics</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">
                  {(stats?.totalDataPoints || 0).toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Data Points</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{timeRange}</div>
                <div className="text-sm text-muted-foreground">Time Range</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{metricTypes.length}</div>
                <div className="text-sm text-muted-foreground">Metric Types</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search metrics..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {TIME_RANGES.map((range) => (
            <Button
              key={range.value}
              variant={timeRange === range.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange(range.value)}
            >
              {range.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant={!selectedType ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedType(undefined)}
        >
          All Types
        </Button>
        {metricTypes.map((type) => (
          <Button
            key={type}
            variant={selectedType === type ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedType(type)}
          >
            {type}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-32 bg-muted rounded" />
                  <div className="h-4 w-16 bg-muted rounded" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="space-y-2">
                      <div className="h-3 w-12 bg-muted rounded" />
                      <div className="h-6 w-16 bg-muted rounded" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredMetrics.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="font-medium mb-2">No metrics found</h3>
              <p className="text-sm text-muted-foreground">
                {search
                  ? 'Try adjusting your search criteria'
                  : 'Start sending metrics to see them here'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMetrics.map((metric) => (
            <MetricCard
              key={metric.name}
              metric={metric}
              onClick={() => setSelectedMetric(metric)}
              timeRange={timeRange}
            />
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Metrics Table</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Name</th>
                  <th className="text-left py-2 font-medium">Type</th>
                  <th className="text-right py-2 font-medium">Current</th>
                  <th className="text-right py-2 font-medium">Avg</th>
                  <th className="text-right py-2 font-medium">Min</th>
                  <th className="text-right py-2 font-medium">Max</th>
                  <th className="text-right py-2 font-medium">Points</th>
                  <th className="text-right py-2 font-medium">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {filteredMetrics.map((metric) => {
                  const colors = TYPE_COLORS[metric.type.toUpperCase()] || TYPE_COLORS.GAUGE;
                  return (
                    <tr
                      key={metric.name}
                      className="border-b hover:bg-muted/50 cursor-pointer"
                      onClick={() => setSelectedMetric(metric)}
                    >
                      <td className="py-2 font-mono text-sm">{metric.name}</td>
                      <td className="py-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                          {metric.type}
                        </span>
                      </td>
                      <td className="text-right py-2 font-mono" style={{ color: colors.chart }}>
                        {metric.lastValue.toFixed(2)}
                      </td>
                      <td className="text-right py-2 font-mono">{metric.avgValue.toFixed(2)}</td>
                      <td className="text-right py-2 font-mono">{metric.minValue.toFixed(2)}</td>
                      <td className="text-right py-2 font-mono">{metric.maxValue.toFixed(2)}</td>
                      <td className="text-right py-2 font-mono">{metric.count.toLocaleString()}</td>
                      <td className="text-right py-2 text-muted-foreground">
                        {timeAgo(metric.lastSeen)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Metric Detail Panel */}
      {selectedMetric && (
        <MetricDetailPanel
          metric={selectedMetric}
          timeRange={timeRange}
          onClose={() => setSelectedMetric(null)}
        />
      )}
    </div>
  );
}
