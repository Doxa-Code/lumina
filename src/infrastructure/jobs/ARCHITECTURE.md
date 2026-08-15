# Background Jobs System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Baselime Server                          │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                  Background Job Scheduler                  │ │
│  │                      (node-cron)                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                              │                                  │
│         ┌────────────────────┼────────────────────┐            │
│         │                    │                    │            │
│         ▼                    ▼                    ▼            │
│  ┌────────────┐      ┌────────────┐      ┌────────────┐       │
│  │   Alert    │      │    SLO     │      │  Anomaly   │       │
│  │  Engine    │      │ Calculator │      │  Detector  │       │
│  │ (*/1 min)  │      │ (*/5 min)  │      │ (*/15 min) │       │
│  └────────────┘      └────────────┘      └────────────┘       │
│         │                    │                    │            │
│         │                    │                    │            │
│         │                    │                    ▼            │
│         │                    │            ┌────────────┐       │
│         │                    │            │  Service   │       │
│         │                    │            │Dependency  │       │
│         │                    │            │Aggregator  │       │
│         │                    │            │(*/10 min)  │       │
│         │                    │            └────────────┘       │
│         │                    │                    │            │
│         ▼                    ▼                    ▼            │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                   PostgreSQL Database                     │ │
│  │                                                            │ │
│  │  • alerts_v2          • slos              • insights      │ │
│  │  • alert_history      • slo_history       • correlations  │ │
│  │  • notification_      • spans             • service_      │ │
│  │    channels          • metrics             dependencies   │ │
│  │  • alert_silences     • logs                              │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Alert Evaluation Flow

```
┌──────────────┐
│ Alert Engine │ (Every minute)
└──────┬───────┘
       │
       │ 1. Query enabled alerts
       ▼
┌─────────────────┐
│ alerts_v2 table │
└──────┬──────────┘
       │
       │ 2. For each alert, fetch data based on dataSource
       ▼
┌──────────────────────────────────┐
│ Data Sources:                    │
│ • Metrics (avg/sum/min/max)      │
│ • Traces (error rate/latency)    │
│ • Logs (count/pattern match)     │
│ • Errors (error count)           │
└──────┬───────────────────────────┘
       │
       │ 3. Evaluate condition
       ▼
┌────────────────────────────────┐
│ Conditions:                    │
│ • above: value > threshold     │
│ • below: value < threshold     │
│ • change_percent: % change     │
│ • anomaly: Z-score analysis    │
│ • absence: value == 0          │
└──────┬─────────────────────────┘
       │
       │ 4. Update alert state
       ▼
┌─────────────────────────┐
│ State Transitions:      │
│ ok → pending → firing   │
│ firing → ok             │
└──────┬──────────────────┘
       │
       │ 5. Record history
       ▼
┌──────────────────────┐
│ alert_history table  │
└──────────────────────┘
```

### 2. SLO Calculation Flow

```
┌───────────────┐
│ SLO Calculator│ (Every 5 minutes)
└──────┬────────┘
       │
       │ 1. Query all SLOs
       ▼
┌──────────────┐
│  slos table  │
└──────┬───────┘
       │
       │ 2. Calculate SLI based on type
       ▼
┌────────────────────────────────────┐
│ SLI Types:                         │
│ • availability: (successful/total) │
│ • latency: (below_threshold/total) │
│ • error_rate: (1 - errors/total)   │
│ • throughput: actual/target        │
└──────┬─────────────────────────────┘
       │
       │ 3. Query trace/metric data
       ▼
┌──────────────────┐
│ spans/metrics    │
│ (time-windowed)  │
└──────┬───────────┘
       │
       │ 4. Calculate error budget
       ▼
┌────────────────────────────────────┐
│ Error Budget:                      │
│ • Total: 100% - target%            │
│ • Consumed: target% - current%     │
│ • Remaining: total - consumed      │
└──────┬─────────────────────────────┘
       │
       │ 5. Determine status
       ▼
┌────────────────────────────────────┐
│ Status:                            │
│ • healthy: >20% budget remaining   │
│ • at_risk: <20% budget remaining   │
│ • breached: current < target       │
└──────┬─────────────────────────────┘
       │
       │ 6. Update & record history
       ▼
┌──────────────────────────────┐
│ slos table + slo_history     │
└──────────────────────────────┘
```

### 3. Anomaly Detection Flow

