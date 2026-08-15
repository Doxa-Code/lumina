import { eq, and, sql } from 'drizzle-orm';
import { db } from '../database/connection.js';
import { serviceDependencies, spans } from '../database/schema/index.js';

interface DependencyStats {
  sourceService: string;
  targetService: string;
  requestCount: number;
  errorCount: number;
  avgLatencyMs: number;
  p99LatencyMs: number;
  lastSeenAt: Date;
}

export async function aggregateServiceDependencies(): Promise<void> {
  console.log('[ServiceDependencyAggregator] Starting service dependency aggregation...');

  try {
    // Get all projects with trace data
    const projects = await db
      .select({
        projectId: spans.projectId,
      })
      .from(spans)
      .groupBy(spans.projectId);

    console.log(
      `[ServiceDependencyAggregator] Analyzing dependencies for ${projects.length} projects`
    );

    let totalDependencies = 0;

    for (const { projectId } of projects) {
      try {
        const dependencies = await aggregateDependenciesForProject(projectId);
        totalDependencies += dependencies.length;
      } catch (error) {
        console.error(
          `[ServiceDependencyAggregator] Failed to aggregate dependencies for project ${projectId}:`,
          error
        );
      }
    }

    console.log(
      `[ServiceDependencyAggregator] Aggregation complete. Processed ${totalDependencies} dependencies`
    );
  } catch (error) {
    console.error('[ServiceDependencyAggregator] Dependency aggregation failed:', error);
    throw error;
  }
}

async function aggregateDependenciesForProject(projectId: string): Promise<DependencyStats[]> {
  // Analyze trace data from the last hour
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

  // Find service dependencies by analyzing parent-child span relationships
  // A dependency exists when a span in one service calls a span in another service
  const dependencyData = await db
    .select({
      sourceService: sql<string>`parent.service_name`,
      targetService: sql<string>`child.service_name`,
      requestCount: sql<number>`COUNT(*)::int`,
      errorCount: sql<number>`COUNT(*) FILTER (WHERE child.status_code = 'ERROR')::int`,
      avgLatencyMs: sql<number>`AVG(child.duration_ms)`,
      p99LatencyMs: sql<number>`PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY child.duration_ms)`,
      lastSeenAt: sql<Date>`MAX(child.start_time)`,
    })
    .from(sql`spans AS parent`)
    .innerJoin(
      sql`spans AS child`,
      sql`parent.trace_id = child.trace_id AND parent.span_id = child.parent_span_id AND parent.project_id = child.project_id`
    )
    .where(
      and(
        sql`parent.project_id = ${projectId}`,
        sql`parent.service_name != child.service_name`,
        sql`child.start_time >= ${oneHourAgo}`
      )
    )
    .groupBy(sql`parent.service_name`, sql`child.service_name`);

  const dependencies: DependencyStats[] = [];

  for (const dep of dependencyData) {
    const stats: DependencyStats = {
      sourceService: dep.sourceService,
      targetService: dep.targetService,
      requestCount: dep.requestCount || 0,
      errorCount: dep.errorCount || 0,
      avgLatencyMs: dep.avgLatencyMs || 0,
      p99LatencyMs: dep.p99LatencyMs || 0,
      lastSeenAt: dep.lastSeenAt || now,
    };

    dependencies.push(stats);

    // Update or insert dependency record
    await upsertDependency(projectId, stats);
  }

  console.log(
    `[ServiceDependencyAggregator] Found ${dependencies.length} dependencies for project ${projectId}`
  );

  return dependencies;
}

async function upsertDependency(projectId: string, stats: DependencyStats): Promise<void> {
  // Check if dependency already exists
  const existing = await db
    .select()
    .from(serviceDependencies)
    .where(
      and(
        eq(serviceDependencies.projectId, projectId),
        eq(serviceDependencies.sourceService, stats.sourceService),
        eq(serviceDependencies.targetService, stats.targetService)
      )
    )
    .limit(1);

  const now = new Date();

  if (existing.length > 0) {
    // Update existing record with aggregated stats
    const existingDep = existing[0];

    // Calculate cumulative moving average for better smoothing
    const alpha = 0.3; // Smoothing factor (0.3 = 30% new data, 70% old data)

    const newAvgLatency =
      alpha * stats.avgLatencyMs +
      (1 - alpha) * (parseFloat(existingDep.avgLatencyMs || '0') || 0);

    const newP99Latency =
      alpha * stats.p99LatencyMs +
      (1 - alpha) * (parseFloat(existingDep.p99LatencyMs || '0') || 0);

    await db
      .update(serviceDependencies)
      .set({
        requestCount: sql`${serviceDependencies.requestCount} + ${stats.requestCount}`,
        errorCount: sql`${serviceDependencies.errorCount} + ${stats.errorCount}`,
        avgLatencyMs: newAvgLatency.toFixed(2),
        p99LatencyMs: newP99Latency.toFixed(2),
        lastSeenAt: stats.lastSeenAt,
        updatedAt: now,
      })
      .where(eq(serviceDependencies.id, existingDep.id));
  } else {
    // Insert new dependency
    await db.insert(serviceDependencies).values({
      projectId,
      sourceService: stats.sourceService,
      targetService: stats.targetService,
      requestCount: stats.requestCount,
      errorCount: stats.errorCount,
      avgLatencyMs: stats.avgLatencyMs.toFixed(2),
      p99LatencyMs: stats.p99LatencyMs.toFixed(2),
      lastSeenAt: stats.lastSeenAt,
      createdAt: now,
      updatedAt: now,
    });

    console.log(
      `[ServiceDependencyAggregator] Created new dependency: ${stats.sourceService} -> ${stats.targetService}`
    );
  }
}

// Clean up old dependencies (optional - run less frequently)
export async function cleanupStaleDependencies(): Promise<void> {
  console.log('[ServiceDependencyAggregator] Cleaning up stale dependencies...');

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const result = await db
    .delete(serviceDependencies)
    .where(sql`${serviceDependencies.lastSeenAt} < ${sevenDaysAgo}`);

  console.log(`[ServiceDependencyAggregator] Removed stale dependencies`);
}
