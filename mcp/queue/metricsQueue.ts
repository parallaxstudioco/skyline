import { inngest } from '@/lib/inngest';
import { appConfig } from '@lib/config';

export interface MetricsRefreshJobPayload {
  accountKey: string;
  reason: string;
  delayMs?: number;
}

/**
 * Enqueues a metrics refresh event via Inngest.
 */
export async function enqueueMetricsRefresh(accountKey: string, payload: { reason: string; delayMs?: number }) {
  await inngest.send({
    name: "app/metrics.refresh",
    data: {
      accountKey,
      reason: payload.reason,
    },
    // Inngest handles delays automatically if specified, or we can use step.sleep in the function
  });
}

/**
 * Schedules a recurring refresh event. 
 * In Vercel environment, we use Inngest's cron-based scheduling or simply trigger on demand.
 */
export async function scheduleRecurringMetricsRefresh(accountKey: string) {
  // Trigger an initial refresh
  await enqueueMetricsRefresh(accountKey, { reason: 'initial-setup' });
}

/**
 * Bootstraps refresh for all accounts.
 */
export async function bootstrapMetricsSchedulers(accounts: { username: string }[]) {
  for (const account of accounts) {
    await scheduleRecurringMetricsRefresh(account.username);
  }
}
