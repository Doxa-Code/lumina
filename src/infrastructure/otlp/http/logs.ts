import type { Request, Response, Router } from 'express';
import { Router as createRouter } from 'express';
import { db } from '../../database/connection.js';
import { logs, apiKeys, projects } from '../../database/schema/index.js';
import { verifyApiKey, extractApiKeyFromHeader } from '../../auth/index.js';
import { eq } from 'drizzle-orm';

interface OTLPAttribute {
  key: string;
  value: {
    stringValue?: string;
    intValue?: string | number;
    doubleValue?: number;
    boolValue?: boolean;
    arrayValue?: { values: OTLPAttribute['value'][] };
  };
}

interface OTLPLogRecord {
  timeUnixNano: string;
  observedTimeUnixNano?: string;
  severityNumber?: number;
  severityText?: string;
  body?: {
    stringValue?: string;
    kvlistValue?: { values: OTLPAttribute[] };
  };
  attributes?: OTLPAttribute[];
  traceId?: string;
  spanId?: string;
}

interface OTLPScopeLog {
  scope?: {
    name?: string;
    version?: string;
  };
  logRecords: OTLPLogRecord[];
}

interface OTLPResourceLog {
  resource?: {
    attributes?: OTLPAttribute[];
  };
  scopeLogs: OTLPScopeLog[];
}

interface OTLPLogsRequest {
  resourceLogs: OTLPResourceLog[];
}

function extractAttributes(attrs?: OTLPAttribute[]): Record<string, unknown> {
  if (!attrs) return {};

  const result: Record<string, unknown> = {};
  for (const attr of attrs) {
    const val = attr.value;
    if (val.stringValue !== undefined) {
      result[attr.key] = val.stringValue;
    } else if (val.intValue !== undefined) {
      result[attr.key] = Number(val.intValue);
    } else if (val.doubleValue !== undefined) {
      result[attr.key] = val.doubleValue;
    } else if (val.boolValue !== undefined) {
      result[attr.key] = val.boolValue;
    } else if (val.arrayValue) {
      result[attr.key] = val.arrayValue.values.map((v) => {
        if (v.stringValue !== undefined) return v.stringValue;
        if (v.intValue !== undefined) return Number(v.intValue);
        if (v.doubleValue !== undefined) return v.doubleValue;
        if (v.boolValue !== undefined) return v.boolValue;
        return null;
      });
    }
  }
  return result;
}

function nanoToDate(nanoStr: string): Date {
  const nano = BigInt(nanoStr);
  const ms = Number(nano / BigInt(1_000_000));
  return new Date(ms);
}

function getServiceName(resourceAttrs: Record<string, unknown>): string {
  return (resourceAttrs['service.name'] as string) || 'unknown';
}

function getServiceNamespace(resourceAttrs: Record<string, unknown>): string | undefined {
  return resourceAttrs['service.namespace'] as string | undefined;
}

function extractBody(body?: OTLPLogRecord['body']): string {
  if (!body) return '';
  if (body.stringValue) return body.stringValue;
  if (body.kvlistValue) {
    return JSON.stringify(extractAttributes(body.kvlistValue.values));
  }
  return '';
}

function getSeverityText(number?: number): string {
  if (!number) return 'INFO';
  if (number <= 4) return 'TRACE';
  if (number <= 8) return 'DEBUG';
  if (number <= 12) return 'INFO';
  if (number <= 16) return 'WARN';
  if (number <= 20) return 'ERROR';
  return 'FATAL';
}

export function createLogsRouter(): Router {
  const router = createRouter();

  router.post('/v1/logs', async (req: Request, res: Response) => {
    const apiKeyStr = extractApiKeyFromHeader(
      req.headers.authorization,
      req.headers['x-api-key'] as string | undefined
    );

    if (!apiKeyStr) {
      res.status(401).json({ error: 'API key required' });
      return;
    }

    const allApiKeys = await db.query.apiKeys.findMany();
    let validApiKey = null;

    for (const key of allApiKeys) {
      if (await verifyApiKey(apiKeyStr, key.keyHash)) {
        validApiKey = key;
        break;
      }
    }

    if (!validApiKey) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    if (validApiKey.expiresAt && new Date() > validApiKey.expiresAt) {
      res.status(401).json({ error: 'API key expired' });
      return;
    }

    const permissions = validApiKey.permissions as string[];
    if (!permissions.includes('ingest') && !permissions.includes('admin')) {
      res.status(403).json({ error: 'API key does not have ingest permission' });
      return;
    }

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, validApiKey.projectId),
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    try {
      const body = req.body as OTLPLogsRequest;
      const logsToInsert: Array<typeof logs.$inferInsert> = [];

      for (const resourceLog of body.resourceLogs || []) {
        const resourceAttrs = extractAttributes(resourceLog.resource?.attributes);
        const serviceName = getServiceName(resourceAttrs);
        const serviceNamespace = getServiceNamespace(resourceAttrs);

        for (const scopeLog of resourceLog.scopeLogs || []) {
          for (const logRecord of scopeLog.logRecords || []) {
            const timestamp = nanoToDate(logRecord.timeUnixNano);
            const observedTimestamp = logRecord.observedTimeUnixNano
              ? nanoToDate(logRecord.observedTimeUnixNano)
              : new Date();

            logsToInsert.push({
              projectId: project.id,
              traceId: logRecord.traceId || null,
              spanId: logRecord.spanId || null,
              serviceName,
              serviceNamespace,
              timestamp,
              observedTimestamp,
              severityNumber: String(logRecord.severityNumber || 9),
              severityText: logRecord.severityText || getSeverityText(logRecord.severityNumber),
              body: extractBody(logRecord.body),
              attributes: extractAttributes(logRecord.attributes),
              resourceAttributes: resourceAttrs,
            });
          }
        }
      }

      if (logsToInsert.length > 0) {
        await db.insert(logs).values(logsToInsert);
      }

      await db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, validApiKey.id));

      res.status(200).json({});
    } catch (error) {
      console.error('Error processing logs:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
