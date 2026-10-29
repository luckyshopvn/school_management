import { Inject, Injectable } from '@nestjs/common';
import {
  ApplicationError,
  Clock,
  currentTenant,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  ruleViolationError,
  totpUri,
  validationError,
  verifyTotp,
} from '@school-management/server';
import { decryptSecret, encryptSecret } from '@school-management/server/tenancy';
import { PERMISSION_CODES } from '@school-management/shared';
import { forbidden } from '../accounts/account-authority.js';
import { loadAssignments } from '../accounts/assignments.js';
import { writeIdentityAuditLog } from '../accounts/identity-audit-log.js';
import { Infrastructure } from '../common/infrastructure.js';
import { IDENTITY_CONFIGURATION, type IdentityConfiguration } from '../common/configuration.js';
import { IdentitySettingsService } from '../settings/identity-settings.service.js';

// Xác thực hai lớp tuỳ chọn của người dùng trường (DT-SaaS phần S8b, YCTD-201, tài liệu 47 mục 14.5, GD-97). Mặc định tắt cả trường nên
// quyết định hiện hành YCTD-31 (không bắt buộc xác thực hai lớp cho Hiệu trưởng, Phó Hiệu trưởng, kế toán trưởng) không đổi; trường bật
// `totp_enabled` ở cấu hình chung thì mỗi người dùng tự đăng ký bằng ứng dụng xác thực và từ đó đăng nhập bằng mật khẩu cộng mã.
// Khóa TOTP mã hóa bằng khóa mã hóa của trường (chế độ nhiều trường) hoặc TOTP_ENCRYPTION_KEY (chế độ một trường); mỗi mã chỉ dùng một
// lần; mã khôi phục dùng một lần khi mất điện thoại, chỉ lưu bản băm
export const TOTP_RULE_CODE = 'G1-10';
export const OTP_REQUIRED_MESSAGE = 'Nhập mã xác thực hai lớp hoặc mã khôi phục';
const ISSUER = 'School Management';

export interface TotpStatus {
  feature_enabled: boolean;
  enrolled: boolean;
  pending_setup: boolean;
  recovery_codes_left: number;
}

// Đăng nhập đúng mật khẩu nhưng chưa gửi mã: không tính là lần nhập sai
export function isTotpRequiredError(error: unknown): boolean {
  return (
    error instanceof ApplicationError &&
    error.details.some((detail) => detail.field === 'otp_code' && detail.message === OTP_REQUIRED_MESSAGE)
  );
}

@Injectable()
export class TotpService {
  constructor(
    private readonly infrastructure: Infrastructure,
    @Inject(IDENTITY_CONFIGURATION) private readonly configuration: IdentityConfiguration,
    private readonly settings: IdentitySettingsService,
    private readonly clock: Clock,
  ) {}

  private get database() {
    return this.infrastructure.database;
  }

  private key(): Buffer {
    const tenantKey = currentTenant()?.childDataEncryptionKey;
    const key = tenantKey ?? this.configuration.totpEncryptionKey;
    if (!key) {
      throw ruleViolationError(
        TOTP_RULE_CODE,
        'Máy chủ chưa cấu hình khóa mã hóa xác thực hai lớp (TOTP_ENCRYPTION_KEY)',
      );
    }
    return key;
  }

  async status(userId: string): Promise<TotpStatus> {
    const featureEnabled = await this.settings.totpEnabled();
    const row = await this.database
      .selectFrom('user_totp')
      .select('confirmed_at')
      .where('user_id', '=', userId)
      .executeTakeFirst();
    const codes = await this.database
      .selectFrom('user_recovery_codes')
      .select((builder) => builder.fn.countAll<string>().as('count'))
      .where('user_id', '=', userId)
      .where('used_at', 'is', null)
      .executeTakeFirstOrThrow();
    return {
      feature_enabled: featureEnabled,
      enrolled: Boolean(row?.confirmed_at),
      pending_setup: Boolean(row) && !row?.confirmed_at,
      recovery_codes_left: Number(codes.count),
    };
  }

  // Có phải nhập mã khi đăng nhập: trường đã bật xác thực hai lớp và người dùng đã đăng ký xong
  async isRequiredFor(userId: string): Promise<boolean> {
    if (!(await this.settings.totpEnabled())) {
      return false;
    }
    const row = await this.database
      .selectFrom('user_totp')
      .select('confirmed_at')
      .where('user_id', '=', userId)
      .executeTakeFirst();
    return Boolean(row?.confirmed_at);
  }

  async beginSetup(userId: string, account: string): Promise<{ secret: string; otpauth_uri: string }> {
    if (!(await this.settings.totpEnabled())) {
      throw ruleViolationError(TOTP_RULE_CODE, 'Nhà trường chưa bật xác thực hai lớp');
    }
    const existing = await this.database
      .selectFrom('user_totp')
      .select('confirmed_at')
      .where('user_id', '=', userId)
      .executeTakeFirst();
    if (existing?.confirmed_at) {
      throw ruleViolationError(TOTP_RULE_CODE, 'Xác thực hai lớp đã bật; tắt trước khi đăng ký lại');
    }
    const secret = generateTotpSecret();
    const encrypted = encryptSecret(this.key(), secret);
    await this.database
      .insertInto('user_totp')
      .values({ user_id: userId, secret_encrypted: encrypted })
      .onConflict((conflict) =>
        conflict
          .column('user_id')
          .doUpdateSet({ secret_encrypted: encrypted, last_step: null, updated_at: this.clock.now() }),
      )
      .execute();
    return { secret, otpauth_uri: totpUri(secret, account, ISSUER) };
  }

