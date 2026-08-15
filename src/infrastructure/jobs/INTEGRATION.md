# Integration Guide

This guide shows how to integrate the background jobs system into your Baselime server.

## Step 1: Update `src/server.ts`

Add the scheduler import and start it when the server starts:

```typescript
import express from 'express';
import cors from 'cors';
import type { Server } from 'http';
import { createServer as createViteServer, type ViteDevServer } from 'vite';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './interface/trpc/router.js';
import { createContext } from './interface/trpc/context.js';
import { authMiddleware } from './interface/trpc/middleware/auth.middleware.js';
import { createTracesRouter } from './infrastructure/otlp/http/traces.js';
import { createLogsRouter } from './infrastructure/otlp/http/logs.js';
import { createMetricsRouter } from './infrastructure/otlp/http/metrics.js';
// Add this import
import { startScheduler, stopScheduler } from './infrastructure/jobs/index.js';

const PORT = process.env.PORT || 3000;
const OTLP_PORT = process.env.OTLP_HTTP_PORT || 4318;
const isDev = process.env.NODE_ENV !== 'production';

let mainServer: Server | null = null;
let otlpServer: Server | null = null;
let vite: ViteDevServer | null = null;

async function shutdown() {
  console.log('\nShutting down gracefully...');

  // Add this line to stop jobs before shutting down
  stopScheduler();

  if (vite) {
    await vite.close();
  }

  const closeServer = (server: Server | null) =>
    new Promise<void>((resolve) => {
      if (server) {
        server.close(() => resolve());
      } else {
        resolve();
      }
    });

  await Promise.all([
    closeServer(mainServer),
    closeServer(otlpServer),
  ]);

  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function main() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  app.use(authMiddleware);

  app.use(
    '/api/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext: ({ req, res }) => createContext({ req, res }),
    })
  );

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // OTLP endpoints on same server
  app.use(createTracesRouter());
  app.use(createLogsRouter());
  app.use(createMetricsRouter());

  if (isDev) {
    // Vite dev server as middleware
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      root: 'src/web',
    });

    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static('dist/web'));
    app.get('*', (req, res) => {
      res.sendFile('index.html', { root: 'dist/web' });
    });
  }

  mainServer = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`  - Frontend: http://localhost:${PORT}`);
    console.log(`  - API: http://localhost:${PORT}/api/trpc`);
    console.log(`  - OTLP Traces: POST http://localhost:${PORT}/v1/traces`);
    console.log(`  - OTLP Logs: POST http://localhost:${PORT}/v1/logs`);
    console.log(`  - OTLP Metrics: POST http://localhost:${PORT}/v1/metrics`);

    // Add this: Start background jobs after server is running
    startScheduler();
  });

  // Separate OTLP server (optional, for dedicated ingest)
  if (OTLP_PORT !== PORT) {
    const otlpApp = express();
    otlpApp.use(cors());
    otlpApp.use(express.json({ limit: '50mb' }));

    otlpApp.use(createTracesRouter());
    otlpApp.use(createLogsRouter());
    otlpApp.use(createMetricsRouter());

    otlpApp.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    otlpServer = otlpApp.listen(OTLP_PORT, () => {
      console.log(`OTLP HTTP Server also running on http://localhost:${OTLP_PORT}`);
    });
  }
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
```

## Step 2: Verify Installation

After integrating, when you start your server, you should see:

```
Server running on http://localhost:3000
  - Frontend: http://localhost:3000
  - API: http://localhost:3000/api/trpc
  - OTLP Traces: POST http://localhost:3000/v1/traces
  - OTLP Logs: POST http://localhost:3000/v1/logs
  - OTLP Metrics: POST http://localhost:3000/v1/metrics
[Scheduler] Starting background job scheduler...
[Scheduler] Scheduled job: Alert Evaluation (*/1 * * * *)
[Scheduler] Scheduled job: SLO Calculation (*/5 * * * *)
[Scheduler] Scheduled job: Anomaly Detection (*/15 * * * *)
[Scheduler] Scheduled job: Service Dependency Aggregation (*/10 * * * *)
[Scheduler] Successfully scheduled 4 jobs
```

## Step 3: Monitor Job Execution

Jobs will automatically run according to their schedules. You'll see logs like:

```
[Scheduler] Running job: Alert Evaluation
[AlertEngine] Starting alert evaluation...
[AlertEngine] Found 5 enabled alerts to evaluate
[AlertEngine] Evaluation complete. 1/5 alerts triggered
[AlertEngine] Alert API Error Rate state changed: ok -> firing
[Scheduler] Job completed: Alert Evaluation (234ms)
```

## Step 4: Test Alert Evaluation

Create a test alert to verify the system is working:

```typescript
import { db } from './infrastructure/database/connection.js';
import { alertsExtended } from './infrastructure/database/schema/index.js';

