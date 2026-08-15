import { router } from './trpc.js';
import { authRouter } from './routers/auth.router.js';
import { organizationsRouter } from './routers/organizations.router.js';
import { projectsRouter } from './routers/projects.router.js';
import { tracesRouter } from './routers/traces.router.js';
import { logsRouter } from './routers/logs.router.js';
import { errorsRouter } from './routers/errors.router.js';
import { queriesRouter } from './routers/queries.router.js';
import { metricsRouter } from './routers/metrics.router.js';
import { alertsRouter } from './routers/alerts.router.js';
import { dashboardsRouter } from './routers/dashboards.router.js';

export const appRouter = router({
  auth: authRouter,
  organizations: organizationsRouter,
  projects: projectsRouter,
  traces: tracesRouter,
  logs: logsRouter,
  errors: errorsRouter,
  queries: queriesRouter,
  metrics: metricsRouter,
  alerts: alertsRouter,
  dashboards: dashboardsRouter,
});

export type AppRouter = typeof appRouter;
