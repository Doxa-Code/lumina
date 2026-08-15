import type { Request, Response, Router } from 'express';
import { Router as createRouter } from 'express';
import { db } from '../../database/connection.js';
import { metrics, apiKeys, projects } from '../../database/schema/index.js';
import { verifyApiKey, extractApiKeyFromHeader } from '../../auth/index.js';
import { eq } from 'drizzle-orm';

interface OTLPAttribute {
  key: string;
  value: {
    stringValue?: string;
    intValue?: string | number;
    doubleValue?: number;
    boolValue?: boolean;
  };
}

interface OTLPNumberDataPoint {
  attributes?: OTLPAttribute[];
  timeUnixNano: string;
  asInt?: string | number;
  asDouble?: number;
}

interface OTLPHistogramDataPoint {
  attributes?: OTLPAttribute[];
  timeUnixNano: string;
  count: string | number;
  sum?: number;
  explicitBounds?: number[];
  bucketCounts?: (string | number)[];
}

interface OTLPMetric {
  name: string;
  description?: string;
  unit?: string;
  gauge?: {
    dataPoints: OTLPNumberDataPoint[];
  };
  sum?: {
    dataPoints: OTLPNumberDataPoint[];
    isMonotonic?: boolean;
  };
  histogram?: {
    dataPoints: OTLPHistogramDataPoint[];
  };
}

interface OTLPScopeMetric {
  scope?: {
    name?: string;
    version?: string;
  };
  metrics: OTLPMetric[];
}

interface OTLPResourceMetric {
  resource?: {
    attributes?: OTLPAttribute[];
  };
  scopeMetrics: OTLPScopeMetric[];
}

interface OTLPMetricsRequest {
  resourceMetrics: OTLPResourceMetric[];
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

export function createMetricsRouter(): Router {
  const router = createRouter();

  router.post('/v1/metrics', async (req: Request, res: Response) => {
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
      const body = req.body as OTLPMetricsRequest;
      const metricsToInsert: Array<typeof metrics.$inferInsert> = [];

      for (const resourceMetric of body.resourceMetrics || []) {
        const resourceAttrs = extractAttributes(resourceMetric.resource?.attributes);
        const serviceName = getServiceName(resourceAttrs);

        for (const scopeMetric of resourceMetric.scopeMetrics || []) {
          for (const metric of scopeMetric.metrics || []) {
            if (metric.gauge) {
              for (const dp of metric.gauge.dataPoints) {
                metricsToInsert.push({
                  projectId: project.id,
                  serviceName,
                  metricName: metric.name,
                  metricType: 'GAUGE',
                  unit: metric.unit,
                  description: metric.description,
                  timestamp: nanoToDate(dp.timeUnixNano),
                  valueInt: dp.asInt !== undefined ? Number(dp.asInt) : null,
                  valueDouble: dp.asDouble,
                  attributes: extractAttributes(dp.attributes),
                  resourceAttributes: resourceAttrs,
                });
              }
            }

            if (metric.sum) {
              for (const dp of metric.sum.dataPoints) {
                metricsToInsert.push({
                  projectId: project.id,
                  serviceName,
                  metricName: metric.name,
                  metricType: 'COUNTER',
                  unit: metric.unit,
                  description: metric.description,
                  timestamp: nanoToDate(dp.timeUnixNano),
                  valueInt: dp.asInt !== undefined ? Number(dp.asInt) : null,
                  valueDouble: dp.asDouble,
                  attributes: extractAttributes(dp.attributes),
                  resourceAttributes: resourceAttrs,
                });
              }
            }

            if (metric.histogram) {
              for (const dp of metric.histogram.dataPoints) {
                const buckets =
                  dp.explicitBounds && dp.bucketCounts
                    ? dp.explicitBounds.map((bound, i) => ({
                        bound,
                        count: Number(dp.bucketCounts![i]),
                      }))
                    : null;

                metricsToInsert.push({
                  projectId: project.id,
                  serviceName,
                  metricName: metric.name,
                  metricType: 'HISTOGRAM',
                  unit: metric.unit,
                  description: metric.description,
                  timestamp: nanoToDate(dp.timeUnixNano),
                  histogramCount: Number(dp.count),
                  histogramSum: dp.sum,
                  histogramBuckets: buckets,
                  attributes: extractAttributes(dp.attributes),
                  resourceAttributes: resourceAttrs,
                });
              }
            }
          }
        }
      }

      if (metricsToInsert.length > 0) {
        await db.insert(metrics).values(metricsToInsert);
      }

      await db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, validApiKey.id));

      res.status(200).json({});
    } catch (error) {
      console.error('Error processing metrics:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
