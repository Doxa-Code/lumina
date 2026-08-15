/**
 * Main Notification Sender
 * Routes notifications to the appropriate channel handler
 */

import type { NotificationChannel, AlertPayload, NotificationResult } from './types.js';
import { sendSlackNotification } from './slack.js';
import { sendEmailNotification } from './email.js';
import { sendWebhookNotification } from './webhook.js';
import { sendPagerDutyNotification } from './pagerduty.js';

/**
 * Sends a notification through the specified channel
 * Handles routing and error recovery gracefully
 */
export async function sendNotification(
  channel: NotificationChannel,
  payload: AlertPayload
): Promise<NotificationResult> {
  try {
    switch (channel.type) {
      case 'slack':
        return await sendSlackNotification(channel.config, payload);

      case 'email':
        return await sendEmailNotification(channel.config, payload);

      case 'webhook':
        return await sendWebhookNotification(channel.config, payload);

      case 'pagerduty':
        return await sendPagerDutyNotification(channel.config, payload);

      default:
        // TypeScript should ensure this never happens
        const exhaustiveCheck: never = channel;
        throw new Error(`Unknown channel type: ${JSON.stringify(exhaustiveCheck)}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to send notification via ${channel.type}:`, errorMessage);

    return {
      success: false,
      channel: channel.type,
      error: errorMessage,
      timestamp: new Date(),
    };
  }
}

/**
 * Sends notifications to multiple channels in parallel
 * Returns results for all channels, both successful and failed
 */
export async function sendNotifications(
  channels: NotificationChannel[],
  payload: AlertPayload
): Promise<NotificationResult[]> {
  const promises = channels.map(channel => sendNotification(channel, payload));
  return await Promise.all(promises);
}

/**
 * Sends notifications to multiple channels with retry logic
 * Retries failed notifications up to maxRetries times
 */
export async function sendNotificationsWithRetry(
  channels: NotificationChannel[],
  payload: AlertPayload,
  maxRetries = 2
): Promise<NotificationResult[]> {
  let results = await sendNotifications(channels, payload);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const failedIndices = results
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => !result.success)
      .map(({ index }) => index);

    if (failedIndices.length === 0) {
      break; // All notifications succeeded
    }

    console.log(
      `Retry attempt ${attempt}/${maxRetries} for ${failedIndices.length} failed notifications`
    );

    // Retry failed notifications
    const retryPromises = failedIndices.map(index =>
      sendNotification(channels[index], payload)
    );

    const retryResults = await Promise.all(retryPromises);

    // Update results with retry outcomes
    failedIndices.forEach((channelIndex, resultIndex) => {
      results[channelIndex] = retryResults[resultIndex];
    });
  }

  return results;
}
