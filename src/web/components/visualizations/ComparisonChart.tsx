import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { cn } from '../../lib/utils';

export interface TimeSeriesData {
  timestamp: number;
  value: number;
}

export interface ComparisonDataset {
  label: string;
  data: TimeSeriesData[];
  color?: string;
}

interface ComparisonChartProps {
  current: ComparisonDataset;
  baseline: ComparisonDataset;
  mode?: 'overlay' | 'side-by-side' | 'difference';
  metricName?: string;
  formatValue?: (value: number) => string;
  className?: string;
}

interface CombinedDataPoint {
  timestamp: number;
  current: number;
  baseline: number;
  difference: number;
  percentChange: number;
}

export function ComparisonChart({
  current,
  baseline,
  mode = 'overlay',
  metricName = 'Value',
  formatValue = (v) => v.toFixed(2),
  className,
}: ComparisonChartProps) {
  const [chartMode, setChartMode] = useState(mode);

  // Combine data points
  const combinedData: CombinedDataPoint[] = [];

  // Create a map of baseline values by timestamp
  const baselineMap = new Map(baseline.data.map(d => [d.timestamp, d.value]));

  // Merge current and baseline data
  current.data.forEach(currentPoint => {
    const baselineValue = baselineMap.get(currentPoint.timestamp);
    if (baselineValue !== undefined) {
      const difference = currentPoint.value - baselineValue;
      const percentChange = baselineValue !== 0
        ? ((currentPoint.value - baselineValue) / baselineValue) * 100
        : 0;

      combinedData.push({
        timestamp: currentPoint.timestamp,
        current: currentPoint.value,
        baseline: baselineValue,
        difference,
        percentChange,
      });
    }
  });

  // Calculate statistics
  const stats = {
    avgCurrent: combinedData.reduce((sum, d) => sum + d.current, 0) / combinedData.length || 0,
    avgBaseline: combinedData.reduce((sum, d) => sum + d.baseline, 0) / combinedData.length || 0,
    avgDifference: combinedData.reduce((sum, d) => sum + d.difference, 0) / combinedData.length || 0,
    avgPercentChange: combinedData.reduce((sum, d) => sum + d.percentChange, 0) / combinedData.length || 0,
    maxCurrent: Math.max(...combinedData.map(d => d.current)),
    maxBaseline: Math.max(...combinedData.map(d => d.baseline)),
    minCurrent: Math.min(...combinedData.map(d => d.current)),
    minBaseline: Math.min(...combinedData.map(d => d.baseline)),
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;

    return (
      <div className="bg-black/90 text-white px-3 py-2 rounded text-sm border border-gray-700">
        <div className="font-bold mb-2">
          {new Date(data.timestamp).toLocaleString()}
        </div>
        <div className="space-y-1">
          {chartMode !== 'difference' && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: current.color || '#3b82f6' }} />
                <span className="text-gray-300">{current.label}:</span>
                <span className="font-mono">{formatValue(data.current)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: baseline.color || '#94a3b8' }} />
                <span className="text-gray-300">{baseline.label}:</span>
                <span className="font-mono">{formatValue(data.baseline)}</span>
              </div>
            </>
          )}
          <div className="pt-1 border-t border-gray-700 mt-1">
            <div className="flex items-center gap-2">
              <span className="text-gray-300">Difference:</span>
              <span className={cn(
                'font-mono font-bold',
                data.difference > 0 ? 'text-red-400' : data.difference < 0 ? 'text-green-400' : 'text-gray-400'
              )}>
                {data.difference > 0 ? '+' : ''}{formatValue(data.difference)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-300">Change:</span>
              <span className={cn(
                'font-mono font-bold',
                data.percentChange > 0 ? 'text-red-400' : data.percentChange < 0 ? 'text-green-400' : 'text-gray-400'
              )}>
                {data.percentChange > 0 ? '+' : ''}{data.percentChange.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{metricName} Comparison</CardTitle>
        <div className="flex gap-2">
          <button
            onClick={() => setChartMode('overlay')}
            className={cn(
              'px-3 py-1 text-sm rounded border-2',
              chartMode === 'overlay'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border hover:border-primary/50'
            )}
          >
            Overlay
          </button>
          <button
            onClick={() => setChartMode('difference')}
            className={cn(
              'px-3 py-1 text-sm rounded border-2',
              chartMode === 'difference'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border hover:border-primary/50'
            )}
          >
            Difference
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Statistics Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">{current.label} Avg</div>
            <div className="text-lg font-bold font-mono">{formatValue(stats.avgCurrent)}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">{baseline.label} Avg</div>
            <div className="text-lg font-bold font-mono">{formatValue(stats.avgBaseline)}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Avg Difference</div>
            <div className={cn(
              'text-lg font-bold font-mono',
              stats.avgDifference > 0 ? 'text-red-500' : stats.avgDifference < 0 ? 'text-green-500' : ''
            )}>
              {stats.avgDifference > 0 ? '+' : ''}{formatValue(stats.avgDifference)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Avg Change</div>
            <div className={cn(
              'text-lg font-bold font-mono',
              stats.avgPercentChange > 0 ? 'text-red-500' : stats.avgPercentChange < 0 ? 'text-green-500' : ''
            )}>
              {stats.avgPercentChange > 0 ? '+' : ''}{stats.avgPercentChange.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Chart */}
        <ResponsiveContainer width="100%" height={400}>
          {chartMode === 'overlay' ? (
            <LineChart data={combinedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatTimestamp}
                style={{ fontSize: '12px' }}
              />
              <YAxis
                tickFormatter={formatValue}
                style={{ fontSize: '12px' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
              />
              <Line
                type="monotone"
                dataKey="current"
                stroke={current.color || '#3b82f6'}
                strokeWidth={2}
                dot={false}
                name={current.label}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="baseline"
                stroke={baseline.color || '#94a3b8'}
                strokeWidth={2}
                dot={false}
                name={baseline.label}
                strokeDasharray="5 5"
                activeDot={{ r: 6 }}
              />
            </LineChart>
          ) : (
            <ComposedChart data={combinedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatTimestamp}
                style={{ fontSize: '12px' }}
              />
              <YAxis
                tickFormatter={formatValue}
                style={{ fontSize: '12px' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
              />
              <ReferenceLine y={0} stroke="#64748b" strokeWidth={2} />
              <Area
                type="monotone"
                dataKey="difference"
                fill="#3b82f6"
                fillOpacity={0.3}
                stroke="#3b82f6"
                strokeWidth={2}
                name="Difference"
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>

        {/* Insights */}
        <div className="mt-6 p-4 bg-muted/20 border-2 border-border rounded">
          <h3 className="font-bold mb-2 text-sm">Insights</h3>
          <div className="space-y-1 text-sm">
            {stats.avgPercentChange > 10 && (
              <div className="text-red-600">
                Significant increase detected: {metricName} is {stats.avgPercentChange.toFixed(1)}% higher on average
              </div>
            )}
            {stats.avgPercentChange < -10 && (
              <div className="text-green-600">
                Significant improvement detected: {metricName} is {Math.abs(stats.avgPercentChange).toFixed(1)}% lower on average
              </div>
            )}
            {Math.abs(stats.avgPercentChange) <= 10 && (
              <div className="text-muted-foreground">
                {metricName} is relatively stable compared to baseline ({stats.avgPercentChange > 0 ? '+' : ''}{stats.avgPercentChange.toFixed(1)}% change)
              </div>
            )}
            <div className="text-muted-foreground">
              Peak {current.label}: {formatValue(stats.maxCurrent)} | Peak {baseline.label}: {formatValue(stats.maxBaseline)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
