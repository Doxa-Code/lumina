/**
 * Notification Sender for Alert Engine
 * Sends notifications via various channels when alerts fire
 */

import { Resend } from 'resend';

// Lazy-initialized Resend client
let resend: Resend | null = null;
function getResend(): Resend | null {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export interface NotificationPayload {
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

export interface NotificationResult {
  success: boolean;
  message: string;
  channelId: string;
  channelType: string;
  timestamp: string;
}

export async function sendNotification(
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
          username: username || 'Lumina Alerts',
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

        return { success: true, message: 'Notification sent to Slack', channelId: '', channelType, timestamp };
      }

      case 'webhook': {
        const { url, method, headers, bodyTemplate } = config;

        let body: string;
        if (bodyTemplate) {
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

        return { success: true, message: 'Notification sent to webhook', channelId: '', channelType, timestamp };
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

        return { success: true, message: 'Notification sent to PagerDuty', channelId: '', channelType, timestamp };
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

        return { success: true, message: 'Notification sent to OpsGenie', channelId: '', channelType, timestamp };
      }

      case 'email': {
        const { recipients, fromName, fromEmail, subject } = config;

        const resendClient = getResend();
        if (!resendClient) {
          console.error('[NotificationSender] Email service not configured. Set RESEND_API_KEY environment variable.');
          return {
            success: false,
            message: 'Email service not configured. Set RESEND_API_KEY environment variable.',
            channelId: '',
            channelType,
            timestamp,
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

        console.log(`[NotificationSender] Sending email to ${recipients.length} recipient(s) from ${senderName} <${fromAddress}>`);

        const { error } = await resendClient.emails.send({
          from: `${senderName} <${fromAddress}>`,
          to: recipients,
          subject: subject || `[${payload.severity.toUpperCase()}] ${payload.alertName}`,
          html: emailHtml,
        });

        if (error) {
          throw new Error(error.message);
        }

        console.log(`[NotificationSender] Email sent successfully to ${recipients.join(', ')}`);
        return {
          success: true,
          message: `Email sent to ${recipients.length} recipient(s)`,
          channelId: '',
          channelType,
          timestamp,
        };
      }

      default:
        return {
          success: false,
          message: `Unknown channel type: ${channelType}`,
          channelId: '',
          channelType,
          timestamp,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error sending notification';
    console.error(`[NotificationSender] Failed to send ${channelType} notification:`, errorMessage);
    return {
      success: false,
      message: errorMessage,
      channelId: '',
      channelType,
      timestamp,
    };
  }
}
