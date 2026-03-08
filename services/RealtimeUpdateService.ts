import type { Server as SocketIOServer } from 'socket.io';
import type { AccountMetrics } from '@lib/types';
import { appConfig } from '@lib/config';
import { createRedisConnection, getRedisClient } from '@mcp/redis';

export interface MetricsUpdateMessage {
  reason: string;
  type: 'metrics:update';
  updatedAt: string;
  metrics: AccountMetrics;
}

export class RealtimeUpdateService {
  private get publisher() {
    return getRedisClient();
  }

  async publishMetricsUpdate(metrics: AccountMetrics, reason: string): Promise<void> {
    const payload: MetricsUpdateMessage = {
      type: 'metrics:update',
      metrics,
      reason,
      updatedAt: new Date().toISOString(),
    };

    await this.publisher.publish(appConfig.realtimeChannel, JSON.stringify(payload));
  }

  async bridgeSocketServer(io: SocketIOServer): Promise<() => Promise<void>> {
    const subscriber = createRedisConnection();
    await subscriber.subscribe(appConfig.realtimeChannel);

    const handleMessage = (channel: string, rawMessage: string) => {
      if (channel !== appConfig.realtimeChannel) {
        return;
      }

      const payload = JSON.parse(rawMessage) as MetricsUpdateMessage;
      io.emit(payload.type, payload);
    };

    subscriber.on('message', handleMessage);

    return async () => {
      subscriber.off('message', handleMessage);
      await subscriber.unsubscribe(appConfig.realtimeChannel);
      await subscriber.quit();
    };
  }
}

export const realtimeUpdateService = new RealtimeUpdateService();
