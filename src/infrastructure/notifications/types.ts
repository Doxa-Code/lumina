/**
 * Notification System Types
 * Defines interfaces for various notification channels and payloads
 */

export interface SlackConfig {
  webhookUrl: string;
}

export interface EmailConfig {
  from: string;
  to: string[];
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  secure?: boolean;
}

export interface WebhookConfig {
  url: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  bodyTemplate?: string;
}

export interface PagerDutyConfig {
  integrationKey: string;
  severity?: 'critical' | 'error' | 'warning' | 'info';
}

export type NotificationChannel =
  | { type: 'slack'; config: SlackConfig }
  | { type: 'email'; config: EmailConfig }
  | { type: 'webhook'; config: WebhookConfig }
  | { type: 'pagerduty'; config: PagerDutyConfig };

export interface AlertPayload {
  id: string;
  name: string;
  description?: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  value: number;
  threshold: number;
  service?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface NotificationResult {
  success: boolean;
  channel: string;
  error?: string;
  timestamp: Date;
}