  // Xác nhận mã đầu tiên: bật xác thực hai lớp, cấp mã khôi phục (chỉ hiện một lần)
  async confirmSetup(userId: string, code: string): Promise<{ recovery_codes: string[] }> {
    const row = await this.database
      .selectFrom('user_totp')
      .selectAll()
      .where('user_id', '=', userId)
      .executeTakeFirst();
    if (!row || row.confirmed_at) {
      throw ruleViolationError(TOTP_RULE_CODE, 'Chưa bắt đầu đăng ký xác thực hai lớp');
    }
    const now = this.clock.now();
    const step = verifyTotp(decryptSecret(this.key(), row.secret_encrypted), code, now);
    if (step === null) {
      throw validationError([{ field: 'code', message: 'Mã không đúng, kiểm tra giờ điện thoại và nhập lại' }]);
    }
    const codes = generateRecoveryCodes();
    await this.database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('user_totp')
        .set({ confirmed_at: now, last_step: step, updated_at: now })
        .where('user_id', '=', userId)
        .execute();
      await transaction.deleteFrom('user_recovery_codes').where('user_id', '=', userId).execute();
      await transaction
        .insertInto('user_recovery_codes')
        .values(codes.map((item) => ({ user_id: userId, code_hash: hashRecoveryCode(item) })))
        .execute();
    });
    return { recovery_codes: codes };
  }

  // Kiểm tra mã khi đăng nhập hoặc khi tắt: mã TOTP (mỗi mã một lần) hoặc mã khôi phục (dùng xong là hết)
  async verify(userId: string, code: string): Promise<boolean> {
    const row = await this.database
      .selectFrom('user_totp')
      .selectAll()
      .where('user_id', '=', userId)
      .where('confirmed_at', 'is not', null)
      .executeTakeFirst();
    if (!row) {
      return false;
    }
    const now = this.clock.now();
    const lastStep = row.last_step === null ? null : Number(row.last_step);
    const step = verifyTotp(decryptSecret(this.key(), row.secret_encrypted), code, now, { lastUsedStep: lastStep });
    if (step !== null) {
      // Cập nhật có điều kiện để hai yêu cầu cùng lúc không cùng dùng được một mã
      const updated = await this.database
        .updateTable('user_totp')
        .set({ last_step: step, updated_at: now })
        .where('user_id', '=', userId)
        .where((expression) =>
          expression.or([expression('last_step', 'is', null), expression('last_step', '<', String(step))]),
        )
        .executeTakeFirst();
      return Number(updated.numUpdatedRows) > 0;
    }
    if (/^[A-Za-z0-9\s-]{10,12}$/.test(code.trim()) && !/^\d{6}$/.test(code.trim())) {
      const consumed = await this.database
        .updateTable('user_recovery_codes')
        .set({ used_at: now })
        .where('user_id', '=', userId)
        .where('code_hash', '=', hashRecoveryCode(code))
        .where('used_at', 'is', null)
        .executeTakeFirst();
      return Number(consumed.numUpdatedRows) > 0;
    }
    return false;
  }

  async disable(userId: string, code: string): Promise<void> {
    if (!(await this.verify(userId, code))) {
      throw validationError([{ field: 'code', message: 'Mã không đúng' }]);
    }
    await this.database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('user_recovery_codes').where('user_id', '=', userId).execute();
      await transaction.deleteFrom('user_totp').where('user_id', '=', userId).execute();
    });
  }

  // Người quản lý tài khoản tắt hộ xác thực hai lớp của một tài khoản mất điện thoại và hết mã khôi phục; có nhật ký, không ghi mã
  async resetByManager(managerUserId: string, targetUserId: string, ipAddress: string | null): Promise<void> {
    const assignments = (await loadAssignments(this.database, [managerUserId])).get(managerUserId) ?? [];
    if (!assignments.some((assignment) => assignment.permissions.includes(PERMISSION_CODES.accountManage))) {
      throw forbidden('Bạn không có quyền đặt lại xác thực hai lớp của tài khoản');
    }
    await this.database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('user_recovery_codes').where('user_id', '=', targetUserId).execute();
      await transaction.deleteFrom('user_totp').where('user_id', '=', targetUserId).execute();
      await writeIdentityAuditLog(transaction, {
        actorUserId: managerUserId,
        entityName: 'user_totp',
        entityId: targetUserId,
        action: 'delete',
        before: { totp: 'đã bật' },
        after: { totp: 'đã đặt lại' },
        ipAddress,
      });
    });
  }
}
