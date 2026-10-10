import { Injectable } from '@nestjs/common';
import { ruleViolationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import { Infrastructure } from '../common/infrastructure.js';
import { IdentitySettingsService } from '../settings/identity-settings.service.js';
import type { CallerContext } from './accounts.service.js';
import { writeIdentityAuditLog } from './identity-audit-log.js';
import { OrganizationDirectory } from './organization-directory.js';
import { assertPermissionAtUnit } from './permission-scope.js';

// Tài khoản phụ huynh khi duyệt hồ sơ trẻ (QT-01 bước 9, PQ-06, YCTD-44, YCTD-45).
// Gọi lại với cùng số điện thoại không tạo trùng; số đã thuộc tài khoản khác thì thêm vai trò phụ huynh vào tài khoản đó
const PARENT_ROLE_CODE = 'VT-14';

export interface GuardianAccountResult {
  user_id: string;
  created: boolean;
  role_added: boolean;
}

@Injectable()
export class GuardianAccountsService {
  constructor(
    private readonly infrastructure: Infrastructure,
    private readonly organizationDirectory: OrganizationDirectory,
    private readonly identitySettings: IdentitySettingsService,
  ) {}

  private get database() {
    return this.infrastructure.database;
  }

  async ensure(
    caller: CallerContext,
    input: { phone: string; full_name: string; org_unit_id: string },
  ): Promise<GuardianAccountResult> {
    await assertPermissionAtUnit(
      this.database,
      this.organizationDirectory,
      caller,
      [PERMISSION_CODES.childApprove],
      input.org_unit_id,
      'Bạn không có quyền duyệt hồ sơ trẻ',
    );
    const parentRole = await this.database
      .selectFrom('roles')
      .select('id')
      .where('code', '=', PARENT_ROLE_CODE)
      .executeTakeFirstOrThrow();

    return this.database.transaction().execute(async (transaction) => {
      const existing = await transaction
        .selectFrom('users')
        .select(['id'])
        .where('phone', '=', input.phone)
        .forUpdate()
        .executeTakeFirst();
      if (existing) {
        const assignment = await transaction
          .selectFrom('user_roles')
          .select('id')
          .where('user_id', '=', existing.id)
          .where('role_id', '=', parentRole.id)
          .where('org_unit_id', '=', input.org_unit_id)
          .executeTakeFirst();
        if (assignment) {
          return { user_id: existing.id, created: false, role_added: false };
        }
        const added = await transaction
          .insertInto('user_roles')
          .values({
            user_id: existing.id,
            role_id: parentRole.id,
            org_unit_id: input.org_unit_id,
            created_by: caller.claims.userId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await writeIdentityAuditLog(transaction, {
          actorUserId: caller.claims.userId,
          entityName: 'user_roles',
          entityId: added.id,
          action: 'assign_role',
          before: null,
          after: { user_id: existing.id, role_code: PARENT_ROLE_CODE, org_unit_id: input.org_unit_id },
          ipAddress: caller.ipAddress,
        });
        return { user_id: existing.id, created: false, role_added: true };
      }

      if ((await this.identitySettings.parentDefaultPasswordHash()) === null) {
        throw ruleViolationError(
          'PQ-06',
          'Chưa đặt mật khẩu mặc định của phụ huynh; Hiệu trưởng đặt ở màn hình Cấu hình, phần Tài khoản',
        );
      }
      const user = await transaction
        .insertInto('users')
        .values({
          full_name: input.full_name,
          phone: input.phone,
          username: null,
          password_hash: null,
          must_change_password: true,
          created_by: caller.claims.userId,
        })
        .returning(['id', 'full_name', 'phone'])
        .executeTakeFirstOrThrow();
      await transaction
        .insertInto('user_roles')
        .values({
          user_id: user.id,
          role_id: parentRole.id,
          org_unit_id: input.org_unit_id,
          created_by: caller.claims.userId,
        })
        .execute();
      await writeIdentityAuditLog(transaction, {
        actorUserId: caller.claims.userId,
        entityName: 'users',
        entityId: user.id,
        action: 'create',
        before: null,
        after: {
          ...user,
          roles: [{ role_code: PARENT_ROLE_CODE, org_unit_id: input.org_unit_id }],
          uses_default_password: true,
        },
        ipAddress: caller.ipAddress,
      });
      return { user_id: user.id, created: true, role_added: true };
    });
  }
}
