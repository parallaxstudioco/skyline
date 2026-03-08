import { randomUUID } from 'crypto';
import { appConfig } from '@lib/config';
import { getRedisClient } from '@mcp/redis';

export interface RateLimitDecision {
  allowed: boolean;
  globalRemaining: number;
  retryAfterMs: number;
  userRemaining: number;
}

export class RateLimitBackoffError extends Error {
  constructor(
    readonly accountKey: string,
    readonly retryAfterMs: number
  ) {
    super(
      `Instagram request rate limit reached for ${accountKey}. Retry in ${retryAfterMs}ms.`
    );
    this.name = 'RateLimitBackoffError';
  }
}

const slidingWindowScript = `
local globalKey = KEYS[1]
local userKey = KEYS[2]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local globalLimit = tonumber(ARGV[3])
local userLimit = tonumber(ARGV[4])
local member = ARGV[5]
local threshold = now - windowMs

redis.call('ZREMRANGEBYSCORE', globalKey, 0, threshold)
redis.call('ZREMRANGEBYSCORE', userKey, 0, threshold)

local globalCount = redis.call('ZCARD', globalKey)
local userCount = redis.call('ZCARD', userKey)

if globalCount >= globalLimit or userCount >= userLimit then
  local oldestGlobal = redis.call('ZRANGE', globalKey, 0, 0, 'WITHSCORES')
  local oldestUser = redis.call('ZRANGE', userKey, 0, 0, 'WITHSCORES')
  local globalRetry = 0
  local userRetry = 0

  if globalCount >= globalLimit and oldestGlobal[2] then
    globalRetry = windowMs - (now - tonumber(oldestGlobal[2]))
  end

  if userCount >= userLimit and oldestUser[2] then
    userRetry = windowMs - (now - tonumber(oldestUser[2]))
  end

  local retryAfter = math.max(globalRetry, userRetry)
  if retryAfter < 0 then
    retryAfter = 0
  end

  return {0, retryAfter, userCount, globalCount}
end

redis.call('ZADD', globalKey, now, member)
redis.call('ZADD', userKey, now, member)
redis.call('PEXPIRE', globalKey, windowMs)
redis.call('PEXPIRE', userKey, windowMs)

return {1, 0, userCount + 1, globalCount + 1}
`;

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export class RateLimitService {
  private get redis() {
    return getRedisClient();
  }

  async consume(accountKey: string): Promise<RateLimitDecision> {
    const now = Date.now();
    const member = `${now}:${randomUUID()}`;
    const rawResult = (await this.redis.eval(
      slidingWindowScript,
      2,
      'rate_limit',
      `rate_limit:user:${accountKey}`,
      now,
      appConfig.rateLimitWindowMs,
      appConfig.globalRateLimitPerHour,
      appConfig.userRateLimitPerHour,
      member
    )) as [number, number, number, number];

    const allowed = rawResult[0] === 1;
    const retryAfterMs = rawResult[1] ?? 0;
    const userCount = rawResult[2] ?? 0;
    const globalCount = rawResult[3] ?? 0;

    return {
      allowed,
      retryAfterMs,
      userRemaining: Math.max(appConfig.userRateLimitPerHour - userCount, 0),
      globalRemaining: Math.max(appConfig.globalRateLimitPerHour - globalCount, 0),
    };
  }

  async waitUntilAllowed(accountKey: string): Promise<void> {
    for (;;) {
      const decision = await this.consume(accountKey);

      if (decision.allowed) {
        return;
      }

      await sleep(Math.max(decision.retryAfterMs, 1000));
    }
  }
}

export const rateLimitService = new RateLimitService();
