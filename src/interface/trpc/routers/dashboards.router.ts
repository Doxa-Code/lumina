import { z } from 'zod';
import { router, projectProcedure } from '../trpc.js';
import { db } from '../../../infrastructure/database/connection.js';
import { dashboardsExtended, dashboardWidgetsExtended, spans, logs, metrics, alertsExtended } from '../../../infrastructure/database/schema/index.js';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';

// ============================================
// ZOD SCHEMAS
// ============================================

const widgetTypeSchema = z.enum([
  'metric_timeseries',
  'metric_gauge',
  'metric_stat',
  'trace_list',
  'trace_latency',
  'log_stream',
  'log_severity',
  'error_rate',
  'service_map',
  'heatmap',
  'slo_status',
  'alert_list',
  'markdown',
]);

const widgetPositionSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  w: z.number().min(1),
  h: z.number().min(1),
  minW: z.number().min(1).optional(),
  minH: z.number().min(1).optional(),
  maxW: z.number().optional(),
  maxH: z.number().optional(),
});

const timeRangeSchema = z.union([
  z.object({
    type: z.literal('relative'),
    value: z.enum(['15m', '1h', '6h', '12h', '24h', '7d', '30d']),
  }),
  z.object({
    type: z.literal('absolute'),
    from: z.string().datetime(),
    to: z.string().datetime(),
  }),
]);

// Widget config schemas for different types
const metricTimeseriesConfigSchema = z.object({
  metricName: z.string(),
  aggregation: z.enum(['avg', 'sum', 'min', 'max', 'count']).default('avg'),
  groupBy: z.array(z.string()).optional(),
  filters: z.record(z.string()).optional(),
});

const metricGaugeConfigSchema = z.object({
  metricName: z.string(),
  aggregation: z.enum(['avg', 'sum', 'min', 'max', 'count']).default('avg'),
  thresholds: z.array(z.object({
    value: z.number(),
    color: z.string(),
  })).optional(),
});

const metricStatConfigSchema = z.object({
  metricName: z.string(),
  aggregation: z.enum(['avg', 'sum', 'min', 'max', 'count']).default('avg'),
  unit: z.string().optional(),
  format: z.string().optional(),
});

const traceListConfigSchema = z.object({
  serviceName: z.string().optional(),
  statusCode: z.enum(['UNSET', 'OK', 'ERROR']).optional(),
  minDuration: z.number().optional(),
  maxDuration: z.number().optional(),
  limit: z.number().min(1).max(100).default(50),
  filters: z.record(z.string()).optional(),
});

const traceLatencyConfigSchema = z.object({
  serviceName: z.string().optional(),
  percentiles: z.array(z.number().min(0).max(100)).default([50, 95, 99]),
  groupBy: z.string().optional(),
});

const logStreamConfigSchema = z.object({
  serviceName: z.string().optional(),
  severityNumber: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(1000).default(100),
  filters: z.record(z.string()).optional(),
});

const logSeverityConfigSchema = z.object({
  serviceName: z.string().optional(),
  groupBy: z.enum(['severity', 'service', 'time']).default('severity'),
});

const errorRateConfigSchema = z.object({
  serviceName: z.string().optional(),
  interval: z.enum(['1m', '5m', '15m', '1h']).default('5m'),
});

const serviceMapConfigSchema = z.object({
  services: z.array(z.string()).optional(),
  showMetrics: z.boolean().default(true),
});

const heatmapConfigSchema = z.object({
  metricName: z.string(),
  xAxis: z.string(),
  yAxis: z.string(),
});

const sloStatusConfigSchema = z.object({
  sloIds: z.array(z.string()).optional(),
  showErrorBudget: z.boolean().default(true),
});

const alertListConfigSchema = z.object({
  states: z.array(z.enum(['ok', 'pending', 'firing', 'silenced'])).optional(),
  severities: z.array(z.enum(['info', 'warning', 'critical'])).optional(),
  limit: z.number().min(1).max(100).default(20),
});

const markdownConfigSchema = z.object({
  content: z.string(),
});

