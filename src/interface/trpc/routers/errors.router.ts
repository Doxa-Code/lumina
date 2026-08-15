import { z } from 'zod';
import { createHash } from 'crypto';
import { router, projectProcedure } from '../trpc.js';
import { db } from '../../../infrastructure/database/connection.js';
import { errorGroups } from '../../../infrastructure/database/schema/query.js';
import { spans } from '../../../infrastructure/database/schema/telemetry.js';
import { eq, desc, sql, and, gte } from 'drizzle-orm';

function generateErrorFingerprint(serviceName: string, errorType: string, errorMessage: string): string {
  const normalizedMessage = errorMessage
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<UUID>')
    .replace(/\b\d{10,13}\b/g, '<TIMESTAMP>')
    .replace(/\b\d+\b/g, '<NUM>')
    .slice(0, 200);

  const input = `${serviceName}:${errorType}:${normalizedMessage}`;
  return createHash('sha256').update(input).digest('hex').slice(0, 32);
}

export const errorsRouter = router({
  list: projectProcedure
    .input(
      z.object({
        status: z.enum(['active', 'resolved', 'ignored']).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const conditions = [eq(errorGroups.projectId, ctx.project!.id)];

      if (input.status) {
        conditions.push(eq(errorGroups.status, input.status));
      }

      const groups = await db
        .select()
        .from(errorGroups)
        .where(and(...conditions))
        .orderBy(desc(errorGroups.lastSeenAt))
        .limit(input.limit)
        .offset(input.offset);

      return groups.map((g) => ({
        id: g.id,
        fingerprint: g.fingerprint,
        message: g.title,
        type: g.type,
        serviceName: (g.services as string[])?.[0] || 'unknown',
        count: parseInt(g.eventCount) || 0,
        firstSeen: g.firstSeenAt.toISOString(),
        lastSeen: g.lastSeenAt.toISOString(),
        status: g.status === 'active' ? 'open' : g.status,
        affectedTraces: [],
      }));
    }),

  get: projectProcedure
    .input(z.object({ errorGroupId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const [group] = await db
        .select()
        .from(errorGroups)
        .where(
          and(
            eq(errorGroups.id, input.errorGroupId),
            eq(errorGroups.projectId, ctx.project!.id)
          )
        )
        .limit(1);

      if (!group) {
        return null;
      }

      // Get recent traces with this error
      const recentTraces = await db
        .select({ traceId: spans.traceId })
        .from(spans)
        .where(
          and(
            eq(spans.projectId, ctx.project!.id),
            eq(spans.statusCode, 'ERROR')
          )
        )
        .limit(10);

      return {
        id: group.id,
        fingerprint: group.fingerprint,
        message: group.title,
        type: group.type,
        serviceName: (group.services as string[])?.[0] || 'unknown',
        count: parseInt(group.eventCount) || 0,
        firstSeen: group.firstSeenAt.toISOString(),
        lastSeen: group.lastSeenAt.toISOString(),
        status: group.status === 'active' ? 'open' : group.status,
        affectedTraces: recentTraces.map((t) => t.traceId),
      };
    }),

  updateStatus: projectProcedure
    .input(
      z.object({
        errorGroupId: z.string().uuid(),
        status: z.enum(['active', 'resolved', 'ignored']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await db
        .update(errorGroups)
        .set({
          status: input.status,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(errorGroups.id, input.errorGroupId),
            eq(errorGroups.projectId, ctx.project!.id)
          )
        );

      return { success: true };
    }),

  stats: projectProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [stats] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        active: sql<number>`SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END)`,
        resolved: sql<number>`SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END)`,
        ignored: sql<number>`SUM(CASE WHEN status = 'ignored' THEN 1 ELSE 0 END)`,
        totalOccurrences: sql<number>`SUM(CAST(event_count AS INTEGER))`,
      })
      .from(errorGroups)
      .where(eq(errorGroups.projectId, ctx.project!.id));

    const [last24h] = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(errorGroups)
      .where(
        and(
          eq(errorGroups.projectId, ctx.project!.id),
          gte(errorGroups.firstSeenAt, oneDayAgo)
        )
      );

    const [last7d] = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(errorGroups)
      .where(
        and(
          eq(errorGroups.projectId, ctx.project!.id),
          gte(errorGroups.firstSeenAt, sevenDaysAgo)
        )
      );

    return {
      total: Number(stats?.total) || 0,
      open: Number(stats?.active) || 0,
      resolved: Number(stats?.resolved) || 0,
      ignored: Number(stats?.ignored) || 0,
      totalOccurrences: Number(stats?.totalOccurrences) || 0,
      newLast24h: Number(last24h?.count) || 0,
      newLast7d: Number(last7d?.count) || 0,
    };
  }),

  sync: projectProcedure.mutation(async ({ ctx }) => {
    // Get all error spans for this project
    const errorSpans = await db
      .select({
        serviceName: spans.serviceName,
        statusMessage: spans.statusMessage,
        name: spans.name,
        startTime: spans.startTime,
        attributes: spans.attributes,
        events: spans.events,
      })
      .from(spans)
      .where(
        and(
          eq(spans.projectId, ctx.project!.id),
          eq(spans.statusCode, 'ERROR')
        )
      );

    if (errorSpans.length === 0) {
      return { synced: 0, message: 'No error spans found' };
    }

    // Group errors by fingerprint
    const errorsMap = new Map<string, {
      fingerprint: string;
      type: string;
      message: string;
      serviceName: string;
      firstSeen: Date;
      lastSeen: Date;
      count: number;
    }>();

    for (const span of errorSpans) {
      let errorType = 'Error';
      let errorMessage = span.statusMessage || span.name || 'Unknown error';

      // Check events for exception details
      const events = span.events as Array<{ name: string; attributes?: Record<string, unknown> }> | null;
      if (events) {
        for (const event of events) {
          if (event.name === 'exception' && event.attributes) {
            if (event.attributes['exception.type']) {
              errorType = String(event.attributes['exception.type']);
            }
            if (event.attributes['exception.message']) {
              errorMessage = String(event.attributes['exception.message']);
            }
            break;
          }
        }
      }

      // Check span attributes
      const attrs = span.attributes as Record<string, unknown> | null;
      if (attrs) {
        if (attrs['exception.type']) {
          errorType = String(attrs['exception.type']);
        }
        if (attrs['exception.message']) {
          errorMessage = String(attrs['exception.message']);
        }
      }

      const serviceName = span.serviceName || 'unknown';
      const fingerprint = generateErrorFingerprint(serviceName, errorType, errorMessage);
      const timestamp = span.startTime;

      const existing = errorsMap.get(fingerprint);
      if (existing) {
        existing.count++;
        if (timestamp < existing.firstSeen) {
          existing.firstSeen = timestamp;
        }
        if (timestamp > existing.lastSeen) {
          existing.lastSeen = timestamp;
        }
      } else {
        errorsMap.set(fingerprint, {
          fingerprint,
          type: errorType,
          message: errorMessage,
          serviceName,
          firstSeen: timestamp,
          lastSeen: timestamp,
          count: 1,
        });
      }
    }

    // Upsert error groups
    let synced = 0;
    for (const error of errorsMap.values()) {
      const existing = await db
        .select()
        .from(errorGroups)
        .where(
          and(
            eq(errorGroups.projectId, ctx.project!.id),
            eq(errorGroups.fingerprint, error.fingerprint)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        const currentCount = parseInt(existing[0].eventCount) || 0;
        const newFirstSeen = error.firstSeen < existing[0].firstSeenAt ? error.firstSeen : existing[0].firstSeenAt;
        const newLastSeen = error.lastSeen > existing[0].lastSeenAt ? error.lastSeen : existing[0].lastSeenAt;

        await db
          .update(errorGroups)
          .set({
            firstSeenAt: newFirstSeen,
            lastSeenAt: newLastSeen,
            eventCount: String(currentCount + error.count),
            updatedAt: new Date(),
          })
          .where(eq(errorGroups.id, existing[0].id));
      } else {
        await db.insert(errorGroups).values({
          projectId: ctx.project!.id,
          fingerprint: error.fingerprint,
          title: error.message.slice(0, 500),
          type: error.type,
          firstSeenAt: error.firstSeen,
          lastSeenAt: error.lastSeen,
          eventCount: String(error.count),
          status: 'active',
          services: [error.serviceName],
        });
      }
      synced++;
    }

    return { synced, message: `Synced ${synced} error groups from ${errorSpans.length} error spans` };
  }),
});
