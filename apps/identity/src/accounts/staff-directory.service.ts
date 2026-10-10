import { Injectable } from '@nestjs/common';
import { PERMISSION_CODES } from '@school-management/shared';
import { Infrastructure } from '../common/infrastructure.js';
import { forbidden } from './account-authority.js';
import type { CallerContext } from './accounts.service.js';
import { loadAssignments } from './assignments.js';
import { OrganizationDirectory } from './organization-directory.js';

// Danh bạ nhân sự theo vai trò và đơn vị để phân công giáo viên vào lớp (P02-05, YCTD-44).
// Chỉ trả mã tài khoản, họ tên và vai trò; khi có hồ sơ nhân sự (P07) sẽ chuyển sang đọc hồ sơ nhân sự
export interface StaffDirectoryEntry {
  user_id: string;
  full_name: string;
  role_code: string;
  org_unit_id: string | null;
}

@Injectable()
export class StaffDirectoryService {
  constructor(
    private readonly infrastructure: Infrastructure,
    private readonly organizationDirectory: OrganizationDirectory,
  ) {}

  private get database() {
    return this.infrastructure.database;
  }

  // Người gọi cần P02.class.manage ở đơn vị đó; người được gán ở Trường chính hoặc toàn trường cũng được tính (QĐ-23)
  async list(caller: CallerContext, roleCode: string, orgUnitId: string): Promise<StaffDirectoryEntry[]> {
    const assignments = (await loadAssignments(this.database, [caller.claims.userId])).get(caller.claims.userId) ?? [];
    const holders = assignments.filter((assignment) => assignment.permissions.includes(PERMISSION_CODES.classManage));
    if (holders.length === 0) {
      throw forbidden('Bạn không có quyền phân công giáo viên');
    }
    const rootId =
      (await this.organizationDirectory.listUnits(caller.accessToken)).find((unit) => unit.unit_type === 'truong_chinh')
        ?.id ?? null;
    const wholeSchool = holders.some(
      (assignment) => assignment.org_unit_id === null || assignment.org_unit_id === rootId,
    );
    if (!wholeSchool && !holders.some((assignment) => assignment.org_unit_id === orgUnitId)) {
      throw forbidden('Đơn vị này nằm ngoài phạm vi của bạn');
    }

    const visibleUnits = [orgUnitId, ...(rootId && rootId !== orgUnitId ? [rootId] : [])];
    const rows = await this.database
      .selectFrom('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .innerJoin('users', 'users.id', 'user_roles.user_id')
      .select(['users.id as user_id', 'users.full_name', 'roles.code as role_code', 'user_roles.org_unit_id'])
      .where('roles.code', '=', roleCode)
      .where('users.status', '=', 'active')
      // Giáo viên luôn gắn đơn vị (PQ-03); gán ở Trường chính là toàn trường nên cũng hiện
      .where('user_roles.org_unit_id', 'in', visibleUnits)
      .orderBy('users.full_name')
      .execute();
    return rows;
  }
}
