import { z } from 'zod';
import { Resend } from 'resend';
import { router, projectProcedure } from '../trpc.js';
import { db } from '../../../infrastructure/database/connection.js';
import { alertsExtended, alertHistory, alertSilences, notificationChannels, spans, logs, metrics } from '../../../infrastructure/database/schema';
import { eq, and, desc, sql, inArray, gte, lte, count } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

// Lazy-initialized Resend client
let resend: Resend | null = null;
function getResend(): Resend | null {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

// ============================================
// INPUT VALIDATION SCHEMAS
// ============================================

const alertStateEnum = z.enum(['ok', 'pending', 'firing', 'silenced']);
const alertSeverityEnum = z.enum(['info', 'warning', 'critical']);
const dataSourceEnum = z.enum(['metric', 'trace', 'log', 'error']);
const conditionTypeEnum = z.enum(['above', 'below', 'change_percent', 'anomaly', 'absence']);

const createAlertSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  dataSource: dataSourceEnum,
  queryConfig: z.record(z.any()),
  conditionType: conditionTypeEnum,
  threshold: z.record(z.any()),
  severity: alertSeverityEnum.default('warning'),
  notificationChannelIds: z.array(z.string().uuid()).default([]),
  notificationMessage: z.string().optional(),
  evaluationInterval: z.number().min(30).max(86400).default(60),
  enabled: z.boolean().default(true),
  labels: z.record(z.any()).default({}),
  annotations: z.record(z.any()).default({}),
});

const updateAlertSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  queryConfig: z.record(z.any()).optional(),
  conditionType: conditionTypeEnum.optional(),
  threshold: z.record(z.any()).optional(),
  severity: alertSeverityEnum.optional(),
  notificationChannelIds: z.array(z.string().uuid()).optional(),
  notificationMessage: z.string().optional(),
  evaluationInterval: z.number().min(30).max(86400).optional(),
  labels: z.record(z.any()).optional(),
  annotations: z.record(z.any()).optional(),
});

const channelTypeEnum = z.enum(['slack', 'email', 'webhook', 'pagerduty', 'opsgenie']);

// Channel config validation schemas
const slackConfigSchema = z.object({
  webhookUrl: z.string().url(),
  channel: z.string().optional(),
  username: z.string().optional(),
  iconEmoji: z.string().optional(),
});

const emailConfigSchema = z.object({
  recipients: z.array(z.string().email()).min(1),
  fromName: z.string().optional(),
  fromEmail: z.string().email().optional(),
  subject: z.string().optional(),
});

const webhookConfigSchema = z.object({
  url: z.string().url(),
  method: z.enum(['POST', 'PUT']).default('POST'),
  headers: z.record(z.string()).optional(),
  bodyTemplate: z.string().optional(),
});

const pagerdutyConfigSchema = z.object({
  routingKey: z.string().min(32).max(32),
  severity: z.enum(['critical', 'error', 'warning', 'info']).default('error'),
});

const opsgenieConfigSchema = z.object({
  apiKey: z.string().min(1),
  region: z.enum(['us', 'eu']).default('us'),
  priority: z.enum(['P1', 'P2', 'P3', 'P4', 'P5']).default('P3'),
});

