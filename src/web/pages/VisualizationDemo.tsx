import {
  ServiceMap,
  FlameGraph,
  Heatmap,
  ComparisonChart,
  ServiceNode,
  ServiceEdge,
  Span,
  HeatmapDataPoint,
  ComparisonDataset,
} from '../components/visualizations';

// Sample data generators
const generateServiceMapData = (): { nodes: ServiceNode[]; edges: ServiceEdge[] } => {
  const nodes: ServiceNode[] = [
    { id: 'api-gateway', name: 'API Gateway', requestCount: 10000, errorRate: 0.5, avgLatency: 45.2 },
    { id: 'auth-service', name: 'Auth Service', requestCount: 5000, errorRate: 0.2, avgLatency: 30.1 },
    { id: 'user-service', name: 'User Service', requestCount: 7500, errorRate: 1.5, avgLatency: 65.3 },
    { id: 'database', name: 'Database', requestCount: 15000, errorRate: 0.1, avgLatency: 15.8 },
    { id: 'cache', name: 'Cache', requestCount: 20000, errorRate: 0.05, avgLatency: 2.1 },
    { id: 'payment-service', name: 'Payment Service', requestCount: 2000, errorRate: 6.0, avgLatency: 120.5 },
  ];

  const edges: ServiceEdge[] = [
    { source: 'api-gateway', target: 'auth-service', requestCount: 5000 },
    { source: 'api-gateway', target: 'user-service', requestCount: 4000 },
    { source: 'api-gateway', target: 'payment-service', requestCount: 1000 },
    { source: 'auth-service', target: 'database', requestCount: 3000 },
    { source: 'auth-service', target: 'cache', requestCount: 5000 },
    { source: 'user-service', target: 'database', requestCount: 5000 },
    { source: 'user-service', target: 'cache', requestCount: 7000 },
    { source: 'payment-service', target: 'database', requestCount: 2000 },
  ];

  return { nodes, edges };
};

const generateFlameGraphData = (): Span[] => {
  const baseTime = Date.now() - 1000;
  return [
    {
      spanId: 'span-1',
      name: 'HTTP GET /api/checkout',
      serviceName: 'api-gateway',
      startTime: baseTime,
      duration: 250,
      kind: 'SERVER',
      status: 'OK',
    },
    {
      spanId: 'span-2',
      name: 'Authenticate User',
      serviceName: 'auth-service',
      startTime: baseTime + 10,
      duration: 30,
      kind: 'CLIENT',
      status: 'OK',
      parentSpanId: 'span-1',
    },
    {
      spanId: 'span-3',
      name: 'Get User Profile',
      serviceName: 'user-service',
      startTime: baseTime + 50,
      duration: 80,
      kind: 'CLIENT',
      status: 'OK',
      parentSpanId: 'span-1',
    },
    {
      spanId: 'span-4',
      name: 'Query Database',
      serviceName: 'database',
      startTime: baseTime + 60,
      duration: 50,
      kind: 'INTERNAL',
      status: 'OK',
      parentSpanId: 'span-3',
    },
    {
      spanId: 'span-5',
      name: 'Process Payment',
      serviceName: 'payment-service',
      startTime: baseTime + 140,
      duration: 100,
      kind: 'CLIENT',
      status: 'OK',
      parentSpanId: 'span-1',
    },
    {
      spanId: 'span-6',
      name: 'Validate Card',
      serviceName: 'payment-service',
      startTime: baseTime + 150,
      duration: 30,
      kind: 'INTERNAL',
      status: 'OK',
      parentSpanId: 'span-5',
    },
    {
      spanId: 'span-7',
      name: 'Charge Card',
      serviceName: 'payment-service',
      startTime: baseTime + 185,
      duration: 45,
      kind: 'INTERNAL',
      status: 'OK',
      parentSpanId: 'span-5',
    },
  ];
};

const generateHeatmapData = (): HeatmapDataPoint[] => {
  const data: HeatmapDataPoint[] = [];
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;

  // Generate 24 hours of data
  for (let i = 0; i < 24; i++) {
    const timestamp = now - (24 - i) * hourMs;

    // Generate varying number of requests per hour
    const requestCount = 100 + Math.floor(Math.random() * 400);

    for (let j = 0; j < requestCount; j++) {
      // Generate latency with some patterns
      let latency;
      const rand = Math.random();

      if (rand < 0.5) {
        // Fast responses (0-50ms)
        latency = Math.random() * 50;
      } else if (rand < 0.8) {
        // Normal responses (50-200ms)
        latency = 50 + Math.random() * 150;
      } else if (rand < 0.95) {
        // Slow responses (200-1000ms)
        latency = 200 + Math.random() * 800;
      } else {
        // Very slow responses (1000-5000ms)
        latency = 1000 + Math.random() * 4000;
      }

      data.push({
        timestamp: timestamp + Math.random() * hourMs,
        latency,
      });
    }
  }

  return data;
};

const generateComparisonData = (): { current: ComparisonDataset; baseline: ComparisonDataset } => {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  const currentData = [];
  const baselineData = [];

  for (let i = 0; i < 24; i++) {
    const timestamp = now - (24 - i) * hourMs;

    // Baseline: more stable
    const baselineValue = 50 + Math.sin(i / 3) * 10 + Math.random() * 5;

    // Current: slightly higher with more variance
    const currentValue = baselineValue * 1.15 + Math.random() * 10;

    currentData.push({ timestamp, value: currentValue });
    baselineData.push({ timestamp, value: baselineValue });
  }

  return {
    current: {
      label: 'This Week',
      data: currentData,
      color: '#3b82f6',
    },
    baseline: {
      label: 'Last Week',
      data: baselineData,
      color: '#94a3b8',
    },
  };
};

export function VisualizationDemo() {
  const serviceMapData = generateServiceMapData();
  const flameGraphData = generateFlameGraphData();
  const heatmapData = generateHeatmapData();
  const comparisonData = generateComparisonData();

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Visualization Components Demo</h1>
        <p className="text-muted-foreground">
          Interactive examples of all available visualization components
        </p>
      </div>

      {/* Service Map */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Service Dependency Map</h2>
        <ServiceMap
          nodes={serviceMapData.nodes}
          edges={serviceMapData.edges}
          onNodeClick={(node) => console.log('Service clicked:', node)}
        />
      </div>

      {/* Flame Graph */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Trace Flame Graph</h2>
        <FlameGraph
          spans={flameGraphData}
          onSpanClick={(span) => console.log('Span clicked:', span)}
        />
      </div>

      {/* Heatmap */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Latency Heatmap</h2>
        <Heatmap
          data={heatmapData}
          timeBuckets={24}
          onCellClick={(bucket) => console.log('Bucket clicked:', bucket)}
        />
      </div>

      {/* Comparison Chart */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Metric Comparison</h2>
        <ComparisonChart
          current={comparisonData.current}
          baseline={comparisonData.baseline}
          mode="overlay"
          metricName="Response Time"
          formatValue={(v) => `${v.toFixed(1)}ms`}
        />
      </div>
    </div>
  );
}
