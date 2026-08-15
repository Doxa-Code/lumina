# Baselime - Roadmap de Features

## Visão Geral

Este documento define o plano de implementação para 4 áreas críticas de features:
1. **Sistema de Dashboards** - Builder visual com widgets customizáveis
2. **Insights Automáticos** - Detecção de anomalias, SLOs e correlações
3. **Visualizações Avançadas** - Flame graphs, heatmaps, service maps
4. **Sistema de Alertas** - Engine de execução e notificações

---

## 1. Sistema de Dashboards

### 1.1 Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    Dashboard Builder                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Widget  │  │ Widget  │  │ Widget  │  │ Widget  │        │
│  │ Metrics │  │ Traces  │  │  Logs   │  │ Custom  │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
├─────────────────────────────────────────────────────────────┤
│              Grid Layout (react-grid-layout)                 │
├─────────────────────────────────────────────────────────────┤
│              Dashboard State (Zustand + DB)                  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Schema do Banco (já parcialmente existe)

```typescript
// Extensões necessárias ao schema existente
dashboards = pgTable('dashboards', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  layout: jsonb('layout').$type<GridLayout>(), // posições dos widgets
  filters: jsonb('filters').$type<DashboardFilters>(), // filtros globais
  timeRange: jsonb('time_range').$type<TimeRange>(), // range padrão
  refreshInterval: integer('refresh_interval'), // auto-refresh em segundos
  isDefault: boolean('is_default').default(false),
  visibility: varchar('visibility', { length: 20 }).default('private'), // private, team, public
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

dashboardWidgets = pgTable('dashboard_widgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  dashboardId: uuid('dashboard_id').notNull().references(() => dashboards.id),
  type: varchar('type', { length: 50 }).notNull(), // metric_chart, trace_list, log_stream, etc.
  title: varchar('title', { length: 255 }),
  config: jsonb('config').$type<WidgetConfig>(), // configuração específica do widget
  position: jsonb('position').$type<{ x: number; y: number; w: number; h: number }>(),
  queryId: uuid('query_id').references(() => savedQueries.id), // query associada
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### 1.3 Tipos de Widgets

| Widget | Descrição | Fontes de Dados |
|--------|-----------|-----------------|
| `metric_timeseries` | Gráfico de linha/área temporal | Métricas |
| `metric_gauge` | Medidor circular | Métricas |
| `metric_stat` | Número grande com variação | Métricas |
| `trace_list` | Lista de traces recentes | Traces |
| `trace_latency` | P50/P95/P99 ao longo do tempo | Traces |
| `log_stream` | Stream de logs em tempo real | Logs |
| `log_severity` | Distribuição por severidade | Logs |
| `error_rate` | Taxa de erros | Traces/Errors |
| `service_map` | Mapa de dependências | Traces |
| `heatmap` | Heatmap de latência | Traces/Metrics |
| `slo_status` | Status de SLOs | Custom |
| `alert_list` | Alertas ativos | Alerts |
| `markdown` | Texto/notas | - |

### 1.4 Componentes Frontend

```
src/web/
├── pages/dashboards/
│   ├── DashboardsPage.tsx        # Lista de dashboards
│   ├── DashboardViewPage.tsx     # Visualização de dashboard
│   └── DashboardEditPage.tsx     # Editor de dashboard
│
├── components/dashboards/
│   ├── DashboardGrid.tsx         # Grid layout com drag-and-drop
│   ├── WidgetContainer.tsx       # Container de widget com header
│   ├── WidgetPicker.tsx          # Modal para adicionar widgets
│   ├── WidgetConfigPanel.tsx     # Painel de configuração
│   │
│   └── widgets/
│       ├── MetricTimeseriesWidget.tsx
│       ├── MetricGaugeWidget.tsx
│       ├── MetricStatWidget.tsx
│       ├── TraceListWidget.tsx
│       ├── TraceLatencyWidget.tsx
│       ├── LogStreamWidget.tsx
│       ├── LogSeverityWidget.tsx
│       ├── ErrorRateWidget.tsx
│       ├── ServiceMapWidget.tsx
│       ├── HeatmapWidget.tsx
│       ├── SloStatusWidget.tsx
│       ├── AlertListWidget.tsx
│       └── MarkdownWidget.tsx
```

### 1.5 API (tRPC Router)

```typescript
// src/interface/trpc/routers/dashboards.router.ts
dashboards.router({
  // CRUD
  list: () => Dashboard[],
  get: (dashboardId) => Dashboard & { widgets: Widget[] },
  create: (input) => Dashboard,
  update: (dashboardId, input) => Dashboard,
  delete: (dashboardId) => void,
  duplicate: (dashboardId, newName) => Dashboard,

  // Widgets
  addWidget: (dashboardId, widgetConfig) => Widget,
  updateWidget: (widgetId, config) => Widget,
  removeWidget: (widgetId) => void,
  reorderWidgets: (dashboardId, layout) => void,

  // Data
  getWidgetData: (widgetId, timeRange) => WidgetData,

  // Sharing
  share: (dashboardId, visibility, sharedWith) => void,
})
```

### 1.6 Features do Dashboard Builder

- [ ] **Grid Layout**: Drag-and-drop com react-grid-layout
- [ ] **Auto-refresh**: Intervalo configurável (off, 10s, 30s, 1m, 5m)
- [ ] **Time Range Global**: Aplica a todos os widgets
- [ ] **Filtros Globais**: Serviço, ambiente, tags
- [ ] **Templates**: Dashboards pré-configurados (Overview, Errors, Performance)
- [ ] **Export/Import**: JSON para backup/compartilhamento
- [ ] **Fullscreen Mode**: Modo TV para monitores
- [ ] **Variables**: Variáveis dinâmicas ($service, $env)

---

## 2. Insights Automáticos

### 2.1 Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    Insights Engine                           │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Anomaly    │  │     SLO      │  │  Correlation │      │
│  │  Detector    │  │   Tracker    │  │   Analyzer   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
├─────────────────────────────────────────────────────────────┤
│              Background Job Processor (cron)                 │
├─────────────────────────────────────────────────────────────┤
│              insights, slos, correlations (tables)           │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Tipos de Insights

| Tipo | Descrição | Trigger |
|------|-----------|---------|
| `anomaly_spike` | Spike inesperado em métrica | Automático |
| `anomaly_drop` | Queda inesperada | Automático |
| `error_burst` | Aumento súbito de erros | Automático |
| `latency_degradation` | P99 acima do normal | Automático |
| `new_error_type` | Novo tipo de erro detectado | Automático |
| `service_dependency_issue` | Problema em serviço downstream | Automático |
| `slo_breach` | SLO violado | Threshold |
| `slo_burn_rate` | SLO queimando rápido demais | Cálculo |
| `correlation_found` | Correlação entre eventos | Análise |
| `trend_change` | Mudança de tendência | ML básico |

### 2.3 Schema do Banco

```typescript
// SLOs
slos = pgTable('slos', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  // Definição do SLI (Service Level Indicator)
  sliType: varchar('sli_type', { length: 50 }).notNull(), // availability, latency, error_rate, throughput
  sliQuery: jsonb('sli_query').$type<SliQuery>(), // query para calcular SLI

  // Target
  target: decimal('target', { precision: 5, scale: 2 }).notNull(), // ex: 99.9
  targetUnit: varchar('target_unit', { length: 20 }).default('percent'), // percent, ms, count

  // Window
  windowType: varchar('window_type', { length: 20 }).default('rolling'), // rolling, calendar
  windowDays: integer('window_days').default(30),

  // Status
  currentValue: decimal('current_value', { precision: 10, scale: 4 }),
  errorBudgetRemaining: decimal('error_budget_remaining', { precision: 10, scale: 4 }),
  status: varchar('status', { length: 20 }).default('healthy'), // healthy, at_risk, breached

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Histórico de SLO
sloHistory = pgTable('slo_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  sloId: uuid('slo_id').notNull().references(() => slos.id),
  timestamp: timestamp('timestamp').notNull(),
  value: decimal('value', { precision: 10, scale: 4 }).notNull(),
  errorBudgetConsumed: decimal('error_budget_consumed', { precision: 10, scale: 4 }),
}, (table) => ({
  sloTimeIdx: index('slo_history_slo_time_idx').on(table.sloId, table.timestamp),
}));