```
┌───────────────────┐
│ Anomaly Detector  │ (Every 15 minutes)
└──────┬────────────┘
       │
       │ 1. Query projects with data
       ▼
┌────────────────────────────┐
│ metrics/spans/logs tables  │
└──────┬─────────────────────┘
       │
       │ 2. For each metric/service
       ▼
┌─────────────────────────────────┐
│ Get current value (last 15 min) │
└──────┬──────────────────────────┘
       │
       │ 3. Get historical baseline
       ▼
┌─────────────────────────────────┐
│ Historical values (last 24 hrs) │
└──────┬──────────────────────────┘
       │
       │ 4. Calculate statistics
       ▼
┌────────────────────────────────┐
│ Statistics:                    │
│ • Mean (μ)                     │
│ • Standard Deviation (σ)       │
│ • Z-score: (value - μ) / σ     │
└──────┬─────────────────────────┘
       │
       │ 5. Detect anomalies
       ▼
┌────────────────────────────────┐
│ Anomaly Threshold:             │
│ • |Z-score| > 3 = anomaly      │
│ • Z > 0 = spike                │
│ • Z < 0 = drop                 │
└──────┬─────────────────────────┘
       │
       │ 6. Create insights
       ▼
┌────────────────────────────────┐
│ insights table                 │
│ • type: anomaly_spike/drop     │
│ • severity: info/warn/critical │
│ • data: expected/actual/zscore │
└────────────────────────────────┘
```

### 4. Service Dependency Aggregation Flow

```
┌──────────────────────────┐
│ Service Dependency       │ (Every 10 minutes)
│ Aggregator               │
└──────┬───────────────────┘
       │
       │ 1. Query recent spans
       ▼
┌────────────────────────────┐
│ spans table (last 1 hour)  │
└──────┬─────────────────────┘
       │
       │ 2. Find parent-child relationships
       ▼
┌─────────────────────────────────────┐
│ JOIN parent.span_id =               │
│      child.parent_span_id           │
│ WHERE parent.service !=             │
│       child.service                 │
└──────┬──────────────────────────────┘
       │
       │ 3. Aggregate stats per dependency
       ▼
┌────────────────────────────────────┐
│ Aggregated Stats:                  │
│ • request_count: COUNT(*)          │
│ • error_count: COUNT(errors)       │
│ • avg_latency: AVG(duration)       │
│ • p99_latency: PERCENTILE(0.99)    │
└──────┬─────────────────────────────┘
       │
       │ 4. Upsert with smoothing
       ▼
┌────────────────────────────────────┐
│ Exponential Moving Average:        │
│ new = α × current + (1-α) × old    │
│ α = 0.3 (smoothing factor)         │
└──────┬─────────────────────────────┘
       │
       │ 5. Update database
       ▼
┌────────────────────────────────┐
│ service_dependencies table     │
│ • source_service               │
│ • target_service               │
│ • aggregated stats             │
└────────────────────────────────┘
```

## Component Details

### Scheduler (`scheduler.ts`)

**Responsibilities:**
- Manage job lifecycle (start/stop)
- Execute jobs on schedule
- Handle errors and logging
- Graceful shutdown

**Key Features:**
- UTC timezone for consistency
- Individual job error isolation
- Process signal handling (SIGTERM/SIGINT)

### Alert Engine (`alert-engine.ts`)

**Responsibilities:**
- Evaluate alert conditions
- Manage alert state transitions
- Record alert history
- Support multiple data sources

**Key Algorithms:**
- Threshold comparison
- Percentage change calculation
- Z-score anomaly detection
- Time-window aggregation

### SLO Calculator (`slo-calculator.ts`)

**Responsibilities:**
- Calculate SLI values
- Track error budget
- Update SLO status
- Record SLO history

**Key Calculations:**
- Availability: `(successful_requests / total_requests) × 100`
- Latency: `(requests_below_threshold / total_requests) × 100`
- Error Budget: `100% - target%`
- Error Budget Consumed: `target% - current_value%`

### Anomaly Detector (`anomaly-detector.ts`)

**Responsibilities:**
- Detect metric anomalies
- Detect latency degradation
- Detect error rate spikes
- Create actionable insights

**Key Algorithms:**
- **Z-score Analysis**: Statistical outlier detection
  ```
  Z = (X - μ) / σ
  where:
    X = current value
    μ = mean of historical values
    σ = standard deviation
  ```
- **Severity Mapping**:
  - `|Z| > 5` → critical
  - `|Z| > 4` → warning
  - `|Z| > 3` → info

### Service Dependency Aggregator (`service-dependency-aggregator.ts`)

**Responsibilities:**
- Discover service dependencies
- Aggregate dependency metrics
- Smooth statistics over time
- Clean up stale dependencies

