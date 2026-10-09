import { Inject, Injectable } from '@nestjs/common';
import { ApplicationError, Clock } from '@school-management/server';
import { IDENTITY_CONFIGURATION, type IdentityConfiguration } from '../common/configuration.js';
import { Infrastructure } from '../common/infrastructure.js';

// Giới hạn số yêu cầu đăng nhập mỗi phút trên một địa chỉ mạng (BM-26, XT-05)
@Injectable()
export class LoginRateLimiter {
  constructor(
    @Inject(IDENTITY_CONFIGURATION) private readonly configuration: IdentityConfiguration,
    private readonly infrastructure: Infrastructure,
    private readonly clock: Clock,
  ) {}

  async check(ipAddress: string): Promise<void> {
    const nowMilliseconds = this.clock.now().getTime();
    const minute = Math.floor(nowMilliseconds / 60_000);
    const key = `${this.configuration.redisKeyPrefix}:login-rate:${ipAddress}:${minute}`;
    const count = await this.infrastructure.redis.incr(key);
    if (count === 1) {
      await this.infrastructure.redis.expire(key, 120);
    }
    if (count > this.configuration.loginRequestsPerMinutePerAddress) {
      const retryAfterSeconds = Math.ceil(((minute + 1) * 60_000 - nowMilliseconds) / 1000);
      throw new ApplicationError(
        'ERR_RATE_LIMIT',
        `Bạn thao tác quá nhanh, vui lòng thử lại sau ${retryAfterSeconds} giây`,
        [],
        retryAfterSeconds,
      );
    }
  }
}
