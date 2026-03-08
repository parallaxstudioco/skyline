import type { AccountMetrics, PostData } from '@lib/types';
import { appConfig } from '@lib/config';
import { getRedisClient } from '@mcp/redis';

export class CacheService {
  private get redis() {
    return getRedisClient();
  }

  private buildAccountKey(accountKey: string): string {
    return `cache:account:${accountKey}`;
  }

  private buildPostKey(accountKey: string, postId: string): string {
    return `cache:post:${accountKey}:${postId}`;
  }

  async getAccountMetrics(accountKey: string): Promise<AccountMetrics | null> {
    const cachedValue = await this.redis.get(this.buildAccountKey(accountKey));
    if (!cachedValue) {
      return null;
    }

    const parsedAccount = JSON.parse(cachedValue) as AccountMetrics & {
      instagramUserId?: string;
    };
    const normalizedAccountKey =
      parsedAccount.accountKey ?? parsedAccount.instagramUserId ?? parsedAccount.username;
    const hydratedPosts = await Promise.all(
      parsedAccount.postsData.map(async (post) => {
        const cachedPost = await this.getPostMetrics(normalizedAccountKey, post.id);
        return cachedPost ?? post;
      })
    );

    return {
      ...parsedAccount,
      accountKey: normalizedAccountKey,
      postsData: hydratedPosts,
    };
  }

  async getPostMetrics(
    accountKey: string,
    postId: string
  ): Promise<PostData | null> {
    const cachedValue = await this.redis.get(this.buildPostKey(accountKey, postId));
    return cachedValue ? (JSON.parse(cachedValue) as PostData) : null;
  }

  async setAccountMetrics(metrics: AccountMetrics): Promise<void> {
    const pipeline = this.redis.multi();

    pipeline.set(
      this.buildAccountKey(metrics.accountKey),
      JSON.stringify(metrics),
      'PX',
      appConfig.accountMetricsTtlMs
    );

    for (const post of metrics.postsData) {
      pipeline.set(
        this.buildPostKey(metrics.accountKey, post.id),
        JSON.stringify(post),
        'PX',
        appConfig.postMetricsTtlMs
      );
    }

    await pipeline.exec();
  }

  async setPostMetrics(accountKey: string, post: PostData): Promise<void> {
    await this.redis.set(
      this.buildPostKey(accountKey, post.id),
      JSON.stringify(post),
      'PX',
      appConfig.postMetricsTtlMs
    );
  }
}

export const cacheService = new CacheService();
