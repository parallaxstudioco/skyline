import { getRedisClient } from '@mcp/redis';

export async function bootstrapBackendServices() {
  try {
    // Ensure Redis is connected (essential for account storage)
    const redis = getRedisClient();
    
    // Add a race to prevent hanging indefinitely on connect
    await Promise.race([
      redis.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis connection timeout')), 2000))
    ]);
    
    console.log('Backend services bootstrapped successfully (Redis connected).');
  } catch (error) {
    console.warn('Backend services bootstrap skipped or failed:', (error instanceof Error ? error.message : String(error)));
    // Continue anyway; the individual routes will fail gracefully if needed
  }
}