// Create a test alert that monitors error rate
await db.insert(alertsExtended).values({
  projectId: 'your-project-id',
  name: 'High Error Rate',
  description: 'Alert when error rate exceeds 5%',
  dataSource: 'trace',
  queryConfig: {
    metric: 'error_rate',
    service: 'api-service',
  },
  conditionType: 'above',
  threshold: {
    value: 5,
    duration: '5m',
    evaluationPeriod: '1m',
  },
  severity: 'critical',
  enabled: true,
  notificationChannelIds: [],
});
```

## Step 5: Verify SLO Calculation

Create a test SLO:

```typescript
import { slos } from './infrastructure/database/schema/index.js';

await db.insert(slos).values({
  projectId: 'your-project-id',
  name: 'API Availability',
  description: '99.9% availability target',
  sliType: 'availability',
  sliConfig: {
    service: 'api-service',
  },
  target: '99.9',
  windowDays: 30,
  alertOnBreach: true,
  alertChannelIds: [],
});
```

## Step 6: Check Anomaly Detection

After 15 minutes, check for detected anomalies:

```typescript
import { insights } from './infrastructure/database/schema/index.js';

const anomalies = await db
  .select()
  .from(insights)
  .where(eq(insights.type, 'anomaly_spike'))
  .limit(10);

console.log('Detected anomalies:', anomalies);
```

## Optional: Run Jobs Manually

For testing or troubleshooting, you can run jobs manually:

```typescript
import {
  evaluateAlerts,
  calculateSLOs,
  detectAnomalies,
  aggregateServiceDependencies
} from './infrastructure/jobs/index.js';

// Run alert evaluation immediately
await evaluateAlerts();

// Run SLO calculation immediately
await calculateSLOs();

// Run anomaly detection immediately
await detectAnomalies();

// Run service dependency aggregation immediately
await aggregateServiceDependencies();
```

## Optional: Add Health Check Endpoint

Add a dedicated endpoint to check job scheduler health:

```typescript
app.get('/api/jobs/status', (req, res) => {
  const jobs = getScheduledJobs();
  res.json({
    status: 'ok',
    scheduledJobs: jobs,
    count: jobs.length,
  });
});
```

## Troubleshooting

### Jobs Not Starting

If you don't see the scheduler logs:

1. Check that `startScheduler()` is called after the server starts
2. Verify there are no errors in the console
3. Check that node-cron is installed: `npm list node-cron`

### Database Connection Issues

If jobs fail with database errors:

1. Verify the database connection is working
2. Check that all required tables exist (run migrations)
3. Ensure the database user has appropriate permissions

### High Memory Usage

If you notice high memory usage:

1. Reduce the anomaly detection scope (limit metrics per project)
2. Increase job intervals to run less frequently
3. Add LIMIT clauses to queries if needed

## Next Steps

1. **Configure Notification Channels**: Set up Slack, email, or webhook notifications
2. **Create Dashboards**: Build dashboards to visualize SLO status and alerts
3. **Set Up Escalation Policies**: Configure alert escalation for critical issues
4. **Monitor Performance**: Track job execution times and resource usage
5. **Customize Job Schedules**: Adjust intervals based on your needs

## Production Recommendations

For production deployments:

1. **Environment Variables**: Use environment variables for all configuration
2. **Error Tracking**: Integrate with Sentry or similar for job error tracking
3. **Metrics Export**: Export job metrics to Prometheus for monitoring
4. **Log Aggregation**: Send logs to a centralized logging system
5. **Resource Limits**: Set memory and CPU limits for the job processes
6. **Backup Scheduler**: Consider running jobs on multiple instances with leader election

## Support

For issues or questions:

1. Check the logs for error messages
2. Review the README.md for detailed documentation
3. Examine individual job files for implementation details
4. Verify database schema matches expected structure
