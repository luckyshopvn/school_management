// Tài khoản đang gọi và quyền hiện hành do dịch vụ định danh trả về ở mỗi yêu cầu (QĐ-20)
export interface RoleAssignment {
  role_code: string;
  role_name: string;
  org_unit_id: string | null;
  permissions: string[];
}

// Phiên đăng nhập thay (DT-18 phần 18h): người đăng nhập thay và thời hạn phiên
export interface ImpersonationInfo {
  id: string;
  impersonator_id: string;
  impersonator_name: string;
  started_at: string;
  expires_at: string;
}

export interface CurrentUserDescription {
  id: string;
  full_name: string;
  // Tên đăng nhập; tài khoản học sinh (kênh student) dùng tên đăng nhập học và thi (DT-23 phần 23a)
  username?: string | null;
  assignments: RoleAssignment[];
  impersonation?: ImpersonationInfo | null;
  // Phạm vi cấp học của tài khoản (DT-19 phần 19a): trống hoặc không có là mọi cấp
  school_levels?: string[];
  // Cấp đang làm việc người dùng chọn ở thanh đầu trang (DT-19 phần 19c): null hoặc không có là "Tất cả"
  working_school_level?: string | null;
  // Phiên hỗ trợ của nhân viên nền tảng (DT-SaaS phần S4): null hoặc không có là phiên thường
  // full_access (YCTD-315): phiên Admin vào thẳng có mọi mã quyền của trường
  support?: {
    id: string;
    scope: 'read' | 'full';
    operator_name: string;
    expires_at: string;
    full_access?: boolean;
  } | null;
}

// Phạm vi đơn vị của một quyền: toàn trường hoặc danh sách đơn vị được gán (lớp 2 của BM-10)
export interface OrganizationScope {
  wholeSchool: boolean;
  orgUnitIds: string[];
}

// Phiên đang gọi: kênh đăng nhập và mã phiên (bài thi trực tuyến chỉ một phiên đang làm, DT-23 phần 23a)
export interface CallingSession {
  channel: string;
  sessionId: string;
}

export class CurrentUser {
  constructor(
    readonly description: CurrentUserDescription,
    readonly session: CallingSession | null = null,
    // Chế độ xem của nhân viên hỗ trợ ở ứng dụng học sinh (YCTD-315b): học sinh Admin đang chọn để xem, chỉ có ở phiên Admin vào
    // thẳng kênh student; các điểm cuối của học sinh dùng học sinh này thay cho học sinh của tài khoản
    readonly supportViewChildId: string | null = null,
  ) {}

  get isPlatformAdminSupport(): boolean {
    return this.description.support?.full_access === true;
  }

  get id(): string {
    return this.description.id;
  }

  hasPermission(permissionCode: string): boolean {
    return this.description.assignments.some((assignment) => assignment.permissions.includes(permissionCode));
  }

  // Cấp học tài khoản được giới hạn; mảng trống là mọi cấp (đọc cấp đang bật qua SchoolLevelResolver.forUser)
  schoolLevelScope(): string[] {
    return this.description.school_levels ?? [];
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
