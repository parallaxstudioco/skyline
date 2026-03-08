import Redis, { type RedisOptions } from 'ioredis';
import { appConfig } from '@lib/config';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: appConfig.redis.host,
      port: appConfig.redis.port,
      password: appConfig.redis.password,
      maxRetriesPerRequest: null, // Required by BullMQ
    });
  }
  return redisClient;
}

export function createRedisConnection() {
  return new Redis(getBullConnectionOptions());
}

export function getBullConnectionOptions(): RedisOptions {
  return {
    host: appConfig.redis.host,
    port: appConfig.redis.port,
    password: appConfig.redis.password,
    maxRetriesPerRequest: null,
  };
}
