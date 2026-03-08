import { getRedisClient } from '@mcp/redis';

export async function bootstrapBackendServices() {
  try {
    // Check for essential environment variables on Vercel
    if (process.env.VERCEL && !process.env.REDIS_URL) {
      console.error('CRITICAL: REDIS_URL is missing in Vercel environment. Database operations will fail.');
      return;
    }

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
  }
}
