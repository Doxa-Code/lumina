# Integration Guide

This guide shows how to integrate the new visualization components into your Baselime application.

## Files Created

### Visualization Components
- `/Users/fernandosouza/dev/baselime/src/web/components/visualizations/ServiceMap.tsx` - D3 force-directed service dependency graph
- `/Users/fernandosouza/dev/baselime/src/web/components/visualizations/FlameGraph.tsx` - Horizontal trace flame graph
- `/Users/fernandosouza/dev/baselime/src/web/components/visualizations/Heatmap.tsx` - Latency distribution heatmap
- `/Users/fernandosouza/dev/baselime/src/web/components/visualizations/ComparisonChart.tsx` - Time series comparison chart
- `/Users/fernandosouza/dev/baselime/src/web/components/visualizations/index.ts` - Barrel export file

### Pages
- `/Users/fernandosouza/dev/baselime/src/web/pages/services/ServiceMapPage.tsx` - Full-page service map view
- `/Users/fernandosouza/dev/baselime/src/web/pages/VisualizationDemo.tsx` - Demo page with all visualizations

### Documentation
- `/Users/fernandosouza/dev/baselime/src/web/components/visualizations/README.md` - Component documentation
- `/Users/fernandosouza/dev/baselime/src/web/components/visualizations/INTEGRATION.md` - This file

## Step 1: Add Routes to Your App

Edit your main routing file (e.g., `App.tsx`) to add the new routes:

```tsx
import { ServiceMapPage } from './pages/services/ServiceMapPage';
import { VisualizationDemo } from './pages/VisualizationDemo';

// Inside your router configuration:
<Route path="/services/map" element={<ServiceMapPage />} />
<Route path="/visualizations/demo" element={<VisualizationDemo />} />
```

## Step 2: Add Navigation Links

Add links to the service map in your navigation menu or services page:

```tsx
import { Link } from 'react-router-dom';
import { Network } from 'lucide-react';

<Link to="/services/map">
  <Button variant="outline">
    <Network className="h-4 w-4 mr-2" />
    Service Map
  </Button>
</Link>
```

## Step 3: Use Components in Your Pages

### Using ServiceMap

```tsx
import { ServiceMap, ServiceNode, ServiceEdge } from '@web/components/visualizations';

function MyPage() {
  const nodes: ServiceNode[] = [
    {
      id: 'api-gateway',
      name: 'API Gateway',
      requestCount: 10000,
      errorRate: 0.5,
      avgLatency: 45.2,
    },
    // ... more nodes
  ];

  const edges: ServiceEdge[] = [
    {
      source: 'api-gateway',
      target: 'auth-service',
      requestCount: 5000,
    },
    // ... more edges
  ];

  return (
    <ServiceMap
      nodes={nodes}
      edges={edges}
      onNodeClick={(node) => console.log('Clicked:', node)}
    />
  );
}
```

### Using FlameGraph

```tsx
import { FlameGraph, Span } from '@web/components/visualizations';

function TracePage() {
  const spans: Span[] = [
    {
      spanId: 'span-1',
      name: 'HTTP GET /api/users',
      serviceName: 'api-gateway',
      startTime: Date.now(),
      duration: 250,
      kind: 'SERVER',
      status: 'OK',
    },
    // ... more spans
  ];

  return (
    <FlameGraph
      spans={spans}
      onSpanClick={(span) => console.log('Selected:', span)}
    />
  );
}
```

### Using Heatmap

```tsx
import { Heatmap, HeatmapDataPoint } from '@web/components/visualizations';

function AnalyticsPage() {
  const data: HeatmapDataPoint[] = [
    { timestamp: Date.now(), latency: 45 },
    // ... more data points
  ];

  return (
    <Heatmap
      data={data}
      timeBuckets={24}
      onCellClick={(bucket) => console.log('Selected:', bucket)}
    />
  );
}
```

### Using ComparisonChart

