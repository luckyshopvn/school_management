import { Inject, Injectable } from '@nestjs/common';
import { ApplicationError, Clock, unauthenticatedError, validationError } from '@school-management/server';
import { randomInt } from 'node:crypto';
import { IDENTITY_CONFIGURATION, type IdentityConfiguration } from '../common/configuration.js';
import { Infrastructure } from '../common/infrastructure.js';
import { SmsSender } from '../messaging/sms-sender.js';
import { IdentitySettingsService } from '../settings/identity-settings.service.js';
import { AuthenticationService, type RequestOrigin } from './authentication.service.js';
import { checkPasswordPolicy, hashPassword, placeholderPasswordHash, verifyPassword } from './password.js';
import { assertPasswordNotReused, recordPasswordHistory } from './password-history.js';

// Quên mật khẩu tự phục vụ của cổng quản trị (DT-16 phần 16c). Người dùng nhập số điện thoại hoặc tên đăng nhập và mã
// xác nhận; nếu là tài khoản nhân sự đang hoạt động có số điện thoại thì dịch vụ gửi mã 6 chữ số qua kênh tin nhắn hiện
// có (lớp SmsSender, cùng kênh với mã đăng nhập của phụ huynh). Phản hồi như nhau dù tài khoản có hay không; số lần gửi
// mỗi giờ đếm theo tên nhập vào cho mọi tên, nên báo vượt giới hạn cũng không lộ tài khoản. Đặt lại xong thì mở khóa tạm,
// bỏ yêu cầu đổi mật khẩu và thu hồi mọi phiên đang mở. Hạn mã, số lần nhập sai, số lần gửi mỗi giờ dùng chung cấu hình
// mã một lần
export const PASSWORD_RESET_PURPOSE = 'password_reset';
const PARENT_ROLE_CODE = 'VT-14';
const INVALID_CODE_MESSAGE = 'Mã không đúng hoặc đã hết hạn, vui lòng yêu cầu mã mới';

export interface PasswordResetRequestResponse {
  message: string;
  expires_in_seconds: number;
}

@Injectable()
export class PasswordResetService {
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

