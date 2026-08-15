import { eq, and, sql, inArray } from 'drizzle-orm';
import { db } from '../database/connection.js';
import {
  alertsExtended,
  alertHistory,
  notificationChannels,
  metrics,
  spans,
  logs,
} from '../database/schema/index.js';
import { sendNotification, type NotificationPayload } from './notification-sender.js';

interface AlertEvaluationResult {
  alertId: string;
  triggered: boolean;
  value: number;
  threshold: number;
  message: string;
}

export async function evaluateAlerts(): Promise<void> {
  console.log('[AlertEngine] Starting alert evaluation...');

  try {
    // Get all enabled alerts
    const alerts = await db
      .select()
      .from(alertsExtended)
      .where(eq(alertsExtended.enabled, true));

    console.log(`[AlertEngine] Found ${alerts.length} enabled alerts to evaluate`);

    const results: AlertEvaluationResult[] = [];

    for (const alert of alerts) {
      try {
        const result = await evaluateAlert(alert);
        results.push(result);

        // Update alert state
        await updateAlertState(alert, result);
      } catch (error) {
        console.error(`[AlertEngine] Failed to evaluate alert ${alert.id}:`, error);
      }
    }

    const triggeredCount = results.filter((r) => r.triggered).length;
    console.log(
      `[AlertEngine] Evaluation complete. ${triggeredCount}/${results.length} alerts triggered`
    );
  } catch (error) {
    console.error('[AlertEngine] Alert evaluation failed:', error);
    throw error;
  }
}

async function evaluateAlert(alert: any): Promise<AlertEvaluationResult> {
  const { queryConfig, conditionType, threshold: thresholdConfig } = alert;

  // Extract evaluation parameters
  const thresholdValue = thresholdConfig.value || 0;
  const duration = thresholdConfig.duration || '5m';
  const evaluationPeriod = thresholdConfig.evaluationPeriod || '1m';

  // Calculate time range
  const durationMs = parseDuration(duration);
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - durationMs);

  let currentValue = 0;

  // Query data based on data source
  switch (alert.dataSource) {
    case 'metric':
      currentValue = await evaluateMetricAlert(
        alert.projectId,
        queryConfig,
        startTime,
        endTime
      );
      break;

    case 'trace':
      currentValue = await evaluateTraceAlert(
        alert.projectId,
        queryConfig,
        startTime,
        endTime
      );
      break;

    case 'log':
      currentValue = await evaluateLogAlert(
        alert.projectId,
        queryConfig,
        startTime,
        endTime
      );
      break;

    case 'error':
      currentValue = await evaluateErrorAlert(
        alert.projectId,
        queryConfig,
        startTime,
        endTime
      );
      break;

    default:
      throw new Error(`Unknown data source: ${alert.dataSource}`);
  }

  // Evaluate condition
  let triggered = false;

  switch (conditionType) {
    case 'above':
      triggered = currentValue > thresholdValue;
      break;

    case 'below':
      triggered = currentValue < thresholdValue;
      break;

    case 'change_percent':
      const previousValue = await getPreviousValue(alert, startTime);
      const changePercent =
        previousValue > 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0;
      triggered = Math.abs(changePercent) > thresholdValue;
      break;

    case 'anomaly':
      const isAnomaly = await detectAnomalyForAlert(alert, currentValue);
      triggered = isAnomaly;
      break;

    case 'absence':
      triggered = currentValue === 0;
      break;

    default:
      throw new Error(`Unknown condition type: ${conditionType}`);
  }

  return {
    alertId: alert.id,
    triggered,
    value: currentValue,
    threshold: thresholdValue,
    message: triggered
      ? `Alert triggered: ${alert.name} - Current value: ${currentValue}, Threshold: ${thresholdValue}`
      : `Alert OK: ${alert.name}`,
  };
}

