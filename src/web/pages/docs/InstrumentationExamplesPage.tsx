import React, { useState } from 'react';
import {
  Code2,
  Terminal,
  Server,
  Globe,
  Boxes,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Zap,
  Database,
  Cloud
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { CodeBlock } from '../../components/ui/code-block';
import { cn } from '../../lib/utils';

interface ExampleSection {
  id: string;
  title: string;
  icon: React.ElementType;
  description: string;
  examples: Example[];
}

interface Example {
  id: string;
  title: string;
  language: string;
  description: string;
  code: string;
  highlightLines?: number[];
  tips?: string[];
}

const INSTRUMENTATION_EXAMPLES: ExampleSection[] = [
  {
    id: 'node',
    title: 'Node.js / TypeScript',
    icon: Server,
    description: 'Full OpenTelemetry instrumentation for Node.js applications',
    examples: [
      {
        id: 'node-basic',
        title: 'Basic Setup',
        language: 'typescript',
        description: 'Complete OpenTelemetry SDK setup with traces, metrics, and logs',
        code: `import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const headers = { 'Authorization': 'Bearer <your-api-key>' };

const sdk = new NodeSDK({
  serviceName: 'my-service',
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:3000/v1/traces',
    headers,
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: 'http://localhost:3000/v1/metrics',
      headers,
    }),
    exportIntervalMillis: 60000,
  }),
  logRecordProcessor: new BatchLogRecordProcessor(
    new OTLPLogExporter({
      url: 'http://localhost:3000/v1/logs',
      headers,
    })
  ),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('SDK shut down successfully'))
    .catch((error) => console.error('Error shutting down SDK', error))
    .finally(() => process.exit(0));
});`,
        highlightLines: [9, 10, 11, 12, 13, 14],
        tips: [
          'Install packages: npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-http @opentelemetry/exporter-metrics-otlp-http @opentelemetry/exporter-logs-otlp-http',
          'Import this file before any other code in your application',
          'Auto-instrumentations will capture HTTP, database, and framework traces automatically',
        ],
      },
      {
        id: 'node-express',
        title: 'Express.js Middleware',
        language: 'typescript',
        description: 'Custom middleware for enhanced Express.js tracing',
        code: `import { trace, SpanStatusCode, context } from '@opentelemetry/api';

const tracer = trace.getTracer('express-middleware');

export function tracingMiddleware(req, res, next) {
  const span = tracer.startSpan(\`\${req.method} \${req.path}\`, {
    attributes: {
      'http.method': req.method,
      'http.url': req.url,
      'http.route': req.route?.path,
      'http.user_agent': req.headers['user-agent'],
      'client.ip': req.ip,
    },
  });

  // Add request ID for correlation
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  span.setAttribute('request.id', requestId);
  res.setHeader('x-request-id', requestId);

  // Capture response
  const originalSend = res.send;
  res.send = function(body) {
    span.setAttribute('http.status_code', res.statusCode);

    if (res.statusCode >= 400) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.setAttribute('error', true);
    }

    span.end();
    return originalSend.call(this, body);
  };

  // Run next middleware in span context
  context.with(trace.setSpan(context.active(), span), () => {
    next();
  });
}`,
        highlightLines: [6, 7, 8, 9, 10, 11, 12, 13],
      },
      {
        id: 'node-custom-spans',
        title: 'Custom Spans & Attributes',
        language: 'typescript',
        description: 'Creating custom spans for business logic tracing',
        code: `import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('my-service');

async function processOrder(orderId: string, items: Item[]) {
  return tracer.startActiveSpan('process-order', async (span) => {
    try {
      // Add business context
      span.setAttribute('order.id', orderId);
      span.setAttribute('order.items_count', items.length);
      span.setAttribute('order.total', calculateTotal(items));

      // Add event for order started
      span.addEvent('order.processing_started', {
        'order.id': orderId,
      });

      // Child span for inventory check
      const inventory = await tracer.startActiveSpan('check-inventory', async (childSpan) => {
        const result = await inventoryService.checkAvailability(items);
        childSpan.setAttribute('inventory.available', result.available);
        childSpan.end();
        return result;
      });

      if (!inventory.available) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Items not available' });
        throw new Error('Items not available');
      }

      // Child span for payment
      await tracer.startActiveSpan('process-payment', async (paymentSpan) => {
        paymentSpan.setAttribute('payment.method', 'credit_card');
        await paymentService.charge(orderId, calculateTotal(items));
        paymentSpan.end();
      });

      span.addEvent('order.completed');
      return { success: true, orderId };

    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}`,
        highlightLines: [8, 9, 10, 11, 13, 14, 15, 16],
        tips: [
          'Use startActiveSpan to automatically manage span context',
          'Add events for important business milestones',
          'Always record exceptions and set error status on failures',
        ],
      },
    ],
  },
  {
    id: 'python',
    title: 'Python',
    icon: Code2,
    description: 'OpenTelemetry instrumentation for Python applications',
    examples: [
      {
        id: 'python-basic',
        title: 'Basic Setup',
        language: 'python',
        description: 'Complete OpenTelemetry setup for Python with Flask',
        code: `from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.instrumentation.flask import FlaskInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.sdk.resources import Resource

# Create resource with service info
resource = Resource.create({
    "service.name": "my-python-service",
    "service.version": "1.0.0",
    "deployment.environment": "production"
})

# Configure tracing
trace_provider = TracerProvider(resource=resource)
trace_exporter = OTLPSpanExporter(
    endpoint="http://localhost:3000/v1/traces",
    headers={"Authorization": "Bearer <your-api-key>"}
)
trace_provider.add_span_processor(BatchSpanProcessor(trace_exporter))
trace.set_tracer_provider(trace_provider)

# Configure metrics
metric_reader = PeriodicExportingMetricReader(
    OTLPMetricExporter(
        endpoint="http://localhost:3000/v1/metrics",
        headers={"Authorization": "Bearer <your-api-key>"}
    ),
    export_interval_millis=60000
)
metrics.set_meter_provider(MeterProvider(resource=resource, metric_readers=[metric_reader]))

# Auto-instrument frameworks
FlaskInstrumentor().instrument()
RequestsInstrumentor().instrument()

# Get tracer for custom spans
tracer = trace.get_tracer(__name__)`,
        highlightLines: [13, 14, 15, 16, 21, 22, 23, 24],
        tips: [
          'Install: pip install opentelemetry-api opentelemetry-sdk opentelemetry-exporter-otlp-proto-http',
          'Add framework instrumentors: pip install opentelemetry-instrumentation-flask opentelemetry-instrumentation-requests',
        ],
      },
      {
        id: 'python-fastapi',
        title: 'FastAPI Integration',
        language: 'python',
        description: 'OpenTelemetry setup for FastAPI applications',
        code: `from fastapi import FastAPI, Request
from opentelemetry import trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource

# Initialize tracing before creating the app
resource = Resource.create({"service.name": "fastapi-service"})
provider = TracerProvider(resource=resource)
provider.add_span_processor(
    BatchSpanProcessor(
        OTLPSpanExporter(
            endpoint="http://localhost:3000/v1/traces",
            headers={"Authorization": "Bearer <your-api-key>"}
        )
    )
)
trace.set_tracer_provider(provider)

app = FastAPI()
FastAPIInstrumentor.instrument_app(app)

tracer = trace.get_tracer(__name__)

@app.get("/users/{user_id}")
async def get_user(user_id: str, request: Request):
    with tracer.start_as_current_span("fetch-user") as span:
        span.set_attribute("user.id", user_id)
        span.set_attribute("http.client_ip", request.client.host)

        user = await fetch_user_from_db(user_id)

        span.set_attribute("user.found", user is not None)
        return user

@app.middleware("http")
async def add_custom_headers(request: Request, call_next):
    with tracer.start_as_current_span("middleware") as span:
        span.set_attribute("path", request.url.path)
        response = await call_next(request)
        span.set_attribute("status_code", response.status_code)
        return response`,
        highlightLines: [29, 30, 31],
      },
      {
        id: 'python-django',
        title: 'Django Integration',
        language: 'python',
        description: 'OpenTelemetry setup for Django applications',
        code: `# settings.py
INSTALLED_APPS = [
    # ... your apps
]

# otel_setup.py - import this in wsgi.py or asgi.py
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.django import DjangoInstrumentor
from opentelemetry.instrumentation.psycopg2 import Psycopg2Instrumentor
from opentelemetry.sdk.resources import Resource
import os

def configure_opentelemetry():
    resource = Resource.create({
        "service.name": os.getenv("SERVICE_NAME", "django-app"),
        "deployment.environment": os.getenv("ENVIRONMENT", "development")
    })

    provider = TracerProvider(resource=resource)
    provider.add_span_processor(
        BatchSpanProcessor(
            OTLPSpanExporter(
                endpoint=os.getenv("OTEL_ENDPOINT", "http://localhost:3000/v1/traces"),
                headers={"Authorization": f"Bearer {os.getenv('OTEL_API_KEY')}"}
            )
        )
    )
    trace.set_tracer_provider(provider)

    # Instrument Django and database
    DjangoInstrumentor().instrument()
    Psycopg2Instrumentor().instrument()

# wsgi.py
from otel_setup import configure_opentelemetry
configure_opentelemetry()

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()`,
        highlightLines: [17, 18, 19, 20, 33, 34],
      },
    ],
  },
  {
    id: 'go',
    title: 'Go',
    icon: Boxes,
    description: 'OpenTelemetry instrumentation for Go applications',
    examples: [
      {
        id: 'go-basic',
        title: 'Basic Setup',
        language: 'go',
        description: 'Complete OpenTelemetry setup for Go applications',
        code: `package main

import (
    "context"
    "log"
    "os"
    "os/signal"

    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/attribute"
    "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
    "go.opentelemetry.io/otel/sdk/resource"
    "go.opentelemetry.io/otel/sdk/trace"
    semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
)

func initTracer() (func(context.Context) error, error) {
    ctx := context.Background()

    // Create OTLP exporter
    exporter, err := otlptracehttp.New(ctx,
        otlptracehttp.WithEndpoint("localhost:3000"),
        otlptracehttp.WithURLPath("/v1/traces"),
        otlptracehttp.WithHeaders(map[string]string{
            "Authorization": "Bearer <your-api-key>",
        }),
    )
    if err != nil {
        return nil, err
    }

    // Create resource with service info
    res, err := resource.Merge(
        resource.Default(),
        resource.NewWithAttributes(
            semconv.SchemaURL,
            semconv.ServiceName("my-go-service"),
            semconv.ServiceVersion("1.0.0"),
            attribute.String("environment", "production"),
        ),
    )
    if err != nil {
        return nil, err
    }

    // Create tracer provider
    tp := trace.NewTracerProvider(
        trace.WithBatcher(exporter),
        trace.WithResource(res),
    )

    otel.SetTracerProvider(tp)

    return tp.Shutdown, nil
}

func main() {
    shutdown, err := initTracer()
    if err != nil {
        log.Fatal(err)
    }

    ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
    defer stop()
    defer shutdown(ctx)

    // Your application code here
    tracer := otel.Tracer("main")
    ctx, span := tracer.Start(ctx, "main-operation")
    defer span.End()

    // Add attributes
    span.SetAttributes(
        attribute.String("user.id", "123"),
        attribute.Int("items.count", 5),
    )
}`,
        highlightLines: [21, 22, 23, 24, 25, 26, 35, 36, 37, 38],
        tips: [
          'Install: go get go.opentelemetry.io/otel go.opentelemetry.io/otel/sdk go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp',
          'Use context propagation for distributed tracing across services',
        ],
      },
      {
        id: 'go-http',
        title: 'HTTP Server & Client',
        language: 'go',
        description: 'Instrumenting HTTP servers and clients in Go',
        code: `package main

import (
    "context"
    "net/http"

    "go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/attribute"
    "go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("http-example")

// Wrap your HTTP handler
func main() {
    // Instrumented handler
    handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        ctx := r.Context()
        span := trace.SpanFromContext(ctx)

        // Add custom attributes
        span.SetAttributes(
            attribute.String("user.id", r.Header.Get("X-User-ID")),
            attribute.String("request.path", r.URL.Path),
        )

        // Call another service with context propagation
        client := http.Client{
            Transport: otelhttp.NewTransport(http.DefaultTransport),
        }

        req, _ := http.NewRequestWithContext(ctx, "GET", "http://other-service/api", nil)
        resp, err := client.Do(req)
        if err != nil {
            span.RecordError(err)
            http.Error(w, err.Error(), 500)
            return
        }
        defer resp.Body.Close()

        w.WriteHeader(http.StatusOK)
    })

    // Wrap with OpenTelemetry middleware
    wrappedHandler := otelhttp.NewHandler(handler, "my-server",
        otelhttp.WithSpanOptions(trace.WithAttributes(
            attribute.String("service.name", "my-go-service"),
        )),
    )

    http.ListenAndServe(":8080", wrappedHandler)
}`,
        highlightLines: [29, 30, 44, 45, 46, 47, 48],
      },
      {
        id: 'go-grpc',
        title: 'gRPC Instrumentation',
        language: 'go',
        description: 'OpenTelemetry instrumentation for gRPC services',
        code: `package main

import (
    "google.golang.org/grpc"
    "go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
)

func main() {
    // Server with OpenTelemetry
    server := grpc.NewServer(
        grpc.StatsHandler(otelgrpc.NewServerHandler()),
    )

    // Register your services
    // pb.RegisterYourServiceServer(server, &yourServer{})

    // Client with OpenTelemetry
    conn, err := grpc.Dial(
        "localhost:50051",
        grpc.WithStatsHandler(otelgrpc.NewClientHandler()),
        grpc.WithInsecure(),
    )
    if err != nil {
        log.Fatal(err)
    }
    defer conn.Close()

    // client := pb.NewYourServiceClient(conn)
}`,
        highlightLines: [10, 11, 18, 19, 20],
      },
    ],
  },
  {
    id: 'java',
    title: 'Java / Kotlin',
    icon: Zap,
    description: 'OpenTelemetry instrumentation for JVM applications',
    examples: [
      {
        id: 'java-agent',
        title: 'Java Agent (Recommended)',
        language: 'bash',
        description: 'Zero-code instrumentation using the OpenTelemetry Java Agent',
        code: `# Download the agent
curl -L -o opentelemetry-javaagent.jar \\
  https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar

# Run your application with the agent
java -javaagent:opentelemetry-javaagent.jar \\
  -Dotel.service.name=my-java-service \\
  -Dotel.exporter.otlp.endpoint=http://localhost:3000 \\
  -Dotel.exporter.otlp.headers="Authorization=Bearer <your-api-key>" \\
  -Dotel.exporter.otlp.protocol=http/protobuf \\
  -Dotel.traces.exporter=otlp \\
  -Dotel.metrics.exporter=otlp \\
  -Dotel.logs.exporter=otlp \\
  -jar my-application.jar`,
        highlightLines: [6, 7, 8, 9],
        tips: [
          'The Java Agent automatically instruments most frameworks (Spring, JAX-RS, JDBC, etc.)',
          'No code changes required - just add the agent to your JVM startup',
          'You can also use environment variables instead of system properties',
        ],
      },
      {
        id: 'java-spring',
        title: 'Spring Boot Manual Setup',
        language: 'java',
        description: 'Programmatic OpenTelemetry configuration for Spring Boot',
        code: `// build.gradle.kts
dependencies {
    implementation("io.opentelemetry:opentelemetry-api:1.35.0")
    implementation("io.opentelemetry:opentelemetry-sdk:1.35.0")
    implementation("io.opentelemetry:opentelemetry-exporter-otlp:1.35.0")
    implementation("io.opentelemetry.instrumentation:opentelemetry-spring-boot-starter:2.1.0")
}

// application.yml
otel:
  exporter:
    otlp:
      endpoint: http://localhost:3000
      headers:
        Authorization: Bearer <your-api-key>
  service:
    name: my-spring-service

// OtelConfig.java
@Configuration
public class OtelConfig {

    @Bean
    public OpenTelemetry openTelemetry() {
        Resource resource = Resource.getDefault()
            .merge(Resource.create(Attributes.of(
                ResourceAttributes.SERVICE_NAME, "my-spring-service",
                ResourceAttributes.SERVICE_VERSION, "1.0.0"
            )));

        SdkTracerProvider tracerProvider = SdkTracerProvider.builder()
            .addSpanProcessor(BatchSpanProcessor.builder(
                OtlpHttpSpanExporter.builder()
                    .setEndpoint("http://localhost:3000/v1/traces")
                    .addHeader("Authorization", "Bearer <your-api-key>")
                    .build()
            ).build())
            .setResource(resource)
            .build();

        return OpenTelemetrySdk.builder()
            .setTracerProvider(tracerProvider)
            .build();
    }
}

// Using in a service
@Service
public class OrderService {
    private final Tracer tracer;

    public OrderService(OpenTelemetry openTelemetry) {
        this.tracer = openTelemetry.getTracer("order-service");
    }

    public Order processOrder(String orderId) {
        Span span = tracer.spanBuilder("process-order")
            .setAttribute("order.id", orderId)
            .startSpan();

        try (Scope scope = span.makeCurrent()) {
            // Business logic
            return orderRepository.findById(orderId);
        } catch (Exception e) {
            span.recordException(e);
            span.setStatus(StatusCode.ERROR);
            throw e;
        } finally {
            span.end();
        }
    }
}`,
        highlightLines: [33, 34, 35, 56, 57, 58],
      },
    ],
  },
  {
    id: 'rust',
    title: 'Rust',
    icon: Terminal,
    description: 'OpenTelemetry instrumentation for Rust applications',
    examples: [
      {
        id: 'rust-basic',
        title: 'Basic Setup with Tracing',
        language: 'rust',
        description: 'OpenTelemetry setup using the tracing ecosystem',
        code: `// Cargo.toml
[dependencies]
opentelemetry = { version = "0.22", features = ["rt-tokio"] }
opentelemetry-otlp = { version = "0.15", features = ["http-proto", "reqwest-client"] }
opentelemetry_sdk = { version = "0.22", features = ["rt-tokio"] }
tracing = "0.1"
tracing-opentelemetry = "0.23"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

// main.rs
use opentelemetry::KeyValue;
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::{runtime, trace as sdktrace, Resource};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

fn init_tracer() -> sdktrace::TracerProvider {
    let exporter = opentelemetry_otlp::new_exporter()
        .http()
        .with_endpoint("http://localhost:3000/v1/traces")
        .with_headers(std::collections::HashMap::from([
            ("Authorization".to_string(), "Bearer <your-api-key>".to_string()),
        ]));

    opentelemetry_otlp::new_pipeline()
        .tracing()
        .with_exporter(exporter)
        .with_trace_config(
            sdktrace::Config::default()
                .with_resource(Resource::new(vec![
                    KeyValue::new("service.name", "my-rust-service"),
                    KeyValue::new("service.version", "1.0.0"),
                ]))
        )
        .install_batch(runtime::Tokio)
        .expect("Failed to install tracer")
}

#[tokio::main]
async fn main() {
    let tracer_provider = init_tracer();

    let telemetry = tracing_opentelemetry::layer()
        .with_tracer(tracer_provider.tracer("my-rust-service"));

    tracing_subscriber::registry()
        .with(telemetry)
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Use tracing macros
    process_request("123").await;

    tracer_provider.shutdown().expect("Failed to shutdown tracer");
}

#[tracing::instrument(fields(user_id = %user_id))]
async fn process_request(user_id: &str) {
    tracing::info!("Processing request");

    // Nested span
    fetch_user_data(user_id).await;
}

#[tracing::instrument]
async fn fetch_user_data(user_id: &str) {
    tracing::info!(user_id, "Fetching user data");
    // Simulate work
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
}`,
        highlightLines: [17, 18, 19, 20, 21, 22, 55, 56],
        tips: [
          'The tracing crate integrates seamlessly with OpenTelemetry',
          'Use #[tracing::instrument] to automatically create spans',
          'Field annotations automatically become span attributes',
        ],
      },
    ],
  },
  {
    id: 'browser',
    title: 'Browser / Frontend',
    icon: Globe,
    description: 'OpenTelemetry instrumentation for web applications',
    examples: [
      {
        id: 'browser-basic',
        title: 'Browser SDK Setup',
        language: 'typescript',
        description: 'OpenTelemetry setup for frontend applications',
        code: `import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: 'my-frontend-app',
  [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  'browser.user_agent': navigator.userAgent,
});

const provider = new WebTracerProvider({ resource });

provider.addSpanProcessor(
  new BatchSpanProcessor(
    new OTLPTraceExporter({
      url: 'http://localhost:3000/v1/traces',
      headers: {
        'Authorization': 'Bearer <your-api-key>',
      },
    })
  )
);

provider.register({
  contextManager: new ZoneContextManager(),
});

registerInstrumentations({
  instrumentations: [
    getWebAutoInstrumentations({
      '@opentelemetry/instrumentation-fetch': {
        propagateTraceHeaderCorsUrls: [/.*/],
        clearTimingResources: true,
      },
      '@opentelemetry/instrumentation-xml-http-request': {
        propagateTraceHeaderCorsUrls: [/.*/],
      },
      '@opentelemetry/instrumentation-document-load': {},
      '@opentelemetry/instrumentation-user-interaction': {},
    }),
  ],
});

export const tracer = provider.getTracer('frontend');`,
        highlightLines: [20, 21, 22, 23, 24, 36, 37, 38, 39],
        tips: [
          'Install: npm install @opentelemetry/sdk-trace-web @opentelemetry/auto-instrumentations-web @opentelemetry/exporter-trace-otlp-http',
          'Auto-instrumentation captures fetch, XHR, document load, and user interactions',
          'Remember to configure CORS on your backend to accept trace headers',
        ],
      },
      {
        id: 'browser-react',
        title: 'React Integration',
        language: 'typescript',
        description: 'React component tracing with custom hooks',
        code: `import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { useEffect, useCallback } from 'react';

const tracer = trace.getTracer('react-components');

// Hook for tracing component lifecycle
export function useComponentTrace(componentName: string) {
  useEffect(() => {
    const span = tracer.startSpan(\`\${componentName}.mount\`);

    return () => {
      span.end();

      // Track unmount
      const unmountSpan = tracer.startSpan(\`\${componentName}.unmount\`);
      unmountSpan.end();
    };
  }, [componentName]);
}

// Hook for tracing async operations
export function useTracedCallback<T extends (...args: any[]) => Promise<any>>(
  callback: T,
  operationName: string,
  deps: React.DependencyList
) {
  return useCallback(async (...args: Parameters<T>) => {
    return tracer.startActiveSpan(operationName, async (span) => {
      try {
        const result = await callback(...args);
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    });
  }, deps);
}

// Example usage in a component
function UserProfile({ userId }: { userId: string }) {
  useComponentTrace('UserProfile');

  const fetchUser = useTracedCallback(
    async () => {
      const response = await fetch(\`/api/users/\${userId}\`);
      return response.json();
    },
    'fetchUser',
    [userId]
  );

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return <div>...</div>;
}`,
        highlightLines: [7, 8, 9, 22, 23, 24, 25, 43, 45, 46, 47, 48, 49, 50, 51],
      },
    ],
  },
  {
    id: 'dotnet',
    title: '.NET / C#',
    icon: Database,
    description: 'OpenTelemetry instrumentation for .NET applications',
    examples: [
      {
        id: 'dotnet-basic',
        title: 'ASP.NET Core Setup',
        language: 'dotnet',
        description: 'OpenTelemetry configuration for ASP.NET Core',
        code: `// Program.cs
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using OpenTelemetry.Metrics;
using OpenTelemetry.Logs;
using OpenTelemetry.Exporter;

var builder = WebApplication.CreateBuilder(args);

// Configure OpenTelemetry
builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource
        .AddService(
            serviceName: "my-dotnet-service",
            serviceVersion: "1.0.0"))
    .WithTracing(tracing => tracing
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddEntityFrameworkCoreInstrumentation()
        .AddOtlpExporter(options =>
        {
            options.Endpoint = new Uri("http://localhost:3000/v1/traces");
            options.Headers = "Authorization=Bearer <your-api-key>";
            options.Protocol = OtlpExportProtocol.HttpProtobuf;
        }))
    .WithMetrics(metrics => metrics
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddOtlpExporter(options =>
        {
            options.Endpoint = new Uri("http://localhost:3000/v1/metrics");
            options.Headers = "Authorization=Bearer <your-api-key>";
        }));

// Add logging with OpenTelemetry
builder.Logging.AddOpenTelemetry(logging =>
{
    logging.AddOtlpExporter(options =>
    {
        options.Endpoint = new Uri("http://localhost:3000/v1/logs");
        options.Headers = "Authorization=Bearer <your-api-key>";
    });
});

var app = builder.Build();
app.MapControllers();
app.Run();`,
        highlightLines: [11, 12, 13, 14, 15, 20, 21, 22, 23, 24],
        tips: [
          'Install NuGet packages: OpenTelemetry.Extensions.Hosting, OpenTelemetry.Exporter.OpenTelemetryProtocol',
          'Add instrumentation packages: OpenTelemetry.Instrumentation.AspNetCore, OpenTelemetry.Instrumentation.Http',
        ],
      },
      {
        id: 'dotnet-custom',
        title: 'Custom Spans',
        language: 'dotnet',
        description: 'Creating custom spans in .NET',
        code: `using System.Diagnostics;
using OpenTelemetry.Trace;

// Create an ActivitySource (equivalent to Tracer)
public static class Telemetry
{
    public static readonly ActivitySource Source = new("MyApp.Services");
}

// Use in a service
public class OrderService
{
    public async Task<Order> ProcessOrderAsync(string orderId)
    {
        using var activity = Telemetry.Source.StartActivity("ProcessOrder");

        activity?.SetTag("order.id", orderId);
        activity?.SetTag("order.type", "standard");

        try
        {
            // Add event
            activity?.AddEvent(new ActivityEvent("order.validation.started"));

            await ValidateOrderAsync(orderId);

            activity?.AddEvent(new ActivityEvent("order.payment.started"));

            // Nested activity
            using (var paymentActivity = Telemetry.Source.StartActivity("ProcessPayment"))
            {
                paymentActivity?.SetTag("payment.method", "credit_card");
                await ProcessPaymentAsync(orderId);
            }

            activity?.AddEvent(new ActivityEvent("order.completed"));

            return new Order { Id = orderId, Status = "completed" };
        }
        catch (Exception ex)
        {
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            activity?.RecordException(ex);
            throw;
        }
    }
}`,
        highlightLines: [15, 17, 18, 23, 29, 30, 31, 32, 33, 40, 41],
      },
    ],
  },
  {
    id: 'php',
    title: 'PHP',
    icon: Cloud,
    description: 'OpenTelemetry instrumentation for PHP applications',
    examples: [
      {
        id: 'php-basic',
        title: 'Laravel Setup',
        language: 'php',
        description: 'OpenTelemetry configuration for Laravel',
        code: `<?php
// config/opentelemetry.php
return [
    'service_name' => env('OTEL_SERVICE_NAME', 'my-laravel-app'),
    'endpoint' => env('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:3000'),
    'api_key' => env('OTEL_API_KEY'),
];

// app/Providers/OpenTelemetryServiceProvider.php
namespace App\\Providers;

use Illuminate\\Support\\ServiceProvider;
use OpenTelemetry\\API\\Globals;
use OpenTelemetry\\SDK\\Trace\\TracerProviderBuilder;
use OpenTelemetry\\SDK\\Trace\\SpanProcessor\\BatchSpanProcessor;
use OpenTelemetry\\Contrib\\Otlp\\SpanExporter;
use OpenTelemetry\\SDK\\Resource\\ResourceInfo;
use OpenTelemetry\\SDK\\Resource\\ResourceInfoFactory;
use OpenTelemetry\\SemConv\\ResourceAttributes;

class OpenTelemetryServiceProvider extends ServiceProvider
{
    public function register()
    {
        $resource = ResourceInfoFactory::defaultResource()->merge(
            ResourceInfo::create([
                ResourceAttributes::SERVICE_NAME => config('opentelemetry.service_name'),
            ])
        );

        $exporter = new SpanExporter(
            config('opentelemetry.endpoint') . '/v1/traces',
            [
                'Authorization' => 'Bearer ' . config('opentelemetry.api_key'),
            ]
        );

        $tracerProvider = (new TracerProviderBuilder())
            ->addSpanProcessor(new BatchSpanProcessor($exporter))
            ->setResource($resource)
            ->build();

        Globals::registerInitialTracer($tracerProvider);
    }
}

// Using in a controller
namespace App\\Http\\Controllers;

use OpenTelemetry\\API\\Globals;

class OrderController extends Controller
{
    public function store(Request $request)
    {
        $tracer = Globals::tracerProvider()->getTracer('order-controller');
        $span = $tracer->spanBuilder('create-order')->startSpan();

        try {
            $span->setAttribute('user.id', $request->user()->id);
            $span->setAttribute('order.items_count', count($request->items));

            $order = Order::create($request->validated());

            $span->setAttribute('order.id', $order->id);
            $span->addEvent('order.created');

            return response()->json($order);
        } catch (\\Exception $e) {
            $span->recordException($e);
            $span->setStatus(\\OpenTelemetry\\API\\Trace\\StatusCode::STATUS_ERROR);
            throw $e;
        } finally {
            $span->end();
        }
    }
}`,
        highlightLines: [31, 32, 33, 34, 35, 55, 56, 58, 59],
        tips: [
          'Install: composer require open-telemetry/sdk open-telemetry/exporter-otlp',
          'Register the service provider in config/app.php',
        ],
      },
    ],
  },
  {
    id: 'ruby',
    title: 'Ruby',
    icon: Terminal,
    description: 'OpenTelemetry instrumentation for Ruby applications',
    examples: [
      {
        id: 'ruby-rails',
        title: 'Rails Setup',
        language: 'ruby',
        description: 'OpenTelemetry configuration for Rails applications',
        code: `# Gemfile
gem 'opentelemetry-sdk'
gem 'opentelemetry-exporter-otlp'
gem 'opentelemetry-instrumentation-all'

# config/initializers/opentelemetry.rb
require 'opentelemetry/sdk'
require 'opentelemetry/exporter/otlp'
require 'opentelemetry/instrumentation/all'

OpenTelemetry::SDK.configure do |c|
  c.service_name = 'my-rails-service'
  c.service_version = '1.0.0'

  c.add_span_processor(
    OpenTelemetry::SDK::Trace::Export::BatchSpanProcessor.new(
      OpenTelemetry::Exporter::OTLP::Exporter.new(
        endpoint: 'http://localhost:3000/v1/traces',
        headers: {
          'Authorization' => "Bearer #{ENV['OTEL_API_KEY']}"
        }
      )
    )
  )

  c.use_all # Auto-instrument all supported gems
end

# Using in a service
class OrderService
  def self.tracer
    OpenTelemetry.tracer_provider.tracer('order-service')
  end

  def process_order(order_id)
    tracer.in_span('process_order', attributes: { 'order.id' => order_id }) do |span|
      span.add_event('order.validation.started')

      validate_order(order_id)

      # Nested span
      tracer.in_span('process_payment') do |payment_span|
        payment_span.set_attribute('payment.method', 'credit_card')
        process_payment(order_id)
      end

      span.add_event('order.completed')
    end
  rescue StandardError => e
    span&.record_exception(e)
    span&.status = OpenTelemetry::Trace::Status.error(e.message)
    raise
  end

  private

  def tracer
    self.class.tracer
  end
end`,
        highlightLines: [15, 16, 17, 18, 19, 20, 21, 22, 23, 36, 37],
        tips: [
          'Run: bundle install',
          'The use_all method automatically instruments Rails, ActiveRecord, Sidekiq, and more',
        ],
      },
    ],
  },
];

export function InstrumentationExamplesPage() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['node']));
  const [selectedExample, setSelectedExample] = useState<string>('node-basic');

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const currentExample = INSTRUMENTATION_EXAMPLES
    .flatMap((s) => s.examples)
    .find((e) => e.id === selectedExample);

  const currentSection = INSTRUMENTATION_EXAMPLES.find((s) =>
    s.examples.some((e) => e.id === selectedExample)
  );

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-72 border-r border-border overflow-y-auto bg-muted/30">
        <div className="p-4 border-b border-border">
          <h1 className="text-lg font-semibold">Instrumentation</h1>
          <p className="text-sm text-muted-foreground">
            OpenTelemetry examples for all languages
          </p>
        </div>

        <nav className="p-2">
          {INSTRUMENTATION_EXAMPLES.map((section) => {
            const Icon = section.icon;
            const isExpanded = expandedSections.has(section.id);
            const isActive = currentSection?.id === section.id;

            return (
              <div key={section.id} className="mb-1">
                <button
                  onClick={() => toggleSection(section.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{section.title}</span>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>

                {isExpanded && (
                  <div className="ml-6 mt-1 space-y-1">
                    {section.examples.map((example) => (
                      <button
                        key={example.id}
                        onClick={() => setSelectedExample(example.id)}
                        className={cn(
                          'w-full text-left px-3 py-1.5 rounded text-sm transition-colors',
                          selectedExample === example.id
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        )}
                      >
                        {example.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {currentExample && currentSection && (
          <div className="max-w-4xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                {React.createElement(currentSection.icon, { className: 'h-4 w-4' })}
                <span>{currentSection.title}</span>
              </div>
              <h1 className="text-2xl font-bold">{currentExample.title}</h1>
              <p className="text-muted-foreground mt-1">{currentExample.description}</p>
            </div>

            {/* Code block */}
            <CodeBlock
              code={currentExample.code}
              language={currentExample.language}
              title={currentExample.title}
              highlightLines={currentExample.highlightLines}
            />

            {/* Tips */}
            {currentExample.tips && currentExample.tips.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    Tips
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {currentExample.tips.map((tip, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <span className="text-muted-foreground">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Related docs */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Related Resources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="https://opentelemetry.io/docs/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-lg text-sm hover:bg-muted/80 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    OpenTelemetry Docs
                  </a>
                  <a
                    href="https://opentelemetry.io/ecosystem/registry/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-lg text-sm hover:bg-muted/80 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Instrumentation Registry
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
