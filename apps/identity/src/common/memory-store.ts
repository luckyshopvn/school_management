// Kho khóa trong bộ nhớ thay Redis cho dịch vụ định danh ở hồ sơ thử nghiệm (DT-SaaS phần S9, YCTD-203): container gộp chạy
// một bản duy nhất, không có Redis (gói miễn phí của Upstash không đủ lệnh). Chọn bằng REDIS_URL=memory:// (phải ghi rõ, không
// tự rơi về). Chỉ đúng khi có một bản dịch vụ: giới hạn đăng nhập, mã xác nhận, mã một lần mất khi khởi động lại, không chia
// giữa nhiều bản; hồ sơ vận hành luôn dùng Redis. Chỉ có các lệnh dịch vụ định danh dùng
export const MEMORY_STORE_URL = 'memory://';

export interface CacheTransaction {
  get(key: string): CacheTransaction;
  del(key: string): CacheTransaction;
  exec(): Promise<Array<[Error | null, unknown]> | null>;
}

export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<unknown>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  multi(): CacheTransaction;
  // Khối Tình trạng dịch vụ của cổng vận hành (YCTD-376): đo Redis, đếm việc chờ của hàng đợi
  ping(): Promise<string>;
  llen(key: string): Promise<number>;
  disconnect(): void;
}

interface Entry {
  value: string;
  expiresAt: number | null;
}

export class MemoryStore implements CacheStore {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly now: () => number = Date.now) {}

  private read(key: string): Entry | undefined {
    const entry = this.entries.get(key);
    if (entry && entry.expiresAt !== null && entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  async get(key: string): Promise<string | null> {
    return this.read(key)?.value ?? null;
  }

  async set(key: string, value: string, _mode: 'EX', seconds: number): Promise<'OK'> {
    this.entries.set(key, { value, expiresAt: this.now() + seconds * 1000 });
    return 'OK';
  }

  async incr(key: string): Promise<number> {
    const entry = this.read(key);
    const next = Number(entry?.value ?? 0) + 1;
    this.entries.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.read(key);
    if (!entry) {
      return 0;
    }
    entry.expiresAt = this.now() + seconds * 1000;
    return 1;
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      if (this.read(key)) {
        removed += 1;
      }
      this.entries.delete(key);
    }
    return removed;
  }

  // Các lệnh trong một lần gọi chạy liền nhau (Node một luồng), như MULTI của Redis
  multi(): CacheTransaction {
    const steps: Array<() => Promise<unknown>> = [];
    const transaction: CacheTransaction = {
      get: (key) => {
        steps.push(() => this.get(key));
        return transaction;
      },
      del: (key) => {
        steps.push(() => this.del(key));
        return transaction;
      },
      exec: async () => {
        const results: Array<[Error | null, unknown]> = [];
        for (const step of steps) {
          results.push([null, await step()]);
        }
        return results;
      },
    };
    return transaction;
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  // Kho trong bộ nhớ không giữ danh sách: hàng đợi luôn rỗng
  async llen(): Promise<number> {
    return 0;
  }

  disconnect(): void {
    this.entries.clear();
  }
}
