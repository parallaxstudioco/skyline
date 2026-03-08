import { Worker, type Job } from 'bullmq';
import { appConfig } from '@lib/config';
import { bootstrapMetricsSchedulers, enqueueMetricsRefresh, type MetricsRefreshJobPayload } from '@mcp/queue/metricsQueue';
import { getBullConnectionOptions } from '@mcp/redis';
import { realtimeUpdateService } from '@services/RealtimeUpdateService';
import { instagramMetricsService } from '@services/InstagramMetricsService';
import { RateLimitBackoffError } from '@services/RateLimitService';
import { connectedAccountsStore } from '@lib/store/connectedAccounts';

export class MetricsWorker {
  async bootstrap(): Promise<void> {
    const connectedAccounts = await connectedAccountsStore.list();
    await bootstrapMetricsSchedulers(connectedAccounts);
  }

  async process(job: Job<MetricsRefreshJobPayload>) {
    try {
      const metrics = await instagramMetricsService.refreshAccountMetrics(
        job.data.accountKey,
        {
          delayOnRateLimit: false,
          reason: job.data.reason,
          throwOnRateLimit: true,
        }
      );

      await realtimeUpdateService.publishMetricsUpdate(metrics, job.data.reason);
      return {
        status: 'updated',
        accountKey: job.data.accountKey,
      };
    } catch (error) {
      if (error instanceof RateLimitBackoffError) {
        await enqueueMetricsRefresh(job.data.accountKey, {
          delayMs: error.retryAfterMs,
          reason: 'rate-limit-backoff',
        });

        return {
          status: 'delayed',
          accountKey: job.data.accountKey,
          retryAfterMs: error.retryAfterMs,
        };
      }

      throw error;
    }
  }

  async run(): Promise<Worker<MetricsRefreshJobPayload>> {
    await this.bootstrap();

    const worker = new Worker<MetricsRefreshJobPayload>(
      appConfig.metricsQueueName,
      async (job) => this.process(job),
      {
        connection: getBullConnectionOptions(),
        concurrency: 2,
      }
    );

    worker.on('failed', (job, error) => {
      console.error(
        `Metrics worker failed for ${job?.data.accountKey ?? 'unknown account'}:`,
        error
      );
    });

    return worker;
  }
}

export const metricsWorker = new MetricsWorker();
