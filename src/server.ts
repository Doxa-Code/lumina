import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import type { Server } from 'http';
import { createServer as createViteServer, type ViteDevServer } from 'vite';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './interface/trpc/router.js';
import { createContext } from './interface/trpc/context.js';
import { authMiddleware } from './interface/trpc/middleware/auth.middleware.js';
import { createTracesRouter } from './infrastructure/otlp/http/traces.js';
import { createLogsRouter } from './infrastructure/otlp/http/logs.js';
import { createMetricsRouter } from './infrastructure/otlp/http/metrics.js';
import { startScheduler, stopScheduler } from './infrastructure/jobs/scheduler.js';

const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== 'production';

let mainServer: Server | null = null;
let vite: ViteDevServer | null = null;

async function shutdown() {
  console.log('\nShutting down gracefully...');

  // Stop background jobs
  stopScheduler();

  if (vite) {
    await vite.close();
  }

  const closeServer = (server: Server | null) =>
    new Promise<void>((resolve) => {
      if (server) {
        server.close(() => resolve());
      } else {
        resolve();
      }
    });

  await closeServer(mainServer);

  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function main() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  app.use(authMiddleware);

  app.use(
    '/api/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext: ({ req, res }) => createContext({ req, res }),
    })
  );

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // OTLP endpoints on same server
  app.use(createTracesRouter());
  app.use(createLogsRouter());
  app.use(createMetricsRouter());

  if (isDev) {
    // Vite dev server as middleware
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      root: 'src/web',
    });

    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static('dist/web'));
    app.get('*', (req, res) => {
      res.sendFile('index.html', { root: 'dist/web' });
    });
  }

  mainServer = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`  - Frontend: http://localhost:${PORT}`);
    console.log(`  - API: http://localhost:${PORT}/api/trpc`);
    console.log(`  - OTLP Traces: POST http://localhost:${PORT}/v1/traces`);
    console.log(`  - OTLP Logs: POST http://localhost:${PORT}/v1/logs`);
    console.log(`  - OTLP Metrics: POST http://localhost:${PORT}/v1/metrics`);

    // Start background jobs for alerts, SLOs, and anomaly detection
    startScheduler();
    console.log(`  - Background Jobs: Started (alerts, SLOs, anomaly detection)`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