async function evaluateMetricAlert(
  projectId: string,
  queryConfig: any,
  startTime: Date,
  endTime: Date
): Promise<number> {
  const { metricName, aggregation = 'avg', filters = {} } = queryConfig;

  const result = await db
    .select({
      value: sql<number>`
        CASE
          WHEN ${aggregation} = 'avg' THEN AVG(COALESCE(${metrics.valueDouble}, ${metrics.valueInt}::float))
          WHEN ${aggregation} = 'sum' THEN SUM(COALESCE(${metrics.valueDouble}, ${metrics.valueInt}::float))
          WHEN ${aggregation} = 'min' THEN MIN(COALESCE(${metrics.valueDouble}, ${metrics.valueInt}::float))
          WHEN ${aggregation} = 'max' THEN MAX(COALESCE(${metrics.valueDouble}, ${metrics.valueInt}::float))
          WHEN ${aggregation} = 'count' THEN COUNT(*)::float
          ELSE AVG(COALESCE(${metrics.valueDouble}, ${metrics.valueInt}::float))
        END
      `,
    })
    .from(metrics)
    .where(
      and(
        eq(metrics.projectId, projectId),
        eq(metrics.metricName, metricName),
        sql`${metrics.timestamp} >= ${startTime}`,
        sql`${metrics.timestamp} <= ${endTime}`
      )
    );

  return result[0]?.value || 0;
}

async function evaluateTraceAlert(
  projectId: string,
  queryConfig: any,
  startTime: Date,
  endTime: Date
): Promise<number> {
  const { metric = 'error_rate', service, filters = {} } = queryConfig;

  if (metric === 'error_rate') {
    const result = await db
      .select({
        total: sql<number>`COUNT(*)::float`,
        errors: sql<number>`COUNT(*) FILTER (WHERE ${spans.statusCode} = 'ERROR')::float`,
      })
      .from(spans)
      .where(
        and(
          eq(spans.projectId, projectId),
          service ? eq(spans.serviceName, service) : undefined,
          sql`${spans.startTime} >= ${startTime}`,
          sql`${spans.startTime} <= ${endTime}`
        )
      );

    const total = result[0]?.total || 0;
    const errors = result[0]?.errors || 0;

    return total > 0 ? (errors / total) * 100 : 0;
  }

  if (metric === 'latency_p99') {
    const result = await db
      .select({
        p99: sql<number>`PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY ${spans.durationMs})`,
      })
      .from(spans)
      .where(
        and(
          eq(spans.projectId, projectId),
          service ? eq(spans.serviceName, service) : undefined,
          sql`${spans.startTime} >= ${startTime}`,
          sql`${spans.startTime} <= ${endTime}`
        )
      );

    return result[0]?.p99 || 0;
  }

  return 0;
}

async function evaluateLogAlert(
  projectId: string,
  queryConfig: any,
  startTime: Date,
  endTime: Date
): Promise<number> {
  const { severity, pattern, service } = queryConfig;

  const conditions = [
    eq(logs.projectId, projectId),
    sql`${logs.timestamp} >= ${startTime}`,
    sql`${logs.timestamp} <= ${endTime}`,
  ];

  if (severity) {
    conditions.push(eq(logs.severityText, severity));
  }

  if (service) {
    conditions.push(eq(logs.serviceName, service));
  }

  if (pattern) {
    conditions.push(sql`${logs.body} ILIKE ${`%${pattern}%`}`);
  }

  const result = await db
    .select({
      count: sql<number>`COUNT(*)::float`,
    })
    .from(logs)
    .where(and(...conditions));

  return result[0]?.count || 0;
}

async function evaluateErrorAlert(
  projectId: string,
  queryConfig: any,
  startTime: Date,
  endTime: Date
): Promise<number> {
  const { service } = queryConfig;

  const result = await db
    .select({
      count: sql<number>`COUNT(*)::float`,
    })
    .from(spans)
    .where(
      and(
        eq(spans.projectId, projectId),
        eq(spans.statusCode, 'ERROR'),
        service ? eq(spans.serviceName, service) : undefined,
        sql`${spans.startTime} >= ${startTime}`,
        sql`${spans.startTime} <= ${endTime}`
      )
    );

  return result[0]?.count || 0;
}

