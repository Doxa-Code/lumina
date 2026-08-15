/**
 * Notification System
 * Exports all notification functionality
 */

// Type definitions
export type {
  SlackConfig,
  EmailConfig,
  WebhookConfig,
  PagerDutyConfig,
  NotificationChannel,
  AlertPayload,
  NotificationResult,
} from './types.js';

// Individual channel senders
export { sendSlackNotification } from './slack.js';
export { sendEmailNotification } from './email.js';
export { sendWebhookNotification } from './webhook.js';
export { sendPagerDutyNotification } from './pagerduty.js';

// Main sender with routing
export {
  sendNotification,
  sendNotifications,
  sendNotificationsWithRetry,
} from './sender.js';
