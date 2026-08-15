import type { Request, Response, Router } from 'express';
import { Router as createRouter } from 'express';
import { db } from '../../database/connection.js';
import { spans, apiKeys, projects, errorGroups } from '../../database/schema/index.js';
import { verifyApiKey, extractApiKeyFromHeader } from '../../auth/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { createHash } from 'crypto';

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

interface OTLPEvent {
  name: string;
  timeUnixNano: string;
  attributes?: OTLPAttribute[];
}

interface OTLPLink {
  traceId: string;
  spanId: string;
  attributes?: OTLPAttribute[];
}

interface OTLPSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes?: OTLPAttribute[];
  events?: OTLPEvent[];
  links?: OTLPLink[];
  status?: {
    code?: number;
    message?: string;
  };
}

interface OTLPResource {
  attributes?: OTLPAttribute[];
}

interface OTLPScopeSpan {
  scope?: {
    name?: string;
    version?: string;
  };
  spans: OTLPSpan[];
}

interface OTLPResourceSpan {
  resource?: OTLPResource;
  scopeSpans: OTLPScopeSpan[];
}

interface OTLPTraceRequest {
  resourceSpans: OTLPResourceSpan[];
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

function getServiceVersion(resourceAttrs: Record<string, unknown>): string | undefined {
  return resourceAttrs['service.version'] as string | undefined;
}

function getStatusCode(code?: number): string {
  if (code === 1) return 'OK';
  if (code === 2) return 'ERROR';
  return 'UNSET';
}

function getSpanKind(kind: number): string {
  const kinds = ['INTERNAL', 'SERVER', 'CLIENT', 'PRODUCER', 'CONSUMER'];
  return kinds[kind] || 'INTERNAL';
}

function generateErrorFingerprint(serviceName: string, errorType: string, errorMessage: string): string {
  const normalizedMessage = errorMessage
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<UUID>')
    .replace(/\b\d{10,13}\b/g, '<TIMESTAMP>')
    .replace(/\b\d+\b/g, '<NUM>')
    .slice(0, 200);

  const input = `${serviceName}:${errorType}:${normalizedMessage}`;
  return createHash('sha256').update(input).digest('hex').slice(0, 32);
}

function extractErrorInfo(span: OTLPSpan): { type: string; message: string } | null {
  if (span.status?.code !== 2) return null;

  let errorType = 'Error';
  let errorMessage = span.status.message || span.name;

  for (const event of span.events || []) {
    if (event.name === 'exception') {
      const attrs = extractAttributes(event.attributes);
      if (attrs['exception.type']) {
        errorType = String(attrs['exception.type']);
      }
      if (attrs['exception.message']) {
        errorMessage = String(attrs['exception.message']);
      }
      break;
    }
  }

  const spanAttrs = extractAttributes(span.attributes);
  if (spanAttrs['exception.type']) {
    errorType = String(spanAttrs['exception.type']);
  }
  if (spanAttrs['exception.message']) {
    errorMessage = String(spanAttrs['exception.message']);
  }

  return { type: errorType, message: errorMessage };
}

export function createTracesRouter(): Router {
  const router = createRouter();

  router.post('/v1/traces', async (req: Request, res: Response) => {
    console.log('[OTLP Traces] Received request');
    console.log('[OTLP Traces] Headers:', JSON.stringify(req.headers, null, 2));

    const apiKeyStr = extractApiKeyFromHeader(
      req.headers.authorization,
      req.headers['x-api-key'] as string | undefined
    );

    if (!apiKeyStr) {
      console.log('[OTLP Traces] No API key provided. Authorization header:', req.headers.authorization);
      console.log('[OTLP Traces] Note: API key must start with "obs_" prefix');
      res.status(401).json({ error: 'API key required. Key must start with obs_ prefix.' });
      return;
    }
    console.log('[OTLP Traces] API key provided:', apiKeyStr.substring(0, 10) + '...');

    const allApiKeys = await db.query.apiKeys.findMany();
    let validApiKey = null;

    for (const key of allApiKeys) {
      if (await verifyApiKey(apiKeyStr, key.keyHash)) {
        validApiKey = key;
        break;
      }
    }

    if (!validApiKey) {
      console.log('[OTLP Traces] Invalid API key - no match found in', allApiKeys.length, 'keys');
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }
    console.log('[OTLP Traces] Valid API key found for project:', validApiKey.projectId);

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
      const body = req.body as OTLPTraceRequest;
      const spansToInsert: Array<typeof spans.$inferInsert> = [];
      const errorsToProcess: Map<string, {
        fingerprint: string;
        type: string;
        message: string;
        serviceName: string;
        timestamp: Date;
      }> = new Map();

      for (const resourceSpan of body.resourceSpans || []) {
        const resourceAttrs = extractAttributes(resourceSpan.resource?.attributes);
        const serviceName = getServiceName(resourceAttrs);
        const serviceNamespace = getServiceNamespace(resourceAttrs);
        const serviceVersion = getServiceVersion(resourceAttrs);

        for (const scopeSpan of resourceSpan.scopeSpans || []) {
          for (const span of scopeSpan.spans || []) {
            const startTime = nanoToDate(span.startTimeUnixNano);
            const endTime = nanoToDate(span.endTimeUnixNano);
            const durationMs = endTime.getTime() - startTime.getTime();

            spansToInsert.push({
              traceId: span.traceId,
              spanId: span.spanId,
              parentSpanId: span.parentSpanId || null,
              projectId: project.id,
              serviceName,
              serviceNamespace,
              serviceVersion,
              name: span.name,
              kind: getSpanKind(span.kind),
              statusCode: getStatusCode(span.status?.code),
              statusMessage: span.status?.message,
              startTime,
              endTime,
              durationMs,
              attributes: extractAttributes(span.attributes),
              resourceAttributes: resourceAttrs,
              events: (span.events || []).map((e) => ({
                name: e.name,
                timestamp: nanoToDate(e.timeUnixNano).toISOString(),
                attributes: extractAttributes(e.attributes),
              })),
              links: (span.links || []).map((l) => ({
                traceId: l.traceId,
                spanId: l.spanId,
                attributes: extractAttributes(l.attributes),
              })),
            });

            const errorInfo = extractErrorInfo(span);
            if (errorInfo) {
              const fingerprint = generateErrorFingerprint(serviceName, errorInfo.type, errorInfo.message);
              const existing = errorsToProcess.get(fingerprint);
              if (!existing || startTime > existing.timestamp) {
                errorsToProcess.set(fingerprint, {
                  fingerprint,
                  type: errorInfo.type,
                  message: errorInfo.message,
                  serviceName,
                  timestamp: startTime,
                });
              }
            }
          }
        }
      }

      console.log('[OTLP Traces] Spans to insert:', spansToInsert.length);
      if (spansToInsert.length > 0) {
        await db.insert(spans).values(spansToInsert).onConflictDoNothing();
        console.log('[OTLP Traces] Inserted', spansToInsert.length, 'spans');
      }

      if (errorsToProcess.size > 0) {
        console.log('[OTLP Traces] Processing', errorsToProcess.size, 'error groups');
        for (const error of errorsToProcess.values()) {
          const existing = await db
            .select()
            .from(errorGroups)
            .where(
              and(
                eq(errorGroups.projectId, project.id),
                eq(errorGroups.fingerprint, error.fingerprint)
              )
            )
            .limit(1);

          if (existing.length > 0) {
            const currentCount = parseInt(existing[0].eventCount) || 0;
            await db
              .update(errorGroups)
              .set({
                lastSeenAt: error.timestamp,
                eventCount: String(currentCount + 1),
                services: sql`
                  CASE
                    WHEN NOT (${errorGroups.services}::jsonb @> ${JSON.stringify([error.serviceName])}::jsonb)
                    THEN ${errorGroups.services}::jsonb || ${JSON.stringify([error.serviceName])}::jsonb
                    ELSE ${errorGroups.services}
                  END
                `,
                updatedAt: new Date(),
              })
              .where(eq(errorGroups.id, existing[0].id));
          } else {
            await db.insert(errorGroups).values({
              projectId: project.id,
              fingerprint: error.fingerprint,
              title: error.message.slice(0, 500),
              type: error.type,
              firstSeenAt: error.timestamp,
              lastSeenAt: error.timestamp,
              eventCount: '1',
              status: 'active',
              services: [error.serviceName],
            });
          }
        }
        console.log('[OTLP Traces] Processed error groups');
      }

      await db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, validApiKey.id));

      res.status(200).json({});
    } catch (error) {
      console.error('Error processing traces:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
