# Plano: Sistema de Observabilidade Completo (Clone Baselime)

## Visão Geral

Sistema de observabilidade completo usando OpenTelemetry como padrão de coleta, com suporte a traces distribuídos, logs estruturados e métricas. Arquitetura baseada em Clean Architecture, DDD e Clean Code.

## Stack Tecnológica

| Componente | Tecnologia |
|------------|------------|
| Runtime | Node.js + TypeScript |
| Frontend | React + Vite |
| Backend | tRPC (server actions pattern) |
| Banco de Dados | PostgreSQL com particionamento |
| ORM | Drizzle ORM |
| Ingestão | OTLP (OpenTelemetry Protocol) via gRPC/HTTP |
| Autenticação | Auth completo (users/orgs/RBAC) |
| Deploy | Docker / Docker Compose |

## Arquitetura de Alto Nível

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Aplicações Instrumentadas                      │
│              (SDKs OpenTelemetry: Node, Python, Go, etc)             │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │ OTLP (gRPC :4317 / HTTP :4318)
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         INGEST LAYER                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │ Traces      │  │ Logs        │  │ Metrics     │                  │
│  │ Receiver    │  │ Receiver    │  │ Receiver    │                  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                  │
│         │                │                │                          │
│         └────────────────┼────────────────┘                          │
│                          ▼                                           │
│              ┌───────────────────────┐                               │
│              │  Processing Pipeline  │                               │
│              │  (batch, transform)   │                               │
│              └───────────┬───────────┘                               │
└──────────────────────────┼──────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       STORAGE LAYER                                  │
│                                                                      │
│  PostgreSQL (Particionado por tempo)                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ spans        │  │ logs         │  │ metrics      │               │
│  │ (traces)     │  │              │  │              │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ users        │  │ organizations│  │ projects     │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API LAYER (tRPC)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │ Traces      │  │ Logs        │  │ Metrics     │                  │
│  │ Router      │  │ Router      │  │ Router      │                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │ Query       │  │ Auth        │  │ Projects    │                  │
│  │ Router      │  │ Router      │  │ Router      │                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React + Vite)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │ Trace View  │  │ Logs View   │  │ Metrics     │                  │
│  │ (Waterfall) │  │             │  │ Dashboard   │                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │ Query       │  │ Errors      │  │ Services    │                  │
│  │ Builder     │  │ View        │  │ Overview    │                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Estrutura de Diretórios (Clean Architecture + DDD)

