import { Inject, Injectable, Optional, type OnModuleDestroy } from '@nestjs/common';
import { createDatabase, type IdentityDatabase, type TenancyRuntime } from '@school-management/database';
import { requireTenant } from '@school-management/server';
import { Redis } from 'ioredis';
import type { Kysely } from 'kysely';
import { IDENTITY_CONFIGURATION, TENANCY_RUNTIME, type IdentityConfiguration } from './configuration.js';

// Kết nối cơ sở dữ liệu định danh và Redis, đóng khi dịch vụ dừng
@Injectable()
export class Infrastructure implements OnModuleDestroy {
  private readonly singleDatabase: Kysely<IdentityDatabase> | null;
  readonly redis: Redis;

  constructor(
    @Inject(IDENTITY_CONFIGURATION) private readonly configuration: IdentityConfiguration,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null = null,
  ) {
    this.singleDatabase = tenancy ? null : createDatabase<IdentityDatabase>(configuration.databaseUrl);
    this.redis = new Redis(configuration.redisUrl, { maxRetriesPerRequest: 3 });
  }

  // Chế độ một trường: cơ sở dữ liệu định danh duy nhất. Chế độ nhiều trường (DT-SaaS phần S1a): cơ sở dữ liệu định danh của
  // trường trong ngữ cảnh của yêu cầu; thiếu ngữ cảnh là lỗi
  get database(): Kysely<IdentityDatabase> {
    const tenant = requireTenant('cơ sở dữ liệu định danh');
    if (tenant && this.tenancy) {
      return this.tenancy.connections.database<IdentityDatabase>(tenant, 'identity', 'identity');
    }
    return this.singleDatabase as Kysely<IdentityDatabase>;
  }

  // Tiền tố khóa Redis của dịch vụ: thêm tiền tố của trường ở chế độ nhiều trường để giới hạn đăng nhập, mã xác nhận, đếm lần
  // sai không lẫn giữa các trường; trường số 1 có tiền tố trống nên khóa hiện có còn đúng
  keyPrefix(): string {
    const tenant = requireTenant('bộ nhớ đệm định danh');
    return tenant?.keyPrefix
      ? `${this.configuration.redisKeyPrefix}:t:${tenant.keyPrefix}`
      : this.configuration.redisKeyPrefix;
  }

  async onModuleDestroy(): Promise<void> {
    this.redis.disconnect();
    await this.singleDatabase?.destroy();
  }
}
