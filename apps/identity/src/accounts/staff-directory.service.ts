import { Injectable } from '@nestjs/common';
import { PERMISSION_CODES } from '@school-management/shared';
import { Infrastructure } from '../common/infrastructure.js';
import type { CallerContext } from './accounts.service.js';
import { OrganizationDirectory } from './organization-directory.js';
import { assertPermissionAtUnit } from './permission-scope.js';

// Danh bạ nhân sự theo vai trò và đơn vị để phân công giáo viên vào lớp và chọn nhân sự liên quan của trẻ (YCTD-44, YCTD-45).
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

  async list(caller: CallerContext, roleCode: string, orgUnitId: string): Promise<StaffDirectoryEntry[]> {
    const { rootId } = await assertPermissionAtUnit(
      this.database,
      this.organizationDirectory,
      caller,
      [PERMISSION_CODES.classManage, PERMISSION_CODES.childManage],
      orgUnitId,
      'Bạn không có quyền xem danh bạ nhân sự',
    );
    const visibleUnits = [orgUnitId, ...(rootId && rootId !== orgUnitId ? [rootId] : [])];
    return (
      this.database
        .selectFrom('user_roles')
        .innerJoin('roles', 'roles.id', 'user_roles.role_id')
        .innerJoin('users', 'users.id', 'user_roles.user_id')
        .select(['users.id as user_id', 'users.full_name', 'roles.code as role_code', 'user_roles.org_unit_id'])
        .where('roles.code', '=', roleCode)
        .where('users.status', '=', 'active')
        // Nhân sự luôn gắn đơn vị (PQ-03); gán ở Trường chính là toàn trường nên cũng hiện
        .where('user_roles.org_unit_id', 'in', visibleUnits)
        .orderBy('users.full_name')
        .execute()
    );
  }
}
