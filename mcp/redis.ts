import Redis, { type RedisOptions } from 'ioredis';
import { appConfig } from '@lib/config';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    const options = getBullConnectionOptions();
    if (appConfig.redis.url) {
      redisClient = new Redis(appConfig.redis.url, options);
    } else {
      redisClient = new Redis(options);
    }
  }
  return redisClient;
}

export function createRedisConnection() {
  return new Redis(getBullConnectionOptions());
}

export function getBullConnectionOptions(): RedisOptions {
  return {
    host: appConfig.redis.url ? undefined : appConfig.redis.host,
    port: appConfig.redis.url ? undefined : appConfig.redis.port,
    password: appConfig.redis.url ? undefined : appConfig.redis.password,
    maxRetriesPerRequest: null,
  };
}
