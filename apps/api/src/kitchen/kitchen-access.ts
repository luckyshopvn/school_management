import { Injectable } from '@nestjs/common';
import type { OrganizationScope } from '../authentication/current-user.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { ApplicationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import { OrganizationScopes } from '../organization/organization-scopes.js';

// Phân quyền phân hệ bếp theo đơn vị (YCTD-76): bếp (P12.kitchen.manage) quản lý dữ liệu bếp của đơn vị; quản lý đơn vị
// (P12.menu.approve) duyệt và công bố thực đơn, duyệt buffet; người có quyền xem báo cáo bếp (P17.report.kitchen) xem
// phiếu đi chợ và báo cáo. Gán ở Trường chính là toàn trường. Vai trò phụ huynh không tính
const KITCHEN_READ_PERMISSIONS = [
  PERMISSION_CODES.kitchenManage,
  PERMISSION_CODES.menuApprove,
  PERMISSION_CODES.kitchenReport,
  // Người kiểm thực (DT-18 phần 22b) xem thực đơn, lô hàng, nhà cung cấp để kiểm tra
  PERMISSION_CODES.foodSafetyInspect,
];

@Injectable()
export class KitchenAccess {
  constructor(private readonly organizationScopes: OrganizationScopes) {}

  async scope(currentUser: CurrentUser, permission: string): Promise<OrganizationScope> {
    return this.organizationScopes.resolveStaff(currentUser, permission);
  }

  async can(currentUser: CurrentUser, permission: string, orgUnitId: string): Promise<boolean> {
    const scope = await this.scope(currentUser, permission);
    return scope.wholeSchool || scope.orgUnitIds.includes(orgUnitId);
  }

  async assert(currentUser: CurrentUser, permission: string, orgUnitId: string, message: string): Promise<void> {
    if (!(await this.can(currentUser, permission, orgUnitId))) {
      throw new ApplicationError('ERR_FORBIDDEN', message);
    }
  }

  async assertManage(currentUser: CurrentUser, orgUnitId: string): Promise<void> {
    await this.assert(
      currentUser,
      PERMISSION_CODES.kitchenManage,
      orgUnitId,
      'Bạn không có quyền quản lý bếp của đơn vị này',
    );
  }

  // Xem dữ liệu bếp của đơn vị: bếp, quản lý đơn vị duyệt thực đơn, người xem báo cáo bếp
  async canRead(currentUser: CurrentUser, orgUnitId: string): Promise<boolean> {
    for (const permission of KITCHEN_READ_PERMISSIONS) {
      if (await this.can(currentUser, permission, orgUnitId)) {
        return true;
      }
    }
    return false;
  }

  async assertRead(currentUser: CurrentUser, orgUnitId: string): Promise<void> {
    if (!(await this.canRead(currentUser, orgUnitId))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không được xem dữ liệu bếp của đơn vị này');
    }
  }
}
