# Background Jobs System

This directory contains the background jobs system for the Baselime observability platform. It handles periodic tasks like alert evaluation, SLO calculation, anomaly detection, and service dependency tracking.

## Overview

The background jobs system uses `node-cron` to schedule and execute periodic tasks. Each job runs independently and includes proper error handling and logging.

## Files

### 1. `scheduler.ts` - Main Job Scheduler

The central scheduler that manages all background jobs using cron schedules.

**Features:**
- Configurable job schedules using cron syntax
- Graceful shutdown handling (SIGTERM/SIGINT)
- Per-job execution tracking and logging
- Error handling and recovery

**Jobs:**
- **Alert Evaluation**: Runs every 1 minute
- **SLO Calculation**: Runs every 5 minutes
- **Anomaly Detection**: Runs every 15 minutes
- **Service Dependency Aggregation**: Runs every 10 minutes

### 2. `alert-engine.ts` - Alert Evaluation Engine

Evaluates all enabled alerts and triggers notifications when conditions are met.

**Supported Data Sources:**
- Metrics
- Traces
- Logs
- Errors

**Supported Conditions:**
- `above`: Trigger when value exceeds threshold
- `below`: Trigger when value falls below threshold
- `change_percent`: Trigger on percentage change from baseline
- `anomaly`: Trigger on statistical anomalies (Z-score based)
- `absence`: Trigger when no data is received

**Alert States:**
- `ok`: Alert condition is not met
- `pending`: Alert condition met, waiting for confirmation
- `firing`: Alert is actively firing
- `silenced`: Alert is silenced by user

### 3. `slo-calculator.ts` - SLO Calculation Engine

Calculates Service Level Indicators (SLIs) and tracks error budget consumption.

**Supported SLI Types:**
- `availability`: Percentage of successful requests
- `latency`: Percentage of requests below latency threshold
- `error_rate`: Success rate (100% - error rate)
- `throughput`: Requests per hour vs. target

**Calculations:**
- Current SLI value
- Error budget consumed
- Error budget remaining
- SLO status (healthy/at_risk/breached)

**Status Determination:**
- `healthy`: Meeting SLO target with >20% error budget remaining
- `at_risk`: Meeting target but <20% error budget remaining
- `breached`: Not meeting SLO target

### 4. `anomaly-detector.ts` - Anomaly Detection Engine

Detects anomalies in metrics, latency, and error rates using statistical methods.

**Detection Methods:**
- **Z-score Analysis**: Detects values > 3 standard deviations from mean
- **Historical Baseline**: Compares current values to 24-hour historical data
- **Threshold-based**: For error rates (>5% triggers detection)

**Anomaly Types:**
- `anomaly_spike`: Sudden increase in metric value
- `anomaly_drop`: Sudden decrease in metric value

**Detection Targets:**
- Custom metrics (CPU, memory, custom business metrics)
- Service latency (P99)
- Error rates

**Severity Levels:**
- `info`: Z-score 3-4
- `warning`: Z-score 4-5
- `critical`: Z-score >5

### 5. `service-dependency-aggregator.ts` - Service Dependency Tracker

Analyzes trace data to discover and track service dependencies.

**Features:**
- Automatic dependency discovery from parent-child span relationships
- Aggregated statistics per dependency
- Exponential moving average for smoothing
- Cleanup of stale dependencies (>7 days old)

**Tracked Metrics:**
- Request count
- Error count
- Average latency
- P99 latency
- Last seen timestamp

## Integration

### Starting the Scheduler

Add to your `src/server.ts`:

```typescript
import { startScheduler, stopScheduler } from './infrastructure/jobs/index.js';

async function main() {
  // ... existing server setup ...

  // Start background jobs
  startScheduler();
  console.log('Background jobs started');
}

async function shutdown() {
  console.log('\nShutting down gracefully...');

  // Stop background jobs
  stopScheduler();

  // ... existing shutdown code ...
}
```

### Running Individual Jobs Manually

```typescript
import { evaluateAlerts, calculateSLOs, detectAnomalies } from './infrastructure/jobs/index.js';

// Run alert evaluation
await evaluateAlerts();

// Run SLO calculation
await calculateSLOs();

// Run anomaly detection
await detectAnomalies();
```

## Configuration

### Environment Variables

You can configure job schedules through environment variables (optional):

```bash
# Alert evaluation interval (default: */1 * * * * - every minute)
ALERT_EVALUATION_SCHEDULE="*/1 * * * *"

# SLO calculation interval (default: */5 * * * * - every 5 minutes)
SLO_CALCULATION_SCHEDULE="*/5 * * * *"

# Anomaly detection interval (default: */15 * * * * - every 15 minutes)
ANOMALY_DETECTION_SCHEDULE="*/15 * * * *"

# Service dependency aggregation interval (default: */10 * * * * - every 10 minutes)
DEPENDENCY_AGGREGATION_SCHEDULE="*/10 * * * *"
```

