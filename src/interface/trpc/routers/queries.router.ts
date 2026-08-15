import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { db } from '../../../infrastructure/database/connection';
import { savedQueries } from '../../../infrastructure/database/schema/query';
import { spans, logs, metrics } from '../../../infrastructure/database/schema/telemetry';
import { eq, desc, and, sql, gte, lte, like, or } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const queryConfigSchema = z.object({
  dataSource: z.enum(['traces', 'logs', 'metrics']),
  aggregation: z.enum(['count', 'avg', 'sum', 'min', 'max', 'p50', 'p95', 'p99']),
  aggregationField: z.string(),
  groupBy: z.array(z.string()),
  filters: z.array(
    z.object({
      field: z.string(),
      operator: z.enum(['=', '!=', '>', '<', '>=', '<=', 'contains', 'not_contains', 'starts_with', 'ends_with']),
      value: z.string(),
    })
  ),
  timeRange: z.string(),
  limit: z.number().min(1).max(10000),
});

type QueryConfig = z.infer<typeof queryConfigSchema>;

function parseTimeRange(range: string): Date {
  const now = new Date();
  const match = range.match(/^(\d+)(m|h|d)$/);
  if (!match) return new Date(now.getTime() - 24 * 60 * 60 * 1000); // default 24h

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'm':
      return new Date(now.getTime() - value * 60 * 1000);
    case 'h':
      return new Date(now.getTime() - value * 60 * 60 * 1000);
    case 'd':
      return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
}

export const queriesRouter = router({
  execute: protectedProcedure
    .input(queryConfigSchema)
    .mutation(async ({ input, ctx }) => {
      const startTime = parseTimeRange(input.timeRange);
      const projectId = ctx.project!.id;

      // Execute query based on data source
      if (input.dataSource === 'traces') {
        return executeSpansQuery(input, projectId, startTime);
      } else if (input.dataSource === 'logs') {
        return executeLogsQuery(input, projectId, startTime);
      } else {
        return executeMetricsQuery(input, projectId, startTime);
      }
    }),

  save: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        config: queryConfigSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const id = randomUUID();

      await db.insert(savedQueries).values({
        id,
        projectId: ctx.project!.id,
        createdBy: ctx.user!.id,
        name: input.name,
        description: input.description || null,
        datasets: [input.config.dataSource],
        filters: input.config.filters,
        aggregations: [{ type: input.config.aggregation, field: input.config.aggregationField }],
        groupBy: input.config.groupBy,
        orderBy: [],
      });

      return { id };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const queries = await db
      .select()
      .from(savedQueries)
      .where(eq(savedQueries.projectId, ctx.project!.id))
      .orderBy(desc(savedQueries.createdAt))
      .limit(50);

    return queries.map((q) => ({
      id: q.id,
      name: q.name,
      description: q.description,
      config: {
        dataSource: (q.datasets as string[])?.[0] || 'traces',
        filters: q.filters,
        aggregations: q.aggregations,
        groupBy: q.groupBy,
      },
      createdAt: q.createdAt.toISOString(),
    }));
  }),

  get: protectedProcedure
    .input(z.object({ queryId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const [query] = await db
        .select()
        .from(savedQueries)
        .where(
          and(
            eq(savedQueries.id, input.queryId),
            eq(savedQueries.projectId, ctx.project!.id)
          )
        )
        .limit(1);

      if (!query) return null;

      return {
        id: query.id,
        name: query.name,
        description: query.description,
        config: {
          dataSource: (query.datasets as string[])?.[0] || 'traces',
          filters: query.filters,
          aggregations: query.aggregations,
          groupBy: query.groupBy,
        },
        createdAt: query.createdAt.toISOString(),
      };
    }),

  delete: protectedProcedure
    .input(z.object({ queryId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await db
        .delete(savedQueries)
        .where(
          and(
            eq(savedQueries.id, input.queryId),
            eq(savedQueries.projectId, ctx.project!.id)
          )
        );

      return { success: true };
    }),
});

