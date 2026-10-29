import { Injectable } from '@nestjs/common';
import { ApplicationError, Clock, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import { forbidden } from '../accounts/account-authority.js';
import type { CallerContext } from '../accounts/accounts.service.js';
import { loadAssignments } from '../accounts/assignments.js';
import { writeIdentityAuditLog } from '../accounts/identity-audit-log.js';
import { OrganizationDirectory } from '../accounts/organization-directory.js';
import { checkPasswordPolicy, hashPassword } from '../authentication/password.js';
import { Infrastructure } from '../common/infrastructure.js';

// Cấu hình chung toàn trường của dịch vụ định danh (PQ-07, PQ-15, YCTD-40, YCTD-43)
export const ACCOUNT_INACTIVITY_LOCK_DAYS_KEY = 'account_inactivity_lock_days';
export const DEFAULT_ACCOUNT_INACTIVITY_LOCK_DAYS = 90;
const PARENT_DEFAULT_PASSWORD_HASH_KEY = 'parent_default_password_hash';
// Cấu hình chung không gắn bản ghi nào; nhật ký dùng mã định danh rỗng
const SCHOOL_WIDE_ENTITY_ID = '00000000-0000-0000-0000-000000000000';

type NumericSettingKey =
  | 'account_inactivity_lock_days'
  | 'one_time_code_lifetime_minutes'
  | 'one_time_code_maximum_attempts'
  | 'one_time_code_maximum_sends_per_hour'
  | 'captcha_failure_threshold'
  | 'password_history_count'
  | 'initial_password_lifetime_hours';

// Mặc định của mã một lần theo tham số ở 27_BO_CA_KIEM_THU_CHI_TIET/01_DINH_DANH_VA_P01.md mục 3 (YCTD-43)
const NUMERIC_SETTINGS: Record<
  NumericSettingKey,
  { defaultValue: number; minimum: number; maximum: number; label: string }
> = {
  account_inactivity_lock_days: {
    defaultValue: DEFAULT_ACCOUNT_INACTIVITY_LOCK_DAYS,
    minimum: 7,
    maximum: 3650,
    label: 'Số ngày',
  },
  one_time_code_lifetime_minutes: { defaultValue: 5, minimum: 1, maximum: 30, label: 'Số phút' },
  one_time_code_maximum_attempts: { defaultValue: 5, minimum: 1, maximum: 10, label: 'Số lần nhập sai' },
  one_time_code_maximum_sends_per_hour: { defaultValue: 5, minimum: 1, maximum: 20, label: 'Số lần gửi' },
  // Đăng nhập cổng quản trị (DT-16 phần 16c, Claude tự chọn mặc định theo ủy quyền của Eric ngày 2026-10-11): nhập sai 3
  // lần với một tài khoản thì hiện mã xác nhận; không cho dùng lại 5 mật khẩu gần nhất (0 là không kiểm tra)
  captcha_failure_threshold: { defaultValue: 3, minimum: 1, maximum: 10, label: 'Số lần nhập sai' },
  password_history_count: { defaultValue: 5, minimum: 0, maximum: 24, label: 'Số mật khẩu gần nhất' },
  // Hạn của mật khẩu mặc định khi tạo tài khoản theo số CCCD (YCTD-311): quá số giờ mà chưa đổi thì quản trị trường phải đặt lại.
  // YCTD-323 rút từ 7 ngày xuống 24 giờ mặc định, tính theo giờ, tối đa 30 ngày
  initial_password_lifetime_hours: { defaultValue: 24, minimum: 1, maximum: 720, label: 'Số giờ' },
};

const CAPTCHA_ALWAYS_KEY = 'captcha_always';
// Xác thực hai lớp tuỳ chọn theo trường, mặc định tắt (DT-SaaS phần S8b, GD-97)
const TOTP_ENABLED_KEY = 'totp_enabled';
const LOGIN_HOTLINE_KEY = 'login_hotline';
const MAXIMUM_HOTLINE_LENGTH = 100;

const NUMERIC_KEYS = Object.keys(NUMERIC_SETTINGS) as NumericSettingKey[];

// Chính sách hạn mật khẩu của tài khoản nhân sự (DT-15 phần 15g, YCTD-110): số ngày tối đa dùng một mật khẩu (0 là không
// giới hạn) và số ngày báo trước khi hết hạn. Quản trị nền tảng, Hiệu trưởng (quyền quản lý mọi tài khoản) sửa ở màn hình
// Danh sách người dùng
// DT-SaaS phần S8b (YCTD-201): thêm độ dài tối thiểu, số lần nhập sai trước khi tạm khóa, số phút tạm khóa (riêng từng trường)
type PasswordPolicyKey =
  | 'password_max_age_days'
  | 'password_expiry_warning_days'
  | 'password_min_length'
  | 'login_max_failed_attempts'
  | 'login_lock_minutes';

const PASSWORD_POLICY_SETTINGS: Record<
  PasswordPolicyKey,
  { defaultValue: number; minimum: number; maximum: number; label: string }
> = {
  password_max_age_days: { defaultValue: 0, minimum: 0, maximum: 3650, label: 'Số ngày' },
  password_expiry_warning_days: { defaultValue: 7, minimum: 0, maximum: 90, label: 'Số ngày báo trước' },
  password_min_length: { defaultValue: 8, minimum: 8, maximum: 64, label: 'Số ký tự' },
  login_max_failed_attempts: { defaultValue: 5, minimum: 3, maximum: 10, label: 'Số lần nhập sai' },
  login_lock_minutes: { defaultValue: 15, minimum: 1, maximum: 1440, label: 'Số phút' },
};

const PASSWORD_POLICY_KEYS = Object.keys(PASSWORD_POLICY_SETTINGS) as PasswordPolicyKey[];

export type PasswordPolicy = Record<PasswordPolicyKey, number>;

export type IdentitySettingsView = Record<NumericSettingKey, number> & {
  parent_default_password_configured: boolean;
  captcha_always: boolean;
  login_hotline: string | null;
  totp_enabled: boolean;
};

// Thông tin công khai của trang đăng nhập cổng quản trị (DT-16 phần 16c)
export interface LoginPageOptions {
  hotline: string | null;
  captcha_always: boolean;
}

@Injectable()
export class IdentitySettingsService {
  constructor(
    private readonly infrastructure: Infrastructure,
    private readonly organizationDirectory: OrganizationDirectory,
    private readonly clock: Clock,
  ) {}

  private get database() {
    return this.infrastructure.database;
  }

  async initialPasswordLifetimeHours(): Promise<number> {
    return this.numeric('initial_password_lifetime_hours');
  }

  async accountInactivityLockDays(): Promise<number> {
    return this.numeric('account_inactivity_lock_days');
  }

  async oneTimeCodeRules(): Promise<{ lifetimeMinutes: number; maximumAttempts: number; maximumSendsPerHour: number }> {
    return {
      lifetimeMinutes: await this.numeric('one_time_code_lifetime_minutes'),
      maximumAttempts: await this.numeric('one_time_code_maximum_attempts'),
      maximumSendsPerHour: await this.numeric('one_time_code_maximum_sends_per_hour'),
    };
  }

  async captchaRules(): Promise<{ always: boolean; failureThreshold: number }> {
    return {
      always: (await this.readValue(CAPTCHA_ALWAYS_KEY)) === true,
      failureThreshold: await this.numeric('captcha_failure_threshold'),
    };
  }

  async totpEnabled(): Promise<boolean> {
    return (await this.readValue(TOTP_ENABLED_KEY)) === true;
  }

  async passwordHistoryCount(): Promise<number> {
    return this.numeric('password_history_count');
  }

  async loginPageOptions(): Promise<LoginPageOptions> {
    const hotline = await this.readValue(LOGIN_HOTLINE_KEY);
    return {
      hotline: typeof hotline === 'string' && hotline !== '' ? hotline : null,
      captcha_always: (await this.captchaRules()).always,
    };
  }

  // Giá trị băm của mật khẩu mặc định chung; không bao giờ trả ra ngoài dịch vụ (BM-69)
  async parentDefaultPasswordHash(): Promise<string | null> {
    const row = await this.database
      .selectFrom('identity_settings')
      .select('value')
      .where('key', '=', PARENT_DEFAULT_PASSWORD_HASH_KEY)
      .executeTakeFirst();
    return typeof row?.value === 'string' ? row.value : null;
  }

  async read(caller: CallerContext): Promise<IdentitySettingsView> {
    await this.requireSettingPermission(caller, false);
    return this.view();
  }

  // Chỉ người có quyền sửa cấu hình ở phạm vi toàn trường mới sửa được cấu hình chung (PQ-15)
  async update(caller: CallerContext, body: Record<string, unknown> | undefined): Promise<IdentitySettingsView> {
    const errors: FieldError[] = [];
    const numericChanges: Partial<Record<NumericSettingKey, number>> = {};
    for (const key of NUMERIC_KEYS) {
      const value = body?.[key];
      if (value === undefined) {
        continue;
      }
      const rule = NUMERIC_SETTINGS[key];
      if (!Number.isInteger(value) || (value as number) < rule.minimum || (value as number) > rule.maximum) {
        errors.push({ field: key, message: `${rule.label} là số nguyên từ ${rule.minimum} đến ${rule.maximum}` });
      } else {
        numericChanges[key] = value as number;
      }
    }
    const defaultPassword = body?.parent_default_password;
    if (defaultPassword !== undefined) {
      if (typeof defaultPassword !== 'string') {
        errors.push({ field: 'parent_default_password', message: 'Bắt buộc nhập' });
      } else {
        errors.push(...checkPasswordPolicy('parent_default_password', defaultPassword));
      }
    }
    const captchaAlways = body?.captcha_always;
    if (captchaAlways !== undefined && typeof captchaAlways !== 'boolean') {
      errors.push({ field: 'captcha_always', message: 'Chọn có hoặc không' });
    }
    const totpEnabled = body?.totp_enabled;
    if (totpEnabled !== undefined && typeof totpEnabled !== 'boolean') {
      errors.push({ field: 'totp_enabled', message: 'Chọn có hoặc không' });
    }
    const hotlineValue = body?.login_hotline;
    let hotline: string | undefined;
    if (hotlineValue !== undefined) {
      if (hotlineValue !== null && typeof hotlineValue !== 'string') {
        errors.push({ field: 'login_hotline', message: 'Đường dây nóng phải là chuỗi' });
      } else {
        hotline = (hotlineValue ?? '').trim();
        if (hotline.length > MAXIMUM_HOTLINE_LENGTH) {
          errors.push({ field: 'login_hotline', message: `Đường dây nóng tối đa ${MAXIMUM_HOTLINE_LENGTH} ký tự` });
        }
      }
    }
    const otherChanges: Array<[string, unknown]> = [];
    if (typeof captchaAlways === 'boolean') {
      otherChanges.push([CAPTCHA_ALWAYS_KEY, captchaAlways]);
    }
    if (hotline !== undefined) {
      otherChanges.push([LOGIN_HOTLINE_KEY, hotline]);
    }
    if (typeof totpEnabled === 'boolean') {
      otherChanges.push([TOTP_ENABLED_KEY, totpEnabled]);
    }
    if (
      errors.length === 0 &&
      Object.keys(numericChanges).length === 0 &&
      defaultPassword === undefined &&
      otherChanges.length === 0
    ) {
      errors.push({ field: 'settings', message: 'Cần ít nhất một mục cấu hình' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    await this.requireSettingPermission(caller, true);

    const before = await this.view();
    const now = this.clock.now();
    const newHash = typeof defaultPassword === 'string' ? await hashPassword(defaultPassword) : null;
    await this.database.transaction().execute(async (transaction) => {
      const entries: Array<[string, unknown]> = [...Object.entries(numericChanges), ...otherChanges];
      if (newHash) {
        entries.push([PARENT_DEFAULT_PASSWORD_HASH_KEY, newHash]);
      }
      for (const [key, value] of entries) {
        await transaction
          .insertInto('identity_settings')
          .values({ key, value: JSON.stringify(value), updated_at: now, updated_by: caller.claims.userId })
          .onConflict((conflict) =>
            conflict
              .column('key')
              .doUpdateSet({ value: JSON.stringify(value), updated_at: now, updated_by: caller.claims.userId }),
          )
          .execute();
      }
      // Nhật ký chỉ ghi việc đã đổi mật khẩu mặc định, không ghi mật khẩu hay giá trị băm (BM-69)
      const changedKeys = Object.keys(numericChanges) as NumericSettingKey[];
      await writeIdentityAuditLog(transaction, {
        actorUserId: caller.claims.userId,
        entityName: 'identity_settings',
        entityId: SCHOOL_WIDE_ENTITY_ID,
        action: 'update',
        before: {
          ...Object.fromEntries(changedKeys.map((key) => [key, before[key]])),
          ...Object.fromEntries(otherChanges.map(([key]) => [key, before[key as keyof IdentitySettingsView]])),
          ...(newHash ? { parent_default_password_configured: before.parent_default_password_configured } : {}),
        },
        after: {
          ...numericChanges,
          ...Object.fromEntries(otherChanges),
          ...(newHash ? { parent_default_password: 'đã đặt mật khẩu mới' } : {}),
        },
        ipAddress: caller.ipAddress,
      });
    });
    return this.view();
  }

  // Chính sách hạn mật khẩu đang áp dụng, dùng khi đăng nhập
  async passwordPolicy(): Promise<PasswordPolicy> {
    const entries = await Promise.all(
      PASSWORD_POLICY_KEYS.map(
        async (key) => [key, await this.readNumber(key, PASSWORD_POLICY_SETTINGS[key].defaultValue)] as const,
      ),
    );
    return Object.fromEntries(entries) as PasswordPolicy;
  }

  async readPasswordPolicy(caller: CallerContext): Promise<PasswordPolicy> {
    await this.requireAccountManager(caller);
    return this.passwordPolicy();
  }

  async updatePasswordPolicy(
    caller: CallerContext,
    body: Record<string, unknown> | undefined,
  ): Promise<PasswordPolicy> {
    const errors: FieldError[] = [];
    const changes: Partial<PasswordPolicy> = {};
    for (const key of PASSWORD_POLICY_KEYS) {
      const value = body?.[key];
      if (value === undefined) {
        continue;
      }
      const rule = PASSWORD_POLICY_SETTINGS[key];
      if (!Number.isInteger(value) || (value as number) < rule.minimum || (value as number) > rule.maximum) {
        errors.push({ field: key, message: `${rule.label} là số nguyên từ ${rule.minimum} đến ${rule.maximum}` });
      } else {
        changes[key] = value as number;
      }
    }
    if (errors.length === 0 && Object.keys(changes).length === 0) {
      errors.push({ field: 'settings', message: 'Cần ít nhất một mục cấu hình' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    await this.requireAccountManager(caller);
    const before = await this.passwordPolicy();
    const now = this.clock.now();
    await this.database.transaction().execute(async (transaction) => {
      for (const [key, value] of Object.entries(changes)) {
        await transaction
          .insertInto('identity_settings')
          .values({ key, value: JSON.stringify(value), updated_at: now, updated_by: caller.claims.userId })
          .onConflict((conflict) =>
            conflict
              .column('key')
              .doUpdateSet({ value: JSON.stringify(value), updated_at: now, updated_by: caller.claims.userId }),
          )
          .execute();
      }
      const changedKeys = Object.keys(changes) as PasswordPolicyKey[];
      await writeIdentityAuditLog(transaction, {
        actorUserId: caller.claims.userId,
        entityName: 'identity_settings',
        entityId: SCHOOL_WIDE_ENTITY_ID,
        action: 'update',
        before: Object.fromEntries(changedKeys.map((key) => [key, before[key]])),
        after: changes,
        ipAddress: caller.ipAddress,
      });
    });
    return this.passwordPolicy();
  }

  // Quyền quản lý mọi tài khoản chỉ gán cho Quản trị nền tảng và Hiệu trưởng, đều là vai trò toàn trường
  private async requireAccountManager(caller: CallerContext): Promise<void> {
    const assignments = (await loadAssignments(this.database, [caller.claims.userId])).get(caller.claims.userId) ?? [];
    if (!assignments.some((assignment) => assignment.permissions.includes(PERMISSION_CODES.accountManage))) {
      throw forbidden('Bạn không có quyền cấu hình chính sách mật khẩu');
    }
  }

  private async readValue(key: string): Promise<unknown> {
    const row = await this.database
      .selectFrom('identity_settings')
      .select('value')
      .where('key', '=', key)
      .executeTakeFirst();
    return row?.value;
  }

  private async readNumber(key: string, defaultValue: number): Promise<number> {
    const value = await this.readValue(key);
    return typeof value === 'number' ? value : defaultValue;
  }

  private async view(): Promise<IdentitySettingsView> {
    const values = Object.fromEntries(
      await Promise.all(NUMERIC_KEYS.map(async (key) => [key, await this.numeric(key)] as const)),
    ) as Record<NumericSettingKey, number>;
    const options = await this.loginPageOptions();
    return {
      ...values,
      parent_default_password_configured: (await this.parentDefaultPasswordHash()) !== null,
      captcha_always: options.captcha_always,
      login_hotline: options.hotline,
      totp_enabled: await this.totpEnabled(),
    };
  }

  private numeric(key: NumericSettingKey): Promise<number> {
    return this.readNumber(key, NUMERIC_SETTINGS[key].defaultValue);
  }

  private async requireSettingPermission(caller: CallerContext, wholeSchool: boolean): Promise<void> {
    const assignments = (await loadAssignments(this.database, [caller.claims.userId])).get(caller.claims.userId) ?? [];
    const holders = assignments.filter((assignment) => assignment.permissions.includes(PERMISSION_CODES.settingManage));
    if (holders.length === 0) {
      throw forbidden('Bạn không có quyền cấu hình');
    }
    if (!wholeSchool || holders.some((assignment) => assignment.org_unit_id === null)) {
      return;
    }
    const rootId = (await this.organizationDirectory.listUnits(caller.accessToken)).find(
      (unit) => unit.unit_type === 'truong_chinh',
    )?.id;
    if (!rootId || !holders.some((assignment) => assignment.org_unit_id === rootId)) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        'Chỉ người có quyền cấu hình toàn trường mới sửa được cấu hình chung',
      );
    }
  }
}
