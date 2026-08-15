# Visualization Components - Quick Reference

## Import

```tsx
import {
  ServiceMap,
  FlameGraph,
  Heatmap,
  ComparisonChart,
  // Types
  ServiceNode,
  ServiceEdge,
  Span,
  HeatmapDataPoint,
  TimeSeriesData,
  ComparisonDataset,
} from '@web/components/visualizations';
```

## ServiceMap

```tsx
<ServiceMap
  nodes={[
    { id: 'api', name: 'API', requestCount: 1000, errorRate: 0.5, avgLatency: 45 }
  ]}
  edges={[
    { source: 'api', target: 'db', requestCount: 500 }
  ]}
  onNodeClick={(node) => {}}
  className="custom-class"
/>
```

**Props:**
- `nodes`: ServiceNode[] - Required
- `edges`: ServiceEdge[] - Required
- `onNodeClick?`: (node: ServiceNode) => void
- `className?`: string

## FlameGraph

```tsx
<FlameGraph
  spans={[
    {
      spanId: '1',
      name: 'GET /api',
      serviceName: 'api',
      startTime: Date.now(),
      duration: 100,
      kind: 'SERVER',
      status: 'OK',
      parentSpanId?: '0'
    }
  ]}
  onSpanClick={(span) => {}}
  className="custom-class"
/>
```

**Props:**
- `spans`: Span[] - Required
- `onSpanClick?`: (span: Span) => void
- `className?`: string

## Heatmap

```tsx
<Heatmap
  data={[
    { timestamp: Date.now(), latency: 45 },
    { timestamp: Date.now() + 1000, latency: 150 }
  ]}
  timeBuckets={24}
  onCellClick={(bucket) => {}}
  className="custom-class"
/>
```

**Props:**
- `data`: HeatmapDataPoint[] - Required
- `timeBuckets?`: number - Default: 24
- `onCellClick?`: (bucket: HeatmapBucket) => void
- `className?`: string

**Latency Buckets:**
- <10ms, 10-50ms, 50-100ms, 100-250ms, 250-500ms
- 500ms-1s, 1-2s, 2-5s, >5s

## ComparisonChart

```tsx
<ComparisonChart
  current={{
    label: 'This Week',
    data: [{ timestamp: Date.now(), value: 45 }],
    color: '#3b82f6'
  }}
  baseline={{
    label: 'Last Week',
    data: [{ timestamp: Date.now(), value: 40 }],
    color: '#94a3b8'
  }}
  mode="overlay"
  metricName="Response Time"
  formatValue={(v) => `${v}ms`}
  className="custom-class"
/>
```

**Props:**
- `current`: ComparisonDataset - Required
- `baseline`: ComparisonDataset - Required
- `mode?`: 'overlay' | 'side-by-side' | 'difference' - Default: 'overlay'
- `metricName?`: string - Default: 'Value'
- `formatValue?`: (value: number) => string
- `className?`: string

## Common Patterns

### Loading State

```tsx
{isLoading ? (
  <div>Loading...</div>
) : (
  <ServiceMap nodes={nodes} edges={edges} />
)}
```

### Empty State

```tsx
{nodes.length === 0 ? (
  <div>No data available</div>
) : (
  <ServiceMap nodes={nodes} edges={edges} />
)}
```

### With tRPC

```tsx
const { data, isLoading } = trpc.traces.services.useQuery({
  from: new Date(Date.now() - 3600000).toISOString(),
  to: new Date().toISOString(),
});

const nodes = data?.map(s => ({
  id: s.serviceName,
  name: s.serviceName,
  requestCount: s.spanCount,
  errorRate: (s.errorCount / s.spanCount) * 100,
  avgLatency: s.avgDurationMs,
})) || [];
```

### Custom Colors

ServiceMap uses built-in health colors:
- Green: errorRate < 1%
- Yellow: errorRate 1-5%
- Red: errorRate > 5%

FlameGraph colors by:
- Service name (d3.schemeTableau10)
- Span kind: SERVER (blue), CLIENT (green), INTERNAL (purple)
- Status: ERROR (red)

### Event Handlers

```tsx
<ServiceMap
  nodes={nodes}
  edges={edges}
  onNodeClick={(node) => {
    console.log('Selected service:', node.name);
    navigate(`/services/${node.id}`);
  }}
/>
```

### Responsive Sizing

All components auto-resize to fit their container:

```tsx
<div className="w-full h-96">
  <ServiceMap nodes={nodes} edges={edges} />
</div>
```

## TypeScript Types

```tsx
interface ServiceNode {
  id: string;
  name: string;
  requestCount: number;
  errorRate: number;
  avgLatency: number;
}

interface ServiceEdge {
  source: string;
  target: string;
  requestCount: number;
}

interface Span {
  spanId: string;
  name: string;
  serviceName: string;
  startTime: number;
  duration: number;
  kind?: string;
  status?: string;
  parentSpanId?: string;
  attributes?: Record<string, any>;
}

interface HeatmapDataPoint {
  timestamp: number;
  latency: number;
}

interface TimeSeriesData {
  timestamp: number;
  value: number;
}

interface ComparisonDataset {
  label: string;
  data: TimeSeriesData[];
  color?: string;
}
```

## Performance Tips

1. **ServiceMap**: Limit to < 50 nodes for best performance
2. **FlameGraph**: Works well with 1000+ spans
3. **Heatmap**: Optimal with 1000-10000 points
4. **ComparisonChart**: No practical limit

## Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile: ✅ Touch events supported

## Troubleshooting

**Tooltips not visible?**
- Check z-index of parent containers
- Ensure body doesn't hide absolute positioned elements

**Component not sizing?**
- Parent must have defined width/height
- Use `className="w-full h-96"` on container

**D3 errors?**
- Ensure d3 v7+ is installed
- Check node.id uniqueness in ServiceMap

**Type errors?**
- Import types from the package
- Ensure data matches interface shape
