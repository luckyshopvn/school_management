import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { createDatabase, type IdentityDatabase } from '@school-management/database';
import { Redis } from 'ioredis';
import type { Kysely } from 'kysely';
import { IDENTITY_CONFIGURATION, type IdentityConfiguration } from './configuration.js';

// Kết nối cơ sở dữ liệu định danh và Redis, đóng khi dịch vụ dừng
@Injectable()
export class Infrastructure implements OnModuleDestroy {
  readonly database: Kysely<IdentityDatabase>;
  readonly redis: Redis;

  constructor(@Inject(IDENTITY_CONFIGURATION) configuration: IdentityConfiguration) {
    this.database = createDatabase<IdentityDatabase>(configuration.databaseUrl);
    this.redis = new Redis(configuration.redisUrl, { maxRetriesPerRequest: 3 });
  }

  async onModuleDestroy(): Promise<void> {
    this.redis.disconnect();
    await this.database.destroy();
  }
}
