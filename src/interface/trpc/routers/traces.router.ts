import { z } from 'zod';
import { router, projectProcedure } from '../trpc.js';
import { db } from '../../../infrastructure/database/connection.js';
import { spans } from '../../../infrastructure/database/schema/index.js';
import { eq, and, desc, gte, lte, sql, like, or, inArray } from 'drizzle-orm';

export const tracesRouter = router({
  list: projectProcedure
    .input(
      z.object({
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        serviceName: z.string().optional(),
        statusCode: z.enum(['UNSET', 'OK', 'ERROR']).optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      // If filtering by serviceName, first find all traceIds that contain that service
      let filteredTraceIds: string[] | null = null;
      if (input.serviceName) {
        const traceIdsWithService = await db
          .selectDistinct({ traceId: spans.traceId })
          .from(spans)
          .where(
            and(
              eq(spans.projectId, projectId),
              eq(spans.serviceName, input.serviceName)
            )
          )
          .limit(1000);
        filteredTraceIds = traceIdsWithService.map((r) => r.traceId);

        // If no traces found with this service, return empty
        if (filteredTraceIds.length === 0) {
          return [];
        }
      }

      const conditions = [eq(spans.projectId, projectId)];

      if (input.from) {
        conditions.push(gte(spans.startTime, new Date(input.from)));
      }
      if (input.to) {
        conditions.push(lte(spans.startTime, new Date(input.to)));
      }
      if (filteredTraceIds) {
        conditions.push(inArray(spans.traceId, filteredTraceIds));
      }
      if (input.statusCode) {
        conditions.push(eq(spans.statusCode, input.statusCode));
      }
      if (input.search) {
        conditions.push(
          or(
            like(spans.name, `%${input.search}%`),
            like(spans.traceId, `%${input.search}%`)
          )!
        );
      }

      const rootSpans = await db
        .select()
        .from(spans)
        .where(and(...conditions, sql`${spans.parentSpanId} IS NULL`))
        .orderBy(desc(spans.startTime))
        .limit(input.limit)
        .offset(input.offset);

      const traceIds = rootSpans.map((s) => s.traceId);

      // Skip spanCounts query if no root spans found
      if (traceIds.length === 0) {
        return [];
      }

      const spanCounts = await db
        .select({
          traceId: spans.traceId,
          count: sql<number>`count(*)`,
          errorCount: sql<number>`count(*) filter (where ${spans.statusCode} = 'ERROR')`,
        })
        .from(spans)
        .where(
          and(
            eq(spans.projectId, projectId),
            inArray(spans.traceId, traceIds)
          )
        )
        .groupBy(spans.traceId);

      const countMap = new Map(
        spanCounts.map((c) => [
          c.traceId,
          { count: c.count, errorCount: c.errorCount },
        ])
      );

      return rootSpans.map((span) => ({
        id: span.id,
        traceId: span.traceId,
        spanId: span.spanId,
        serviceName: span.serviceName,
        name: span.name,
        kind: span.kind,
        statusCode: span.statusCode,
        startTime: span.startTime.toISOString(),
        endTime: span.endTime.toISOString(),
        durationMs: span.durationMs,
        spanCount: countMap.get(span.traceId)?.count || 1,
        errorCount: countMap.get(span.traceId)?.errorCount || 0,
        attributes: span.attributes,
        resourceAttributes: span.resourceAttributes,
      }));
    }),

  get: projectProcedure
    .input(
      z.object({
        traceId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      const traceSpans = await db
        .select()
        .from(spans)
        .where(
          and(eq(spans.projectId, projectId), eq(spans.traceId, input.traceId))
        )
        .orderBy(spans.startTime);

      if (traceSpans.length === 0) {
        return null;
      }

      const rootSpan = traceSpans.find((s) => !s.parentSpanId);
      const startTime = rootSpan?.startTime || traceSpans[0].startTime;
      const endTime = traceSpans.reduce(
        (max, s) => (s.endTime > max ? s.endTime : max),
        traceSpans[0].endTime
      );

      const services = [...new Set(traceSpans.map((s) => s.serviceName))];
      const errorCount = traceSpans.filter((s) => s.statusCode === 'ERROR').length;

      return {
        traceId: input.traceId,
        projectId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationMs: endTime.getTime() - startTime.getTime(),
        spanCount: traceSpans.length,
        errorCount,
        services,
        spans: traceSpans.map((s) => ({
          id: s.id,
          traceId: s.traceId,
          spanId: s.spanId,
          parentSpanId: s.parentSpanId,
          serviceName: s.serviceName,
          serviceNamespace: s.serviceNamespace,
          serviceVersion: s.serviceVersion,
          name: s.name,
          kind: s.kind,
          statusCode: s.statusCode,
          statusMessage: s.statusMessage,
          startTime: s.startTime.toISOString(),
          endTime: s.endTime.toISOString(),
          durationMs: s.durationMs,
          attributes: s.attributes,
          resourceAttributes: s.resourceAttributes,
          events: s.events,
          links: s.links,
        })),
      };
    }),

  services: projectProcedure
    .input(
      z.object({
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      const conditions = [eq(spans.projectId, projectId)];

      if (input.from) {
        conditions.push(gte(spans.startTime, new Date(input.from)));
      }
      if (input.to) {
        conditions.push(lte(spans.startTime, new Date(input.to)));
      }

      const result = await db
        .select({
          serviceName: spans.serviceName,
          spanCount: sql<number>`count(*)`,
          traceCount: sql<number>`count(DISTINCT ${spans.traceId})`,
          errorCount: sql<number>`count(*) filter (where ${spans.statusCode} = 'ERROR')`,
          avgDuration: sql<number>`avg(${spans.durationMs})`,
          p99Duration: sql<number>`percentile_cont(0.99) within group (order by ${spans.durationMs})`,
          lastSeen: sql<Date>`max(${spans.startTime})`,
        })
        .from(spans)
        .where(and(...conditions))
        .groupBy(spans.serviceName)
        .orderBy(desc(sql`count(*)`));

      return result.map((r) => ({
        serviceName: r.serviceName,
        spanCount: Number(r.spanCount) || 0,
        traceCount: Number(r.traceCount) || 0,
        errorCount: Number(r.errorCount) || 0,
        avgDurationMs: Number(r.avgDuration) || 0,
        p99DurationMs: Number(r.p99Duration) || 0,
        lastSeen: r.lastSeen instanceof Date ? r.lastSeen.toISOString() : new Date().toISOString(),
      }));
    }),

  // Get slowest endpoints
  slowestEndpoints: projectProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(20).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      const result = await db
        .select({
          name: spans.name,
          serviceName: spans.serviceName,
          avgDuration: sql<number>`avg(${spans.durationMs})`,
          p95Duration: sql<number>`percentile_cont(0.95) within group (order by ${spans.durationMs})`,
          count: sql<number>`count(*)`,
          errorCount: sql<number>`count(*) filter (where ${spans.statusCode} = 'ERROR')`,
        })
        .from(spans)
        .where(
          and(
            eq(spans.projectId, projectId),
            sql`${spans.parentSpanId} IS NULL`
          )
        )
        .groupBy(spans.name, spans.serviceName)
        .orderBy(desc(sql`avg(${spans.durationMs})`))
        .limit(input.limit);

      return result.map((r) => ({
        name: r.name,
        serviceName: r.serviceName,
        avgDurationMs: Number(r.avgDuration) || 0,
        p95DurationMs: Number(r.p95Duration) || 0,
        count: Number(r.count) || 0,
        errorCount: Number(r.errorCount) || 0,
        errorRate: r.count > 0 ? (Number(r.errorCount) / Number(r.count)) * 100 : 0,
      }));
    }),

  // Get endpoints with most errors
  errorEndpoints: projectProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(20).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      const result = await db
        .select({
          name: spans.name,
          serviceName: spans.serviceName,
          count: sql<number>`count(*)`,
          errorCount: sql<number>`count(*) filter (where ${spans.statusCode} = 'ERROR')`,
          avgDuration: sql<number>`avg(${spans.durationMs})`,
          lastError: sql<Date>`max(${spans.startTime}) filter (where ${spans.statusCode} = 'ERROR')`,
        })
        .from(spans)
        .where(
          and(
            eq(spans.projectId, projectId),
            sql`${spans.parentSpanId} IS NULL`
          )
        )
        .groupBy(spans.name, spans.serviceName)
        .having(sql`count(*) filter (where ${spans.statusCode} = 'ERROR') > 0`)
        .orderBy(desc(sql`count(*) filter (where ${spans.statusCode} = 'ERROR')`))
        .limit(input.limit);

      return result.map((r) => ({
        name: r.name,
        serviceName: r.serviceName,
        count: Number(r.count) || 0,
        errorCount: Number(r.errorCount) || 0,
        errorRate: r.count > 0 ? (Number(r.errorCount) / Number(r.count)) * 100 : 0,
        avgDurationMs: Number(r.avgDuration) || 0,
        lastError: r.lastError instanceof Date ? r.lastError.toISOString() : null,
      }));
    }),

  // Recent errors
  recentErrors: projectProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(20).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      const result = await db
        .select()
        .from(spans)
        .where(
          and(
            eq(spans.projectId, projectId),
            eq(spans.statusCode, 'ERROR')
          )
        )
        .orderBy(desc(spans.startTime))
        .limit(input.limit);

      return result.map((s) => ({
        traceId: s.traceId,
        spanId: s.spanId,
        name: s.name,
        serviceName: s.serviceName,
        statusMessage: s.statusMessage,
        startTime: s.startTime.toISOString(),
        durationMs: s.durationMs,
      }));
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

      const intervalMap: Record<string, string> = {
        '1m': '1 minute',
        '5m': '5 minutes',
        '15m': '15 minutes',
        '1h': '1 hour',
        '1d': '1 day',
      };

      const result = await db.execute(sql`
        SELECT
          date_trunc('${sql.raw(intervalMap[input.interval].split(' ')[1])}', ${spans.startTime}) as bucket,
          count(*) as count,
          count(*) filter (where ${spans.statusCode} = 'ERROR') as error_count,
          avg(${spans.durationMs}) as avg_duration
        FROM ${spans}
        WHERE ${spans.projectId} = ${projectId}
          AND ${spans.startTime} >= ${new Date(input.from)}
          AND ${spans.startTime} <= ${new Date(input.to)}
        GROUP BY bucket
        ORDER BY bucket
      `);

      return (result as unknown as Array<{
        bucket: Date;
        count: number;
        error_count: number;
        avg_duration: number;
      }>).map((r) => ({
        timestamp: r.bucket.toISOString(),
        count: Number(r.count),
        errorCount: Number(r.error_count),
        avgDurationMs: Number(r.avg_duration),
      }));
    }),
});
