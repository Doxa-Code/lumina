import cron, { ScheduledTask } from 'node-cron';
import { evaluateAlerts } from './alert-engine.js';
import { aggregateServiceDependencies } from './service-dependency-aggregator.js';

interface JobConfig {
  name: string;
  schedule: string;
  handler: () => Promise<void>;
  enabled: boolean;
}

const jobs: JobConfig[] = [
  {
    name: 'Alert Evaluation',
    schedule: '*/1 * * * *', // Every minute
    handler: evaluateAlerts,
    enabled: true,
  },
  {
    name: 'Service Dependency Aggregation',
    schedule: '*/10 * * * *', // Every 10 minutes
    handler: aggregateServiceDependencies,
    enabled: true,
  },
];

const scheduledJobs: Map<string, ScheduledTask> = new Map();

export function startScheduler(): void {
  console.log('[Scheduler] Starting background job scheduler...');

  for (const job of jobs) {
    if (!job.enabled) {
      console.log(`[Scheduler] Skipping disabled job: ${job.name}`);
      continue;
    }

    try {
      const task = cron.schedule(
        job.schedule,
        async () => {
          const startTime = Date.now();
          console.log(`[Scheduler] Running job: ${job.name}`);

          try {
            await job.handler();
            const duration = Date.now() - startTime;
            console.log(`[Scheduler] Job completed: ${job.name} (${duration}ms)`);
          } catch (error) {
            console.error(`[Scheduler] Job failed: ${job.name}`, error);
          }
        },
        {
          timezone: 'UTC',
        }
      );

      scheduledJobs.set(job.name, task);
      console.log(`[Scheduler] Scheduled job: ${job.name} (${job.schedule})`);
    } catch (error) {
      console.error(`[Scheduler] Failed to schedule job: ${job.name}`, error);
    }
  }

  console.log(`[Scheduler] Successfully scheduled ${scheduledJobs.size} jobs`);
}

export function stopScheduler(): void {
  console.log('[Scheduler] Stopping background job scheduler...');

  for (const [name, task] of scheduledJobs.entries()) {
    task.stop();
    console.log(`[Scheduler] Stopped job: ${name}`);
  }

  scheduledJobs.clear();
  console.log('[Scheduler] All jobs stopped');
}

export function getScheduledJobs(): string[] {
  return Array.from(scheduledJobs.keys());
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Scheduler] SIGTERM received, stopping scheduler...');
  stopScheduler();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Scheduler] SIGINT received, stopping scheduler...');
  stopScheduler();
  process.exit(0);
});
