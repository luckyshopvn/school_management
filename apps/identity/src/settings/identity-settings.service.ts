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
  | 'one_time_code_maximum_sends_per_hour';

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
};

const NUMERIC_KEYS = Object.keys(NUMERIC_SETTINGS) as NumericSettingKey[];

export type IdentitySettingsView = Record<NumericSettingKey, number> & { parent_default_password_configured: boolean };

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
    if (errors.length === 0 && Object.keys(numericChanges).length === 0 && defaultPassword === undefined) {
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
      const entries: Array<[string, unknown]> = Object.entries(numericChanges);
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
          ...(newHash ? { parent_default_password_configured: before.parent_default_password_configured } : {}),
        },
        after: { ...numericChanges, ...(newHash ? { parent_default_password: 'đã đặt mật khẩu mới' } : {}) },
        ipAddress: caller.ipAddress,
      });
    });
    return this.view();
  }

  private async view(): Promise<IdentitySettingsView> {
    const values = Object.fromEntries(
      await Promise.all(NUMERIC_KEYS.map(async (key) => [key, await this.numeric(key)] as const)),
    ) as Record<NumericSettingKey, number>;
    return { ...values, parent_default_password_configured: (await this.parentDefaultPasswordHash()) !== null };
  }

  private async numeric(key: NumericSettingKey): Promise<number> {
    const row = await this.database
      .selectFrom('identity_settings')
      .select('value')
      .where('key', '=', key)
      .executeTakeFirst();
    return typeof row?.value === 'number' ? row.value : NUMERIC_SETTINGS[key].defaultValue;
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