**Key Algorithms:**
- **Dependency Discovery**: Parent-child span analysis
- **Exponential Moving Average**:
  ```
  EMA(t) = α × V(t) + (1-α) × EMA(t-1)
  where α = 0.3 (30% new, 70% old)
  ```

## Performance Characteristics

### Time Complexity

| Job | Query Complexity | Processing Complexity |
|-----|------------------|----------------------|
| Alert Engine | O(n × m) | O(n) |
| SLO Calculator | O(n × m) | O(n) |
| Anomaly Detector | O(p × s × h) | O(p × s × h) |
| Dependency Aggregator | O(s²) | O(d) |

Where:
- n = number of alerts/SLOs
- m = data points per query
- p = number of projects
- s = number of services/metrics
- h = historical data points
- d = number of dependencies

### Space Complexity

| Job | Memory Usage |
|-----|--------------|
| Alert Engine | O(n + m) |
| SLO Calculator | O(n + m) |
| Anomaly Detector | O(h) per metric |
| Dependency Aggregator | O(d) |

### Database Load

| Job | Query Type | Index Usage |
|-----|------------|-------------|
| Alert Engine | SELECT + UPDATE | High (time-based) |
| SLO Calculator | SELECT + UPDATE | High (time-based) |
| Anomaly Detector | SELECT only | Very High (time + service) |
| Dependency Aggregator | SELECT + UPSERT | Medium (trace joins) |

## Scaling Considerations

### Horizontal Scaling

To scale horizontally (multiple instances):

1. **Use Distributed Locks**: Implement Redis-based locks
2. **Partition by Project**: Each instance handles specific projects
3. **Leader Election**: Use Consul or etcd for leader election

### Vertical Scaling

To scale vertically (single instance):

1. **Increase Job Intervals**: Reduce execution frequency
2. **Limit Query Scope**: Add LIMIT clauses and pagination
3. **Optimize Queries**: Add appropriate indexes
4. **Use Read Replicas**: Offload reads to replicas

### Database Optimization

Required indexes for optimal performance:

```sql
-- Alerts
CREATE INDEX idx_alerts_enabled ON alerts_v2(enabled);
CREATE INDEX idx_alerts_project_state ON alerts_v2(project_id, state);

-- SLOs
CREATE INDEX idx_slos_project_status ON slos(project_id, status);

-- Spans (for SLO/dependency calculation)
CREATE INDEX idx_spans_project_time ON spans(project_id, start_time);
CREATE INDEX idx_spans_service_time ON spans(project_id, service_name, start_time);
CREATE INDEX idx_spans_trace ON spans(trace_id);

-- Metrics (for anomaly detection)
CREATE INDEX idx_metrics_project_metric_time ON metrics(project_id, metric_name, timestamp);
CREATE INDEX idx_metrics_service_time ON metrics(project_id, service_name, timestamp);

-- Insights
CREATE INDEX idx_insights_project_status ON insights(project_id, status);
CREATE INDEX idx_insights_project_detected ON insights(project_id, detected_at);
```

## Error Handling Strategy

### Job-Level Errors

```typescript
try {
  await job.handler();
} catch (error) {
  console.error(`Job failed: ${job.name}`, error);
  // Job continues to run on schedule
}
```

### Database Errors

```typescript
try {
  await db.update(alerts).set(...).where(...);
} catch (error) {
  // Log error but don't stop processing other alerts
  console.error('Failed to update alert:', error);
}
```

### Transient Failures

- Network errors: Retry on next schedule
- Lock timeouts: Skip and try on next run
- Query timeouts: Reduce query scope

## Monitoring & Observability

### Key Metrics to Monitor

1. **Job Execution**
   - Execution duration
   - Success/failure rate
   - Items processed per run

2. **Database Performance**
   - Query execution time
   - Connection pool usage
   - Lock wait time

3. **Business Metrics**
   - Alerts triggered per hour
   - SLOs at risk/breached
   - Anomalies detected per project
   - Dependencies discovered

### Health Checks

Monitor:
- Last execution timestamp
- Execution duration trends
- Error rate over time
- Queue depth (if using queues)

### Logging Strategy

```typescript
// Start of job
console.log('[JobName] Starting job...');

// Progress updates
console.log(`[JobName] Processed ${count} items`);

// State changes
console.log(`[JobName] Alert state changed: ok -> firing`);

// Completion
console.log(`[JobName] Completed (${duration}ms)`);

// Errors
console.error(`[JobName] Error:`, error);
```