```
/
├── docker-compose.yml
├── Dockerfile
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── vite.config.ts
│
├── src/
│   │
│   ├── domain/                          # DOMAIN LAYER (Entities, Value Objects, Domain Services)
│   │   ├── telemetry/
│   │   │   ├── entities/
│   │   │   │   ├── Span.ts              # Entidade de Span (trace)
│   │   │   │   ├── Log.ts               # Entidade de Log
│   │   │   │   ├── Metric.ts            # Entidade de Métrica
│   │   │   │   └── Trace.ts             # Agregado de Trace (conjunto de spans)
│   │   │   ├── value-objects/
│   │   │   │   ├── TraceId.ts
│   │   │   │   ├── SpanId.ts
│   │   │   │   ├── SpanKind.ts
│   │   │   │   ├── SpanStatus.ts
│   │   │   │   ├── Severity.ts
│   │   │   │   └── Attributes.ts
│   │   │   ├── services/
│   │   │   │   ├── TraceAggregator.ts   # Agrega spans em trace tree
│   │   │   │   └── ErrorDetector.ts     # Detecta erros em spans/logs
│   │   │   └── repositories/
│   │   │       ├── ISpanRepository.ts
│   │   │       ├── ILogRepository.ts
│   │   │       └── IMetricRepository.ts
│   │   │
│   │   ├── identity/
│   │   │   ├── entities/
│   │   │   │   ├── User.ts
│   │   │   │   ├── Organization.ts
│   │   │   │   ├── Project.ts
│   │   │   │   └── ApiKey.ts
│   │   │   ├── value-objects/
│   │   │   │   ├── Email.ts
│   │   │   │   ├── Password.ts
│   │   │   │   └── Role.ts
│   │   │   └── repositories/
│   │   │       ├── IUserRepository.ts
│   │   │       ├── IOrganizationRepository.ts
│   │   │       └── IProjectRepository.ts
│   │   │
│   │   ├── query/
│   │   │   ├── entities/
│   │   │   │   ├── SavedQuery.ts
│   │   │   │   ├── Dashboard.ts
│   │   │   │   └── Alert.ts
│   │   │   ├── value-objects/
│   │   │   │   ├── QueryFilter.ts
│   │   │   │   ├── Aggregation.ts
│   │   │   │   └── TimeRange.ts
│   │   │   └── services/
│   │   │       └── QueryBuilder.ts      # Constrói queries dinâmicas
│   │   │
│   │   └── shared/
│   │       ├── Entity.ts                # Base class para entidades
│   │       ├── ValueObject.ts           # Base class para value objects
│   │       ├── AggregateRoot.ts         # Base class para aggregates
│   │       └── DomainEvent.ts           # Base class para domain events
│   │
│   ├── application/                     # APPLICATION LAYER (Use Cases)
│   │   ├── telemetry/
│   │   │   ├── commands/
│   │   │   │   ├── IngestSpans.ts       # Processa spans recebidos via OTLP
│   │   │   │   ├── IngestLogs.ts        # Processa logs recebidos via OTLP
│   │   │   │   └── IngestMetrics.ts     # Processa métricas recebidas via OTLP
│   │   │   └── queries/
│   │   │       ├── GetTrace.ts          # Busca trace completo por ID
│   │   │       ├── SearchSpans.ts       # Busca spans com filtros
│   │   │       ├── SearchLogs.ts        # Busca logs com filtros
│   │   │       ├── GetMetrics.ts        # Busca métricas agregadas
│   │   │       └── GetServiceMap.ts     # Gera mapa de serviços
│   │   │
│   │   ├── identity/
│   │   │   ├── commands/
│   │   │   │   ├── CreateUser.ts
│   │   │   │   ├── CreateOrganization.ts
│   │   │   │   ├── CreateProject.ts
│   │   │   │   ├── GenerateApiKey.ts
│   │   │   │   └── InviteMember.ts
│   │   │   └── queries/
│   │   │       ├── GetUser.ts
│   │   │       ├── GetOrganization.ts
│   │   │       └── GetProjects.ts
│   │   │
│   │   ├── query/
│   │   │   ├── commands/
│   │   │   │   ├── SaveQuery.ts
│   │   │   │   ├── CreateDashboard.ts
│   │   │   │   └── CreateAlert.ts
│   │   │   └── queries/
│   │   │       ├── ExecuteQuery.ts      # Executa query dinâmica
│   │   │       └── GetDashboard.ts
│   │   │
│   │   └── shared/
│   │       ├── Command.ts               # Interface base para commands
│   │       ├── Query.ts                 # Interface base para queries
│   │       └── UseCaseResult.ts         # Result pattern
│   │
│   ├── infrastructure/                  # INFRASTRUCTURE LAYER
│   │   ├── database/
│   │   │   ├── schema/
│   │   │   │   ├── telemetry.ts         # Schema: spans, logs, metrics
│   │   │   │   ├── identity.ts          # Schema: users, orgs, projects
│   │   │   │   └── query.ts             # Schema: saved_queries, dashboards
│   │   │   ├── migrations/
│   │   │   ├── repositories/
│   │   │   │   ├── DrizzleSpanRepository.ts
│   │   │   │   ├── DrizzleLogRepository.ts
│   │   │   │   ├── DrizzleMetricRepository.ts
│   │   │   │   ├── DrizzleUserRepository.ts
│   │   │   │   └── ...
│   │   │   └── connection.ts            # Pool de conexões
│   │   │
│   │   ├── otlp/                        # OpenTelemetry Protocol Receivers
│   │   │   ├── grpc/
│   │   │   │   ├── TraceService.ts      # gRPC service para traces
│   │   │   │   ├── LogsService.ts       # gRPC service para logs
│   │   │   │   └── MetricsService.ts    # gRPC service para métricas
│   │   │   ├── http/
│   │   │   │   ├── traces.ts            # HTTP endpoint para traces
│   │   │   │   ├── logs.ts              # HTTP endpoint para logs
│   │   │   │   └── metrics.ts           # HTTP endpoint para métricas
│   │   │   ├── proto/                   # Protobuf definitions (OTLP)
│   │   │   │   ├── trace.proto
│   │   │   │   ├── logs.proto
│   │   │   │   └── metrics.proto
│   │   │   └── processors/
│   │   │       ├── BatchProcessor.ts    # Agrupa dados para insert eficiente
│   │   │       └── AttributeNormalizer.ts
│   │   │
│   │   ├── auth/
│   │   │   ├── JwtService.ts
│   │   │   ├── PasswordHasher.ts
│   │   │   ├── ApiKeyValidator.ts
│   │   │   └── SessionManager.ts
│   │   │
│   │   └── cache/
│   │       └── RedisCache.ts            # Opcional: cache para queries frequentes
│   │
│   ├── interface/                       # INTERFACE LAYER (Controllers, Presenters)
│   │   ├── trpc/
│   │   │   ├── context.ts               # Contexto tRPC (user, project)
│   │   │   ├── router.ts                # Root router
│   │   │   ├── routers/
│   │   │   │   ├── auth.router.ts
│   │   │   │   ├── traces.router.ts
│   │   │   │   ├── logs.router.ts
│   │   │   │   ├── metrics.router.ts
│   │   │   │   ├── query.router.ts
│   │   │   │   ├── projects.router.ts
│   │   │   │   └── errors.router.ts
│   │   │   └── middleware/
│   │   │       ├── auth.middleware.ts
│   │   │       └── rateLimit.middleware.ts
│   │   │
│   │   └── http/
│   │       └── health.ts                # Health check endpoint
│   │
│   ├── web/                             # FRONTEND (React + Vite)
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ui/                      # Componentes base (shadcn/ui)
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   └── Layout.tsx
│   │   │   ├── traces/
│   │   │   │   ├── TraceList.tsx
│   │   │   │   ├── TraceDetail.tsx
│   │   │   │   ├── TraceWaterfall.tsx   # Visualização waterfall
│   │   │   │   ├── SpanCard.tsx
│   │   │   │   └── ServiceGraph.tsx     # Grafo de dependências
│   │   │   ├── logs/
│   │   │   │   ├── LogList.tsx
│   │   │   │   ├── LogDetail.tsx
│   │   │   │   └── LogChart.tsx
│   │   │   ├── metrics/
│   │   │   │   ├── MetricChart.tsx
│   │   │   │   └── Dashboard.tsx
│   │   │   ├── query/
│   │   │   │   ├── QueryBuilder.tsx
│   │   │   │   ├── FilterBuilder.tsx
│   │   │   │   ├── AggregationPicker.tsx
│   │   │   │   └── ResultsTable.tsx
│   │   │   ├── errors/
│   │   │   │   ├── ErrorList.tsx
│   │   │   │   └── ErrorDetail.tsx
│   │   │   └── services/
│   │   │       ├── ServiceList.tsx
│   │   │       └── ServiceDetail.tsx
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   ├── Login.tsx
│   │   │   │   ├── Register.tsx
│   │   │   │   └── Invite.tsx
│   │   │   ├── dashboard/
│   │   │   │   └── Home.tsx
│   │   │   ├── traces/
│   │   │   │   ├── TracesPage.tsx
│   │   │   │   └── TraceDetailPage.tsx
│   │   │   ├── logs/
│   │   │   │   └── LogsPage.tsx
│   │   │   ├── metrics/
│   │   │   │   └── MetricsPage.tsx
│   │   │   ├── queries/
│   │   │   │   ├── QueriesPage.tsx
│   │   │   │   └── QueryEditorPage.tsx
│   │   │   ├── errors/
│   │   │   │   └── ErrorsPage.tsx
│   │   │   ├── services/
│   │   │   │   └── ServicesPage.tsx
│   │   │   └── settings/
│   │   │       ├── ProjectSettings.tsx
│   │   │       ├── ApiKeys.tsx
│   │   │       └── TeamMembers.tsx
│   │   ├── hooks/
│   │   │   ├── useTraces.ts
│   │   │   ├── useLogs.ts
│   │   │   ├── useMetrics.ts
│   │   │   └── useQuery.ts
│   │   ├── stores/
│   │   │   ├── authStore.ts
│   │   │   ├── projectStore.ts
│   │   │   └── queryStore.ts
│   │   ├── lib/
│   │   │   ├── trpc.ts                  # Cliente tRPC
│   │   │   └── utils.ts
│   │   └── styles/
│   │       └── globals.css
│   │
│   └── server.ts                        # Entry point: Express + tRPC + OTLP
│
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

## Schema do Banco de Dados (PostgreSQL com Particionamento)

### Tabelas de Telemetria (Particionadas por tempo)

```sql
-- Spans (Distributed Tracing)
CREATE TABLE spans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trace_id VARCHAR(32) NOT NULL,
    span_id VARCHAR(16) NOT NULL,
    parent_span_id VARCHAR(16),
    project_id UUID NOT NULL REFERENCES projects(id),

    -- Identificação do serviço
    service_name VARCHAR(255) NOT NULL,
    service_namespace VARCHAR(255),
    service_version VARCHAR(100),

    -- Dados do span
    name VARCHAR(500) NOT NULL,
    kind VARCHAR(20) NOT NULL, -- INTERNAL, SERVER, CLIENT, PRODUCER, CONSUMER
    status_code VARCHAR(20) NOT NULL, -- UNSET, OK, ERROR
    status_message TEXT,

    -- Timestamps (nanoseconds -> stored as bigint)
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    duration_ms DOUBLE PRECISION GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (end_time - start_time)) * 1000
    ) STORED,

    -- Atributos flexíveis (JSONB para queries)
    attributes JSONB NOT NULL DEFAULT '{}',
    resource_attributes JSONB NOT NULL DEFAULT '{}',

    -- Events e Links
    events JSONB NOT NULL DEFAULT '[]',
    links JSONB NOT NULL DEFAULT '[]',

    -- Metadados de ingestão
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Índices compostos
    CONSTRAINT spans_project_trace UNIQUE (project_id, trace_id, span_id)
) PARTITION BY RANGE (start_time);

