import { Injectable } from '@nestjs/common';
import { ApplicationError, Clock, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import { forbidden } from '../accounts/account-authority.js';
import type { CallerContext } from '../accounts/accounts.service.js';
import { loadAssignments } from '../accounts/assignments.js';
import { writeIdentityAuditLog } from '../accounts/identity-audit-log.js';
import { OrganizationDirectory } from '../accounts/organization-directory.js';
import { Infrastructure } from '../common/infrastructure.js';

// Cấu hình chung toàn trường của dịch vụ định danh (PQ-07, PQ-15, YCTD-40)
export const ACCOUNT_INACTIVITY_LOCK_DAYS_KEY = 'account_inactivity_lock_days';
export const DEFAULT_ACCOUNT_INACTIVITY_LOCK_DAYS = 90;
// Cấu hình chung không gắn bản ghi nào; nhật ký dùng mã định danh rỗng
const SCHOOL_WIDE_ENTITY_ID = '00000000-0000-0000-0000-000000000000';

export interface IdentitySettingsView {
  account_inactivity_lock_days: number;
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

  async accountInactivityLockDays(): Promise<number> {
    const row = await this.database
      .selectFrom('identity_settings')
      .select('value')
      .where('key', '=', ACCOUNT_INACTIVITY_LOCK_DAYS_KEY)
      .executeTakeFirst();
    return typeof row?.value === 'number' ? row.value : DEFAULT_ACCOUNT_INACTIVITY_LOCK_DAYS;
  }

  async read(caller: CallerContext): Promise<IdentitySettingsView> {
    await this.requireSettingPermission(caller, false);
    return { account_inactivity_lock_days: await this.accountInactivityLockDays() };
  }

  // Chỉ người có quyền sửa cấu hình ở phạm vi toàn trường mới sửa được cấu hình chung (PQ-15)
  async update(caller: CallerContext, days: unknown): Promise<IdentitySettingsView> {
    if (!Number.isInteger(days) || (days as number) < 7 || (days as number) > 3650) {
      throw validationError([{ field: 'account_inactivity_lock_days', message: 'Số ngày là số nguyên từ 7 đến 3650' }]);
    }
    await this.requireSettingPermission(caller, true);
    const before = await this.accountInactivityLockDays();
    await this.database.transaction().execute(async (transaction) => {
      await transaction
        .insertInto('identity_settings')
        .values({
          key: ACCOUNT_INACTIVITY_LOCK_DAYS_KEY,
          value: JSON.stringify(days),
          updated_at: this.clock.now(),
          updated_by: caller.claims.userId,
        })
        .onConflict((conflict) =>
          conflict.column('key').doUpdateSet({
            value: JSON.stringify(days),
            updated_at: this.clock.now(),
            updated_by: caller.claims.userId,
          }),
        )
        .execute();
      await writeIdentityAuditLog(transaction, {
        actorUserId: caller.claims.userId,
        entityName: 'identity_settings',
        entityId: SCHOOL_WIDE_ENTITY_ID,
        action: 'update',
        before: { [ACCOUNT_INACTIVITY_LOCK_DAYS_KEY]: before },
        after: { [ACCOUNT_INACTIVITY_LOCK_DAYS_KEY]: days },
        ipAddress: caller.ipAddress,
      });
    });
    return { account_inactivity_lock_days: days as number };
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
