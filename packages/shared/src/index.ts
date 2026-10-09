// Gói dùng chung chỉ chứa kiểu dữ liệu và hằng số, không chứa truy vấn cơ sở dữ liệu và quy tắc nghiệp vụ
export const API_VERSION_PREFIX = '/api/v1';

export const SERVICE_NAMES = {
  api: 'api',
  identity: 'identity',
} as const;

export type ServiceName = (typeof SERVICE_NAMES)[keyof typeof SERVICE_NAMES];

export interface HealthResponse {
  status: 'ok';
  service: ServiceName;
}

// Mã quyền đặc biệt ngoài dạng phân hệ và hành động (PQ-10, PQ-11)
export const PERMISSION_CODES = {
  accountManage: 'P01.account.manage',
  accountManageInUnit: 'P01.account.manage-in-unit',
  academicYearManage: 'P01.academic-year.manage',
  orgUnitManage: 'P01.org-unit.manage',
} as const;

// Vai trò không gắn đơn vị, phạm vi toàn trường (PQ-03)
export const WHOLE_SCHOOL_ROLE_CODES = ['VT-01', 'VT-02', 'VT-19', 'VT-20'] as const;
// Vai trò VT-03 không được cấp khi tạo tài khoản (PQ-13)
export const ROLE_CODES_RESERVED_FOR_PRINCIPAL = ['VT-01', 'VT-02'] as const;
