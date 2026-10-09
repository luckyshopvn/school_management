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
  academicYearManage: 'P01.academic-year.manage',
  orgUnitManage: 'P01.org-unit.manage',
} as const;
