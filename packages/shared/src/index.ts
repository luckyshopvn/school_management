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
  settingManage: 'P01.setting.manage',
  departmentManage: 'P01.department.manage',
  catalogManage: 'P01.catalog.manage',
  approvalThresholdManage: 'P01.approval-threshold.manage',
  roomManage: 'P01.room.manage',
  classManage: 'P02.class.manage',
  childManage: 'P02.child.manage',
  childApprove: 'P02.approve',
  nationalIdView: 'P02.national-id.view',
  importChildren: 'P01.import.children',
  attendanceManage: 'P04.attendance.manage',
  authorizedPickupManage: 'P02.authorized-pickup.manage',
  pickupGateConfirm: 'P04.pickup.gate-confirm',
  feeCatalogManage: 'P05.fee-catalog.manage',
  discountTypeManage: 'P05.discount-type.manage',
  cashflowCategoryManage: 'P06.cashflow-category.manage',
  registrationManage: 'P05.registration.manage',
  lateRegistrationApprove: 'P05.late-registration.approve',
  feeCalculationManage: 'P05.fee-calculation.manage',
  discountManage: 'P05.discount.manage',
  invoiceAdjustmentCreate: 'P05.invoice-adjustment.create',
  feeDocumentApprove: 'P05.fee-document.approve',
} as const;

// Danh mục chứng từ áp dụng hạn mức phê duyệt (07_QUY_TAC_NGHIEP_VU.md mục 12.1, BR-77)
export const APPROVAL_DOCUMENT_TYPES = [
  { code: 'payment', label: 'Phiếu chi' },
  { code: 'receipt_reversal', label: 'Phiếu đảo phiếu thu' },
  { code: 'payment_reversal', label: 'Phiếu đảo phiếu chi' },
  { code: 'purchase_request', label: 'Đề nghị mua hàng' },
  { code: 'invoice_adjustment', label: 'Phiếu điều chỉnh hóa đơn' },
  { code: 'tuition_discount', label: 'Miễn giảm học phí' },
  { code: 'payroll', label: 'Bảng lương kỳ' },
  { code: 'financial_period_closing', label: 'Chốt kỳ tài chính' },
] as const;

export type ApprovalDocumentType = (typeof APPROVAL_DOCUMENT_TYPES)[number]['code'];

// Vai trò không gắn đơn vị, phạm vi toàn trường (PQ-03)
export const WHOLE_SCHOOL_ROLE_CODES = ['VT-01', 'VT-02', 'VT-19', 'VT-20'] as const;
// Vai trò VT-03 không được cấp khi tạo tài khoản (PQ-13)
export const ROLE_CODES_RESERVED_FOR_PRINCIPAL = ['VT-01', 'VT-02'] as const;
