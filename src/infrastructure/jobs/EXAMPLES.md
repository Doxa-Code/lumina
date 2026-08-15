# Background Jobs - Usage Examples

This document provides practical examples of how to use and test the background jobs system.

## Table of Contents

1. [Alert Examples](#alert-examples)
2. [SLO Examples](#slo-examples)
3. [Testing Anomaly Detection](#testing-anomaly-detection)
4. [Service Dependency Examples](#service-dependency-examples)
5. [Manual Job Execution](#manual-job-execution)

## Alert Examples

### Example 1: CPU Usage Alert

Create an alert that fires when CPU usage exceeds 80% for 5 minutes:

```typescript
import { db } from '../database/connection.js';
import { alertsExtended } from '../database/schema/index.js';

await db.insert(alertsExtended).values({
  projectId: 'your-project-id',
  name: 'High CPU Usage',
  description: 'Alert when CPU usage exceeds 80%',

  // Monitor a metric
  dataSource: 'metric',
  queryConfig: {
    metricName: 'system.cpu.utilization',
    aggregation: 'avg',
    filters: {},
  },

  // Trigger when above threshold
  conditionType: 'above',
  threshold: {
    value: 80,           // 80%
    duration: '5m',      // Must persist for 5 minutes
    evaluationPeriod: '1m',
  },

  severity: 'warning',
  enabled: true,
  evaluationInterval: 60, // Check every 60 seconds

  notificationChannelIds: ['slack-channel-id'],
  notificationMessage: 'CPU usage is critically high! Current: {{value}}%',
});
```

### Example 2: API Error Rate Alert

Alert when API error rate exceeds 5%:

```typescript
await db.insert(alertsExtended).values({
  projectId: 'your-project-id',
  name: 'High API Error Rate',
  description: 'Alert when error rate exceeds 5%',

  // Monitor traces
  dataSource: 'trace',
  queryConfig: {
    metric: 'error_rate',
    service: 'api-service',
    filters: {
      environment: 'production',
    },
  },

  conditionType: 'above',
  threshold: {
    value: 5,  // 5%
    duration: '5m',
    evaluationPeriod: '1m',
  },

  severity: 'critical',
  enabled: true,

  notificationChannelIds: ['pagerduty-channel-id'],
  notificationMessage: 'API error rate is {{value}}% (threshold: 5%)',
});
```

### Example 3: Database Latency Alert

Alert when P99 database latency exceeds 500ms:

```typescript
await db.insert(alertsExtended).values({
  projectId: 'your-project-id',
  name: 'Slow Database Queries',
  description: 'Alert when P99 latency exceeds 500ms',

  dataSource: 'trace',
  queryConfig: {
    metric: 'latency_p99',
    service: 'postgres',
  },

  conditionType: 'above',
  threshold: {
    value: 500,  // 500ms
    duration: '10m',
    evaluationPeriod: '1m',
  },

  severity: 'warning',
  enabled: true,

  notificationChannelIds: ['slack-channel-id'],
});
```

### Example 4: No Data Received Alert

Alert when no logs are received from a critical service:

```typescript
await db.insert(alertsExtended).values({
  projectId: 'your-project-id',
  name: 'Payment Service Silent',
  description: 'Alert when no logs received from payment service',

  dataSource: 'log',
  queryConfig: {
    service: 'payment-service',
    severity: 'INFO',
  },

  // Trigger when no data
  conditionType: 'absence',
  threshold: {
    duration: '5m',
    evaluationPeriod: '1m',
  },

  severity: 'critical',
  enabled: true,

  notificationChannelIds: ['pagerduty-channel-id', 'slack-channel-id'],
});
```

### Example 5: Anomaly-Based Alert

Alert when memory usage shows anomalous behavior:

```typescript
await db.insert(alertsExtended).values({
  projectId: 'your-project-id',
  name: 'Memory Usage Anomaly',
  description: 'Alert on unusual memory usage patterns',

  dataSource: 'metric',
  queryConfig: {
    metricName: 'system.memory.usage',
    aggregation: 'avg',
  },

  // Use anomaly detection
  conditionType: 'anomaly',
  threshold: {
    duration: '15m',
    evaluationPeriod: '5m',
  },

  severity: 'warning',
  enabled: true,

  notificationChannelIds: ['slack-channel-id'],
});
```

## SLO Examples

### Example 1: API Availability SLO

99.9% availability target for API service:

```typescript
import { slos } from '../database/schema/index.js';

await db.insert(slos).values({
  projectId: 'your-project-id',
  name: 'API Service Availability',
  description: '99.9% uptime for API service',

  // Availability SLI
  sliType: 'availability',
  sliConfig: {
    service: 'api-service',
  },

  target: '99.9',        // 99.9%
  targetUnit: 'percent',

  // Rolling 30-day window
  windowType: 'rolling',
  windowDays: 30,

  alertOnBreach: true,
  alertChannelIds: ['pagerduty-channel-id'],
});
```

### Example 2: Latency SLO

95% of requests should complete within 200ms:

```typescript
await db.insert(slos).values({
  projectId: 'your-project-id',
  name: 'API Response Time',
  description: '95% of requests under 200ms',

  // Latency SLI
  sliType: 'latency',
  sliConfig: {
    threshold: 200,      // 200ms
    percentile: 95,
    service: 'api-service',
  },

  target: '95.0',
  targetUnit: 'percent',

  windowType: 'rolling',
  windowDays: 7,  // Weekly window

  alertOnBreach: true,
  alertChannelIds: ['slack-channel-id'],
});
```

### Example 3: Error Rate SLO

Error rate should stay below 1%:

```typescript
await db.insert(slos).values({
  projectId: 'your-project-id',
  name: 'Low Error Rate',
  description: 'Maintain error rate below 1%',

  sliType: 'error_rate',
  sliConfig: {
    service: 'api-service',
    threshold: 1,  // 1%
  },

  target: '99.0',  // 99% success rate = 1% error rate
  targetUnit: 'percent',

  windowType: 'rolling',
  windowDays: 30,

  alertOnBreach: true,
  alertChannelIds: ['slack-channel-id', 'email-channel-id'],
});
```

### Example 4: Throughput SLO

Maintain at least 1000 requests per hour:

```typescript
await db.insert(slos).values({
  projectId: 'your-project-id',
  name: 'Minimum Throughput',
  description: 'Maintain at least 1000 req/hour',

  sliType: 'throughput',
  sliConfig: {
    service: 'api-service',
    threshold: 1000,  // requests per hour
  },

  target: '100.0',  // 100% of target
  targetUnit: 'percent',

  windowType: 'rolling',
  windowDays: 1,  // Daily window

  alertOnBreach: true,
  alertChannelIds: ['slack-channel-id'],
});
```

## Testing Anomaly Detection

### Generate Test Metrics with Anomaly

```typescript
import { metrics } from '../database/schema/index.js';

// Insert normal baseline data (last 24 hours)
const now = new Date();
const normalValues = Array.from({ length: 100 }, () => 50 + Math.random() * 10);

for (let i = 0; i < normalValues.length; i++) {
  const timestamp = new Date(now.getTime() - (100 - i) * 15 * 60 * 1000);

  await db.insert(metrics).values({
    projectId: 'test-project',
    serviceName: 'test-service',
    metricName: 'test.cpu.usage',
    metricType: 'gauge',
    timestamp,
    valueDouble: normalValues[i],  // Normal: 50-60
    attributes: {},
    resourceAttributes: {},
  });
}

// Insert anomalous spike (recent data)
for (let i = 0; i < 5; i++) {
  const timestamp = new Date(now.getTime() - i * 1 * 60 * 1000);

  await db.insert(metrics).values({
    projectId: 'test-project',
    serviceName: 'test-service',
    metricName: 'test.cpu.usage',
    metricType: 'gauge',
    timestamp,
    valueDouble: 150 + Math.random() * 10,  // Anomaly: 150-160
    attributes: {},
    resourceAttributes: {},
  });
}

// Run anomaly detection
import { detectAnomalies } from './anomaly-detector.js';
await detectAnomalies();

// Check for detected insights
import { insights } from '../database/schema/index.js';
const detectedAnomalies = await db
  .select()
  .from(insights)
  .where(eq(insights.type, 'anomaly_spike'))
  .orderBy(desc(insights.detectedAt))
  .limit(1);

console.log('Detected anomalies:', detectedAnomalies);
```

### Generate Latency Anomaly

```typescript
import { spans } from '../database/schema/index.js';

// Normal latency: 50-100ms
for (let i = 0; i < 100; i++) {
  await db.insert(spans).values({
    projectId: 'test-project',
    traceId: `trace-${i}`,
    spanId: `span-${i}`,
    serviceName: 'api-service',
    name: 'GET /api/users',
    kind: 'server',
    statusCode: 'OK',
    startTime: new Date(Date.now() - (100 - i) * 5 * 60 * 1000),
    endTime: new Date(Date.now() - (100 - i) * 5 * 60 * 1000 + (50 + Math.random() * 50)),
    durationMs: 50 + Math.random() * 50,
    attributes: {},
    resourceAttributes: {},
    events: [],
    links: [],
  });
}

// Anomalous latency: 500-600ms
for (let i = 0; i < 10; i++) {
  await db.insert(spans).values({
    projectId: 'test-project',
    traceId: `trace-anomaly-${i}`,
    spanId: `span-anomaly-${i}`,
    serviceName: 'api-service',
    name: 'GET /api/users',
    kind: 'server',
    statusCode: 'OK',
    startTime: new Date(Date.now() - i * 1 * 60 * 1000),
    endTime: new Date(Date.now() - i * 1 * 60 * 1000 + (500 + Math.random() * 100)),
    durationMs: 500 + Math.random() * 100,
    attributes: {},
    resourceAttributes: {},
    events: [],
    links: [],
  });
}
```

## Service Dependency Examples

### Generate Test Traces with Dependencies

```typescript
import { spans } from '../database/schema/index.js';

// Create a trace: frontend -> api -> database
const traceId = 'test-trace-1';
const now = new Date();

// Frontend span (root)
await db.insert(spans).values({
  projectId: 'test-project',
  traceId,
  spanId: 'span-1',
  parentSpanId: null,
  serviceName: 'frontend',
  name: 'GET /',
  kind: 'client',
  statusCode: 'OK',
  startTime: new Date(now.getTime()),
  endTime: new Date(now.getTime() + 500),
  durationMs: 500,
  attributes: { 'http.method': 'GET' },
  resourceAttributes: {},
  events: [],
  links: [],
});

// API span (child of frontend)
await db.insert(spans).values({
  projectId: 'test-project',
  traceId,
  spanId: 'span-2',
  parentSpanId: 'span-1',
  serviceName: 'api-service',
  name: 'GET /api/data',
  kind: 'server',
  statusCode: 'OK',
  startTime: new Date(now.getTime() + 50),
  endTime: new Date(now.getTime() + 450),
  durationMs: 400,
  attributes: { 'http.method': 'GET' },
  resourceAttributes: {},
  events: [],
  links: [],
});

// Database span (child of api)
await db.insert(spans).values({
  projectId: 'test-project',
  traceId,
  spanId: 'span-3',
  parentSpanId: 'span-2',
  serviceName: 'postgres',
  name: 'SELECT * FROM users',
  kind: 'client',
  statusCode: 'OK',
  startTime: new Date(now.getTime() + 100),
  endTime: new Date(now.getTime() + 400),
  durationMs: 300,
  attributes: { 'db.statement': 'SELECT * FROM users' },
  resourceAttributes: {},
  events: [],
  links: [],
});

// Run dependency aggregation
import { aggregateServiceDependencies } from './service-dependency-aggregator.js';
await aggregateServiceDependencies();

// Check discovered dependencies
import { serviceDependencies } from '../database/schema/index.js';
const dependencies = await db
  .select()
  .from(serviceDependencies)
  .where(eq(serviceDependencies.projectId, 'test-project'));

console.log('Discovered dependencies:', dependencies);
// Expected:
// - frontend -> api-service
// - api-service -> postgres
```

## Manual Job Execution

### Run All Jobs Once

```typescript
import {
  evaluateAlerts,
  calculateSLOs,
  detectAnomalies,
  aggregateServiceDependencies,
} from './infrastructure/jobs/index.js';

async function runAllJobs() {
  console.log('Running all background jobs...');

  try {
    await evaluateAlerts();
    console.log('✓ Alert evaluation complete');
  } catch (error) {
    console.error('✗ Alert evaluation failed:', error);
  }

  try {
    await calculateSLOs();
    console.log('✓ SLO calculation complete');
  } catch (error) {
    console.error('✗ SLO calculation failed:', error);
  }

  try {
    await detectAnomalies();
    console.log('✓ Anomaly detection complete');
  } catch (error) {
    console.error('✗ Anomaly detection failed:', error);
  }

  try {
    await aggregateServiceDependencies();
    console.log('✓ Service dependency aggregation complete');
  } catch (error) {
    console.error('✗ Service dependency aggregation failed:', error);
  }

  console.log('All jobs complete!');
}

runAllJobs();
```

### Run Specific Job with Custom Logic

```typescript
import { db } from '../database/connection.js';
import { alertsExtended } from '../database/schema/index.js';

// Manually evaluate a specific alert
async function evaluateSpecificAlert(alertId: string) {
  const alert = await db
    .select()
    .from(alertsExtended)
    .where(eq(alertsExtended.id, alertId))
    .limit(1);

  if (alert.length === 0) {
    console.error('Alert not found');
    return;
  }

  console.log(`Evaluating alert: ${alert[0].name}`);

  // Import the internal evaluation function
  // Note: You might need to export this function from alert-engine.ts
  const { evaluateAlert } = await import('./alert-engine.js');

  const result = await evaluateAlert(alert[0]);

  console.log('Evaluation result:', result);
}

// Usage
evaluateSpecificAlert('alert-id-here');
```

## Testing with cURL

### Trigger Alert via HTTP Endpoint (if added)

```bash
# Add this endpoint to your server.ts first:
# app.post('/api/jobs/run/:job', async (req, res) => {
#   const { job } = req.params;
#   // Run job logic
# });

# Run alert evaluation
curl -X POST http://localhost:3000/api/jobs/run/alerts

# Run SLO calculation
curl -X POST http://localhost:3000/api/jobs/run/slos

# Run anomaly detection
curl -X POST http://localhost:3000/api/jobs/run/anomalies

# Run dependency aggregation
curl -X POST http://localhost:3000/api/jobs/run/dependencies
```

## Monitoring Job Execution

### Check Last Execution Times

```typescript
import { alertsExtended, slos } from '../database/schema/index.js';

// Check when alerts were last evaluated
const recentAlertEvaluations = await db
  .select({
    name: alertsExtended.name,
    lastEvaluated: alertsExtended.lastEvaluatedAt,
  })
  .from(alertsExtended)
  .where(isNotNull(alertsExtended.lastEvaluatedAt))
  .orderBy(desc(alertsExtended.lastEvaluatedAt))
  .limit(10);

console.log('Recent alert evaluations:', recentAlertEvaluations);

// Check SLO update times
const recentSLOUpdates = await db
  .select({
    name: slos.name,
    lastUpdated: slos.updatedAt,
    currentValue: slos.currentValue,
    status: slos.status,
  })
  .from(slos)
  .orderBy(desc(slos.updatedAt))
  .limit(10);

console.log('Recent SLO updates:', recentSLOUpdates);
```

### View Recent Insights

```typescript
import { insights } from '../database/schema/index.js';

const recentInsights = await db
  .select()
  .from(insights)
  .where(eq(insights.status, 'new'))
  .orderBy(desc(insights.detectedAt))
  .limit(20);

console.log('Recent insights:', recentInsights);
```

## Complete End-to-End Example

```typescript
// 1. Setup: Create project, alert, and SLO
const projectId = 'e2e-test-project';

// 2. Create alert
await db.insert(alertsExtended).values({
  projectId,
  name: 'E2E Test Alert',
  dataSource: 'metric',
  queryConfig: { metricName: 'test.metric', aggregation: 'avg' },
  conditionType: 'above',
  threshold: { value: 100, duration: '5m' },
  severity: 'warning',
  enabled: true,
});

// 3. Create SLO
await db.insert(slos).values({
  projectId,
  name: 'E2E Test SLO',
  sliType: 'availability',
  sliConfig: { service: 'test-service' },
  target: '99.9',
  windowDays: 7,
});

// 4. Generate test data
for (let i = 0; i < 50; i++) {
  await db.insert(metrics).values({
    projectId,
    serviceName: 'test-service',
    metricName: 'test.metric',
    metricType: 'gauge',
    timestamp: new Date(Date.now() - i * 60 * 1000),
    valueDouble: 120,  // Above threshold
    attributes: {},
    resourceAttributes: {},
  });
}

// 5. Run jobs
await evaluateAlerts();
await calculateSLOs();
await detectAnomalies();

// 6. Verify results
const firedAlerts = await db
  .select()
  .from(alertsExtended)
  .where(
    and(
      eq(alertsExtended.projectId, projectId),
      eq(alertsExtended.state, 'firing')
    )
  );

console.log('Fired alerts:', firedAlerts);

const sloStatus = await db
  .select()
  .from(slos)
  .where(eq(slos.projectId, projectId));

console.log('SLO status:', sloStatus);

const detectedAnomalies = await db
  .select()
  .from(insights)
  .where(eq(insights.projectId, projectId));

console.log('Detected anomalies:', detectedAnomalies);
```

## Tips and Best Practices

1. **Test with Small Datasets First**: Start with a small amount of test data
2. **Monitor Performance**: Check job execution times with `console.time()`
3. **Use Transactions**: Wrap multiple inserts in transactions for consistency
4. **Clean Up Test Data**: Always clean up test data after testing
5. **Check Logs**: Monitor job logs to understand execution flow
6. **Validate Results**: Always verify job results match expectations
7. **Test Edge Cases**: Test with zero data, missing fields, etc.