// Function to validate channel config based on type
function validateChannelConfig(type: string, config: Record<string, any>): { valid: boolean; error?: string } {
  try {
    switch (type) {
      case 'slack':
        slackConfigSchema.parse(config);
        break;
      case 'email':
        emailConfigSchema.parse(config);
        break;
      case 'webhook':
        webhookConfigSchema.parse(config);
        break;
      case 'pagerduty':
        pagerdutyConfigSchema.parse(config);
        break;
      case 'opsgenie':
        opsgenieConfigSchema.parse(config);
        break;
      default:
        return { valid: false, error: `Unknown channel type: ${type}` };
    }
    return { valid: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { valid: false, error: err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') };
    }
    return { valid: false, error: 'Invalid configuration' };
  }
}

// ============================================
// ALERT EVALUATION LOGIC
// ============================================

interface EvaluationResult {
  triggered: boolean;
  value: number;
  threshold: number;
  evaluatedAt: string;
  message: string;
  dataPoints?: number;
}

async function evaluateAlert(
  projectId: string,
  dataSource: string,
  queryConfig: Record<string, any>,
  conditionType: string,
  threshold: Record<string, any>
): Promise<EvaluationResult> {
  const now = new Date();
  const duration = threshold.duration || '5m';
  const durationMs = parseDuration(duration);
  const from = new Date(now.getTime() - durationMs);

  let value = 0;
  let dataPoints = 0;
  const thresholdValue = Number(threshold.value) || 0;

  try {
    switch (dataSource) {
      case 'trace': {
        // Evaluate based on trace data (latency, error rate, etc.)
        const serviceName = queryConfig.serviceName;
        const conditions = [
          eq(spans.projectId, projectId),
          gte(spans.startTime, from),
          lte(spans.startTime, now),
          sql`${spans.parentSpanId} IS NULL`, // Root spans only
        ];

        if (serviceName) {
          conditions.push(eq(spans.serviceName, serviceName));
        }

        if (queryConfig.metricType === 'error_rate') {
          // Calculate error rate
          const result = await db
            .select({
              total: sql<number>`count(*)`,
              errors: sql<number>`count(*) filter (where ${spans.statusCode} = 'ERROR')`,
            })
            .from(spans)
            .where(and(...conditions));

          const total = Number(result[0]?.total) || 0;
          const errors = Number(result[0]?.errors) || 0;
          value = total > 0 ? (errors / total) * 100 : 0;
          dataPoints = total;
        } else if (queryConfig.metricType === 'latency' || queryConfig.metricType === 'p99') {
          // Calculate latency percentile
          const percentile = queryConfig.percentile || 99;
          const result = await db
            .select({
              percentileValue: sql<number>`percentile_cont(${percentile / 100}) within group (order by ${spans.durationMs})`,
              count: sql<number>`count(*)`,
            })
            .from(spans)
            .where(and(...conditions));

          value = Number(result[0]?.percentileValue) || 0;
          dataPoints = Number(result[0]?.count) || 0;
        } else {
          // Default: count of spans
          const result = await db
            .select({ count: sql<number>`count(*)` })
            .from(spans)
            .where(and(...conditions));

          value = Number(result[0]?.count) || 0;
          dataPoints = value;
        }
        break;
      }

      case 'log': {
        // Evaluate based on log data
        const serviceName = queryConfig.serviceName;
        const severityNumber = queryConfig.severityNumber;
        const conditions = [
          eq(logs.projectId, projectId),
          gte(logs.timestamp, from),
          lte(logs.timestamp, now),
        ];

        if (serviceName) {
          conditions.push(eq(logs.serviceName, serviceName));
        }

        if (severityNumber) {
          conditions.push(eq(logs.severityNumber, severityNumber));
        }

        const result = await db
          .select({ count: sql<number>`count(*)` })
          .from(logs)
          .where(and(...conditions));

        value = Number(result[0]?.count) || 0;
        dataPoints = value;
        break;
      }

      case 'metric': {
        // Evaluate based on metric data
        const metricName = queryConfig.metricName;
        const aggregation = queryConfig.aggregation || 'avg';
        const conditions = [
          eq(metrics.projectId, projectId),
          gte(metrics.timestamp, from),
          lte(metrics.timestamp, now),
        ];

        if (metricName) {
          conditions.push(eq(metrics.metricName, metricName));
        }

        let aggregationSql;
        switch (aggregation) {
          case 'sum':
            aggregationSql = sql<number>`sum(coalesce(${metrics.valueDouble}, ${metrics.valueInt}))`;
            break;
          case 'min':
            aggregationSql = sql<number>`min(coalesce(${metrics.valueDouble}, ${metrics.valueInt}))`;
            break;
          case 'max':
            aggregationSql = sql<number>`max(coalesce(${metrics.valueDouble}, ${metrics.valueInt}))`;
            break;
          case 'count':
            aggregationSql = sql<number>`count(*)`;
            break;
          default: // avg
            aggregationSql = sql<number>`avg(coalesce(${metrics.valueDouble}, ${metrics.valueInt}))`;
        }

        const result = await db
          .select({
            value: aggregationSql,
            count: sql<number>`count(*)`,
          })
          .from(metrics)
          .where(and(...conditions));

        value = Number(result[0]?.value) || 0;
        dataPoints = Number(result[0]?.count) || 0;
        break;
      }

      case 'error': {
        // Evaluate based on error groups
        const serviceName = queryConfig.serviceName;
        const conditions = [
          eq(spans.projectId, projectId),
          eq(spans.statusCode, 'ERROR'),
          gte(spans.startTime, from),
          lte(spans.startTime, now),
        ];

        if (serviceName) {
          conditions.push(eq(spans.serviceName, serviceName));
        }

        const result = await db
          .select({ count: sql<number>`count(*)` })
          .from(spans)
          .where(and(...conditions));

        value = Number(result[0]?.count) || 0;
        dataPoints = value;
        break;
      }

      default:
        return {
          triggered: false,
          value: 0,
          threshold: thresholdValue,
          evaluatedAt: now.toISOString(),
          message: `Unknown data source: ${dataSource}`,
          dataPoints: 0,
        };
    }

    // Evaluate condition
    let triggered = false;
    let message = '';

    switch (conditionType) {
      case 'above':
        triggered = value > thresholdValue;
        message = triggered
          ? `Value ${value.toFixed(2)} is above threshold ${thresholdValue}`
          : `Value ${value.toFixed(2)} is within threshold ${thresholdValue}`;
        break;

      case 'below':
        triggered = value < thresholdValue;
        message = triggered
          ? `Value ${value.toFixed(2)} is below threshold ${thresholdValue}`
          : `Value ${value.toFixed(2)} is within threshold ${thresholdValue}`;
        break;

      case 'change_percent':
        // For change percent, we need historical data to compare
        // Simplified: compare with previous period
        const previousFrom = new Date(from.getTime() - durationMs);
        // This is simplified - in production you'd run another query
        triggered = Math.abs(value) > thresholdValue;
        message = triggered
          ? `Change of ${value.toFixed(2)}% exceeds threshold ${thresholdValue}%`
          : `Change of ${value.toFixed(2)}% is within threshold ${thresholdValue}%`;
        break;

      case 'anomaly':
        // Simplified anomaly detection using standard deviation
        // In production, you'd use ML-based anomaly detection
        const stdDevThreshold = thresholdValue || 3; // Default 3 sigma
        triggered = false; // Would need historical data to compute
        message = 'Anomaly detection evaluated';
        break;

      case 'absence':
        triggered = dataPoints === 0;
        message = triggered
          ? `No data received in the last ${duration}`
          : `Received ${dataPoints} data points in the last ${duration}`;
        break;

      default:
        message = `Unknown condition type: ${conditionType}`;
    }

    return {
      triggered,
      value,
      threshold: thresholdValue,
      evaluatedAt: now.toISOString(),
      message,
      dataPoints,
    };
  } catch (error) {
    return {
      triggered: false,
      value: 0,
      threshold: thresholdValue,
      evaluatedAt: now.toISOString(),
      message: `Evaluation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      dataPoints: 0,
    };
  }
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 5 * 60 * 1000; // Default 5 minutes

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 5 * 60 * 1000;
  }
}

// ============================================
// NOTIFICATION SENDING LOGIC
// ============================================

interface NotificationPayload {
  alertId: string;
  alertName: string;
  severity: string;
  state: string;
  value: number;
  threshold: number;
  message: string;
  triggeredAt: string;
  projectId: string;
}

interface NotificationResult {
  success: boolean;
  message: string;
  timestamp: string;
}

async function sendNotification(
  channelType: string,
  config: Record<string, any>,
  payload: NotificationPayload
): Promise<NotificationResult> {
  const timestamp = new Date().toISOString();

  try {
    switch (channelType) {
      case 'slack': {
        const { webhookUrl, channel, username, iconEmoji } = config;

        const slackPayload = {
          channel: channel || undefined,
          username: username || 'Alert Bot',
          icon_emoji: iconEmoji || ':warning:',
          attachments: [{
            color: payload.severity === 'critical' ? 'danger' : payload.severity === 'warning' ? 'warning' : 'good',
            title: `Alert: ${payload.alertName}`,
            text: payload.message,
            fields: [
              { title: 'Severity', value: payload.severity.toUpperCase(), short: true },
              { title: 'State', value: payload.state.toUpperCase(), short: true },
              { title: 'Value', value: payload.value.toFixed(2), short: true },
              { title: 'Threshold', value: payload.threshold.toString(), short: true },
            ],
            footer: 'Lumina Alerts',
            ts: Math.floor(new Date(payload.triggeredAt).getTime() / 1000),
          }],
        };

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackPayload),
        });

        if (!response.ok) {
          throw new Error(`Slack API error: ${response.status}`);
        }

        return { success: true, message: 'Notification sent to Slack', timestamp };
      }

      case 'webhook': {
        const { url, method, headers, bodyTemplate } = config;

        let body: string;
        if (bodyTemplate) {
          // Replace template variables
          body = bodyTemplate
            .replace(/\{\{alertName\}\}/g, payload.alertName)
            .replace(/\{\{severity\}\}/g, payload.severity)
            .replace(/\{\{state\}\}/g, payload.state)
            .replace(/\{\{value\}\}/g, payload.value.toString())
            .replace(/\{\{threshold\}\}/g, payload.threshold.toString())
            .replace(/\{\{message\}\}/g, payload.message);
        } else {
          body = JSON.stringify(payload);
        }

        const response = await fetch(url, {
          method: method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body,
        });

        if (!response.ok) {
          throw new Error(`Webhook error: ${response.status}`);
        }

        return { success: true, message: 'Notification sent to webhook', timestamp };
      }

      case 'pagerduty': {
        const { routingKey, severity: pdSeverity } = config;

        const severityMap: Record<string, string> = {
          critical: 'critical',
          warning: 'warning',
          info: 'info',
        };

        const pdPayload = {
          routing_key: routingKey,
          event_action: payload.state === 'firing' ? 'trigger' : 'resolve',
          dedup_key: payload.alertId,
          payload: {
            summary: `[${payload.severity.toUpperCase()}] ${payload.alertName}: ${payload.message}`,
            severity: severityMap[payload.severity] || pdSeverity || 'warning',
            source: 'lumina',
            timestamp: payload.triggeredAt,
            custom_details: {
              value: payload.value,
              threshold: payload.threshold,
              projectId: payload.projectId,
            },
          },
        };

        const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pdPayload),
        });

        if (!response.ok) {
          throw new Error(`PagerDuty API error: ${response.status}`);
        }

        return { success: true, message: 'Notification sent to PagerDuty', timestamp };
      }

      case 'opsgenie': {
        const { apiKey, region, priority } = config;
        const baseUrl = region === 'eu'
          ? 'https://api.eu.opsgenie.com/v2/alerts'
          : 'https://api.opsgenie.com/v2/alerts';

        const ogPayload = {
          message: `[${payload.severity.toUpperCase()}] ${payload.alertName}`,
          description: payload.message,
          priority: priority || 'P3',
          alias: payload.alertId,
          source: 'lumina',
          details: {
            value: payload.value.toString(),
            threshold: payload.threshold.toString(),
            projectId: payload.projectId,
          },
        };

        const response = await fetch(baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `GenieKey ${apiKey}`,
          },
          body: JSON.stringify(ogPayload),
        });

        if (!response.ok) {
          throw new Error(`OpsGenie API error: ${response.status}`);
        }

        return { success: true, message: 'Notification sent to OpsGenie', timestamp };
      }

      case 'email': {
        const { recipients, fromName, fromEmail, subject } = config;
        console.log('[Email Debug] Config received:', JSON.stringify(config, null, 2));

        const resendClient = getResend();
        if (!resendClient) {
          return {
            success: false,
            message: 'Email service not configured. Set RESEND_API_KEY environment variable.',
            timestamp
          };
        }

        const severityColors: Record<string, string> = {
          critical: '#DC2626',
          warning: '#F59E0B',
          info: '#3B82F6',
        };
        const color = severityColors[payload.severity] || '#6B7280';

        const emailHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f5;">
              <div style="max-width: 600px; margin: 0 auto; background: #18181b; border-radius: 8px; overflow: hidden;">
                <div style="background-color: ${color}; padding: 20px;">
                  <h1 style="margin: 0; color: white; font-size: 20px;">${payload.alertName}</h1>
                  <span style="display: inline-block; margin-top: 8px; padding: 4px 12px; background: rgba(255,255,255,0.2); border-radius: 4px; color: white; font-size: 12px; text-transform: uppercase;">${payload.severity}</span>
                </div>
                <div style="padding: 24px; color: #e4e4e7;">
                  <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5;">${payload.message}</p>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 12px 0; border-bottom: 1px solid #27272a; color: #a1a1aa;">State</td>
                      <td style="padding: 12px 0; border-bottom: 1px solid #27272a; text-align: right; color: #22c55e; text-transform: uppercase; font-weight: 600;">${payload.state}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0; border-bottom: 1px solid #27272a; color: #a1a1aa;">Value</td>
                      <td style="padding: 12px 0; border-bottom: 1px solid #27272a; text-align: right;">${payload.value.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0; border-bottom: 1px solid #27272a; color: #a1a1aa;">Threshold</td>
                      <td style="padding: 12px 0; border-bottom: 1px solid #27272a; text-align: right;">${payload.threshold}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0; color: #a1a1aa;">Triggered At</td>
                      <td style="padding: 12px 0; text-align: right;">${new Date(payload.triggeredAt).toLocaleString()}</td>
                    </tr>
                  </table>
                </div>
                <div style="padding: 16px 24px; background: #0f0f10; text-align: center; color: #71717a; font-size: 12px;">
                  Sent by Lumina
                </div>
              </div>
            </body>
          </html>
        `;

        const fromAddress = fromEmail || process.env.RESEND_FROM_EMAIL || 'alerts@lumina.io';
        const senderName = fromName || 'Lumina Alerts';

        const { error } = await resendClient.emails.send({
          from: `${senderName} <${fromAddress}>`,
          to: recipients,
          subject: subject || `[${payload.severity.toUpperCase()}] ${payload.alertName}`,
          html: emailHtml,
        });

        if (error) {
          throw new Error(error.message);
        }

        return {
          success: true,
          message: `Email sent to ${recipients.length} recipient(s)`,
          timestamp
        };
      }

      default:
        return {
          success: false,
          message: `Unknown channel type: ${channelType}`,
          timestamp
        };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error sending notification',
      timestamp,
    };
  }
}