-- Partições automáticas por dia
CREATE TABLE spans_y2024m01 PARTITION OF spans
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
-- ... mais partições criadas automaticamente

-- Logs
CREATE TABLE logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),

    -- Correlação com traces
    trace_id VARCHAR(32),
    span_id VARCHAR(16),

    -- Identificação do serviço
    service_name VARCHAR(255) NOT NULL,
    service_namespace VARCHAR(255),

    -- Dados do log
    timestamp TIMESTAMPTZ NOT NULL,
    observed_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    severity_number INTEGER NOT NULL, -- 1-24 (TRACE to FATAL)
    severity_text VARCHAR(20),
    body TEXT,

    -- Atributos
    attributes JSONB NOT NULL DEFAULT '{}',
    resource_attributes JSONB NOT NULL DEFAULT '{}',

    -- Metadados
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (timestamp);

-- Metrics (usando modelo de pontos)
CREATE TABLE metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),

    -- Identificação
    service_name VARCHAR(255) NOT NULL,
    metric_name VARCHAR(255) NOT NULL,
    metric_type VARCHAR(20) NOT NULL, -- GAUGE, COUNTER, HISTOGRAM, SUMMARY
    unit VARCHAR(50),
    description TEXT,

    -- Timestamp e valor
    timestamp TIMESTAMPTZ NOT NULL,

    -- Valores (dependendo do tipo)
    value_int BIGINT,
    value_double DOUBLE PRECISION,

    -- Para histogramas
    histogram_count BIGINT,
    histogram_sum DOUBLE PRECISION,
    histogram_buckets JSONB, -- [{bound: 0.1, count: 10}, ...]

    -- Atributos (labels)
    attributes JSONB NOT NULL DEFAULT '{}',
    resource_attributes JSONB NOT NULL DEFAULT '{}',

    -- Metadados
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (timestamp);
```

### Tabelas de Identidade

```sql
-- Usuários
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organizações
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Membros da organização
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL, -- OWNER, ADMIN, MEMBER, VIEWER
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- Projetos (ambientes de telemetria)
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    environment VARCHAR(50) DEFAULT 'production', -- production, staging, development
    retention_days INTEGER DEFAULT 30,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, slug)
);