### Cron Syntax Reference

```
*    *    *    *    *
┬    ┬    ┬    ┬    ┬
│    │    │    │    │
│    │    │    │    └─── Day of Week (0-7, Sunday = 0 or 7)
│    │    │    └──────── Month (1-12)
│    │    └───────────── Day of Month (1-31)
│    └────────────────── Hour (0-23)
└─────────────────────── Minute (0-59)
```

Examples:
- `*/1 * * * *` - Every minute
- `*/5 * * * *` - Every 5 minutes
- `0 * * * *` - Every hour at minute 0
- `0 0 * * *` - Every day at midnight

## Performance Considerations

### Database Query Optimization

1. **Alert Evaluation**: Queries are limited to enabled alerts only
2. **Anomaly Detection**: Limited to 50 metrics per project to avoid overwhelming queries
3. **Service Dependencies**: Uses 1-hour rolling window for aggregation

### Resource Usage

- **Memory**: Each job runs independently and releases resources after completion
- **CPU**: Statistical calculations (Z-score) are optimized for batch processing
- **Database**: Uses indexed queries and proper time range filtering

### Scaling Recommendations

For high-volume environments:

1. **Adjust Intervals**: Increase job intervals to reduce load
   ```typescript
   // In scheduler.ts
   {
     name: 'Anomaly Detection',
     schedule: '*/30 * * * *', // Every 30 minutes instead of 15
     handler: detectAnomalies,
     enabled: true,
   }
   ```

2. **Partition by Project**: Run separate job instances per project
3. **Use Job Queues**: Replace cron with a queue system (Bull, BullMQ) for better scaling
4. **Database Optimization**: Add appropriate indexes for query patterns

## Monitoring

### Logging

Each job logs:
- Start time
- Completion time and duration
- Number of items processed
- Errors encountered

Example output:
```
[Scheduler] Starting background job scheduler...
[Scheduler] Scheduled job: Alert Evaluation (*/1 * * * *)
[Scheduler] Scheduled job: SLO Calculation (*/5 * * * *)
[Scheduler] Successfully scheduled 4 jobs
[Scheduler] Running job: Alert Evaluation
[AlertEngine] Starting alert evaluation...
[AlertEngine] Found 12 enabled alerts to evaluate
[AlertEngine] Evaluation complete. 2/12 alerts triggered
[Scheduler] Job completed: Alert Evaluation (1234ms)
```

### Health Checks

Monitor job health by checking:
- Last execution timestamp
- Execution duration trends
- Error rates
- Queue depth (if using job queues)

## Error Handling

Each job includes comprehensive error handling:

1. **Job-level errors**: Caught and logged without stopping the scheduler
2. **Database errors**: Transaction rollback and retry logic
3. **Timeout protection**: Jobs have implicit timeouts from cron scheduler

## Testing

### Unit Testing

```typescript
import { evaluateAlerts } from './alert-engine.js';
import { db } from '../database/connection.js';

describe('Alert Engine', () => {
  it('should evaluate metric alerts correctly', async () => {
    // Setup test data
    await db.insert(alertsExtended).values({
      // ... test alert config
    });

    // Run evaluation
    await evaluateAlerts();

    // Assert results
    const alert = await db.select().from(alertsExtended).where(...);
    expect(alert.state).toBe('firing');
  });
});
```

### Integration Testing

```typescript
// Start scheduler for integration tests
import { startScheduler, stopScheduler } from './scheduler.js';

beforeAll(() => {
  startScheduler();
});

afterAll(() => {
  stopScheduler();
});
```

## Troubleshooting

### Jobs Not Running

1. Check if scheduler was started: Look for `[Scheduler] Starting background job scheduler...` in logs
2. Verify job is enabled in `scheduler.ts`
3. Check for errors in job execution

### High CPU Usage

1. Reduce anomaly detection scope (limit metrics/services)
2. Increase job intervals
3. Add database indexes for frequently queried columns

### Database Lock Timeouts

1. Reduce batch sizes in queries
2. Add connection pooling limits
3. Use read replicas for read-heavy jobs

### Memory Leaks

1. Ensure all database connections are properly closed
2. Limit result set sizes with LIMIT clauses
3. Monitor memory usage over time

## Future Enhancements

Potential improvements:

1. **Distributed Job Execution**: Use Redis for distributed locks
2. **Job Priority Queues**: Prioritize critical alerts over regular checks
3. **Dynamic Scheduling**: Adjust intervals based on data volume
4. **Machine Learning**: Advanced anomaly detection using ML models
5. **Correlation Analysis**: Automatic correlation between metrics and events
6. **Job Metrics**: Export job execution metrics to Prometheus
