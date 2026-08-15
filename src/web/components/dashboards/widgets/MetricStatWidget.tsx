import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface MetricStatWidgetProps {
  data: Array<{
    timestamp: string;
    value: number;
  }>;
  config: {
    metricName: string;
    aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
    unit?: string;
    format?: string;
  };
}

export function MetricStatWidget({ data, config }: MetricStatWidgetProps) {
  const stats = useMemo(() => {
    if (data.length === 0) {
      return { current: 0, previous: 0, trend: 0, trendDirection: 'neutral' as const };
    }

    const current = data[data.length - 1]?.value || 0;
    const previous = data[data.length - 2]?.value || current;
    const trend = previous !== 0 ? ((current - previous) / previous) * 100 : 0;
    const trendDirection = trend > 0 ? 'up' : trend < 0 ? 'down' : 'neutral';

    return { current, previous, trend, trendDirection };
  }, [data]);

  const formatValue = (value: number): string => {
    const unit = config.unit || '';

    if (config.format === 'bytes') {
      if (value < 1024) return `${value.toFixed(0)}${unit}`;
      if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}K${unit}`;
      if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)}M${unit}`;
      return `${(value / (1024 * 1024 * 1024)).toFixed(1)}G${unit}`;
    }

    if (config.format === 'percentage') {
      return `${value.toFixed(1)}%`;
    }

    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M${unit}`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K${unit}`;
    return `${value.toFixed(1)}${unit}`;
  };

  const sparklineData = data.slice(-20).map((point) => ({
    value: point.value,
  }));

  return (
    <div className="h-full flex flex-col justify-between">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl font-bold mb-2">
            {formatValue(stats.current)}
          </div>
          {stats.trendDirection !== 'neutral' && (
            <div
              className={`flex items-center justify-center gap-1 text-sm ${
                stats.trendDirection === 'up' ? 'text-green-500' : 'text-red-500'
              }`}
            >
              {stats.trendDirection === 'up' ? (
                <TrendingUp className="h-4 w-4" />
              ) : stats.trendDirection === 'down' ? (
                <TrendingDown className="h-4 w-4" />
              ) : (
                <Minus className="h-4 w-4" />
              )}
              <span>{Math.abs(stats.trend).toFixed(1)}%</span>
            </div>
          )}
        </div>
      </div>

      {sparklineData.length > 1 && (
        <div className="h-16 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
