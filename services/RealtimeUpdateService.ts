import Pusher from 'pusher';
import type { AccountMetrics } from '@lib/types';
import { appConfig } from '@lib/config';

export interface MetricsUpdateMessage {
  reason: string;
  type: 'metrics:update';
  updatedAt: string;
  metrics: AccountMetrics;
}

export class RealtimeUpdateService {
  private pusher: Pusher | null = null;

  private getPusher() {
    if (!this.pusher && appConfig.pusher.appId) {
      this.pusher = new Pusher({
        appId: appConfig.pusher.appId,
        key: appConfig.pusher.key,
        secret: appConfig.pusher.secret,
        cluster: appConfig.pusher.cluster,
        useTLS: true,
      });
    }
    return this.pusher;
  }

  async publishMetricsUpdate(metrics: AccountMetrics, reason: string): Promise<void> {
    const payload: MetricsUpdateMessage = {
      type: 'metrics:update',
      metrics,
      reason,
      updatedAt: new Date().toISOString(),
    };

    const pusher = this.getPusher();
    if (pusher) {
      await pusher.trigger(appConfig.realtimeChannel, payload.type, payload);
    } else {
      console.warn('Pusher not configured, real-time update skipped.');
    }
  }

  // legacy bridge for socket.io - keeping signature but making it a no-op for serverless
  async bridgeSocketServer(_io: any): Promise<() => Promise<void>> {
    return async () => {};
  }
}

export const realtimeUpdateService = new RealtimeUpdateService();