async function executeSpansQuery(config: QueryConfig, projectId: string, startTime: Date) {
  const conditions = [
    eq(spans.projectId, projectId),
    gte(spans.startTime, startTime),
  ];

  // Add filters (simplified - would need more complex handling for attributes)
  for (const filter of config.filters) {
    if (filter.field === 'serviceName') {
      switch (filter.operator) {
        case '=':
          conditions.push(eq(spans.serviceName, filter.value));
          break;
        case '!=':
          conditions.push(sql`${spans.serviceName} != ${filter.value}`);
          break;
        case 'contains':
          conditions.push(like(spans.serviceName, `%${filter.value}%`));
          break;
      }
    } else if (filter.field === 'name') {
      switch (filter.operator) {
        case '=':
          conditions.push(eq(spans.name, filter.value));
          break;
        case 'contains':
          conditions.push(like(spans.name, `%${filter.value}%`));
          break;
      }
    } else if (filter.field === 'statusCode') {
      conditions.push(eq(spans.statusCode, filter.value));
    }
  }

  // Build aggregation query
  if (config.groupBy.length > 0 && config.groupBy.includes('serviceName')) {
    const result = await db
      .select({
        serviceName: spans.serviceName,
        count: sql<number>`COUNT(*)`,
        avgDuration: sql<number>`AVG(${spans.durationMs})`,
        sumDuration: sql<number>`SUM(${spans.durationMs})`,
        minDuration: sql<number>`MIN(${spans.durationMs})`,
        maxDuration: sql<number>`MAX(${spans.durationMs})`,
      })
      .from(spans)
      .where(and(...conditions))
      .groupBy(spans.serviceName)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(config.limit);

    return result.map((r) => ({
      serviceName: r.serviceName,
      value:
        config.aggregation === 'count'
          ? r.count
          : config.aggregation === 'avg'
          ? r.avgDuration
          : config.aggregation === 'sum'
          ? r.sumDuration
          : config.aggregation === 'min'
          ? r.minDuration
          : r.maxDuration,
    }));
  }

  // Simple count
  const [result] = await db
    .select({
      count: sql<number>`COUNT(*)`,
      avgDuration: sql<number>`AVG(${spans.durationMs})`,
    })
    .from(spans)
    .where(and(...conditions));

  return [
    {
      value: config.aggregation === 'count' ? result?.count || 0 : result?.avgDuration || 0,
    },
  ];
}

async function executeLogsQuery(config: QueryConfig, projectId: string, startTime: Date) {
  const conditions = [
    eq(logs.projectId, projectId),
    gte(logs.timestamp, startTime),
  ];

  for (const filter of config.filters) {
    if (filter.field === 'serviceName') {
      switch (filter.operator) {
        case '=':
          conditions.push(eq(logs.serviceName, filter.value));
          break;
        case 'contains':
          conditions.push(like(logs.serviceName, `%${filter.value}%`));
          break;
      }
    } else if (filter.field === 'severityNumber') {
      conditions.push(eq(logs.severityNumber, parseInt(filter.value)));
    } else if (filter.field === 'body') {
      conditions.push(like(logs.body, `%${filter.value}%`));
    }
  }

  if (config.groupBy.length > 0 && config.groupBy.includes('serviceName')) {
    const result = await db
      .select({
        serviceName: logs.serviceName,
        count: sql<number>`COUNT(*)`,
      })
      .from(logs)
      .where(and(...conditions))
      .groupBy(logs.serviceName)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(config.limit);

    return result.map((r) => ({
      serviceName: r.serviceName,
      value: r.count,
    }));
  }

  if (config.groupBy.includes('severityText')) {
    const result = await db
      .select({
        severityText: logs.severityText,
        count: sql<number>`COUNT(*)`,
      })
      .from(logs)
      .where(and(...conditions))
      .groupBy(logs.severityText)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(config.limit);

    return result.map((r) => ({
      severityText: r.severityText,
      value: r.count,
    }));
  }

  const [result] = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(logs)
    .where(and(...conditions));

  return [{ value: result?.count || 0 }];
}

async function executeMetricsQuery(config: QueryConfig, projectId: string, startTime: Date) {
  const conditions = [
    eq(metrics.projectId, projectId),
    gte(metrics.timestamp, startTime),
  ];

  for (const filter of config.filters) {
    if (filter.field === 'name') {
      switch (filter.operator) {
        case '=':
          conditions.push(eq(metrics.metricName, filter.value));
          break;
        case 'contains':
          conditions.push(like(metrics.metricName, `%${filter.value}%`));
          break;
      }
    } else if (filter.field === 'type') {
      conditions.push(eq(metrics.metricType, filter.value));
    }
  }

  if (config.groupBy.length > 0 && config.groupBy.includes('name')) {
    const result = await db
      .select({
        name: metrics.metricName,
        count: sql<number>`COUNT(*)`,
        avgValue: sql<number>`AVG(${metrics.valueDouble})`,
        sumValue: sql<number>`SUM(${metrics.valueDouble})`,
        minValue: sql<number>`MIN(${metrics.valueDouble})`,
        maxValue: sql<number>`MAX(${metrics.valueDouble})`,
      })
      .from(metrics)
      .where(and(...conditions))
      .groupBy(metrics.metricName)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(config.limit);

    return result.map((r) => ({
      name: r.name,
      value:
        config.aggregation === 'count'
          ? r.count
          : config.aggregation === 'avg'
          ? r.avgValue
          : config.aggregation === 'sum'
          ? r.sumValue
          : config.aggregation === 'min'
          ? r.minValue
          : r.maxValue,
    }));
  }

  const [result] = await db
    .select({
      count: sql<number>`COUNT(*)`,
      avgValue: sql<number>`AVG(${metrics.valueDouble})`,
    })
    .from(metrics)
    .where(and(...conditions));

  return [
    {
      value: config.aggregation === 'count' ? result?.count || 0 : result?.avgValue || 0,
    },
  ];
}
