# Advanced Visualization Components

A collection of interactive visualization components for the Baselime observability platform built with React, TypeScript, D3, and Recharts.

## Components

### 1. ServiceMap

A D3 force-directed graph visualization for service dependencies.

**Features:**
- Force-directed layout with draggable nodes
- Node size based on request volume
- Edge thickness based on traffic volume
- Color-coded health status (green=healthy, yellow=degraded, red=errors)
- Interactive tooltips with service statistics
- Click on nodes to view detailed information
- Zoom and pan support

**Usage:**
```tsx
import { ServiceMap, ServiceNode, ServiceEdge } from '@web/components/visualizations';

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

<ServiceMap
  nodes={nodes}
  edges={edges}
  onNodeClick={(node) => console.log('Clicked:', node)}
/>
```

### 2. FlameGraph

A horizontal flame graph for trace span visualization.

**Features:**
- Hierarchical span visualization
- Width proportional to span duration
- Color by service or span kind
- Click to zoom into specific spans
- Detailed tooltips with span information
- Reset zoom functionality
- Time axis with duration formatting

**Usage:**
```tsx
import { FlameGraph, Span } from '@web/components/visualizations';

const spans: Span[] = [
  {
    spanId: 'span-1',
    name: 'HTTP GET /api/users',
    serviceName: 'api-gateway',
    startTime: 1628000000000,
    duration: 250,
    kind: 'SERVER',
    status: 'OK',
  },
  {
    spanId: 'span-2',
    name: 'Query Users',
    serviceName: 'database',
    startTime: 1628000000050,
    duration: 150,
    kind: 'CLIENT',
    status: 'OK',
    parentSpanId: 'span-1',
  },
  // ... more spans
];

<FlameGraph
  spans={spans}
  onSpanClick={(span) => console.log('Clicked span:', span)}
/>
```

### 3. Heatmap

A latency heatmap for visualizing request distribution over time and latency buckets.

**Features:**
- X-axis: time buckets
- Y-axis: latency buckets (<10ms, 10-50ms, 50-100ms, etc.)
- Color intensity based on request count
- Interactive tooltips with bucket details
- Click to drill down into specific time/latency windows
- Color legend with gradient scale
- Responsive design

**Usage:**
```tsx
import { Heatmap, HeatmapDataPoint } from '@web/components/visualizations';

const data: HeatmapDataPoint[] = [
  { timestamp: 1628000000000, latency: 25 },
  { timestamp: 1628000060000, latency: 150 },
  // ... more data points
];

<Heatmap
  data={data}
  timeBuckets={24}
  onCellClick={(bucket) => console.log('Selected bucket:', bucket)}
/>
```

### 4. ComparisonChart

A metric comparison chart for comparing two time periods.

**Features:**
- Multiple display modes: overlay, difference
- Automatic statistics calculation (avg, max, min)
- Percent change highlighting
- Interactive mode switching
- Detailed tooltips with comparison data
- Automatic insights generation
- Support for custom value formatting

**Usage:**
```tsx
import { ComparisonChart, ComparisonDataset } from '@web/components/visualizations';

const current: ComparisonDataset = {
  label: 'This Week',
  data: [
    { timestamp: 1628000000000, value: 45 },
    { timestamp: 1628000060000, value: 52 },
    // ... more data
  ],
  color: '#3b82f6',
};

const baseline: ComparisonDataset = {
  label: 'Last Week',
  data: [
    { timestamp: 1628000000000, value: 40 },
    { timestamp: 1628000060000, value: 48 },
    // ... more data
  ],
  color: '#94a3b8',
};

<ComparisonChart
  current={current}
  baseline={baseline}
  mode="overlay"
  metricName="Response Time"
  formatValue={(v) => `${v.toFixed(1)}ms`}
/>
```

## ServiceMapPage

A complete page implementation showing how to use the ServiceMap component with real data.

**Features:**
- Time range selector (15m, 1h, 6h, 24h, 7d)
- Auto-refresh functionality
- Service details panel
- Upstream and downstream dependency lists
- Integration with trace viewing
- Health status indicators
- Legend explaining visualization

**Usage:**
Add to your router:
```tsx
import { ServiceMapPage } from '@web/pages/services/ServiceMapPage';

<Route path="/services/map" element={<ServiceMapPage />} />
```

## Styling

All components use Tailwind CSS classes and integrate with the existing design system. They respect:
- Border widths (border-2)
- Color scheme (primary, muted, card backgrounds)
- Typography (font-mono for metrics, uppercase titles)
- Spacing and padding conventions

## TypeScript Support

All components are fully typed with proper TypeScript interfaces for:
- Component props
- Data structures
- Event handlers
- Return types

## Dependencies

- **React**: ^18.3.1
- **D3**: ^7.9.0 (ServiceMap, FlameGraph, Heatmap)
- **Recharts**: ^2.12.7 (ComparisonChart)
- **@types/d3**: ^7.4.3

## Browser Support

- Modern browsers with ES2022 support
- SVG support required for D3 visualizations
- ResizeObserver API for responsive sizing

## Performance Considerations

- ServiceMap: Recommended max 50 nodes for optimal performance
- FlameGraph: Handles thousands of spans efficiently
- Heatmap: Best with 1000-10000 data points
- ComparisonChart: Optimized for time series data

## Accessibility

- Keyboard navigation support where applicable
- ARIA labels on interactive elements
- High contrast color schemes for readability
- Screen reader friendly tooltips
