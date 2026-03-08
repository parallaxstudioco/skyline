import fs from 'fs/promises';
import path from 'path';

export interface ConnectedInstagramAccountRecord {
  username: string;
  instagramUserId?: string;
  accessToken?: string;
  tokenExpiry?: string;
}

const DATA_PATH = path.join(process.cwd(), 'data', 'instagram-connections.json');

export class ConnectedAccountsStore {
  private async read(): Promise<ConnectedInstagramAccountRecord[]> {
    try {
      const data = await fs.readFile(DATA_PATH, 'utf-8');
      return JSON.parse(data) as ConnectedInstagramAccountRecord[];
    } catch (error) {
      return [];
    }
  }

  private async write(accounts: ConnectedInstagramAccountRecord[]): Promise<void> {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    await fs.writeFile(DATA_PATH, JSON.stringify(accounts, null, 2), 'utf-8');
  }

  async list(): Promise<ConnectedInstagramAccountRecord[]> {
    return this.read();
  }

  async getByUsername(username: string): Promise<ConnectedInstagramAccountRecord | undefined> {
    const accounts = await this.read();
    return accounts.find(
      (a) => a.username.toLowerCase() === username.trim().toLowerCase()
    );
  }

  async upsert(record: ConnectedInstagramAccountRecord): Promise<void> {
    const accounts = await this.read();
    const index = accounts.findIndex(
      (a) => a.username.toLowerCase() === record.username.toLowerCase()
    );

    if (index >= 0) {
      accounts[index] = { ...accounts[index], ...record };
    } else {
      accounts.push(record);
    }

    await this.write(accounts);
  }

  async remove(username: string): Promise<void> {
    const accounts = await this.read();
    const filtered = accounts.filter(
      (a) => a.username.toLowerCase() !== username.toLowerCase()
    );
    await this.write(filtered);
  }
}

export const connectedAccountsStore = new ConnectedAccountsStore();