```tsx
import { ComparisonChart, ComparisonDataset } from '@web/components/visualizations';

function MetricsPage() {
  const current: ComparisonDataset = {
    label: 'This Week',
    data: [
      { timestamp: Date.now(), value: 45 },
      // ... more data
    ],
    color: '#3b82f6',
  };

  const baseline: ComparisonDataset = {
    label: 'Last Week',
    data: [
      { timestamp: Date.now(), value: 40 },
      // ... more data
    ],
    color: '#94a3b8',
  };

  return (
    <ComparisonChart
      current={current}
      baseline={baseline}
      metricName="Response Time"
      formatValue={(v) => `${v.toFixed(1)}ms`}
    />
  );
}
```

## Step 4: Integrate with Existing Trace Viewer

You can add the FlameGraph to your existing trace detail page:

```tsx
// In TraceDetailPage.tsx
import { FlameGraph } from '@web/components/visualizations';

// Add a new tab or view option for flame graph
<Tabs value={viewType} onValueChange={setViewType}>
  <TabsList>
    <TabsTrigger value="tree">Tree View</TabsTrigger>
    <TabsTrigger value="waterfall">Waterfall</TabsTrigger>
    <TabsTrigger value="flame">Flame Graph</TabsTrigger>
  </TabsList>

  {viewType === 'flame' && (
    <FlameGraph
      spans={trace.spans}
      onSpanClick={(span) => setSelectedSpanId(span.spanId)}
    />
  )}
</Tabs>
```

## Step 5: Add Service Map Link to Services Page

In your existing `ServicesPage.tsx`, add a link to the service map:

```tsx
// At the top of the page
<div className="flex items-center justify-between mb-6">
  <div>
    <h1 className="text-2xl font-bold">Services</h1>
    <p className="text-muted-foreground">
      Overview of all services sending telemetry data
    </p>
  </div>
  <Link to="/services/map">
    <Button variant="outline">
      <Network className="h-4 w-4 mr-2" />
      View Service Map
    </Button>
  </Link>
</div>
```

## Advanced Usage

### Custom Styling

All components accept a `className` prop for custom styling:

```tsx
<ServiceMap
  nodes={nodes}
  edges={edges}
  className="shadow-lg rounded-lg"
/>
```

### Error Handling

Components handle empty data gracefully:

```tsx
// If nodes is empty, ServiceMap will show an empty state
<ServiceMap nodes={[]} edges={[]} />
```

### TypeScript Support

All components are fully typed. Import types as needed:

```tsx
import type {
  ServiceNode,
  ServiceEdge,
  Span,
  HeatmapDataPoint,
  TimeSeriesData,
  ComparisonDataset,
} from '@web/components/visualizations';
```

## Testing

View the demo page at `/visualizations/demo` to see all components with sample data:

```bash
# Start dev server
npm run dev:web

# Navigate to:
http://localhost:5173/visualizations/demo
```

## Performance Considerations

- **ServiceMap**: Best with < 50 nodes for smooth interactions
- **FlameGraph**: Can handle thousands of spans efficiently
- **Heatmap**: Optimal with 1000-10000 data points
- **ComparisonChart**: Works well with time series data of any size

## Troubleshooting

### D3 Tooltips Not Showing

If tooltips don't appear, ensure your app doesn't have CSS that hides elements with `position: absolute` at high z-index.

### Charts Not Responsive

Make sure parent containers have a defined width. All charts use `ResponsiveContainer` or calculate dimensions from their container.

### TypeScript Errors

Ensure you're using the correct types:
- D3 components: ServiceMap, FlameGraph, Heatmap
- Recharts component: ComparisonChart

## Next Steps

1. Add the routes to your App.tsx
2. Test the demo page
3. Integrate individual components into your existing pages
4. Customize colors and styling to match your design system
5. Add additional features as needed

## Support

For issues or questions:
- Check the README.md for component documentation
- Review the demo page for usage examples
- Inspect the component source code for advanced customization