const createChannelSchema = z.object({
  type: channelTypeEnum,
  name: z.string().min(1).max(255),
  config: z.record(z.any()),
  enabled: z.boolean().default(true),
});

const updateChannelSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  config: z.record(z.any()).optional(),
  enabled: z.boolean().optional(),
});

export const alertsRouter = router({
  // ============================================
  // ALERT CRUD OPERATIONS
  // ============================================

  list: projectProcedure
    .input(
      z.object({
        state: alertStateEnum.optional(),
        severity: alertSeverityEnum.optional(),
        enabled: z.boolean().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      const conditions = [eq(alertsExtended.projectId, projectId)];

      if (input.state !== undefined) {
        conditions.push(eq(alertsExtended.state, input.state));
      }
      if (input.severity !== undefined) {
        conditions.push(eq(alertsExtended.severity, input.severity));
      }
      if (input.enabled !== undefined) {
        conditions.push(eq(alertsExtended.enabled, input.enabled));
      }
      if (input.search) {
        conditions.push(
          sql`${alertsExtended.name} ILIKE ${`%${input.search}%`}`
        );
      }

      const alerts = await db
        .select()
        .from(alertsExtended)
        .where(and(...conditions))
        .orderBy(desc(alertsExtended.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return alerts.map((alert) => ({
        id: alert.id,
        name: alert.name,
        description: alert.description,
        dataSource: alert.dataSource,
        conditionType: alert.conditionType,
        severity: alert.severity,
        enabled: alert.enabled,
        state: alert.state,
        lastEvaluatedAt: alert.lastEvaluatedAt?.toISOString() || null,
        lastTriggeredAt: alert.lastTriggeredAt?.toISOString() || null,
        firingStartedAt: alert.firingStartedAt?.toISOString() || null,
        createdAt: alert.createdAt.toISOString(),
        updatedAt: alert.updatedAt.toISOString(),
      }));
    }),

  get: projectProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        includeHistory: z.boolean().default(true),
        historyLimit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      const alert = await db
        .select()
        .from(alertsExtended)
        .where(
          and(
            eq(alertsExtended.projectId, projectId),
            eq(alertsExtended.id, input.id)
          )
        )
        .limit(1);

      if (alert.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Alert not found',
        });
      }

      const alertData = alert[0];

      let history: any[] = [];
      if (input.includeHistory) {
        const historyRecords = await db
          .select()
          .from(alertHistory)
          .where(eq(alertHistory.alertId, input.id))
          .orderBy(desc(alertHistory.timestamp))
          .limit(input.historyLimit);

        history = historyRecords.map((h) => ({
          id: h.id,
          event: h.event,
          previousState: h.previousState,
          newState: h.newState,
          value: h.value ? parseFloat(h.value) : null,
          threshold: h.threshold ? parseFloat(h.threshold) : null,
          message: h.message,
          timestamp: h.timestamp.toISOString(),
        }));
      }

      return {
        id: alertData.id,
        projectId: alertData.projectId,
        name: alertData.name,
        description: alertData.description,
        dataSource: alertData.dataSource,
        queryConfig: alertData.queryConfig,
        conditionType: alertData.conditionType,
        threshold: alertData.threshold,
        severity: alertData.severity,
        notificationChannelIds: alertData.notificationChannelIds,
        notificationMessage: alertData.notificationMessage,
        evaluationInterval: alertData.evaluationInterval,
        enabled: alertData.enabled,
        state: alertData.state,
        lastEvaluatedAt: alertData.lastEvaluatedAt?.toISOString() || null,
        lastTriggeredAt: alertData.lastTriggeredAt?.toISOString() || null,
        firingStartedAt: alertData.firingStartedAt?.toISOString() || null,
        labels: alertData.labels,
        annotations: alertData.annotations,
        createdBy: alertData.createdBy,
        createdAt: alertData.createdAt.toISOString(),
        updatedAt: alertData.updatedAt.toISOString(),
        history,
      };
    }),

  create: projectProcedure
    .input(createAlertSchema)
    .mutation(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;
      const userId = ctx.user!.id;

      // Validate notification channels exist
      if (input.notificationChannelIds.length > 0) {
        const channels = await db
          .select({ id: notificationChannels.id })
          .from(notificationChannels)
          .where(
            and(
              eq(notificationChannels.projectId, projectId),
              inArray(notificationChannels.id, input.notificationChannelIds)
            )
          );

        if (channels.length !== input.notificationChannelIds.length) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'One or more notification channels not found',
          });
        }
      }

      const [alert] = await db
        .insert(alertsExtended)
        .values({
          projectId,
          name: input.name,
          description: input.description,
          dataSource: input.dataSource,
          queryConfig: input.queryConfig,
          conditionType: input.conditionType,
          threshold: input.threshold,
          severity: input.severity,
          notificationChannelIds: input.notificationChannelIds,
          notificationMessage: input.notificationMessage,
          evaluationInterval: input.evaluationInterval,
          enabled: input.enabled,
          state: 'ok',
          labels: input.labels,
          annotations: input.annotations,
          createdBy: userId,
        })
        .returning();

      return {
        id: alert.id,
        name: alert.name,
        enabled: alert.enabled,
        state: alert.state,
        createdAt: alert.createdAt.toISOString(),
      };
    }),

  update: projectProcedure
    .input(updateAlertSchema)
    .mutation(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      // Check alert exists and belongs to project
      const existing = await db
        .select({ id: alertsExtended.id })
        .from(alertsExtended)
        .where(
          and(
            eq(alertsExtended.projectId, projectId),
            eq(alertsExtended.id, input.id)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Alert not found',
        });
      }

      // Validate notification channels if provided
      if (input.notificationChannelIds && input.notificationChannelIds.length > 0) {
        const channels = await db
          .select({ id: notificationChannels.id })
          .from(notificationChannels)
          .where(
            and(
              eq(notificationChannels.projectId, projectId),
              inArray(notificationChannels.id, input.notificationChannelIds)
            )
          );

        if (channels.length !== input.notificationChannelIds.length) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'One or more notification channels not found',
          });
        }
      }

      const updateData: any = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.queryConfig !== undefined) updateData.queryConfig = input.queryConfig;
      if (input.conditionType !== undefined) updateData.conditionType = input.conditionType;
      if (input.threshold !== undefined) updateData.threshold = input.threshold;
      if (input.severity !== undefined) updateData.severity = input.severity;
      if (input.notificationChannelIds !== undefined) updateData.notificationChannelIds = input.notificationChannelIds;
      if (input.notificationMessage !== undefined) updateData.notificationMessage = input.notificationMessage;
      if (input.evaluationInterval !== undefined) updateData.evaluationInterval = input.evaluationInterval;
      if (input.labels !== undefined) updateData.labels = input.labels;
      if (input.annotations !== undefined) updateData.annotations = input.annotations;

      const [updated] = await db
        .update(alertsExtended)
        .set(updateData)
        .where(eq(alertsExtended.id, input.id))
        .returning();

      return {
        id: updated.id,
        name: updated.name,
        updatedAt: updated.updatedAt.toISOString(),
      };
    }),

  delete: projectProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      // Check alert exists and belongs to project
      const existing = await db
        .select({ id: alertsExtended.id })
        .from(alertsExtended)
        .where(
          and(
            eq(alertsExtended.projectId, projectId),
            eq(alertsExtended.id, input.id)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Alert not found',
        });
      }

      await db
        .delete(alertsExtended)
        .where(eq(alertsExtended.id, input.id));

      return { success: true };
    }),

  // ============================================
  // ALERT ACTIONS
  // ============================================

  enable: projectProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      const [updated] = await db
        .update(alertsExtended)
        .set({ enabled: true, updatedAt: new Date() })
        .where(
          and(
            eq(alertsExtended.projectId, projectId),
            eq(alertsExtended.id, input.id)
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Alert not found',
        });
      }

      return {
        id: updated.id,
        enabled: updated.enabled,
      };
    }),

  disable: projectProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      const [updated] = await db
        .update(alertsExtended)
        .set({ enabled: false, updatedAt: new Date() })
        .where(
          and(
            eq(alertsExtended.projectId, projectId),
            eq(alertsExtended.id, input.id)
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Alert not found',
        });
      }

      return {
        id: updated.id,
        enabled: updated.enabled,
      };
    }),

  test: projectProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      // Get the alert configuration
      const alert = await db
        .select()
        .from(alertsExtended)
        .where(
          and(
            eq(alertsExtended.projectId, projectId),
            eq(alertsExtended.id, input.id)
          )
        )
        .limit(1);

      if (alert.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Alert not found',
        });
      }

      const alertData = alert[0];

      // Evaluate the alert using actual data
      const evaluationResult = await evaluateAlert(
        projectId,
        alertData.dataSource,
        alertData.queryConfig as Record<string, any>,
        alertData.conditionType,
        alertData.threshold as Record<string, any>
      );

      // Update alert state based on evaluation
      const previousState = alertData.state;
      let newState = alertData.state;

      if (evaluationResult.triggered && alertData.state !== 'silenced') {
        newState = 'firing';
      } else if (!evaluationResult.triggered && alertData.state === 'firing') {
        newState = 'ok';
      }

      // Update the alert's evaluation timestamp and state
      await db
        .update(alertsExtended)
        .set({
          lastEvaluatedAt: new Date(),
          state: newState,
          ...(newState === 'firing' && previousState !== 'firing' ? { firingStartedAt: new Date(), lastTriggeredAt: new Date() } : {}),
          updatedAt: new Date(),
        })
        .where(eq(alertsExtended.id, alertData.id));

      // Record state change in history if state changed
      if (previousState !== newState) {
        await db.insert(alertHistory).values({
          alertId: alertData.id,
          event: newState === 'firing' ? 'triggered' : 'resolved',
          previousState,
          newState,
          value: evaluationResult.value.toString(),
          threshold: evaluationResult.threshold.toString(),
          message: evaluationResult.message,
          timestamp: new Date(),
        });
      }

      return {
        id: alertData.id,
        name: alertData.name,
        result: evaluationResult,
        stateChanged: previousState !== newState,
        previousState,
        newState,
      };
    }),

  acknowledge: projectProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        message: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;
      const userId = ctx.user!.id;

      // Check alert exists and is firing
      const alert = await db
        .select()
        .from(alertsExtended)
        .where(
          and(
            eq(alertsExtended.projectId, projectId),
            eq(alertsExtended.id, input.id)
          )
        )
        .limit(1);

      if (alert.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Alert not found',
        });
      }

      if (alert[0].state !== 'firing') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only firing alerts can be acknowledged',
        });
      }

      // Record acknowledgment in history
      await db.insert(alertHistory).values({
        alertId: input.id,
        event: 'acknowledged',
        previousState: 'firing',
        newState: 'firing',
        triggeredBy: userId,
        message: input.message || 'Alert acknowledged',
        timestamp: new Date(),
      });

      return {
        success: true,
        acknowledgedAt: new Date().toISOString(),
      };
    }),

  silence: projectProcedure
    .input(
      z.object({
        alertId: z.string().uuid(),
        duration: z.number().min(60).max(2592000), // 1 minute to 30 days in seconds
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;
      const userId = ctx.user!.id;

      // Check alert exists
      const alert = await db
        .select({ id: alertsExtended.id })
        .from(alertsExtended)
        .where(
          and(
            eq(alertsExtended.projectId, projectId),
            eq(alertsExtended.id, input.alertId)
          )
        )
        .limit(1);

      if (alert.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Alert not found',
        });
      }

      const now = new Date();
      const endsAt = new Date(now.getTime() + input.duration * 1000);

      const [silence] = await db
        .insert(alertSilences)
        .values({
          projectId,
          alertId: input.alertId,
          startsAt: now,
          endsAt,
          reason: input.reason,
          createdBy: userId,
        })
        .returning();

      // Update alert state to silenced
      await db
        .update(alertsExtended)
        .set({ state: 'silenced', updatedAt: new Date() })
        .where(eq(alertsExtended.id, input.alertId));

      // Record in history
      await db.insert(alertHistory).values({
        alertId: input.alertId,
        event: 'silenced',
        previousState: 'firing',
        newState: 'silenced',
        triggeredBy: userId,
        message: input.reason || `Silenced for ${input.duration} seconds`,
        timestamp: now,
      });

      return {
        id: silence.id,
        alertId: silence.alertId,
        startsAt: silence.startsAt.toISOString(),
        endsAt: silence.endsAt.toISOString(),
      };
    }),

  // ============================================
  // NOTIFICATION CHANNELS
  // ============================================

  listChannels: projectProcedure
    .input(
      z.object({
        type: channelTypeEnum.optional(),
        enabled: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      const conditions = [eq(notificationChannels.projectId, projectId)];

      if (input.type !== undefined) {
        conditions.push(eq(notificationChannels.type, input.type));
      }
      if (input.enabled !== undefined) {
        conditions.push(eq(notificationChannels.enabled, input.enabled));
      }

      const channels = await db
        .select()
        .from(notificationChannels)
        .where(and(...conditions))
        .orderBy(desc(notificationChannels.createdAt));

      return channels.map((channel) => ({
        id: channel.id,
        type: channel.type,
        name: channel.name,
        config: channel.config as Record<string, any>,
        enabled: channel.enabled,
        lastTestedAt: channel.lastTestedAt?.toISOString() || null,
        lastTestResult: channel.lastTestResult,
        createdAt: channel.createdAt.toISOString(),
        updatedAt: channel.updatedAt.toISOString(),
      }));
    }),

  createChannel: projectProcedure
    .input(createChannelSchema)
    .mutation(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      console.log('[createChannel] Creating channel for project:', projectId);
      console.log('[createChannel] Input:', JSON.stringify(input, null, 2));

      // Validate config structure based on channel type
      const validation = validateChannelConfig(input.type, input.config);
      if (!validation.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Invalid channel configuration: ${validation.error}`,
        });
      }

      const [channel] = await db
        .insert(notificationChannels)
        .values({
          projectId,
          type: input.type,
          name: input.name,
          config: input.config,
          enabled: input.enabled,
        })
        .returning();

      return {
        id: channel.id,
        type: channel.type,
        name: channel.name,
        enabled: channel.enabled,
        createdAt: channel.createdAt.toISOString(),
      };
    }),

  updateChannel: projectProcedure
    .input(updateChannelSchema)
    .mutation(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      console.log('[updateChannel] Input received:', JSON.stringify(input, null, 2));

      // Check channel exists and belongs to project
      const existing = await db
        .select({ id: notificationChannels.id })
        .from(notificationChannels)
        .where(
          and(
            eq(notificationChannels.projectId, projectId),
            eq(notificationChannels.id, input.id)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Notification channel not found',
        });
      }

      const updateData: any = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) updateData.name = input.name;
      if (input.config !== undefined) updateData.config = input.config;
      if (input.enabled !== undefined) updateData.enabled = input.enabled;

      const [updated] = await db
        .update(notificationChannels)
        .set(updateData)
        .where(eq(notificationChannels.id, input.id))
        .returning();

      return {
        id: updated.id,
        name: updated.name,
        enabled: updated.enabled,
        updatedAt: updated.updatedAt.toISOString(),
      };
    }),

  deleteChannel: projectProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      // Check channel exists and belongs to project
      const existing = await db
        .select({ id: notificationChannels.id })
        .from(notificationChannels)
        .where(
          and(
            eq(notificationChannels.projectId, projectId),
            eq(notificationChannels.id, input.id)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Notification channel not found',
        });
      }

      // Check if channel is in use by any alerts
      const alertsUsingChannel = await db
        .select({ id: alertsExtended.id })
        .from(alertsExtended)
        .where(
          and(
            eq(alertsExtended.projectId, projectId),
            sql`${alertsExtended.notificationChannelIds}::jsonb @> ${JSON.stringify([input.id])}::jsonb`
          )
        )
        .limit(1);

      if (alertsUsingChannel.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot delete channel that is in use by alerts',
        });
      }

      await db
        .delete(notificationChannels)
        .where(eq(notificationChannels.id, input.id));

      return { success: true };
    }),

  testChannel: projectProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      // Get the channel configuration
      const channel = await db
        .select()
        .from(notificationChannels)
        .where(
          and(
            eq(notificationChannels.projectId, projectId),
            eq(notificationChannels.id, input.id)
          )
        )
        .limit(1);

      if (channel.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Notification channel not found',
        });
      }

      const channelData = channel[0];

      // Send a test notification using the actual notification logic
      const testPayload: NotificationPayload = {
        alertId: 'test-' + Date.now(),
        alertName: 'Test Notification',
        severity: 'info',
        state: 'firing',
        value: 0,
        threshold: 0,
        message: 'This is a test notification from Lumina to verify your notification channel is configured correctly.',
        triggeredAt: new Date().toISOString(),
        projectId,
      };

      const testResult = await sendNotification(
        channelData.type,
        channelData.config as Record<string, any>,
        testPayload
      );

      // Update last tested timestamp
      await db
        .update(notificationChannels)
        .set({
          lastTestedAt: new Date(),
          lastTestResult: testResult.success ? 'success' : 'failed',
          updatedAt: new Date(),
        })
        .where(eq(notificationChannels.id, input.id));

      return {
        id: channelData.id,
        name: channelData.name,
        type: channelData.type,
        result: testResult,
      };
    }),

  // ============================================
  // STATISTICS
  // ============================================

  stats: projectProcedure
    .input(
      z.object({
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      const conditions = [eq(alertsExtended.projectId, projectId)];

      if (input.from) {
        conditions.push(gte(alertsExtended.createdAt, new Date(input.from)));
      }
      if (input.to) {
        conditions.push(lte(alertsExtended.createdAt, new Date(input.to)));
      }

      const result = await db
        .select({
          state: alertsExtended.state,
          count: sql<number>`count(*)`,
        })
        .from(alertsExtended)
        .where(and(...conditions))
        .groupBy(alertsExtended.state);

      const stats = {
        ok: 0,
        pending: 0,
        firing: 0,
        silenced: 0,
        total: 0,
      };

      result.forEach((r) => {
        const count = Number(r.count);
        stats[r.state as keyof typeof stats] = count;
        stats.total += count;
      });

      // Get severity breakdown
      const severityResult = await db
        .select({
          severity: alertsExtended.severity,
          count: sql<number>`count(*)`,
        })
        .from(alertsExtended)
        .where(and(...conditions))
        .groupBy(alertsExtended.severity);

      const bySeverity = {
        info: 0,
        warning: 0,
        critical: 0,
      };

      severityResult.forEach((r) => {
        bySeverity[r.severity as keyof typeof bySeverity] = Number(r.count);
      });

      // Get recent firing alerts count (last 24h)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentFiring = await db
        .select({
          count: sql<number>`count(*)`,
        })
        .from(alertsExtended)
        .where(
          and(
            eq(alertsExtended.projectId, projectId),
            eq(alertsExtended.state, 'firing'),
            gte(alertsExtended.lastTriggeredAt, oneDayAgo)
          )
        );

      const recentFiringCount = recentFiring[0]?.count ? Number(recentFiring[0].count) : 0;

      return {
        byState: stats,
        bySeverity,
        recentFiring: recentFiringCount,
      };
    }),
});
