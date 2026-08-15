import { z } from 'zod';
import { router, projectProcedure } from '../trpc.js';
import { db } from '../../../infrastructure/database/connection.js';
import { metrics } from '../../../infrastructure/database/schema/telemetry.js';
import { eq, desc, sql, and, gte } from 'drizzle-orm';

export const metricsRouter = router({
  list: projectProcedure
    .input(
      z.object({
        search: z.string().optional(),
        type: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        timeRange: z.string().default('24h'),
      })
    )
    .query(async ({ input, ctx }) => {
      const now = new Date();
      let startTime: Date;

      const match = input.timeRange.match(/^(\d+)(m|h|d)$/);
      if (match) {
        const value = parseInt(match[1]);
        const unit = match[2];
        switch (unit) {
          case 'm':
            startTime = new Date(now.getTime() - value * 60 * 1000);
            break;
          case 'h':
            startTime = new Date(now.getTime() - value * 60 * 60 * 1000);
            break;
          case 'd':
            startTime = new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
            break;
          default:
            startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        }
      } else {
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      const conditions = [
        eq(metrics.projectId, ctx.project!.id),
        gte(metrics.timestamp, startTime),
      ];

      if (input.type) {
        conditions.push(eq(metrics.metricType, input.type));
      }

      // Group by metric name to get summaries
      const result = await db
        .select({
          name: metrics.metricName,
          type: metrics.metricType,
          unit: metrics.unit,
          count: sql<number>`COUNT(*)`,
          avgValue: sql<number>`AVG(COALESCE(${metrics.valueDouble}, ${metrics.valueInt}))`,
          minValue: sql<number>`MIN(COALESCE(${metrics.valueDouble}, ${metrics.valueInt}))`,
          maxValue: sql<number>`MAX(COALESCE(${metrics.valueDouble}, ${metrics.valueInt}))`,
          lastValue: sql<number>`(
            SELECT COALESCE(value_double, value_int)
            FROM metrics m2
            WHERE m2.metric_name = ${metrics.metricName}
              AND m2.project_id = ${ctx.project!.id}
            ORDER BY timestamp DESC
            LIMIT 1
          )`,
          lastSeen: sql<Date>`MAX(${metrics.timestamp})`,
        })
        .from(metrics)
        .where(and(...conditions))
        .groupBy(metrics.metricName, metrics.metricType, metrics.unit)
        .orderBy(desc(sql`MAX(${metrics.timestamp})`))
        .limit(input.limit);

      return result.map((m) => ({
        name: m.name,
        type: m.type,
        unit: m.unit,
        count: Number(m.count) || 0,
        lastValue: Number(m.lastValue) || 0,
        avgValue: Number(m.avgValue) || 0,
        minValue: Number(m.minValue) || 0,
        maxValue: Number(m.maxValue) || 0,
        lastSeen: m.lastSeen instanceof Date ? m.lastSeen.toISOString() : new Date().toISOString(),
      }));
    }),

  get: projectProcedure
    .input(
      z.object({
        name: z.string(),
        timeRange: z.string().default('24h'),
      })
    )
    .query(async ({ input, ctx }) => {
      const now = new Date();
      let startTime: Date;

      const match = input.timeRange.match(/^(\d+)(m|h|d)$/);
      if (match) {
        const value = parseInt(match[1]);
        const unit = match[2];
        switch (unit) {
          case 'm':
            startTime = new Date(now.getTime() - value * 60 * 1000);
            break;
          case 'h':
            startTime = new Date(now.getTime() - value * 60 * 60 * 1000);
            break;
          case 'd':
            startTime = new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
            break;
          default:
            startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        }
      } else {
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      const dataPoints = await db
        .select({
          timestamp: metrics.timestamp,
          value: sql<number>`COALESCE(${metrics.valueDouble}, ${metrics.valueInt})`,
          attributes: metrics.attributes,
        })
        .from(metrics)
        .where(
          and(
            eq(metrics.projectId, ctx.project!.id),
            eq(metrics.metricName, input.name),
            gte(metrics.timestamp, startTime)
          )
        )
        .orderBy(metrics.timestamp)
        .limit(1000);

      return dataPoints.map((dp) => ({
        timestamp: dp.timestamp.toISOString(),
        value: Number(dp.value) || 0,
        attributes: dp.attributes,
      }));
    }),

  stats: projectProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [stats] = await db
      .select({
        uniqueMetrics: sql<number>`COUNT(DISTINCT ${metrics.metricName})`,
        totalDataPoints: sql<number>`COUNT(*)`,
        types: sql<string[]>`ARRAY_AGG(DISTINCT ${metrics.metricType})`,
      })
      .from(metrics)
      .where(
        and(
          eq(metrics.projectId, ctx.project!.id),
          gte(metrics.timestamp, oneDayAgo)
        )
      );

    return {
      uniqueMetrics: Number(stats?.uniqueMetrics) || 0,
      totalDataPoints: Number(stats?.totalDataPoints) || 0,
      types: (stats?.types || []).filter(Boolean),
    };
  }),

  types: projectProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const result = await db
      .select({
        type: metrics.metricType,
        count: sql<number>`COUNT(DISTINCT ${metrics.metricName})`,
      })
      .from(metrics)
      .where(
        and(
          eq(metrics.projectId, ctx.project!.id),
          gte(metrics.timestamp, oneDayAgo)
        )
      )
      .groupBy(metrics.metricType);

    return result.map((r) => ({
      type: r.type,
      count: Number(r.count) || 0,
    }));
  }),
});
