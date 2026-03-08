import { getRedisClient } from '@mcp/redis';
import { getMetricsQueue } from '@mcp/queue/metricsQueue';

export async function bootstrapBackendServices() {
  try {
    // Ensure Redis is connected
    const redis = getRedisClient();
    await redis.ping();
    
    // Ensure Queues are initialized
    getMetricsQueue();
    
    console.log('Backend services bootstrapped successfully.');
  } catch (error) {
    console.error('Failed to bootstrap backend services:', error);
    throw error;
  }
}