-- API Keys para ingestão
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL, -- SHA256 hash da key
    key_prefix VARCHAR(10) NOT NULL, -- Primeiros caracteres para identificação
    permissions JSONB NOT NULL DEFAULT '["ingest"]', -- ingest, read, admin
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);
```

### Tabelas de Query/Dashboard

```sql
-- Queries salvas
CREATE TABLE saved_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Definição da query
    datasets JSONB NOT NULL, -- [{type: 'spans', name: 'lambda-logs'}]
    filters JSONB NOT NULL DEFAULT '[]',
    aggregations JSONB NOT NULL DEFAULT '[]',
    group_by JSONB NOT NULL DEFAULT '[]',
    order_by JSONB NOT NULL DEFAULT '[]',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Dashboards
CREATE TABLE dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    layout JSONB NOT NULL DEFAULT '[]', -- Grid layout
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Widgets do dashboard
CREATE TABLE dashboard_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    query_id UUID REFERENCES saved_queries(id),
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- chart, table, stat, histogram
    config JSONB NOT NULL DEFAULT '{}',
    position JSONB NOT NULL, -- {x, y, w, h}
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alertas
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    query_id UUID REFERENCES saved_queries(id),

    -- Condição
    condition_type VARCHAR(50) NOT NULL, -- threshold, anomaly, absence
    threshold JSONB, -- {operator: '>', value: 100}

    -- Notificação
    notification_channels JSONB NOT NULL DEFAULT '[]', -- [{type: 'slack', webhook: '...'}]

    -- Estado
    enabled BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Erros agrupados
