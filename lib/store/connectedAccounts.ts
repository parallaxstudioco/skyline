import { getRedisClient } from '@mcp/redis';

export interface ConnectedInstagramAccountRecord {
  username: string;
  instagramUserId?: string;
  accessToken?: string;
  tokenExpiry?: string;
}

const REDIS_KEY_PREFIX = 'account:';
const ACCOUNTS_LIST_KEY = 'accounts:list';

export class ConnectedAccountsStore {
  private get redis() {
    return getRedisClient();
  }

  private getKey(username: string): string {
    return `${REDIS_KEY_PREFIX}${username.toLowerCase().trim()}`;
  }

  async list(): Promise<ConnectedInstagramAccountRecord[]> {
    const usernames = await this.redis.smembers(ACCOUNTS_LIST_KEY);
    if (usernames.length === 0) return [];

    const keys = usernames.map(u => this.getKey(u));
    const pipeline = this.redis.pipeline();
    keys.forEach(k => pipeline.get(k));
    
    const results = await pipeline.exec();
    if (!results) return [];

    return results
      .map(([err, val]) => {
        if (err || !val) return null;
        return JSON.parse(val as string) as ConnectedInstagramAccountRecord;
      })
      .filter((a): a is ConnectedInstagramAccountRecord => a !== null);
  }

  async getByUsername(username: string): Promise<ConnectedInstagramAccountRecord | undefined> {
    const data = await this.redis.get(this.getKey(username));
    if (!data) return undefined;
    return JSON.parse(data) as ConnectedInstagramAccountRecord;
  }

  async upsert(record: ConnectedInstagramAccountRecord): Promise<void> {
    const key = this.getKey(record.username);
    const username = record.username.toLowerCase().trim();
    
    await this.redis.pipeline()
      .set(key, JSON.stringify(record))
      .sadd(ACCOUNTS_LIST_KEY, username)
      .exec();
  }

  async remove(username: string): Promise<void> {
    const key = this.getKey(username);
    const normalizedUsername = username.toLowerCase().trim();
    
    await this.redis.pipeline()
      .del(key)
      .srem(ACCOUNTS_LIST_KEY, normalizedUsername)
      .exec();
  }
}

export const connectedAccountsStore = new ConnectedAccountsStore();