  async request(loginIdentifier: string, origin: RequestOrigin): Promise<PasswordResetRequestResponse> {
    const now = this.clock.now();
    const rules = await this.identitySettings.oneTimeCodeRules();
    const response = {
      message:
        'Nếu thông tin đúng với một tài khoản đã đăng ký số điện thoại, mã đặt lại mật khẩu sẽ được gửi qua tin nhắn',
      expires_in_seconds: rules.lifetimeMinutes * 60,
    };

    const hour = Math.floor(now.getTime() / 3_600_000);
    const counterKey = `${this.configuration.redisKeyPrefix}:password-reset-requests:${loginIdentifier.toLowerCase()}:${hour}`;
    const requestCount = await this.infrastructure.redis.incr(counterKey);
    if (requestCount === 1) {
      await this.infrastructure.redis.expire(counterKey, 7200);
    }
    if (requestCount > rules.maximumSendsPerHour) {
      await this.authenticationService.recordSecurityEvent(
        'password_reset_send_limit',
        null,
        loginIdentifier,
        origin.ipAddress,
      );
      throw new ApplicationError(
        'ERR_RATE_LIMIT',
        `Bạn đã yêu cầu mã quá ${rules.maximumSendsPerHour} lần trong giờ này, vui lòng thử lại sau`,
        [],
        Math.ceil(((hour + 1) * 3_600_000 - now.getTime()) / 1000),
      );
    }

    const user = await this.findStaffAccount(loginIdentifier);
    if (!user || user.status !== 'active' || !user.phone) {
      await this.authenticationService.recordSecurityEvent(
        'password_reset_request_ignored',
        user?.id ?? null,
        loginIdentifier,
        origin.ipAddress,
      );
      return response;
    }
    const phone = user.phone;
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('one_time_codes')
        .set({ expires_at: now })
        .where('user_id', '=', user.id)
        .where('purpose', '=', PASSWORD_RESET_PURPOSE)
        .where('used_at', 'is', null)
        .where('expires_at', '>', now)
        .execute();
      await transaction
        .insertInto('one_time_codes')
        .values({
          user_id: user.id,
          phone,
          purpose: PASSWORD_RESET_PURPOSE,
          code_hash: await hashPassword(code),
          expires_at: new Date(now.getTime() + rules.lifetimeMinutes * 60 * 1000),
          created_at: now,
        })
        .execute();
    });
    await this.smsSender.send(
      phone,
      `Mã đặt lại mật khẩu cổng quản trị: ${code}. Mã hết hạn sau ${rules.lifetimeMinutes} phút. Không chia sẻ mã này.`,
    );
    await this.authenticationService.recordSecurityEvent(
      'password_reset_code_sent',
      user.id,
      loginIdentifier,
      origin.ipAddress,
    );
    return response;
  }

  async confirm(loginIdentifier: string, code: string, newPassword: string, origin: RequestOrigin): Promise<void> {
    const policyErrors = checkPasswordPolicy('new_password', newPassword);
    if (policyErrors.length > 0) {
      throw validationError(policyErrors);
    }
    const now = this.clock.now();
    const rules = await this.identitySettings.oneTimeCodeRules();
    const user = await this.findStaffAccount(loginIdentifier);
    const current =
      user && user.status === 'active'
        ? await this.database
            .selectFrom('one_time_codes')
            .selectAll()
            .where('user_id', '=', user.id)
            .where('purpose', '=', PASSWORD_RESET_PURPOSE)
            .where('used_at', 'is', null)
            .where('expires_at', '>', now)
            .where('attempt_count', '<', rules.maximumAttempts)
            .orderBy('created_at', 'desc')
            .executeTakeFirst()
        : undefined;
    if (!user || !current) {
      await verifyPassword(await placeholderPasswordHash(), code);
      await this.authenticationService.recordSecurityEvent(
        'password_reset_failed',
        user?.id ?? null,
        loginIdentifier,
        origin.ipAddress,
      );
      throw unauthenticatedError(INVALID_CODE_MESSAGE);
    }
    if (!(await verifyPassword(current.code_hash, code))) {
      const attempts = current.attempt_count + 1;
      await this.database
        .updateTable('one_time_codes')
        .set(
          attempts >= rules.maximumAttempts
            ? { attempt_count: attempts, expires_at: now }
            : { attempt_count: attempts },
        )
        .where('id', '=', current.id)
        .execute();
      await this.authenticationService.recordSecurityEvent(
        'password_reset_failed',
        user.id,
        loginIdentifier,
        origin.ipAddress,
      );
      throw unauthenticatedError(INVALID_CODE_MESSAGE);
    }
    // Mã đúng nhưng mật khẩu trùng mật khẩu gần đây thì giữ mã để người dùng chọn mật khẩu khác
    await assertPasswordNotReused(this.database, user, newPassword, await this.identitySettings.passwordHistoryCount());

    const newHash = await hashPassword(newPassword);
    const consumed = await this.database.transaction().execute(async (transaction) => {
      const marked = await transaction
        .updateTable('one_time_codes')
        .set({ used_at: now })
        .where('id', '=', current.id)
        .where('used_at', 'is', null)
        .executeTakeFirst();
      if (Number(marked.numUpdatedRows) === 0) {
        return false;
      }
      await transaction
        .updateTable('users')
        .set({
          password_hash: newHash,
          password_changed_at: now,
          must_change_password: false,
          failed_login_count: 0,
          locked_until: null,
          updated_at: now,
        })
        .where('id', '=', user.id)
        .execute();
      await recordPasswordHistory(transaction, user.id, newHash, now);
      await transaction
        .updateTable('sessions')
        .set({ revoked_at: now })
        .where('user_id', '=', user.id)
        .where('revoked_at', 'is', null)
        .execute();
      return true;
    });
    if (!consumed) {
      throw unauthenticatedError(INVALID_CODE_MESSAGE);
    }
    await this.authenticationService.recordSecurityEvent('password_reset', user.id, loginIdentifier, origin.ipAddress);
  }

  // Tài khoản có ít nhất một vai trò khác Phụ huynh; phụ huynh đăng nhập ứng dụng bằng mã một lần (YCTD-43)
  private async findStaffAccount(loginIdentifier: string) {
    const user = await this.database
      .selectFrom('users')
      .selectAll()
      .where((expression) =>
        expression.or([expression('phone', '=', loginIdentifier), expression('username', '=', loginIdentifier)]),
      )
      .executeTakeFirst();
    if (!user) {
      return undefined;
    }
    const staffRole = await this.database
      .selectFrom('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .select('roles.code')
      .where('user_roles.user_id', '=', user.id)
      .where('roles.code', '!=', PARENT_ROLE_CODE)
      .executeTakeFirst();
    return staffRole ? user : undefined;
  }
}