CREATE TABLE error_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- Fingerprint para agrupamento
    fingerprint VARCHAR(64) NOT NULL, -- Hash do stack trace normalizado

    -- Dados do erro
    title VARCHAR(500) NOT NULL,
    type VARCHAR(255), -- TypeError, NetworkError, etc
    first_seen_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL,

    -- Contadores
    event_count INTEGER DEFAULT 1,

    -- Estado
    status VARCHAR(50) DEFAULT 'active', -- active, resolved, ignored
    assigned_to UUID REFERENCES users(id),

    -- Metadados
    services JSONB NOT NULL DEFAULT '[]', -- Serviços afetados
    tags JSONB NOT NULL DEFAULT '[]',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(project_id, fingerprint)
);
```

## Índices para Performance

```sql
-- Spans
CREATE INDEX idx_spans_project_time ON spans (project_id, start_time DESC);
CREATE INDEX idx_spans_trace ON spans (trace_id);
CREATE INDEX idx_spans_service ON spans (project_id, service_name, start_time DESC);
CREATE INDEX idx_spans_status ON spans (project_id, status_code, start_time DESC) WHERE status_code = 'ERROR';
CREATE INDEX idx_spans_attributes ON spans USING GIN (attributes jsonb_path_ops);

-- Logs
CREATE INDEX idx_logs_project_time ON logs (project_id, timestamp DESC);
CREATE INDEX idx_logs_trace ON logs (trace_id) WHERE trace_id IS NOT NULL;
CREATE INDEX idx_logs_service ON logs (project_id, service_name, timestamp DESC);
CREATE INDEX idx_logs_severity ON logs (project_id, severity_number, timestamp DESC);
CREATE INDEX idx_logs_body_search ON logs USING GIN (to_tsvector('english', body));

