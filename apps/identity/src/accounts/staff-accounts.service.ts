import { Injectable } from '@nestjs/common';
import { ApplicationError, Clock, ruleViolationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import { Infrastructure } from '../common/infrastructure.js';
import { forbidden } from './account-authority.js';
import type { CallerContext } from './accounts.service.js';
import { loadAssignments } from './assignments.js';
import { writeIdentityAuditLog } from './identity-audit-log.js';
import { OrganizationDirectory } from './organization-directory.js';
import { assertPermissionAtUnit } from './permission-scope.js';

// Tài khoản gắn với hồ sơ nhân sự: phòng nhân sự tra tài khoản có sẵn để liên kết; chấm dứt hợp đồng thì khóa tài khoản
// ngay, không xóa (P07-01, P07-02; BR-05; YCTD-58). Máy chủ API gọi bằng mã phiên của người thao tác
const PROTECTED_ROLES = ['VT-01', 'VT-02'];

export interface StaffAccountView {
  user_id: string;
  full_name: string;
  username: string | null;
  phone: string | null;
  status: 'active' | 'locked';
}

@Injectable()
export class StaffAccountsService {
  constructor(
    private readonly infrastructure: Infrastructure,
    private readonly organizationDirectory: OrganizationDirectory,
    private readonly clock: Clock,
  ) {}

  private get database() {
    return this.infrastructure.database;
  }

  // Tìm theo tên đăng nhập hoặc số điện thoại; chỉ trả tài khoản có vai trò nhân sự, không trả tài khoản chỉ là phụ huynh
  async lookup(caller: CallerContext, input: { login: string; org_unit_id: string }): Promise<StaffAccountView> {
    await this.assertStaffManager(caller, input.org_unit_id);
    const user = await this.database
      .selectFrom('users')
      .select(['id', 'full_name', 'username', 'phone', 'status'])
      .where((expression) =>
        expression.or([expression('username', '=', input.login), expression('phone', '=', input.login)]),
      )
      .executeTakeFirst();
    if (!user) {
      throw new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy tài khoản với tên đăng nhập hoặc số điện thoại này');
    }
    const assignments = (await loadAssignments(this.database, [user.id])).get(user.id) ?? [];
    if (!assignments.some((assignment) => assignment.role_code !== 'VT-14')) {
      throw ruleViolationError('BR-37', 'Tài khoản này không có vai trò nhân sự');
    }
    return {
      user_id: user.id,
      full_name: user.full_name,
      username: user.username,
      phone: user.phone,
      status: user.status,
    };
  }

  // Khóa tài khoản và thu hồi mọi phiên khi hợp đồng chấm dứt (BR-05, CTC-P08-043)
  async lockForTermination(
    caller: CallerContext,
    userId: string,
    input: { org_unit_id: string },
  ): Promise<StaffAccountView> {
    await this.assertStaffManager(caller, input.org_unit_id);
    const user = await this.database
      .selectFrom('users')
      .select(['id', 'full_name', 'username', 'phone', 'status'])
      .where('id', '=', userId)
      .executeTakeFirst();
    if (!user) {
      throw new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy tài khoản');
    }
    const assignments = (await loadAssignments(this.database, [userId])).get(userId) ?? [];
    if (assignments.some((assignment) => PROTECTED_ROLES.includes(assignment.role_code))) {
      throw forbidden('Không khóa được tài khoản quản trị hoặc Hiệu trưởng qua chấm dứt hợp đồng');
    }
    if (user.status !== 'locked') {
      const now = this.clock.now();
      await this.database.transaction().execute(async (transaction) => {
        await transaction
          .updateTable('users')
          .set({ status: 'locked', updated_at: now })
          .where('id', '=', userId)
          .execute();
        await transaction
          .updateTable('sessions')
          .set({ revoked_at: now })
          .where('user_id', '=', userId)
          .where('revoked_at', 'is', null)
          .execute();
        await writeIdentityAuditLog(transaction, {
          actorUserId: caller.claims.userId,
          entityName: 'users',
          entityId: userId,
          action: 'lock',
          before: { status: user.status },
          after: { status: 'locked', reason: 'Chấm dứt hợp đồng lao động' },
          ipAddress: caller.ipAddress,
        });
      });
    }
    return {
      user_id: user.id,
      full_name: user.full_name,
      username: user.username,
      phone: user.phone,
      status: 'locked',
    };
  }

  private async assertStaffManager(caller: CallerContext, orgUnitId: string): Promise<void> {
    await assertPermissionAtUnit(
      this.database,
      this.organizationDirectory,
      caller,
      [PERMISSION_CODES.staffManage],
      orgUnitId,
      'Bạn không có quyền quản lý hồ sơ nhân sự',
    );
  }
}
