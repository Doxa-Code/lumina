import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  doublePrecision,
  bigint,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { projects } from './identity';

export const spans = pgTable(
  'spans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    traceId: varchar('trace_id', { length: 32 }).notNull(),
    spanId: varchar('span_id', { length: 16 }).notNull(),
    parentSpanId: varchar('parent_span_id', { length: 16 }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),

    serviceName: varchar('service_name', { length: 255 }).notNull(),
    serviceNamespace: varchar('service_namespace', { length: 255 }),
    serviceVersion: varchar('service_version', { length: 100 }),

    name: varchar('name', { length: 500 }).notNull(),
    kind: varchar('kind', { length: 20 }).notNull(),
    statusCode: varchar('status_code', { length: 20 }).notNull(),
    statusMessage: text('status_message'),

    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    durationMs: doublePrecision('duration_ms'),

    attributes: jsonb('attributes').notNull().default({}),
    resourceAttributes: jsonb('resource_attributes').notNull().default({}),
    events: jsonb('events').notNull().default([]),
    links: jsonb('links').notNull().default([]),

    ingestedAt: timestamp('ingested_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectTimeIdx: index('spans_project_time_idx').on(
      table.projectId,
      table.startTime
    ),
    traceIdx: index('spans_trace_idx').on(table.traceId),
    serviceIdx: index('spans_service_idx').on(
      table.projectId,
      table.serviceName,
      table.startTime
    ),
    statusIdx: index('spans_status_idx').on(
      table.projectId,
      table.statusCode,
      table.startTime
    ),
    projectTraceSpan: uniqueIndex('spans_project_trace_span_idx').on(
      table.projectId,
      table.traceId,
      table.spanId
    ),
  })
);

export const logs = pgTable(
  'logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),

    traceId: varchar('trace_id', { length: 32 }),
    spanId: varchar('span_id', { length: 16 }),

    serviceName: varchar('service_name', { length: 255 }).notNull(),
    serviceNamespace: varchar('service_namespace', { length: 255 }),

    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    observedTimestamp: timestamp('observed_timestamp', { withTimezone: true })
      .defaultNow()
      .notNull(),
    severityNumber: varchar('severity_number', { length: 10 }).notNull(),
    severityText: varchar('severity_text', { length: 20 }),
    body: text('body'),

    attributes: jsonb('attributes').notNull().default({}),
    resourceAttributes: jsonb('resource_attributes').notNull().default({}),

    ingestedAt: timestamp('ingested_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectTimeIdx: index('logs_project_time_idx').on(
      table.projectId,
      table.timestamp
    ),
    traceIdx: index('logs_trace_idx').on(table.traceId),
    serviceIdx: index('logs_service_idx').on(
      table.projectId,
      table.serviceName,
      table.timestamp
    ),
    severityIdx: index('logs_severity_idx').on(
      table.projectId,
      table.severityNumber,
      table.timestamp
    ),
  })
);

export const metrics = pgTable(
  'metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),

    serviceName: varchar('service_name', { length: 255 }).notNull(),
    metricName: varchar('metric_name', { length: 255 }).notNull(),
    metricType: varchar('metric_type', { length: 20 }).notNull(),
    unit: varchar('unit', { length: 50 }),
    description: text('description'),

    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),

    valueInt: bigint('value_int', { mode: 'number' }),
    valueDouble: doublePrecision('value_double'),

    histogramCount: bigint('histogram_count', { mode: 'number' }),
    histogramSum: doublePrecision('histogram_sum'),
    histogramBuckets: jsonb('histogram_buckets'),

    attributes: jsonb('attributes').notNull().default({}),
    resourceAttributes: jsonb('resource_attributes').notNull().default({}),

    ingestedAt: timestamp('ingested_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectNameTimeIdx: index('metrics_project_name_time_idx').on(
      table.projectId,
      table.metricName,
      table.timestamp
    ),
    serviceIdx: index('metrics_service_idx').on(
      table.projectId,
      table.serviceName,
      table.timestamp
    ),
  })
);

// Service dependencies for service map
export const serviceDependencies = pgTable(
  'service_dependencies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    sourceService: varchar('source_service', { length: 255 }).notNull(),
    targetService: varchar('target_service', { length: 255 }).notNull(),

    requestCount: bigint('request_count', { mode: 'number' }).notNull().default(0),
    errorCount: bigint('error_count', { mode: 'number' }).notNull().default(0),
    avgLatencyMs: varchar('avg_latency_ms', { length: 50 }),
    p99LatencyMs: varchar('p99_latency_ms', { length: 50 }),

    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectServiceIdx: index('service_dependencies_project_service_idx').on(
      table.projectId,
      table.sourceService,
      table.targetService
    ),
  })
);

export type SpanInsert = typeof spans.$inferInsert;
export type SpanSelect = typeof spans.$inferSelect;

export type LogInsert = typeof logs.$inferInsert;
export type LogSelect = typeof logs.$inferSelect;

export type MetricInsert = typeof metrics.$inferInsert;
export type MetricSelect = typeof metrics.$inferSelect;

export type ServiceDependencyInsert = typeof serviceDependencies.$inferInsert;
export type ServiceDependencySelect = typeof serviceDependencies.$inferSelect;
