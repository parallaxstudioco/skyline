import { getRedisClient } from '@mcp/redis';

export async function bootstrapBackendServices() {
  try {
    // Ensure Redis is connected (essential for account storage)
    const redis = getRedisClient();
    await redis.ping();
    
    console.log('Backend services bootstrapped successfully (Redis connected).');
  } catch (error) {
    console.error('Failed to bootstrap backend services:', error);
    // In serverless, we might not want to throw and crash the entire process
    // but individual functions will handle their own connectivity
  }
}
