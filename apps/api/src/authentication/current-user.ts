// Tài khoản đang gọi và quyền hiện hành do dịch vụ định danh trả về ở mỗi yêu cầu (QĐ-20)
export interface RoleAssignment {
  role_code: string;
  role_name: string;
  org_unit_id: string | null;
  permissions: string[];
}

export interface CurrentUserDescription {
  id: string;
  full_name: string;
  assignments: RoleAssignment[];
}

// Phạm vi đơn vị của một quyền: toàn trường hoặc danh sách đơn vị được gán (lớp 2 của BM-10)
export interface OrganizationScope {
  wholeSchool: boolean;
  orgUnitIds: string[];
}

export class CurrentUser {
  constructor(readonly description: CurrentUserDescription) {}

  get id(): string {
    return this.description.id;
  }

  hasPermission(permissionCode: string): boolean {
    return this.description.assignments.some((assignment) => assignment.permissions.includes(permissionCode));
  }

  // Không tính vai trò phụ huynh khi cần phạm vi của nhân sự: VT-14 gán theo đơn vị của con nhưng chỉ xem dữ liệu con mình
  organizationScope(permissionCode: string, options: { excludeParentRole?: boolean } = {}): OrganizationScope {
    const assignments = this.description.assignments.filter(
      (assignment) =>
        assignment.permissions.includes(permissionCode) &&
        !(options.excludeParentRole && assignment.role_code === 'VT-14'),
    );
    const wholeSchool = assignments.some((assignment) => assignment.org_unit_id === null);
    const orgUnitIds = wholeSchool
      ? []
      : [...new Set(assignments.map((assignment) => assignment.org_unit_id).filter((id): id is string => id !== null))];
    return { wholeSchool, orgUnitIds };
  }
}