async function updateAlertState(
  alert: any,
  result: AlertEvaluationResult
): Promise<void> {
  const now = new Date();
  const currentState = alert.state;
  let newState = currentState;

  if (result.triggered) {
    if (currentState === 'ok') {
      newState = 'pending';
    } else if (currentState === 'pending') {
      // Check if it's been pending long enough
      const pendingDuration = alert.firingStartedAt
        ? now.getTime() - new Date(alert.firingStartedAt).getTime()
        : 0;

      if (pendingDuration > 60000) {
        // 1 minute
        newState = 'firing';
      }
    }
  } else {
    if (currentState === 'firing' || currentState === 'pending') {
      newState = 'ok';
    }
  }

  // Update alert state
  const updates: any = {
    lastEvaluatedAt: now,
    state: newState,
  };

  if (newState === 'pending' && currentState === 'ok') {
    updates.firingStartedAt = now;
  }

  if (newState === 'firing' && currentState !== 'firing') {
    updates.lastTriggeredAt = now;

    // Send notifications when alert starts firing
    await sendAlertNotifications(alert, result);
  }

  if (newState === 'ok' && (currentState === 'firing' || currentState === 'pending')) {
    updates.firingStartedAt = null;
  }

  await db.update(alertsExtended).set(updates).where(eq(alertsExtended.id, alert.id));

  // Record history
  if (newState !== currentState) {
    await db.insert(alertHistory).values({
      alertId: alert.id,
      event: newState === 'firing' ? 'triggered' : 'resolved',
      previousState: currentState,
      newState,
      value: result.value.toString(),
      threshold: result.threshold.toString(),
      message: result.message,
      timestamp: now,
    });

    console.log(
      `[AlertEngine] Alert ${alert.name} state changed: ${currentState} -> ${newState}`
    );
  }
}

async function sendAlertNotifications(
  alert: any,
  result: AlertEvaluationResult
): Promise<void> {
  const channelIds = alert.notificationChannelIds as string[];

  if (!channelIds || channelIds.length === 0) {
    console.log(`[AlertEngine] No notification channels configured for alert ${alert.name}`);
    return;
  }

  console.log(`[AlertEngine] Sending notifications for alert ${alert.name} to ${channelIds.length} channel(s)`);

  // Fetch all notification channels
  const channels = await db
    .select()
    .from(notificationChannels)
    .where(
      and(
        inArray(notificationChannels.id, channelIds),
        eq(notificationChannels.enabled, true)
      )
    );

  if (channels.length === 0) {
    console.log(`[AlertEngine] No enabled notification channels found for alert ${alert.name}`);
    return;
  }

  // Build notification payload
  const payload: NotificationPayload = {
    alertId: alert.id,
    alertName: alert.name,
    severity: alert.severity || 'warning',
    state: 'firing',
    value: result.value,
    threshold: result.threshold,
    message: alert.notificationMessage || result.message,
    triggeredAt: new Date().toISOString(),
    projectId: alert.projectId,
  };

  // Send to all channels in parallel
  const results = await Promise.all(
    channels.map(async (channel) => {
      try {
        const notificationResult = await sendNotification(
          channel.type,
          channel.config as Record<string, any>,
          payload
        );

        console.log(
          `[AlertEngine] Notification to ${channel.type} (${channel.name}): ${notificationResult.success ? 'SUCCESS' : 'FAILED'} - ${notificationResult.message}`
        );

        return notificationResult;
      } catch (error) {
        console.error(
          `[AlertEngine] Failed to send notification to ${channel.type} (${channel.name}):`,
          error
        );
        return { success: false, message: String(error) };
      }
    })
  );

  const successCount = results.filter((r) => r.success).length;
  console.log(
    `[AlertEngine] Notifications sent: ${successCount}/${channels.length} succeeded for alert ${alert.name}`
  );
}

async function getPreviousValue(alert: any, startTime: Date): Promise<number> {
  // Get the value from the previous evaluation period
  const duration = parseDuration(alert.threshold.duration || '5m');
  const previousStartTime = new Date(startTime.getTime() - duration);

  // This is a simplified implementation
  // In production, you might want to store historical values
  return 0;
}

async function detectAnomalyForAlert(alert: any, currentValue: number): Promise<boolean> {
  // Simple Z-score based anomaly detection
  // In production, this should use more sophisticated algorithms
  const historicalValues = await getHistoricalValues(alert);

  if (historicalValues.length < 10) {
    return false; // Not enough data
  }

  const mean = historicalValues.reduce((sum, v) => sum + v, 0) / historicalValues.length;
  const variance =
    historicalValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
    historicalValues.length;
  const stdDev = Math.sqrt(variance);

  const zScore = stdDev > 0 ? Math.abs((currentValue - mean) / stdDev) : 0;

  // Consider it an anomaly if Z-score > 3 (3 standard deviations)
  return zScore > 3;
}

async function getHistoricalValues(alert: any): Promise<number[]> {
  // Get last 24 hours of data
  // This is a simplified implementation
  return [];
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}
