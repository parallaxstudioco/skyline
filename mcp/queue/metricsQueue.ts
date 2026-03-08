import { Queue } from 'bullmq';
import { appConfig } from '@lib/config';
import { getBullConnectionOptions } from '@mcp/redis';

export interface MetricsRefreshJobPayload {
  accountKey: string;
  reason: string;
  delayMs?: number;
}

let metricsQueue: Queue<MetricsRefreshJobPayload> | null = null;

export function getMetricsQueue() {
  if (!metricsQueue) {
    metricsQueue = new Queue<MetricsRefreshJobPayload>(appConfig.metricsQueueName, {
      connection: getBullConnectionOptions(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
      },
    });
  }
  return metricsQueue;
}

export async function enqueueMetricsRefresh(accountKey: string, payload: { reason: string; delayMs?: number }) {
  const queue = getMetricsQueue();
  await queue.add(
    `${accountKey}:${payload.reason}`,
    { accountKey, reason: payload.reason, delayMs: payload.delayMs },
    { delay: payload.delayMs }
  );
}

export async function scheduleRecurringMetricsRefresh(accountKey: string) {
  const queue = getMetricsQueue();
  await queue.upsertJobScheduler(
    `recurring-refresh:${accountKey}`,
    {
      every: appConfig.accountMetricsTtlMs,
    },
    {
      name: `refresh:${accountKey}`,
      data: { accountKey, reason: 'recurring' },
    }
  );
}

export async function bootstrapMetricsSchedulers(accounts: { username: string }[]) {
  for (const account of accounts) {
    await scheduleRecurringMetricsRefresh(account.username);
  }
}
