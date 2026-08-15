/**
 * Generic Webhook Notification Sender
 * Sends alert data to custom webhook endpoints with template support
 */

import type { WebhookConfig, AlertPayload, NotificationResult } from './types.js';

/**
 * Replaces Handlebars-style placeholders in a template string
 * Supports patterns like {{name}}, {{value}}, {{metadata.key}}
 */
function replaceTemplate(template: string, payload: AlertPayload): string {
  let result = template;

  // Replace simple placeholders like {{name}}, {{value}}, etc.
  const simpleReplacements: Record<string, string | number> = {
    id: payload.id,
    name: payload.name,
    description: payload.description || '',
    severity: payload.severity,
    value: payload.value,
    threshold: payload.threshold,
    service: payload.service || '',
    timestamp: payload.timestamp.toISOString(),
  };

  for (const [key, value] of Object.entries(simpleReplacements)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    result = result.replace(regex, String(value));
  }

  // Replace metadata placeholders like {{metadata.key}}
  if (payload.metadata) {
    for (const [key, value] of Object.entries(payload.metadata)) {
      const regex = new RegExp(`{{\\s*metadata\\.${key}\\s*}}`, 'g');
      result = result.replace(regex, String(value));
    }
  }

  return result;
}

/**
 * Creates the default payload when no template is provided
 */
function createDefaultPayload(payload: AlertPayload): object {
  return {
    id: payload.id,
    name: payload.name,
    description: payload.description,
    severity: payload.severity,
    value: payload.value,
    threshold: payload.threshold,
    service: payload.service,
    timestamp: payload.timestamp.toISOString(),
    metadata: payload.metadata,
  };
}

/**
 * Sends an alert notification to a custom webhook
 */
export async function sendWebhookNotification(
  config: WebhookConfig,
  payload: AlertPayload
): Promise<NotificationResult> {
  const startTime = new Date();

  try {
    const method = config.method || 'POST';
    const headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };

    // Use template if provided, otherwise send default payload
    let body: string;
    if (config.bodyTemplate) {
      body = replaceTemplate(config.bodyTemplate, payload);
    } else {
      body = JSON.stringify(createDefaultPayload(payload));
    }

    const response = await fetch(config.url, {
      method,
      headers,
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Webhook error: ${response.status} - ${errorText}`);
    }

    return {
      success: true,
      channel: 'webhook',
      timestamp: startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to send webhook notification:', errorMessage);

    return {
      success: false,
      channel: 'webhook',
      error: errorMessage,
      timestamp: startTime,
    };
  }
}
