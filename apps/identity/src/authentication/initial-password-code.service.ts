import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { ApplicationError, Clock, validationError } from '@school-management/server';
import { Infrastructure } from '../common/infrastructure.js';
import { SmsSender } from '../messaging/sms-sender.js';
import { IdentitySettingsService } from '../settings/identity-settings.service.js';
import { hashPassword, placeholderPasswordHash, verifyPassword } from './password.js';

// Mã xác nhận khi đổi mật khẩu mặc định lần đầu (YCTD-323, quyết định của Eric ngày 2026-10-28 giữ mật khẩu mặc định chung của YCTD-311):
// tài khoản còn dùng mật khẩu mặc định (initial_password_expires_at còn giá trị) chỉ đổi được mật khẩu khi nhập đúng mã gửi tới số điện
// thoại trong hồ sơ, nên người khác biết số CCCD và mật khẩu mặc định cũng không chiếm được tài khoản. Hạn mã, số lần nhập sai, số lần
// gửi mỗi giờ dùng chung cấu hình của mã đăng nhập phụ huynh (oneTimeCodeRules)
const PURPOSE = 'initial_password';
export const INITIAL_PASSWORD_CODE_MESSAGE = 'Nhập mã xác nhận đã gửi tới số điện thoại của tài khoản';

// Che số điện thoại khi báo đã gửi mã: giữ 3 số cuối
export function maskPhone(phone: string): string {
  return phone.length <= 3 ? '***' : `${'*'.repeat(phone.length - 3)}${phone.slice(-3)}`;
}

@Injectable()
export class InitialPasswordCodeService {
  constructor(
    private readonly infrastructure: Infrastructure,
    private readonly identitySettings: IdentitySettingsService,
    private readonly smsSender: SmsSender,
    private readonly clock: Clock,
  ) {}

  private get database() {
    return this.infrastructure.database;
  }

  // Gửi mã cho tài khoản đang còn mật khẩu mặc định; tài khoản không cần mã thì báo xung đột
  async send(userId: string): Promise<{ phone: string; expires_in_seconds: number }> {
    const now = this.clock.now();
    const user = await this.database
      .selectFrom('users')
      .select(['id', 'phone', 'initial_password_expires_at'])
      .where('id', '=', userId)
      .executeTakeFirst();
    if (!user || user.initial_password_expires_at === null || !user.phone) {
      throw new ApplicationError('ERR_CONFLICT', 'Tài khoản này không cần mã xác nhận khi đổi mật khẩu');
    }
    const rules = await this.identitySettings.oneTimeCodeRules();
    const hour = Math.floor(now.getTime() / 3_600_000);
    const counterKey = `${this.infrastructure.keyPrefix()}:initial-password-codes:${user.id}:${hour}`;
    const count = await this.infrastructure.redis.incr(counterKey);
    if (count === 1) {
      await this.infrastructure.redis.expire(counterKey, 7200);
    }
    if (count > rules.maximumSendsPerHour) {
      throw new ApplicationError(
        'ERR_RATE_LIMIT',
        `Bạn đã yêu cầu mã quá ${rules.maximumSendsPerHour} lần trong giờ này, vui lòng thử lại sau`,
        [],
        Math.ceil(((hour + 1) * 3_600_000 - now.getTime()) / 1000),
      );
    }
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const phone = user.phone;
    await this.database.transaction().execute(async (transaction) => {
      // Mã cũ chưa dùng hết hiệu lực khi có mã mới
      await transaction
        .updateTable('one_time_codes')
        .set({ expires_at: now })
        .where('user_id', '=', user.id)
        .where('purpose', '=', PURPOSE)
        .where('used_at', 'is', null)
        .where('expires_at', '>', now)
        .execute();
      await transaction
        .insertInto('one_time_codes')
        .values({
          user_id: user.id,
          phone,
          purpose: PURPOSE,
          code_hash: await hashPassword(code),
          expires_at: new Date(now.getTime() + rules.lifetimeMinutes * 60_000),
          created_at: now,
        })
        .execute();
    });
    await this.smsSender.send(
      phone,
      `Mã xác nhận đổi mật khẩu lần đầu: ${code}. Mã hết hạn sau ${rules.lifetimeMinutes} phút. Không chia sẻ mã này.`,
    );
    return { phone: maskPhone(phone), expires_in_seconds: rules.lifetimeMinutes * 60 };
  }

  // Kiểm và dùng mã trong giao dịch đổi mật khẩu; thiếu hoặc sai mã thì lỗi ở ô otp_code. Nhập sai đủ số lần thì mã hết hiệu lực
  async consume(userId: string, code: string | undefined): Promise<void> {
    if (!code) {
      throw validationError([{ field: 'otp_code', message: INITIAL_PASSWORD_CODE_MESSAGE }]);
    }
    const now = this.clock.now();
    const rules = await this.identitySettings.oneTimeCodeRules();
    const accepted = await this.database.transaction().execute(async (transaction) => {
      const current = await transaction
        .selectFrom('one_time_codes')
        .selectAll()
        .where('user_id', '=', userId)
        .where('purpose', '=', PURPOSE)
        .where('used_at', 'is', null)
        .where('expires_at', '>', now)
        .where('attempt_count', '<', rules.maximumAttempts)
        .orderBy('created_at', 'desc')
        .forUpdate()
        .executeTakeFirst();
      if (!current) {
        await verifyPassword(await placeholderPasswordHash(), code);
        return false;
      }
      if (!(await verifyPassword(current.code_hash, code))) {
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
    if (!accepted) {
      throw validationError([
        { field: 'otp_code', message: 'Mã xác nhận không đúng hoặc đã hết hạn, vui lòng yêu cầu mã mới' },
      ]);
    }
  }
}
