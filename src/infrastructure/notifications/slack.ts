/**
 * Slack Notification Sender
 * Sends formatted alerts to Slack via webhook
 */

import type { SlackConfig, AlertPayload, NotificationResult } from './types.js';

interface SlackAttachment {
  color: string;
  title: string;
  text?: string;
  fields: Array<{
    title: string;
    value: string;
    short: boolean;
  }>;
  footer?: string;
  ts: number;
}

interface SlackMessage {
  text: string;
  attachments: SlackAttachment[];
}

/**
 * Maps severity to Slack color
 */
function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    critical: '#FF0000',
    error: '#FF6B6B',
    warning: '#FFA500',
    info: '#36A2EB',
  };
  return colors[severity] || '#808080';
}

/**
 * Sends an alert notification to Slack
 */
export async function sendSlackNotification(
  config: SlackConfig,
  payload: AlertPayload
): Promise<NotificationResult> {
  const startTime = new Date();

  try {
    const attachment: SlackAttachment = {
      color: getSeverityColor(payload.severity),
      title: payload.name,
      text: payload.description,
      fields: [
        {
          title: 'Severity',
          value: payload.severity.toUpperCase(),
          short: true,
        },
        {
          title: 'Value',
          value: payload.value.toString(),
          short: true,
        },
        {
          title: 'Threshold',
          value: payload.threshold.toString(),
          short: true,
        },
      ],
      ts: Math.floor(payload.timestamp.getTime() / 1000),
    };

    if (payload.service) {
      attachment.fields.push({
        title: 'Service',
        value: payload.service,
        short: true,
      });
    }

    const message: SlackMessage = {
      text: `Alert: ${payload.name}`,
      attachments: [attachment],
    };

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Slack API error: ${response.status} - ${errorText}`);
    }

    return {
      success: true,
      channel: 'slack',
      timestamp: startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to send Slack notification:', errorMessage);

    return {
      success: false,
      channel: 'slack',
      error: errorMessage,
      timestamp: startTime,
    };
  }
}
