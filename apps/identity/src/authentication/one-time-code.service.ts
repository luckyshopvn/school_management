import { Inject, Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { ApplicationError, Clock, unauthenticatedError } from '@school-management/server';
import { IDENTITY_CONFIGURATION, type IdentityConfiguration } from '../common/configuration.js';
import { Infrastructure } from '../common/infrastructure.js';
import { SmsSender } from '../messaging/sms-sender.js';
import { IdentitySettingsService } from '../settings/identity-settings.service.js';
import { AuthenticationService, type IssuedTokens, type RequestOrigin } from './authentication.service.js';
import { hashPassword, placeholderPasswordHash, verifyPassword } from './password.js';

// Đăng nhập bằng mã một lần cho phụ huynh (XT-09, BM-61, AC-180, AC-181, YCTD-43)
const PARENT_ROLE_CODE = 'VT-14';
const INVALID_CODE_MESSAGE = 'Mã không đúng hoặc đã hết hạn, vui lòng yêu cầu mã mới';

export interface OneTimeCodeRequestResponse {
  message: string;
  expires_in_seconds: number;
}

@Injectable()
export class OneTimeCodeService {
  constructor(
    @Inject(IDENTITY_CONFIGURATION) private readonly configuration: IdentityConfiguration,
    private readonly infrastructure: Infrastructure,
    private readonly authenticationService: AuthenticationService,
    private readonly identitySettings: IdentitySettingsService,
    private readonly smsSender: SmsSender,
    private readonly clock: Clock,
  ) {}

  private get database() {
    return this.infrastructure.database;
  }

  // Trả cùng một phản hồi dù số điện thoại có hay không (BM-61)
  async request(phone: string, origin: RequestOrigin): Promise<OneTimeCodeRequestResponse> {
    const now = this.clock.now();
    const rules = await this.identitySettings.oneTimeCodeRules();
    const response = {
      message: 'Nếu số điện thoại đã đăng ký tài khoản phụ huynh, mã đăng nhập sẽ được gửi qua tin nhắn',
      expires_in_seconds: rules.lifetimeMinutes * 60,
    };

    // Đếm số lần yêu cầu theo số điện thoại cho mọi số, kể cả số không có trong hệ thống,
    // nên báo vượt giới hạn không lộ số có tồn tại hay không (CTC-DD-022, BM-61)
    const hour = Math.floor(now.getTime() / 3_600_000);
    const counterKey = `${this.configuration.redisKeyPrefix}:one-time-code-requests:${phone}:${hour}`;
    const requestCount = await this.infrastructure.redis.incr(counterKey);
    if (requestCount === 1) {
      await this.infrastructure.redis.expire(counterKey, 7200);
    }
    if (requestCount > rules.maximumSendsPerHour) {
      await this.recordSecurityEvent('one_time_code_send_limit', null, phone, origin.ipAddress);
      const retryAfterSeconds = Math.ceil(((hour + 1) * 3_600_000 - now.getTime()) / 1000);
      throw new ApplicationError(
        'ERR_RATE_LIMIT',
        `Bạn đã yêu cầu mã quá ${rules.maximumSendsPerHour} lần trong giờ này, vui lòng thử lại sau`,
        [],
        retryAfterSeconds,
      );
    }

    const user = await this.findParent(phone);
    if (!user || user.status !== 'active') {
      await this.recordSecurityEvent('one_time_code_request_ignored', user?.id ?? null, phone, origin.ipAddress);
      return response;
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.database.transaction().execute(async (transaction) => {
      // Mã cũ chưa dùng hết hiệu lực khi có mã mới
      await transaction
        .updateTable('one_time_codes')
        .set({ expires_at: now })
        .where('user_id', '=', user.id)
        .where('used_at', 'is', null)
        .where('expires_at', '>', now)
        .execute();
      await transaction
        .insertInto('one_time_codes')
        .values({
          user_id: user.id,
          phone,
          purpose: 'login',
          code_hash: await hashPassword(code),
          expires_at: new Date(now.getTime() + rules.lifetimeMinutes * 60 * 1000),
          created_at: now,
        })
        .execute();
    });
    await this.smsSender.send(
      phone,
      `Mã đăng nhập ứng dụng phụ huynh: ${code}. Mã hết hạn sau ${rules.lifetimeMinutes} phút. Không chia sẻ mã này.`,
    );
    return response;
  }

  // Mã đúng thì cấp phiên đầy đủ kênh phụ huynh, kể cả khi chưa đổi mật khẩu mặc định (Q-147)
  async login(phone: string, code: string, origin: RequestOrigin): Promise<IssuedTokens> {
    const now = this.clock.now();
    const rules = await this.identitySettings.oneTimeCodeRules();
    const user = await this.findParent(phone);
    const accepted = await this.database.transaction().execute(async (transaction) => {
      const current = user
        ? await transaction
            .selectFrom('one_time_codes')
            .selectAll()
            .where('user_id', '=', user.id)
            .where('phone', '=', phone)
            .where('used_at', 'is', null)
            .where('expires_at', '>', now)
            .where('attempt_count', '<', rules.maximumAttempts)
            .orderBy('created_at', 'desc')
            .forUpdate()
            .executeTakeFirst()
        : undefined;
      if (!current) {
        await verifyPassword(await placeholderPasswordHash(), code);
        return false;
      }
      if (!(await verifyPassword(current.code_hash, code))) {
        // Nhập sai đủ số lần thì mã hết hiệu lực, phải yêu cầu mã mới (AC-181)
        const attempts = current.attempt_count + 1;
        await transaction
          .updateTable('one_time_codes')
          .set(
            attempts >= rules.maximumAttempts
              ? { attempt_count: attempts, expires_at: now }
              : { attempt_count: attempts },
          )
          .where('id', '=', current.id)
          .execute();
        return false;
      }
      await transaction.updateTable('one_time_codes').set({ used_at: now }).where('id', '=', current.id).execute();
      return true;
    });
    if (!user || !accepted) {
      await this.recordSecurityEvent('one_time_code_login_failed', user?.id ?? null, phone, origin.ipAddress);
      throw unauthenticatedError(INVALID_CODE_MESSAGE);
    }
    await this.authenticationService.assertAccountUsable(user, phone, origin, now);
    return this.authenticationService.completeSignIn(user, 'parent', origin, 'one_time_code', false, now);
  }

  // Chỉ tài khoản có duy nhất vai trò phụ huynh mới đăng nhập bằng mã (CTC-DD-023, YCTD-43)
  private async findParent(phone: string) {
    const user = await this.database.selectFrom('users').selectAll().where('phone', '=', phone).executeTakeFirst();
    if (!user) {
      return undefined;
    }
    const roles = await this.database
      .selectFrom('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .select('roles.code')
      .where('user_roles.user_id', '=', user.id)
      .execute();
    if (roles.length === 0 || roles.some((role) => role.code !== PARENT_ROLE_CODE)) {
      return undefined;
    }
    return user;
  }

  private async recordSecurityEvent(
    eventType: string,
    userId: string | null,
    phone: string,
    ipAddress: string,
  ): Promise<void> {
    await this.database
      .insertInto('security_events')
      .values({
        event_type: eventType,
        user_id: userId,
        login_identifier: phone,
        ip_address: ipAddress,
        created_at: this.clock.now(),
      })
      .execute();
  }
}
