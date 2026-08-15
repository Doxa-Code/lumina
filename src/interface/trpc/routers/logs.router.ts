import { z } from 'zod';
import { router, projectProcedure } from '../trpc.js';
import { db } from '../../../infrastructure/database/connection.js';
import { logs } from '../../../infrastructure/database/schema/index.js';
import { eq, and, desc, gte, lte, sql, like } from 'drizzle-orm';

export const logsRouter = router({
  list: projectProcedure
    .input(
      z.object({
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        serviceName: z.string().optional(),
        severityNumber: z.number().min(1).max(24).optional(),
        traceId: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      const conditions = [eq(logs.projectId, projectId)];

      if (input.from) {
        conditions.push(gte(logs.timestamp, new Date(input.from)));
      }
      if (input.to) {
        conditions.push(lte(logs.timestamp, new Date(input.to)));
      }
      if (input.serviceName) {
        conditions.push(like(logs.serviceName, `%${input.serviceName}%`));
      }
      if (input.severityNumber) {
        conditions.push(gte(sql`CAST(${logs.severityNumber} AS INTEGER)`, input.severityNumber));
      }
      if (input.traceId) {
        conditions.push(eq(logs.traceId, input.traceId));
      }
      if (input.search) {
        conditions.push(like(logs.body, `%${input.search}%`));
      }

      const result = await db
        .select()
        .from(logs)
        .where(and(...conditions))
        .orderBy(desc(logs.timestamp))
        .limit(input.limit)
        .offset(input.offset);

      return result.map((log) => ({
        id: log.id,
        projectId: log.projectId,
        traceId: log.traceId,
        spanId: log.spanId,
        serviceName: log.serviceName,
        serviceNamespace: log.serviceNamespace,
        timestamp: log.timestamp.toISOString(),
        observedTimestamp: log.observedTimestamp.toISOString(),
        severityNumber: parseInt(log.severityNumber, 10),
        severityText: log.severityText,
        body: log.body,
        attributes: log.attributes,
        resourceAttributes: log.resourceAttributes,
      }));
    }),

  get: projectProcedure
    .input(
      z.object({
        logId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      const log = await db.query.logs.findFirst({
        where: and(eq(logs.id, input.logId), eq(logs.projectId, projectId)),
      });

      if (!log) {
        return null;
      }

      return {
        id: log.id,
        projectId: log.projectId,
        traceId: log.traceId,
        spanId: log.spanId,
        serviceName: log.serviceName,
        serviceNamespace: log.serviceNamespace,
        timestamp: log.timestamp.toISOString(),
        observedTimestamp: log.observedTimestamp.toISOString(),
        severityNumber: parseInt(log.severityNumber, 10),
        severityText: log.severityText,
        body: log.body,
        attributes: log.attributes,
        resourceAttributes: log.resourceAttributes,
      };
    }),

  stats: projectProcedure
    .input(
      z.object({
        from: z.string().datetime(),
        to: z.string().datetime(),
        interval: z.enum(['1m', '5m', '15m', '1h', '1d']).default('15m'),
      })
    )
    .query(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      const intervalSeconds: Record<string, number> = {
        '1m': 60,
        '5m': 300,
        '15m': 900,
        '1h': 3600,
        '1d': 86400,
      };

      const result = await db.execute(sql`
        SELECT
          to_timestamp(floor(extract(epoch from ${logs.timestamp}) / ${intervalSeconds[input.interval]}) * ${intervalSeconds[input.interval]}) as bucket,
          count(*) as count,
          count(*) filter (where CAST(${logs.severityNumber} AS INTEGER) >= 17) as error_count,
          count(*) filter (where CAST(${logs.severityNumber} AS INTEGER) >= 13 AND CAST(${logs.severityNumber} AS INTEGER) < 17) as warn_count
        FROM ${logs}
        WHERE ${logs.projectId} = ${projectId}
          AND ${logs.timestamp} >= ${new Date(input.from)}
          AND ${logs.timestamp} <= ${new Date(input.to)}
        GROUP BY bucket
        ORDER BY bucket
      `);

      return (result as unknown as Array<{
        bucket: Date;
        count: number;
        error_count: number;
        warn_count: number;
      }>).map((r) => ({
        timestamp: r.bucket.toISOString(),
        count: Number(r.count),
        errorCount: Number(r.error_count),
        warnCount: Number(r.warn_count),
      }));
    }),

  severityDistribution: projectProcedure
    .input(
      z.object({
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      const conditions = [eq(logs.projectId, projectId)];

      if (input.from) {
        conditions.push(gte(logs.timestamp, new Date(input.from)));
      }
      if (input.to) {
        conditions.push(lte(logs.timestamp, new Date(input.to)));
      }

      const result = await db
        .select({
          severityText: logs.severityText,
          count: sql<number>`count(*)`,
        })
        .from(logs)
        .where(and(...conditions))
        .groupBy(logs.severityText);

      return result.map((r) => ({
        severity: r.severityText || 'UNKNOWN',
        count: Number(r.count),
      }));
    }),
});
