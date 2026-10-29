import {
  Inject,
  Injectable,
  Logger,
  Optional,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { TenancyRuntime } from '@school-management/database';
import {
  API_STATUS_KEY,
  API_STATUS_SECONDS,
  API_STATUS_TTL_SECONDS,
  timedCheck,
  type ApiStatusRecord,
} from '@school-management/server/service-status';
import { Redis } from 'ioredis';
import { sql } from 'kysely';
import { S3FileStorage } from '../files/file-storage.js';
import { API_CONFIGURATION, TENANCY_RUNTIME, type ApiConfiguration } from './configuration.js';
import { Databases } from './databases.js';

// Máy chủ API tự kiểm cho khối "Tình trạng dịch vụ" của cổng vận hành (YCTD-376, phương án A): mỗi 60 giây đo cơ sở dữ liệu
// (nền tảng ở chế độ nhiều trường, hệ thống ở chế độ một trường) và thùng chứa tệp dùng chung, ghi kết quả vào Redis, hết hạn sau 180
// giây. Không có REDIS_URL thì không chạy. Không thêm điểm cuối, không ghi nội dung lỗi gốc
export async function collectApiStatus(
  checkDatabase: () => Promise<unknown>,
  checkStorage: (() => Promise<unknown>) | null,
  now: Date,
): Promise<ApiStatusRecord> {
  const [database, storage] = await Promise.all([
    timedCheck(checkDatabase),
    checkStorage ? timedCheck(checkStorage) : Promise.resolve(null),
  ]);
  return { checked_at: now.toISOString(), database, storage };
}

@Injectable()
export class ServiceStatusReporter implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ServiceStatusReporter.name);
  private redis: Redis | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration,
    private readonly databases: Databases,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null = null,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.configuration.redisUrl) {
      return;
    }
    this.redis = new Redis(this.configuration.redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
    this.redis.on('error', (error: Error) => this.logger.warn(`Redis của tự kiểm tình trạng lỗi: ${error.message}`));
    const storage = this.configuration.objectStorage ? new S3FileStorage(this.configuration.objectStorage) : null;
    const tenancy = this.tenancy;
    const checkDatabase = tenancy
      ? () => sql`select 1`.execute(tenancy.platform)
      : () => sql`select 1`.execute(this.databases.system);
    const report = async () => {
      const record = await collectApiStatus(checkDatabase, storage ? () => storage.probe() : null, new Date());
      await this.redis?.set(API_STATUS_KEY, JSON.stringify(record), 'EX', API_STATUS_TTL_SECONDS);
    };
    const tick = () =>
      void report().catch((error: unknown) =>
        this.logger.warn(`Không ghi được kết quả tự kiểm: ${error instanceof Error ? error.message : String(error)}`),
      );
    tick();
    this.timer = setInterval(tick, API_STATUS_SECONDS * 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.redis?.disconnect();
    this.redis = null;
  }
}
