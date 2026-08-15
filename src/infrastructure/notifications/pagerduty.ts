/**
 * PagerDuty Notification Sender
 * Integrates with PagerDuty Events API v2 for incident management
 */

import type { PagerDutyConfig, AlertPayload, NotificationResult } from './types.js';

const PAGERDUTY_EVENTS_API = 'https://events.pagerduty.com/v2/enqueue';

interface PagerDutyEvent {
  routing_key: string;
  event_action: 'trigger' | 'resolve';
  dedup_key: string;
  payload: {
    summary: string;
    severity: 'critical' | 'error' | 'warning' | 'info';
    source: string;
    timestamp?: string;
    custom_details?: Record<string, unknown>;
  };
}

/**
 * Maps alert severity to PagerDuty severity
 */
function mapSeverity(severity: string, configSeverity?: string): 'critical' | 'error' | 'warning' | 'info' {
  if (configSeverity) {
    return configSeverity as 'critical' | 'error' | 'warning' | 'info';
  }

  const severityMap: Record<string, 'critical' | 'error' | 'warning' | 'info'> = {
    critical: 'critical',
    error: 'error',
    warning: 'warning',
    info: 'info',
  };

  return severityMap[severity] || 'error';
}

/**
 * Determines if alert should trigger or resolve an incident
 */
function getEventAction(payload: AlertPayload): 'trigger' | 'resolve' {
  // Trigger if value exceeds threshold, resolve otherwise
  // This logic can be customized based on alert type
  return payload.value >= payload.threshold ? 'trigger' : 'resolve';
}

/**
 * Sends an alert notification to PagerDuty
 */
export async function sendPagerDutyNotification(
  config: PagerDutyConfig,
  payload: AlertPayload
): Promise<NotificationResult> {
  const startTime = new Date();

  try {
    const event: PagerDutyEvent = {
      routing_key: config.integrationKey,
      event_action: getEventAction(payload),
      dedup_key: payload.id, // Use alert ID as deduplication key
      payload: {
        summary: `${payload.name}: ${payload.description || 'Alert triggered'}`,
        severity: mapSeverity(payload.severity, config.severity),
        source: payload.service || 'baselime',
        timestamp: payload.timestamp.toISOString(),
        custom_details: {
          alert_id: payload.id,
          value: payload.value,
          threshold: payload.threshold,
          service: payload.service,
          ...payload.metadata,
        },
      },
    };

    const response = await fetch(PAGERDUTY_EVENTS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PagerDuty API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('PagerDuty event sent:', result);

    return {
      success: true,
      channel: 'pagerduty',
      timestamp: startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to send PagerDuty notification:', errorMessage);

    return {
      success: false,
      channel: 'pagerduty',
      error: errorMessage,
      timestamp: startTime,
    };
  }
}
