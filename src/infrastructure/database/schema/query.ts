import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
} from 'drizzle-orm/pg-core';
import { projects, users } from './identity';

export const savedQueries = pgTable('saved_queries', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  datasets: jsonb('datasets').notNull(),
  filters: jsonb('filters').notNull().default([]),
  aggregations: jsonb('aggregations').notNull().default([]),
  groupBy: jsonb('group_by').notNull().default([]),
  orderBy: jsonb('order_by').notNull().default([]),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').references(() => users.id),
});

export const dashboards = pgTable('dashboards', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  layout: jsonb('layout').notNull().default([]),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').references(() => users.id),
});

export const dashboardWidgets = pgTable('dashboard_widgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  dashboardId: uuid('dashboard_id')
    .notNull()
    .references(() => dashboards.id, { onDelete: 'cascade' }),
  queryId: uuid('query_id').references(() => savedQueries.id),
  title: varchar('title', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  config: jsonb('config').notNull().default({}),
  position: jsonb('position').notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Extended dashboards with additional features
export const dashboardsExtended = pgTable('dashboards_extended', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  layout: jsonb('layout').notNull().default([]),
  filters: jsonb('filters').notNull().default({}),
  timeRange: jsonb('time_range').notNull().default({ type: 'relative', value: '24h' }),
  refreshInterval: integer('refresh_interval'), // in seconds

  visibility: varchar('visibility', { length: 50 }).notNull().default('private'), // 'private', 'team', 'public'
  isDefault: boolean('is_default').default(false).notNull(),
  isTemplate: boolean('is_template').default(false).notNull(),
  templateCategory: varchar('template_category', { length: 100 }),

  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Extended dashboard widgets with additional features
export const dashboardWidgetsExtended = pgTable('dashboard_widgets_extended', {
  id: uuid('id').primaryKey().defaultRandom(),
  dashboardId: uuid('dashboard_id')
    .notNull()
    .references(() => dashboardsExtended.id, { onDelete: 'cascade' }),
  queryId: uuid('query_id').references(() => savedQueries.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 50 }).notNull(),
  config: jsonb('config').notNull().default({}),
  position: jsonb('position').notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const alerts = pgTable('alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  queryId: uuid('query_id').references(() => savedQueries.id),

  conditionType: varchar('condition_type', { length: 50 }).notNull(),
  threshold: jsonb('threshold'),

  notificationChannels: jsonb('notification_channels').notNull().default([]),

  enabled: boolean('enabled').default(true).notNull(),
  lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Extended alerts table with full alerting capabilities
export const alertsExtended = pgTable('alerts_extended', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  dataSource: varchar('data_source', { length: 50 }).notNull(), // 'metric', 'trace', 'log', 'error'
  queryConfig: jsonb('query_config').notNull().default({}),
  conditionType: varchar('condition_type', { length: 50 }).notNull(), // 'above', 'below', 'change_percent', 'anomaly', 'absence'
  threshold: jsonb('threshold').notNull().default({}),

  severity: varchar('severity', { length: 50 }).notNull().default('warning'), // 'info', 'warning', 'critical'
  notificationChannelIds: jsonb('notification_channel_ids').notNull().default([]),
  notificationMessage: text('notification_message'),
  evaluationInterval: integer('evaluation_interval').notNull().default(60), // in seconds

  enabled: boolean('enabled').default(true).notNull(),
  state: varchar('state', { length: 50 }).notNull().default('ok'), // 'ok', 'pending', 'firing', 'silenced'

  lastEvaluatedAt: timestamp('last_evaluated_at', { withTimezone: true }),
  lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
  firingStartedAt: timestamp('firing_started_at', { withTimezone: true }),

  labels: jsonb('labels').notNull().default({}),
  annotations: jsonb('annotations').notNull().default({}),

  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Alert history for tracking state changes
export const alertHistory = pgTable('alert_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  alertId: uuid('alert_id')
    .notNull()
    .references(() => alertsExtended.id, { onDelete: 'cascade' }),

  event: varchar('event', { length: 50 }).notNull(), // 'triggered', 'resolved', 'acknowledged', 'silenced'
  previousState: varchar('previous_state', { length: 50 }),
  newState: varchar('new_state', { length: 50 }),

  value: varchar('value', { length: 50 }),
  threshold: varchar('threshold', { length: 50 }),
  message: text('message'),

  triggeredBy: uuid('triggered_by').references(() => users.id),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
});

// Alert silences for temporarily muting alerts
export const alertSilences = pgTable('alert_silences', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  alertId: uuid('alert_id')
    .notNull()
    .references(() => alertsExtended.id, { onDelete: 'cascade' }),

  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  reason: text('reason'),

  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Notification channels for alert destinations
export const notificationChannels = pgTable('notification_channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),

  type: varchar('type', { length: 50 }).notNull(), // 'slack', 'email', 'webhook', 'pagerduty', 'opsgenie'
  name: varchar('name', { length: 255 }).notNull(),
  config: jsonb('config').notNull().default({}),

  enabled: boolean('enabled').default(true).notNull(),
  lastTestedAt: timestamp('last_tested_at', { withTimezone: true }),
  lastTestResult: varchar('last_test_result', { length: 50 }), // 'success', 'failed'

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const errorGroups = pgTable('error_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),

  fingerprint: varchar('fingerprint', { length: 64 }).notNull(),

  title: varchar('title', { length: 500 }).notNull(),
  type: varchar('type', { length: 255 }),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),

  eventCount: varchar('event_count', { length: 20 }).default('1').notNull(),

  status: varchar('status', { length: 50 }).default('active').notNull(),
  assignedTo: uuid('assigned_to').references(() => users.id),

  services: jsonb('services').notNull().default([]),
  tags: jsonb('tags').notNull().default([]),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type SavedQueryInsert = typeof savedQueries.$inferInsert;
export type SavedQuerySelect = typeof savedQueries.$inferSelect;

export type DashboardInsert = typeof dashboards.$inferInsert;
export type DashboardSelect = typeof dashboards.$inferSelect;

export type DashboardWidgetInsert = typeof dashboardWidgets.$inferInsert;
export type DashboardWidgetSelect = typeof dashboardWidgets.$inferSelect;

export type DashboardsExtendedInsert = typeof dashboardsExtended.$inferInsert;
export type DashboardsExtendedSelect = typeof dashboardsExtended.$inferSelect;

export type DashboardWidgetsExtendedInsert = typeof dashboardWidgetsExtended.$inferInsert;
export type DashboardWidgetsExtendedSelect = typeof dashboardWidgetsExtended.$inferSelect;

export type AlertInsert = typeof alerts.$inferInsert;
export type AlertSelect = typeof alerts.$inferSelect;

export type AlertsExtendedInsert = typeof alertsExtended.$inferInsert;
export type AlertsExtendedSelect = typeof alertsExtended.$inferSelect;

export type AlertHistoryInsert = typeof alertHistory.$inferInsert;
export type AlertHistorySelect = typeof alertHistory.$inferSelect;

export type AlertSilenceInsert = typeof alertSilences.$inferInsert;
export type AlertSilenceSelect = typeof alertSilences.$inferSelect;

export type NotificationChannelInsert = typeof notificationChannels.$inferInsert;
export type NotificationChannelSelect = typeof notificationChannels.$inferSelect;

export type ErrorGroupInsert = typeof errorGroups.$inferInsert;
export type ErrorGroupSelect = typeof errorGroups.$inferSelect;