const widgetConfigSchema = z.union([
  metricTimeseriesConfigSchema,
  metricGaugeConfigSchema,
  metricStatConfigSchema,
  traceListConfigSchema,
  traceLatencyConfigSchema,
  logStreamConfigSchema,
  logSeverityConfigSchema,
  errorRateConfigSchema,
  serviceMapConfigSchema,
  heatmapConfigSchema,
  sloStatusConfigSchema,
  alertListConfigSchema,
  markdownConfigSchema,
]);

// ============================================
// DASHBOARD CRUD
// ============================================

export const dashboardsRouter = router({
  list: projectProcedure
    .input(
      z.object({
        visibility: z.enum(['private', 'team', 'public']).optional(),
        isTemplate: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      const conditions = [eq(dashboardsExtended.projectId, projectId)];

      if (input.visibility) {
        conditions.push(eq(dashboardsExtended.visibility, input.visibility));
      }

      if (input.isTemplate !== undefined) {
        conditions.push(eq(dashboardsExtended.isTemplate, input.isTemplate));
      }

      const dashboards = await db
        .select({
          id: dashboardsExtended.id,
          name: dashboardsExtended.name,
          description: dashboardsExtended.description,
          visibility: dashboardsExtended.visibility,
          isDefault: dashboardsExtended.isDefault,
          isTemplate: dashboardsExtended.isTemplate,
          templateCategory: dashboardsExtended.templateCategory,
          timeRange: dashboardsExtended.timeRange,
          refreshInterval: dashboardsExtended.refreshInterval,
          createdAt: dashboardsExtended.createdAt,
          updatedAt: dashboardsExtended.updatedAt,
        })
        .from(dashboardsExtended)
        .where(and(...conditions))
        .orderBy(
          desc(dashboardsExtended.isDefault),
          desc(dashboardsExtended.updatedAt)
        );

      return dashboards.map((d) => ({
        ...d,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      }));
    }),

  get: projectProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      const dashboard = await db
        .select()
        .from(dashboardsExtended)
        .where(
          and(
            eq(dashboardsExtended.projectId, projectId),
            eq(dashboardsExtended.id, input.id)
          )
        )
        .limit(1);

      if (dashboard.length === 0) {
        return null;
      }

      const widgets = await db
        .select()
        .from(dashboardWidgetsExtended)
        .where(eq(dashboardWidgetsExtended.dashboardId, input.id))
        .orderBy(dashboardWidgetsExtended.createdAt);

      return {
        ...dashboard[0],
        createdAt: dashboard[0].createdAt.toISOString(),
        updatedAt: dashboard[0].updatedAt.toISOString(),
        widgets: widgets.map((w) => ({
          ...w,
          createdAt: w.createdAt.toISOString(),
          updatedAt: (w as any).updatedAt?.toISOString() ?? w.createdAt.toISOString(),
        })),
      };
    }),

  create: projectProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        filters: z.record(z.any()).optional(),
        timeRange: timeRangeSchema.optional(),
        refreshInterval: z.number().min(0).optional(),
        visibility: z.enum(['private', 'team', 'public']).default('private'),
        isDefault: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;
      const userId = ctx.user!.id;

      const [dashboard] = await db
        .insert(dashboardsExtended)
        .values({
          projectId,
          createdBy: userId,
          name: input.name,
          description: input.description,
          filters: input.filters || {},
          timeRange: input.timeRange || { type: 'relative', value: '24h' },
          refreshInterval: input.refreshInterval,
          visibility: input.visibility,
          isDefault: input.isDefault,
          layout: [],
        })
        .returning();

      return {
        ...dashboard,
        createdAt: dashboard.createdAt.toISOString(),
        updatedAt: dashboard.updatedAt.toISOString(),
      };
    }),

  update: projectProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        filters: z.record(z.any()).optional(),
        timeRange: timeRangeSchema.optional(),
        refreshInterval: z.number().min(0).optional(),
        visibility: z.enum(['private', 'team', 'public']).optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;
      const { id, ...updateData } = input;

      const updateValues: any = {
        updatedAt: new Date(),
      };

      if (updateData.name !== undefined) updateValues.name = updateData.name;
      if (updateData.description !== undefined) updateValues.description = updateData.description;
      if (updateData.filters !== undefined) updateValues.filters = updateData.filters;
      if (updateData.timeRange !== undefined) updateValues.timeRange = updateData.timeRange;
      if (updateData.refreshInterval !== undefined) updateValues.refreshInterval = updateData.refreshInterval;
      if (updateData.visibility !== undefined) updateValues.visibility = updateData.visibility;
      if (updateData.isDefault !== undefined) updateValues.isDefault = updateData.isDefault;

      const [dashboard] = await db
        .update(dashboardsExtended)
        .set(updateValues)
        .where(
          and(
            eq(dashboardsExtended.projectId, projectId),
            eq(dashboardsExtended.id, id)
          )
        )
        .returning();

      if (!dashboard) {
        throw new Error('Dashboard not found');
      }

      return {
        ...dashboard,
        createdAt: dashboard.createdAt.toISOString(),
        updatedAt: dashboard.updatedAt.toISOString(),
      };
    }),

  delete: projectProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      await db
        .delete(dashboardsExtended)
        .where(
          and(
            eq(dashboardsExtended.projectId, projectId),
            eq(dashboardsExtended.id, input.id)
          )
        );

      return { success: true };
    }),

  duplicate: projectProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;
      const userId = ctx.user!.id;

      // Get original dashboard
      const [original] = await db
        .select()
        .from(dashboardsExtended)
        .where(
          and(
            eq(dashboardsExtended.projectId, projectId),
            eq(dashboardsExtended.id, input.id)
          )
        )
        .limit(1);

      if (!original) {
        throw new Error('Dashboard not found');
      }

      // Create duplicate dashboard
      const [newDashboard] = await db
        .insert(dashboardsExtended)
        .values({
          projectId,
          createdBy: userId,
          name: input.name,
          description: original.description,
          layout: original.layout,
          filters: original.filters,
          timeRange: original.timeRange,
          refreshInterval: original.refreshInterval,
          visibility: original.visibility,
          isDefault: false,
          isTemplate: false,
          templateCategory: null,
        })
        .returning();

      // Get original widgets
      const originalWidgets = await db
        .select()
        .from(dashboardWidgetsExtended)
        .where(eq(dashboardWidgetsExtended.dashboardId, input.id));

      // Duplicate widgets
      if (originalWidgets.length > 0) {
        await db.insert(dashboardWidgetsExtended).values(
          originalWidgets.map((w) => ({
            dashboardId: newDashboard.id,
            type: w.type,
            title: w.title,
            description: w.description,
            config: w.config,
            position: w.position,
            queryId: w.queryId,
          }))
        );
      }

      return {
        ...newDashboard,
        createdAt: newDashboard.createdAt.toISOString(),
        updatedAt: newDashboard.updatedAt.toISOString(),
      };
    }),

  // ============================================
  // WIDGET OPERATIONS
  // ============================================

  addWidget: projectProcedure
    .input(
      z.object({
        dashboardId: z.string().uuid(),
        type: widgetTypeSchema,
        title: z.string().max(255).optional(),
        description: z.string().optional(),
        config: z.record(z.any()),
        position: widgetPositionSchema,
        queryId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      // Verify dashboard exists and belongs to project
      const [dashboard] = await db
        .select()
        .from(dashboardsExtended)
        .where(
          and(
            eq(dashboardsExtended.projectId, projectId),
            eq(dashboardsExtended.id, input.dashboardId)
          )
        )
        .limit(1);

      if (!dashboard) {
        throw new Error('Dashboard not found');
      }

      const [widget] = await db
        .insert(dashboardWidgetsExtended)
        .values({
          dashboardId: input.dashboardId,
          type: input.type,
          title: input.title,
          description: input.description ?? null,
          config: input.config,
          position: input.position,
          queryId: input.queryId ?? null,
        } as any)
        .returning();

      // Update dashboard's updatedAt
      await db
        .update(dashboardsExtended)
        .set({ updatedAt: new Date() })
        .where(eq(dashboardsExtended.id, input.dashboardId));

      return {
        ...widget,
        createdAt: widget.createdAt.toISOString(),
        updatedAt: (widget as any).updatedAt?.toISOString() ?? widget.createdAt.toISOString(),
      };
    }),

  updateWidget: projectProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().max(255).optional(),
        description: z.string().optional(),
        config: z.record(z.any()).optional(),
        position: widgetPositionSchema.optional(),
        queryId: z.string().uuid().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;
      const { id, ...updateData } = input;

      // Get widget and verify it belongs to project's dashboard
      const [widget] = await db
        .select({
          widget: dashboardWidgetsExtended,
          dashboardId: dashboardsExtended.id,
        })
        .from(dashboardWidgetsExtended)
        .innerJoin(
          dashboardsExtended,
          eq(dashboardWidgetsExtended.dashboardId, dashboardsExtended.id)
        )
        .where(
          and(
            eq(dashboardWidgetsExtended.id, id),
            eq(dashboardsExtended.projectId, projectId)
          )
        )
        .limit(1);

      if (!widget) {
        throw new Error('Widget not found');
      }

      const updateValues: any = {
        updatedAt: new Date(),
      };

      if (updateData.title !== undefined) updateValues.title = updateData.title;
      if (updateData.description !== undefined) updateValues.description = updateData.description;
      if (updateData.config !== undefined) updateValues.config = updateData.config;
      if (updateData.position !== undefined) updateValues.position = updateData.position;
      if (updateData.queryId !== undefined) updateValues.queryId = updateData.queryId;

      const [updated] = await db
        .update(dashboardWidgetsExtended)
        .set(updateValues)
        .where(eq(dashboardWidgetsExtended.id, id))
        .returning();

      // Update dashboard's updatedAt
      await db
        .update(dashboardsExtended)
        .set({ updatedAt: new Date() })
        .where(eq(dashboardsExtended.id, widget.dashboardId));

      return {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: (updated as any).updatedAt?.toISOString() ?? updated.createdAt.toISOString(),
      };
    }),

  removeWidget: projectProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      // Get widget and verify it belongs to project's dashboard
      const [widget] = await db
        .select({
          dashboardId: dashboardsExtended.id,
        })
        .from(dashboardWidgetsExtended)
        .innerJoin(
          dashboardsExtended,
          eq(dashboardWidgetsExtended.dashboardId, dashboardsExtended.id)
        )
        .where(
          and(
            eq(dashboardWidgetsExtended.id, input.id),
            eq(dashboardsExtended.projectId, projectId)
          )
        )
        .limit(1);

      if (!widget) {
        throw new Error('Widget not found');
      }

      await db
        .delete(dashboardWidgetsExtended)
        .where(eq(dashboardWidgetsExtended.id, input.id));

      // Update dashboard's updatedAt
      await db
        .update(dashboardsExtended)
        .set({ updatedAt: new Date() })
        .where(eq(dashboardsExtended.id, widget.dashboardId));

      return { success: true };
    }),

  updateLayout: projectProcedure
    .input(
      z.object({
        dashboardId: z.string().uuid(),
        widgets: z.array(
          z.object({
            id: z.string().uuid(),
            position: widgetPositionSchema,
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      // Verify dashboard exists and belongs to project
      const [dashboard] = await db
        .select()
        .from(dashboardsExtended)
        .where(
          and(
            eq(dashboardsExtended.projectId, projectId),
            eq(dashboardsExtended.id, input.dashboardId)
          )
        )
        .limit(1);

      if (!dashboard) {
        throw new Error('Dashboard not found');
      }

      // Update each widget's position
      for (const widget of input.widgets) {
        await db
          .update(dashboardWidgetsExtended)
          .set({
            position: widget.position,
          })
          .where(
            and(
              eq(dashboardWidgetsExtended.id, widget.id),
              eq(dashboardWidgetsExtended.dashboardId, input.dashboardId)
            )
          );
      }

      // Update dashboard's updatedAt
      await db
        .update(dashboardsExtended)
        .set({ updatedAt: new Date() })
        .where(eq(dashboardsExtended.id, input.dashboardId));

      return { success: true };
    }),

  // ============================================
  // WIDGET DATA
  // ============================================

  getWidgetData: projectProcedure
    .input(
      z.object({
        widgetId: z.string().uuid(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;

      // Get widget and verify it belongs to project's dashboard
      const [widget] = await db
        .select({
          widget: dashboardWidgetsExtended,
          dashboard: dashboardsExtended,
        })
        .from(dashboardWidgetsExtended)
        .innerJoin(
          dashboardsExtended,
          eq(dashboardWidgetsExtended.dashboardId, dashboardsExtended.id)
        )
        .where(
          and(
            eq(dashboardWidgetsExtended.id, input.widgetId),
            eq(dashboardsExtended.projectId, projectId)
          )
        )
        .limit(1);

      if (!widget) {
        throw new Error('Widget not found');
      }

      const { type, config } = widget.widget;
      const timeRange = widget.dashboard.timeRange as any;

      // Calculate time bounds
      let from: Date;
      let to: Date;

      if (input.from && input.to) {
        from = new Date(input.from);
        to = new Date(input.to);
      } else if (timeRange.type === 'relative') {
        to = new Date();
        const value = timeRange.value;
        const match = value.match(/^(\d+)([mhd])$/);
        if (match) {
          const amount = parseInt(match[1]);
          const unit = match[2];
          from = new Date(to);
          switch (unit) {
            case 'm':
              from.setMinutes(from.getMinutes() - amount);
              break;
            case 'h':
              from.setHours(from.getHours() - amount);
              break;
            case 'd':
              from.setDate(from.getDate() - amount);
              break;
          }
        } else {
          from = new Date(to.getTime() - 24 * 60 * 60 * 1000); // default 24h
        }
      } else if (timeRange.type === 'absolute') {
        from = new Date(timeRange.from);
        to = new Date(timeRange.to);
      } else {
        to = new Date();
        from = new Date(to.getTime() - 24 * 60 * 60 * 1000); // default 24h
      }

      // Fetch data based on widget type
      switch (type) {
        case 'metric_timeseries':
        case 'metric_gauge':
        case 'metric_stat': {
          const cfg = config as z.infer<typeof metricTimeseriesConfigSchema>;
          const conditions = [
            eq(metrics.projectId, projectId),
            eq(metrics.metricName, cfg.metricName),
            gte(metrics.timestamp, from),
            lte(metrics.timestamp, to),
          ];

          const result = await db
            .select({
              timestamp: metrics.timestamp,
              value: sql<number>`COALESCE(${metrics.valueDouble}, ${metrics.valueInt})`,
            })
            .from(metrics)
            .where(and(...conditions))
            .orderBy(metrics.timestamp);

          return result.map((r) => ({
            timestamp: r.timestamp.toISOString(),
            value: r.value,
          }));
        }

        case 'trace_list': {
          const cfg = config as z.infer<typeof traceListConfigSchema>;
          const conditions = [
            eq(spans.projectId, projectId),
            gte(spans.startTime, from),
            lte(spans.startTime, to),
            sql`${spans.parentSpanId} IS NULL`,
          ];

          if (cfg.serviceName) {
            conditions.push(eq(spans.serviceName, cfg.serviceName));
          }
          if (cfg.statusCode) {
            conditions.push(eq(spans.statusCode, cfg.statusCode));
          }
          if (cfg.minDuration) {
            conditions.push(gte(spans.durationMs, cfg.minDuration));
          }
          if (cfg.maxDuration) {
            conditions.push(lte(spans.durationMs, cfg.maxDuration));
          }

          const result = await db
            .select()
            .from(spans)
            .where(and(...conditions))
            .orderBy(desc(spans.startTime))
            .limit(cfg.limit || 50);

          return result.map((s) => ({
            id: s.id,
            traceId: s.traceId,
            serviceName: s.serviceName,
            name: s.name,
            statusCode: s.statusCode,
            startTime: s.startTime.toISOString(),
            endTime: s.endTime.toISOString(),
            durationMs: s.durationMs,
          }));
        }

        case 'trace_latency': {
          const cfg = config as z.infer<typeof traceLatencyConfigSchema>;
          const conditions = [
            eq(spans.projectId, projectId),
            gte(spans.startTime, from),
            lte(spans.startTime, to),
            sql`${spans.parentSpanId} IS NULL`,
          ];

          if (cfg.serviceName) {
            conditions.push(eq(spans.serviceName, cfg.serviceName));
          }

          const percentiles = cfg.percentiles || [50, 95, 99];
          const percentileQueries = percentiles.map((p) =>
            sql`percentile_cont(${p / 100}) within group (order by ${spans.durationMs}) as p${p}`
          );

          const result = await db
            .select({
              avgDuration: sql<number>`avg(${spans.durationMs})`,
              ...Object.fromEntries(
                percentiles.map((p, i) => [`p${p}`, percentileQueries[i]])
              ),
            })
            .from(spans)
            .where(and(...conditions));

          return result[0];
        }

        case 'log_stream': {
          const cfg = config as z.infer<typeof logStreamConfigSchema>;
          const conditions = [
            eq(logs.projectId, projectId),
            gte(logs.timestamp, from),
            lte(logs.timestamp, to),
          ];

          if (cfg.serviceName) {
            conditions.push(eq(logs.serviceName, cfg.serviceName));
          }
          if (cfg.severityNumber) {
            conditions.push(eq(logs.severityNumber, cfg.severityNumber));
          }

          const result = await db
            .select()
            .from(logs)
            .where(and(...conditions))
            .orderBy(desc(logs.timestamp))
            .limit(cfg.limit || 100);

          return result.map((l) => ({
            id: l.id,
            timestamp: l.timestamp.toISOString(),
            severityNumber: l.severityNumber,
            severityText: l.severityText,
            body: l.body,
            serviceName: l.serviceName,
            attributes: l.attributes,
          }));
        }

        case 'log_severity': {
          const cfg = config as z.infer<typeof logSeverityConfigSchema>;
          const conditions = [
            eq(logs.projectId, projectId),
            gte(logs.timestamp, from),
            lte(logs.timestamp, to),
          ];

          if (cfg.serviceName) {
            conditions.push(eq(logs.serviceName, cfg.serviceName));
          }

          if (cfg.groupBy === 'severity') {
            const result = await db
              .select({
                severity: logs.severityNumber,
                count: sql<number>`count(*)`,
              })
              .from(logs)
              .where(and(...conditions))
              .groupBy(logs.severityNumber)
              .orderBy(logs.severityNumber);

            return result.map((r) => ({
              severity: r.severity,
              count: Number(r.count),
            }));
          } else if (cfg.groupBy === 'service') {
            const result = await db
              .select({
                service: logs.serviceName,
                count: sql<number>`count(*)`,
              })
              .from(logs)
              .where(and(...conditions))
              .groupBy(logs.serviceName)
              .orderBy(desc(sql`count(*)`));

            return result.map((r) => ({
              service: r.service,
              count: Number(r.count),
            }));
          }

          return [];
        }

        case 'error_rate': {
          const cfg = config as z.infer<typeof errorRateConfigSchema>;
          const conditions = [
            eq(spans.projectId, projectId),
            gte(spans.startTime, from),
            lte(spans.startTime, to),
          ];

          if (cfg.serviceName) {
            conditions.push(eq(spans.serviceName, cfg.serviceName));
          }

          const intervalMap: Record<string, string> = {
            '1m': '1 minute',
            '5m': '5 minutes',
            '15m': '15 minutes',
            '1h': '1 hour',
          };

          const interval = intervalMap[cfg.interval] || '5 minutes';

          const result = await db.execute(sql`
            SELECT
              date_trunc('${sql.raw(interval.split(' ')[1])}', ${spans.startTime}) as bucket,
              count(*) as total,
              count(*) filter (where ${spans.statusCode} = 'ERROR') as errors
            FROM ${spans}
            WHERE ${and(...conditions)}
            GROUP BY bucket
            ORDER BY bucket
          `);

          return (result as unknown as Array<{ bucket: Date; total: number; errors: number }>).map((r) => ({
            timestamp: r.bucket.toISOString(),
            total: Number(r.total),
            errors: Number(r.errors),
            errorRate: r.total > 0 ? (Number(r.errors) / Number(r.total)) * 100 : 0,
          }));
        }

        case 'alert_list': {
          const cfg = config as z.infer<typeof alertListConfigSchema>;
          const conditions = [eq(alertsExtended.projectId, projectId)];

          if (cfg.states && cfg.states.length > 0) {
            conditions.push(
              sql`${alertsExtended.state} = ANY(${cfg.states})`
            );
          }

          if (cfg.severities && cfg.severities.length > 0) {
            conditions.push(
              sql`${alertsExtended.severity} = ANY(${cfg.severities})`
            );
          }

          const result = await db
            .select()
            .from(alertsExtended)
            .where(and(...conditions))
            .orderBy(desc(alertsExtended.lastTriggeredAt))
            .limit(cfg.limit || 20);

          return result.map((a) => ({
            id: a.id,
            name: a.name,
            severity: a.severity,
            state: a.state,
            lastTriggeredAt: a.lastTriggeredAt?.toISOString(),
            lastEvaluatedAt: a.lastEvaluatedAt?.toISOString(),
          }));
        }

        case 'markdown': {
          const cfg = config as z.infer<typeof markdownConfigSchema>;
          return { content: cfg.content };
        }

        case 'service_map':
        case 'heatmap':
        case 'slo_status':
        default:
          return { message: 'Widget type not yet implemented' };
      }
    }),

  // ============================================
  // TEMPLATES
  // ============================================

  listTemplates: projectProcedure.query(async ({ ctx }) => {
    const projectId = ctx.project!.id;

    const templates = await db
      .select({
        id: dashboardsExtended.id,
        name: dashboardsExtended.name,
        description: dashboardsExtended.description,
        templateCategory: dashboardsExtended.templateCategory,
        createdAt: dashboardsExtended.createdAt,
      })
      .from(dashboardsExtended)
      .where(
        and(
          eq(dashboardsExtended.projectId, projectId),
          eq(dashboardsExtended.isTemplate, true)
        )
      )
      .orderBy(dashboardsExtended.templateCategory, dashboardsExtended.name);

    return templates.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
    }));
  }),

  createFromTemplate: projectProcedure
    .input(
      z.object({
        templateId: z.string().uuid(),
        name: z.string().min(1).max(255),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const projectId = ctx.project!.id;
      const userId = ctx.user!.id;

      // Get template dashboard
      const [template] = await db
        .select()
        .from(dashboardsExtended)
        .where(
          and(
            eq(dashboardsExtended.projectId, projectId),
            eq(dashboardsExtended.id, input.templateId),
            eq(dashboardsExtended.isTemplate, true)
          )
        )
        .limit(1);

      if (!template) {
        throw new Error('Template not found');
      }

      // Create new dashboard from template
      const [newDashboard] = await db
        .insert(dashboardsExtended)
        .values({
          projectId,
          createdBy: userId,
          name: input.name,
          description: template.description,
          layout: template.layout,
          filters: template.filters,
          timeRange: template.timeRange,
          refreshInterval: template.refreshInterval,
          visibility: 'private',
          isDefault: false,
          isTemplate: false,
          templateCategory: null,
        })
        .returning();

      // Get template widgets
      const templateWidgets = await db
        .select()
        .from(dashboardWidgetsExtended)
        .where(eq(dashboardWidgetsExtended.dashboardId, input.templateId));

      // Copy widgets
      if (templateWidgets.length > 0) {
        await db.insert(dashboardWidgetsExtended).values(
          templateWidgets.map((w) => ({
            dashboardId: newDashboard.id,
            type: w.type,
            title: w.title,
            description: w.description,
            config: w.config,
            position: w.position,
            queryId: w.queryId,
          }))
        );
      }

      return {
        ...newDashboard,
        createdAt: newDashboard.createdAt.toISOString(),
        updatedAt: newDashboard.updatedAt.toISOString(),
      };
    }),
});