-- Metrics
CREATE INDEX idx_metrics_project_name_time ON metrics (project_id, metric_name, timestamp DESC);
CREATE INDEX idx_metrics_service ON metrics (project_id, service_name, timestamp DESC);
```

## Fases de Implementação

### Fase 1: Fundação (Core Infrastructure)
1. Setup do projeto (Vite + tRPC + Drizzle)
2. Schema do banco de dados com migrations
3. Sistema de particionamento automático
4. Estrutura de domínio (entities, value objects)
5. Autenticação básica (users, login, JWT)

### Fase 2: Ingestão OTLP
1. Servidor OTLP HTTP (/v1/traces, /v1/logs, /v1/metrics)
2. Parsing de protobuf/JSON
3. Batch processing para inserts eficientes
4. Validação de API keys
5. Rate limiting

### Fase 3: API de Consulta
1. tRPC routers para traces, logs, metrics
2. Query builder dinâmico
3. Agregações e group by
4. Paginação eficiente
5. Exportação de dados

### Fase 4: Frontend - Traces
1. Layout base (sidebar, header)
2. Lista de requests/traces
3. Visualização waterfall de spans
4. Detalhes do span (atributos, events)
5. Filtros e busca

### Fase 5: Frontend - Logs & Errors
1. Lista de logs com filtros
2. Detalhe do log estruturado
3. Correlação log -> trace
4. Agrupamento de erros
5. Gestão de erros (resolve, ignore)

### Fase 6: Frontend - Metrics & Dashboards
1. Gráficos de métricas
2. Query builder visual
3. Criação de dashboards
4. Widgets configuráveis
5. Alertas

### Fase 7: Organizações & Multi-tenancy
1. CRUD de organizações
2. Gestão de membros/roles
3. Múltiplos projetos
4. Convites por email
5. Billing hooks (preparação)

### Fase 8: Polish & DevOps
1. Docker compose completo
2. Health checks
3. Métricas internas
4. Documentação
5. Testes E2E

## Decisões Técnicas Importantes

### 1. OpenTelemetry Protocol (OTLP)
- **HTTP** na porta 4318 (mais fácil de debugar)
- **gRPC** na porta 4317 (mais eficiente para alto volume)
- Suporte a JSON e Protobuf
- Batch processor com flush a cada 5s ou 1000 items

### 2. Particionamento PostgreSQL
- Partições diárias para spans/logs/metrics
- Job automático para criar partições futuras (pg_partman ou custom)
- Drop de partições antigas baseado em retention_days do projeto
- Queries sempre incluem filtro de tempo para partition pruning

### 3. Query Builder
- Traduz filtros visuais para SQL seguro (sem SQL injection)
- Usa prepared statements com parâmetros
- Suporta agregações: COUNT, SUM, AVG, MIN, MAX, P50, P95, P99
- Group by com limit para evitar explosão de cardinalidade

### 4. Correlação de Dados
- trace_id é o elo entre spans, logs e métricas
- Visualização unificada por request
- Click em log -> mostra span correspondente
- Click em span -> mostra logs daquele contexto

### 5. Performance
- Connection pooling com pg (pool size = CPU cores * 2)
- Batch inserts (INSERT ... VALUES (...), (...), ...)
- Materialized views para métricas agregadas (opcional)
- Cache de queries frequentes (Redis opcional)

## Como Executar (Preview)

```bash
# Desenvolvimento
docker-compose up -d postgres
pnpm install
pnpm db:migrate
pnpm dev

# Produção
docker-compose up -d

# Testar ingestão
curl -X POST http://localhost:4318/v1/traces \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <api-key>" \
  -d @sample-trace.json
```

## Configuração OpenTelemetry SDK (Exemplo Node.js)

```typescript
// Em aplicações que enviam dados para este sistema
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
    headers: {
      'Authorization': 'Bearer <sua-api-key>'
    }
  }),
  // ... outras configurações
});

sdk.start();
```