// Insights detectados
insights = pgTable('insights', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  type: varchar('type', { length: 50 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull(), // info, warning, critical
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),

  // Contexto
  relatedService: varchar('related_service', { length: 255 }),
  relatedMetric: varchar('related_metric', { length: 255 }),
  relatedTraceIds: jsonb('related_trace_ids').$type<string[]>(),

  // Dados do insight
  data: jsonb('data').$type<InsightData>(), // dados específicos do tipo

  // Status
  status: varchar('status', { length: 20 }).default('new'), // new, acknowledged, resolved, ignored
  acknowledgedBy: uuid('acknowledged_by').references(() => users.id),
  acknowledgedAt: timestamp('acknowledged_at'),

  // Temporal
  detectedAt: timestamp('detected_at').defaultNow(),
  startedAt: timestamp('started_at'), // quando o problema começou
  resolvedAt: timestamp('resolved_at'),

  createdAt: timestamp('created_at').defaultNow(),
});

// Correlações
correlations = pgTable('correlations', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),

  // Par correlacionado
  sourceType: varchar('source_type', { length: 20 }).notNull(), // metric, error, latency
  sourceId: varchar('source_id', { length: 255 }).notNull(),
  targetType: varchar('target_type', { length: 20 }).notNull(),
  targetId: varchar('target_id', { length: 255 }).notNull(),

  // Força da correlação
  correlationScore: decimal('correlation_score', { precision: 5, scale: 4 }).notNull(), // -1 a 1
  confidence: decimal('confidence', { precision: 5, scale: 4 }).notNull(), // 0 a 1

  // Metadados
  sampleSize: integer('sample_size').notNull(),
  timeWindow: varchar('time_window', { length: 20 }).notNull(),

  lastCalculatedAt: timestamp('last_calculated_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### 2.4 Algoritmos de Detecção

#### Anomaly Detection (Z-Score + Moving Average)
```typescript
// Detecta anomalias usando desvio padrão
function detectAnomaly(values: number[], threshold = 3): AnomalyResult {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const std = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);

  const latest = values[values.length - 1];
  const zScore = (latest - mean) / std;

  return {
    isAnomaly: Math.abs(zScore) > threshold,
    zScore,
    direction: zScore > 0 ? 'spike' : 'drop',
    deviation: Math.abs(zScore) * std,
  };
}
```

#### SLO Error Budget Calculation
```typescript
function calculateErrorBudget(slo: SLO, currentValue: number): ErrorBudget {
  const target = slo.target / 100; // ex: 0.999
  const allowed = 1 - target; // ex: 0.001 (0.1%)
  const actual = 1 - currentValue; // erro atual

  const consumed = actual / allowed;
  const remaining = Math.max(0, 1 - consumed);

  // Burn rate: quantas vezes mais rápido que o esperado
  const expectedBurnRate = 1 / slo.windowDays;
  const actualBurnRate = consumed / getDaysSinceWindowStart(slo);
  const burnRateMultiplier = actualBurnRate / expectedBurnRate;

  return {
    totalBudget: allowed,
    consumed,
    remaining,
    burnRateMultiplier,
    daysUntilExhausted: remaining / actualBurnRate,
  };
}
```

#### Correlation Analysis (Pearson)
```typescript
function calculateCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.reduce((a, b) => a + b * b, 0);
  const sumY2 = y.reduce((a, b) => a + b * b, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));

  return denominator === 0 ? 0 : numerator / denominator;
}
```

### 2.5 Componentes Frontend

```
src/web/
├── pages/insights/
│   ├── InsightsPage.tsx          # Feed de insights
│   ├── SLOsPage.tsx              # Gerenciamento de SLOs
│   └── CorrelationsPage.tsx      # Visualização de correlações
│
├── components/insights/
│   ├── InsightCard.tsx           # Card de insight individual
│   ├── InsightTimeline.tsx       # Timeline de insights
│   ├── SLOCard.tsx               # Card de SLO com gauge
│   ├── SLOBurndownChart.tsx      # Gráfico de error budget
│   ├── CorrelationMatrix.tsx     # Matriz de correlações
│   └── AnomalyOverlay.tsx        # Overlay em gráficos
```

### 2.6 Background Jobs

```typescript
// Jobs a serem executados periodicamente
jobs = {
  // A cada 1 minuto
  'insights:anomaly-detection': {
    cron: '* * * * *',
    handler: detectAnomalies,
  },

  // A cada 5 minutos
  'insights:slo-calculation': {
    cron: '*/5 * * * *',
    handler: calculateSLOs,
  },

  // A cada hora
  'insights:correlation-analysis': {
    cron: '0 * * * *',
    handler: analyzeCorrelations,
  },

  // Diariamente
  'insights:cleanup': {
    cron: '0 0 * * *',
    handler: cleanupOldInsights,
  },
};
```

---

## 3. Visualizações Avançadas

### 3.1 Flame Graph

Para análise de performance de traces.

```
┌─────────────────────────────────────────────────────────────┐
│ [======================== root ===========================] │
│ [======== service-a =======][======== service-b =========] │
│ [=== db ===][= cache =]    [=== api ===][=== process ===] │
│             [get]          [fetch]      [parse][validate]  │
└─────────────────────────────────────────────────────────────┘
```

**Componente**: `FlameGraph.tsx`
- Visualização hierárquica de spans
- Cores por serviço ou duração
- Zoom interativo
- Tooltip com detalhes do span
- Filtro por duração mínima

### 3.2 Service Map (Topology)

Grafo de dependências entre serviços.

```
       ┌─────────┐
       │ gateway │
       └────┬────┘
            │
    ┌───────┼───────┐
    │       │       │
    ▼       ▼       ▼
┌──────┐ ┌──────┐ ┌──────┐
│ auth │ │ api  │ │ web  │
└──┬───┘ └──┬───┘ └──────┘
   │        │
   ▼        ▼
┌──────┐ ┌──────┐
│  db  │ │redis │
└──────┘ └──────┘
```

**Componente**: `ServiceMap.tsx`
- Grafo interativo (vis.js ou d3-force)
- Nodes = serviços
- Edges = chamadas entre serviços
- Cores por health (verde/amarelo/vermelho)
- Espessura da edge = volume de requests
- Click para drill-down

### 3.3 Heatmap

Para visualizar distribuição de latência ao longo do tempo.

```
       00:00  06:00  12:00  18:00  24:00
      ┌─────┬─────┬─────┬─────┬─────┐
<10ms │░░░░░│░░░░░│▒▒▒▒▒│▒▒▒▒▒│░░░░░│
 10ms │░░░░░│▒▒▒▒▒│████│████│▒▒▒▒▒│
 50ms │▒▒▒▒▒│████│████│████│████│
100ms │████│████│████│▒▒▒▒▒│████│
>1s   │░░░░░│▒▒▒▒▒│▒▒▒▒▒│░░░░░│░░░░░│
      └─────┴─────┴─────┴─────┴─────┘
```

**Componente**: `Heatmap.tsx`
- X = tempo, Y = buckets de latência
- Cor = intensidade/contagem
- Hover para detalhes
- Seleção para drill-down

### 3.4 Comparison View

Comparar métricas side-by-side ou sobrepostas.

**Componente**: `ComparisonChart.tsx`
- Comparar período atual vs anterior
- Comparar serviços diferentes
- Comparar deploys (antes/depois)
- Modo: overlay, side-by-side, diff

### 3.5 Log Pattern Analysis

Agrupar logs por padrões similares.

```
┌─────────────────────────────────────────────────────────────┐
│ Pattern: "User {id} failed to authenticate from {ip}"       │
│ Occurrences: 1,234 (last 24h)                               │
│ Trend: ↑ 45% vs yesterday                                   │
│ Services: auth-service, api-gateway                         │
│ [View Logs] [Create Alert]                                  │
└─────────────────────────────────────────────────────────────┘
```

### 3.6 Schema para Visualizações

```typescript
// Templates de visualização salvos
visualizationTemplates = pgTable('visualization_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id), // null = global
  type: varchar('type', { length: 50 }).notNull(), // flame_graph, service_map, heatmap, etc.
  name: varchar('name', { length: 255 }).notNull(),
  config: jsonb('config').$type<VisualizationConfig>(),
  isDefault: boolean('is_default').default(false),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### 3.7 Componentes

```
src/web/components/visualizations/
├── FlameGraph/
│   ├── FlameGraph.tsx
│   ├── FlameGraphNode.tsx
│   └── FlameGraphTooltip.tsx
│
├── ServiceMap/
│   ├── ServiceMap.tsx
│   ├── ServiceNode.tsx
│   └── ServiceEdge.tsx
│
├── Heatmap/
│   ├── Heatmap.tsx
│   ├── HeatmapCell.tsx
│   └── HeatmapLegend.tsx
│
├── Comparison/
│   ├── ComparisonChart.tsx
│   └── ComparisonSelector.tsx
│
└── LogPatterns/
    ├── LogPatternList.tsx
    └── LogPatternCard.tsx
```

---

## 4. Sistema de Alertas

### 4.1 Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                     Alert Engine                             │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    Rule      │  │  Condition   │  │ Notification │      │
│  │  Evaluator   │  │   Checker    │  │   Sender     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
├─────────────────────────────────────────────────────────────┤
│              Alert State Machine                             │
│         (pending → firing → resolved/silenced)               │
├─────────────────────────────────────────────────────────────┤
│              alerts, alert_history, channels (tables)        │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Schema Completo

```typescript
// Alertas (extensão do existente)
alerts = pgTable('alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  // Fonte de dados
  dataSource: varchar('data_source', { length: 20 }).notNull(), // metric, trace, log, error
  queryConfig: jsonb('query_config').$type<AlertQueryConfig>(),

  // Condição
  conditionType: varchar('condition_type', { length: 50 }).notNull(),
  // above, below, change_percent, anomaly, absence
  threshold: jsonb('threshold').$type<AlertThreshold>(),
  // { value: 100, duration: '5m', evaluationPeriod: '1m' }

  // Severidade e prioridade
  severity: varchar('severity', { length: 20 }).default('warning'), // info, warning, critical

  // Notificações
  notificationChannels: jsonb('notification_channels').$type<string[]>(), // IDs dos canais
  notificationMessage: text('notification_message'), // template customizado

  // Schedule
  evaluationInterval: integer('evaluation_interval').default(60), // segundos

  // Estado
  enabled: boolean('enabled').default(true),
  state: varchar('state', { length: 20 }).default('ok'), // ok, pending, firing, silenced
  lastEvaluatedAt: timestamp('last_evaluated_at'),
  lastTriggeredAt: timestamp('last_triggered_at'),
  firingStartedAt: timestamp('firing_started_at'),

  // Metadata
  labels: jsonb('labels').$type<Record<string, string>>(),
  annotations: jsonb('annotations').$type<Record<string, string>>(),

  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Histórico de alertas
alertHistory = pgTable('alert_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  alertId: uuid('alert_id').notNull().references(() => alerts.id),

  event: varchar('event', { length: 20 }).notNull(), // triggered, resolved, silenced, acknowledged
  previousState: varchar('previous_state', { length: 20 }),
  newState: varchar('new_state', { length: 20 }),

  value: decimal('value', { precision: 20, scale: 6 }), // valor que triggou
  threshold: decimal('threshold', { precision: 20, scale: 6 }),

  triggeredBy: uuid('triggered_by').references(() => users.id), // para ações manuais
  message: text('message'),

  timestamp: timestamp('timestamp').defaultNow(),
}, (table) => ({
  alertTimeIdx: index('alert_history_alert_time_idx').on(table.alertId, table.timestamp),
}));

// Canais de notificação
notificationChannels = pgTable('notification_channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),

  type: varchar('type', { length: 50 }).notNull(), // slack, email, webhook, pagerduty, opsgenie
  name: varchar('name', { length: 255 }).notNull(),

  config: jsonb('config').$type<ChannelConfig>(),
  // Slack: { webhookUrl, channel, username }
  // Email: { recipients: [], smtp?: {} }
  // Webhook: { url, method, headers, bodyTemplate }
  // PagerDuty: { routingKey, severity }

  enabled: boolean('enabled').default(true),

  // Para testes
  lastTestedAt: timestamp('last_tested_at'),
  lastTestResult: varchar('last_test_result', { length: 20 }), // success, failed

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Silences (mute temporário)
alertSilences = pgTable('alert_silences', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),

  // Pode silenciar um alerta específico ou por matchers
  alertId: uuid('alert_id').references(() => alerts.id),
  matchers: jsonb('matchers').$type<SilenceMatcher[]>(), // { label, value, operator }

  startsAt: timestamp('starts_at').notNull(),
  endsAt: timestamp('ends_at').notNull(),

  reason: text('reason'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

// Escalation policies
escalationPolicies = pgTable('escalation_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),

  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  steps: jsonb('steps').$type<EscalationStep[]>(),
  // [
  //   { delayMinutes: 0, channels: ['slack-oncall'] },
  //   { delayMinutes: 15, channels: ['pagerduty'] },
  //   { delayMinutes: 30, channels: ['email-managers'] }
  // ]

  repeatAfterMinutes: integer('repeat_after_minutes'), // re-escalar se não resolvido

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### 4.3 Tipos de Condições

| Condição | Descrição | Exemplo |
|----------|-----------|---------|
| `above` | Valor acima do threshold | Latência P99 > 500ms |
| `below` | Valor abaixo do threshold | Disponibilidade < 99% |
| `change_percent` | Mudança percentual | Erros +50% vs hora anterior |
| `anomaly` | Fora do padrão histórico | 3σ do baseline |
| `absence` | Dados ausentes | Sem métricas por 5 min |

### 4.4 Canal de Notificação: Implementations

```typescript
// Slack
async function sendSlackNotification(channel: SlackChannel, alert: Alert) {
  await fetch(channel.webhookUrl, {
    method: 'POST',
    body: JSON.stringify({
      channel: channel.channel,
      username: channel.username || 'Baselime Alerts',
      icon_emoji: ':warning:',
      attachments: [{
        color: alert.severity === 'critical' ? 'danger' : 'warning',
        title: `[${alert.severity.toUpperCase()}] ${alert.name}`,
        text: alert.description,
        fields: [
          { title: 'Value', value: alert.currentValue, short: true },
          { title: 'Threshold', value: alert.threshold.value, short: true },
          { title: 'Service', value: alert.labels.service, short: true },
        ],
        ts: Math.floor(Date.now() / 1000),
      }],
    }),
  });
}

// Email
async function sendEmailNotification(channel: EmailChannel, alert: Alert) {
  // Usar nodemailer ou serviço externo (SendGrid, SES)
}

// Webhook
async function sendWebhookNotification(channel: WebhookChannel, alert: Alert) {
  const body = renderTemplate(channel.bodyTemplate, alert);
  await fetch(channel.url, {
    method: channel.method || 'POST',
    headers: channel.headers,
    body,
  });
}

// PagerDuty
async function sendPagerDutyNotification(channel: PagerDutyChannel, alert: Alert) {
  await fetch('https://events.pagerduty.com/v2/enqueue', {
    method: 'POST',
    body: JSON.stringify({
      routing_key: channel.routingKey,
      event_action: alert.state === 'firing' ? 'trigger' : 'resolve',
      dedup_key: alert.id,
      payload: {
        summary: alert.name,
        severity: channel.severity || alert.severity,
        source: 'baselime',
        custom_details: alert,
      },
    }),
  });
}
```

### 4.5 Alert Engine (Background Job)

```typescript
// src/infrastructure/jobs/alert-engine.ts

async function evaluateAlerts() {
  const alerts = await db.select().from(alerts).where(eq(alerts.enabled, true));

  for (const alert of alerts) {
    const shouldEvaluate = !alert.lastEvaluatedAt ||
      Date.now() - alert.lastEvaluatedAt.getTime() >= alert.evaluationInterval * 1000;

    if (!shouldEvaluate) continue;

    try {
      const value = await evaluateAlertQuery(alert);
      const conditionMet = checkCondition(alert, value);

      await updateAlertState(alert, conditionMet, value);

      if (conditionMet && alert.state !== 'firing') {
        await triggerAlert(alert, value);
      } else if (!conditionMet && alert.state === 'firing') {
        await resolveAlert(alert);
      }
    } catch (error) {
      console.error(`Error evaluating alert ${alert.id}:`, error);
    }
  }
}

async function triggerAlert(alert: Alert, value: number) {
  // Atualizar estado
  await db.update(alerts)
    .set({ state: 'firing', firingStartedAt: new Date() })
    .where(eq(alerts.id, alert.id));

  // Registrar no histórico
  await db.insert(alertHistory).values({
    alertId: alert.id,
    event: 'triggered',
    previousState: alert.state,
    newState: 'firing',
    value,
    threshold: alert.threshold.value,
  });

  // Enviar notificações
  for (const channelId of alert.notificationChannels) {
    const channel = await db.select().from(notificationChannels)
      .where(eq(notificationChannels.id, channelId))
      .limit(1);

    if (channel[0]) {
      await sendNotification(channel[0], alert);
    }
  }
}
```

### 4.6 Componentes Frontend

```
src/web/
├── pages/alerts/
│   ├── AlertsPage.tsx            # Lista de alertas
│   ├── AlertDetailPage.tsx       # Detalhes e histórico
│   ├── AlertCreatePage.tsx       # Criar/editar alerta
│   └── ChannelsPage.tsx          # Gerenciar canais de notificação
│
├── components/alerts/
│   ├── AlertCard.tsx             # Card de alerta
│   ├── AlertStatusBadge.tsx      # Badge de status (ok, firing, etc)
│   ├── AlertTimeline.tsx         # Timeline de eventos
│   ├── AlertConditionBuilder.tsx # Builder visual de condições
│   ├── ChannelSelector.tsx       # Seletor de canais
│   ├── ChannelConfigForm.tsx     # Form de configuração por tipo
│   ├── SilenceModal.tsx          # Modal para silenciar
│   └── EscalationBuilder.tsx     # Builder de escalation
```

### 4.7 API (tRPC Router)

```typescript
// src/interface/trpc/routers/alerts.router.ts
alerts.router({
  // CRUD Alertas
  list: () => Alert[],
  get: (alertId) => Alert & { history: AlertHistory[] },
  create: (input) => Alert,
  update: (alertId, input) => Alert,
  delete: (alertId) => void,

  // Ações
  enable: (alertId) => void,
  disable: (alertId) => void,
  test: (alertId) => TestResult,
  acknowledge: (alertId, message?) => void,

  // Silences
  silence: (alertId, duration, reason) => Silence,
  listSilences: () => Silence[],
  deleteSilence: (silenceId) => void,

  // Canais
  listChannels: () => Channel[],
  createChannel: (input) => Channel,
  updateChannel: (channelId, input) => Channel,
  deleteChannel: (channelId) => void,
  testChannel: (channelId) => TestResult,

  // Estatísticas
  stats: () => { firing: number, pending: number, silenced: number },

  // Escalation
  listPolicies: () => EscalationPolicy[],
  createPolicy: (input) => EscalationPolicy,
  updatePolicy: (policyId, input) => EscalationPolicy,
  deletePolicy: (policyId) => void,
})
```

---

## 5. Ordem de Implementação Sugerida

### Fase 1: Fundação (1-2 semanas)
1. **Schema migrations** - Criar todas as novas tabelas
2. **Background job system** - Setup de processamento assíncrono
3. **Base components** - Componentes reutilizáveis (gauges, heatmap cells, etc)

### Fase 2: Alertas (2-3 semanas)
1. CRUD de alertas e canais
2. Slack e Webhook como primeiros canais
3. Alert engine básico
4. UI de gerenciamento

### Fase 3: Dashboards (2-3 semanas)
1. CRUD de dashboards
2. Grid layout com drag-and-drop
3. Widgets básicos (metric, trace, log)
4. Time range e filtros globais

### Fase 4: Visualizações (1-2 semanas)
1. Service Map (baseado em dados de trace existentes)
2. Heatmap de latência
3. Flame Graph
4. Integrar como widgets de dashboard

### Fase 5: Insights (2-3 semanas)
1. SLOs básicos
2. Anomaly detection
3. Feed de insights
4. Correlation analysis

### Fase 6: Polish (1 semana)
1. Templates de dashboard
2. Email e PagerDuty
3. Escalation policies
4. Export/import

---

## 6. Dependências Adicionais

```json
{
  "dependencies": {
    "react-grid-layout": "^1.4.4",    // Dashboard grid
    "d3": "^7.9.0",                    // Service map e visualizações
    "@visx/heatmap": "^3.3.0",         // Heatmap
    "node-cron": "^3.0.3",             // Background jobs
    "nodemailer": "^6.9.0",            // Email
    "simple-statistics": "^7.8.0"      // Estatísticas (z-score, correlation)
  }
}
```

---

## 7. Métricas de Sucesso

| Feature | Métrica | Target |
|---------|---------|--------|
| Dashboards | Dashboards criados por projeto | > 3 |
| Alertas | Tempo médio de detecção | < 1 min |
| Alertas | Falsos positivos | < 10% |
| Insights | Anomalias detectadas/semana | > 5 relevantes |
| SLOs | Precisão de cálculo | 99.9% |
| Visualizações | Uso de flame graph | > 20% dos traces |

---

## Próximos Passos

1. Revisar e aprovar este roadmap
2. Definir prioridades de fase
3. Criar issues/tasks granulares
4. Começar pela Fase 1 (Fundação)
