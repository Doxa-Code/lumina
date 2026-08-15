/**
 * Email Notification Sender
 * Sends HTML formatted alert emails via SMTP
 */

import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { EmailConfig, AlertPayload, NotificationResult } from './types.js';

/**
 * Creates an email transporter instance
 */
function createTransporter(config: EmailConfig): Transporter {
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.secure ?? (config.smtpPort === 465),
    auth: {
      user: config.smtpUser,
      pass: config.smtpPassword,
    },
  });
}

/**
 * Generates HTML email content
 */
function generateEmailHtml(payload: AlertPayload): string {
  const severityColors: Record<string, string> = {
    critical: '#FF0000',
    error: '#FF6B6B',
    warning: '#FFA500',
    info: '#36A2EB',
  };

  const color = severityColors[payload.severity] || '#808080';
  const timestamp = payload.timestamp.toLocaleString();

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: ${color};
            color: white;
            padding: 20px;
            border-radius: 8px 8px 0 0;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
          }
          .severity {
            display: inline-block;
            padding: 4px 12px;
            background-color: rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            font-size: 14px;
            margin-top: 8px;
          }
          .content {
            background-color: #f9f9f9;
            padding: 20px;
            border: 1px solid #e0e0e0;
            border-top: none;
            border-radius: 0 0 8px 8px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #e0e0e0;
          }
          .info-row:last-child {
            border-bottom: none;
          }
          .info-label {
            font-weight: 600;
            color: #666;
          }
          .info-value {
            color: #333;
          }
          .footer {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            font-size: 12px;
            color: #999;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${payload.name}</h1>
          <div class="severity">${payload.severity.toUpperCase()}</div>
        </div>
        <div class="content">
          ${payload.description ? `<p>${payload.description}</p>` : ''}
          <div class="info-row">
            <span class="info-label">Value:</span>
            <span class="info-value">${payload.value}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Threshold:</span>
            <span class="info-value">${payload.threshold}</span>
          </div>
          ${payload.service ? `
          <div class="info-row">
            <span class="info-label">Service:</span>
            <span class="info-value">${payload.service}</span>
          </div>
          ` : ''}
          <div class="info-row">
            <span class="info-label">Time:</span>
            <span class="info-value">${timestamp}</span>
          </div>
        </div>
        <div class="footer">
          Baselime Observability Platform
        </div>
      </body>
    </html>
  `;
}

/**
 * Sends an alert notification via email
 */
export async function sendEmailNotification(
  config: EmailConfig,
  payload: AlertPayload
): Promise<NotificationResult> {
  const startTime = new Date();

  try {
    const transporter = createTransporter(config);

    const mailOptions = {
      from: config.from,
      to: config.to.join(', '),
      subject: `[${payload.severity.toUpperCase()}] ${payload.name}`,
      html: generateEmailHtml(payload),
    };

    await transporter.sendMail(mailOptions);

    return {
      success: true,
      channel: 'email',
      timestamp: startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to send email notification:', errorMessage);

    return {
      success: false,
      channel: 'email',
      error: errorMessage,
      timestamp: startTime,
    };
  }
}
