// Gói dùng chung chỉ chứa kiểu dữ liệu và hằng số, không chứa truy vấn cơ sở dữ liệu và quy tắc nghiệp vụ
export * from './facilities.js';
export * from './portal-menu.js';
export * from './menu-permissions.js';
export * from './staff-profile.js';
export * from './staff-catalogs.js';
export * from './classes.js';
export * from './student-health.js';
export * from './students.js';

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
  receiptManage: 'P06.receipt.manage',
  cashAccountManage: 'P06.cash-account.manage',
  debtView: 'P05.debt.view',
  receiptReversalCreate: 'P06.receipt-reversal.create',
  receiptReversalApprove: 'P06.receipt-reversal.approve',
  openingDebtImport: 'P05.opening-debt.import',
  paymentManage: 'P06.payment.manage',
  paymentApprove: 'P06.payment.approve',
  paymentReversalCreate: 'P06.payment-reversal.create',
  staffManage: 'P07.staff.manage',
  staffView: 'P07.staff.view',
  contractView: 'P07.contract.view',
  importStaff: 'P01.import.staff',
  holidayManage: 'P08.holiday.manage',
  schoolDayChangeManage: 'P08.school-day-change.manage',
  staffAttendanceManage: 'P08.attendance.manage',
  staffAttendanceView: 'P08.attendance.view',
  workScheduleManage: 'P08.work-schedule.manage',
  healthManage: 'P10.health.manage',
  medicalEventRecord: 'P10.medical-event.record',
  dailyCareRecord: 'P10.daily-care.record',
  medicineManage: 'P10.medicine.manage',
  medicationAdminister: 'P10.medication.administer',
  medicinePurchaseApprove: 'P10.medicine-purchase.approve',
  kitchenManage: 'P12.kitchen.manage',
  menuApprove: 'P12.menu.approve',
  mealReportSubmit: 'P12.meal-report.submit',
  kitchenReport: 'P17.report.kitchen',
  assetManage: 'P13.asset.manage',
  purchaseRequestCreate: 'P13.purchase-request.create',
  purchaseRequestApprove: 'P13.purchase-request.approve',
  purchaseOrderManage: 'P13.purchase-order.manage',
  stocktakeApprove: 'P13.stocktake.approve',
  activityCreate: 'P14.activity.create',
  activityApprove: 'P14.activity.approve',
  contentManage: 'P14.content.manage',
  libraryManage: 'P14.library.manage',
  extracurricularManage: 'P14.extracurricular.manage',
  commentModerate: 'P14.comment.moderate',
  interactionManage: 'P15.interaction.manage',
  messageSend: 'P15.message.send',
  lostItemManage: 'P02.lost-item.manage',
  lessonManage: 'P03.lesson.manage',
  lessonPlanReview: 'P03.lesson-plan.review',
  curriculumManage: 'P03.curriculum.manage',
  progressRecord: 'P03.progress.record',
  taskAssign: 'P09.task.assign',
  planManage: 'P09.plan.manage',
  evaluationManage: 'P09.evaluation.manage',
  workHistoryManage: 'P07.work-history.manage',
  bonusDeductionManage: 'P08.bonus-deduction.manage',
  debtReminderManage: 'P05.debt-reminder.manage',
  overdueDebtPropose: 'P05.overdue-debt.propose',
  overdueDebtDecide: 'P05.overdue-debt.decide',
  bankTransactionManage: 'P06.bank-transaction.manage',
  payableManage: 'P06.payable.manage',
  periodCloseRequest: 'P06.period-close.request',
  periodCloseApprove: 'P06.period-close.approve',
  operationsReport: 'P17.report.operations',
  consolidatedReport: 'P17.report.consolidated',
  dataExport: 'P17.data.export',
  admissionCampaignManage: 'P16.admission-campaign.manage',
  admissionApplicationManage: 'P16.application.manage',
  admissionApplicationReview: 'P16.application.review',
  admissionPostManage: 'P16.admission-post.manage',
  recruitmentRequestCreate: 'P18.recruitment-request.create',
  recruitmentRequestApprove: 'P18.recruitment-request.approve',
  recruitmentManage: 'P18.recruitment.manage',
  interviewManage: 'P18.interview.manage',
  ledgerManage: 'P06.ledger.manage',
  ledgerView: 'P06.ledger.view',
  bankStatementImport: 'P06.bank-statement.import',
  facebookManage: 'P14.facebook.manage',
  integrationManage: 'P01.integration.manage',
  leavePolicyManage: 'P08.leave-policy.manage',
  leaveApprove: 'P08.leave.approve',
  timesheetReopenApprove: 'P08.timesheet-reopen.approve',
  payItemTypeManage: 'P08.pay-item-type.manage',
  staffPayItemManage: 'P08.staff-pay-item.manage',
  taxTableManage: 'P08.tax-table.manage',
  payrollManage: 'P08.payroll.manage',
  payrollView: 'P08.payroll.view',
  payrollApprove: 'P08.payroll.approve',
  leadershipDashboard: 'P17.dashboard.leadership',
  unitDashboard: 'P17.dashboard.unit',
  tuitionReport: 'P17.report.tuition',
  debtReport: 'P17.report.debt',
  cashFlowReport: 'P17.report.cash-flow',
  attendanceReport: 'P17.report.attendance',
  staffAttendanceReport: 'P17.report.staff-attendance',
  saturdayReport: 'P17.report.saturday',
  birthdayView: 'P17.birthday.view',
  // Báo cáo cân nặng, chiều cao theo đợt cân đo (YCTD-102)
  growthReport: 'P17.report.growth',
  // Thống kê theo tiêu chí ngành và hồ sơ chưa nhập đủ (YCTD-102)
  childStatisticsView: 'P17.child-statistics.view',
  staffStatisticsView: 'P17.staff-statistics.view',
  apiClientManage: 'P01.api-client.manage',
  // Thiết bị dạy học, cơ sở vật chất, hồ sơ trường và báo cáo EMIS (DT-14 phần 14d, YCTD-102)
  equipmentManage: 'P13.equipment.manage',
  facilitiesReport: 'P17.report.facilities',
  schoolProfileManage: 'P01.school-profile.manage',
  emisReport: 'P17.report.emis',
  notificationTemplateManage: 'P19.notification-template.manage',
  notificationReceiptView: 'P19.notification-receipt.view',
  // Hoàn thành chương trình, nhóm học sinh, chuẩn nghề nghiệp (YCTD-102)
  programCompletionManage: 'P02.program-completion.manage',
  programCompletionApprove: 'P02.program-completion.approve',
  childGroupManage: 'P02.child-group.manage',
  professionalStandardManage: 'P07.professional-standard.manage',
  professionalStandardAssess: 'P07.professional-standard.assess',
  // Xem mọi ý kiến phản hồi gửi từ chân trang, đổi trạng thái và trả lời (DT-15 phần 15g, YCTD-110)
  feedbackManage: 'P01.feedback.manage',
  // Văn thư lưu trữ, mục 5.10 của Sở (DT-15 phần 15h2, YCTD-118)
  archiveView: 'P09.archive.view',
  archiveManage: 'P09.archive.manage',
  archiveExport: 'P09.archive.export',
  // Soạn thông báo hệ thống bật lên khi vào cổng quản trị, cấu hình ứng dụng liên kết (DT-16 phần 16c)
  announcementManage: 'P01.announcement.manage',
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

// Tên phân hệ theo mã, dùng làm tên nhóm chức năng trên ma trận quyền (03_DANH_SACH_CONG_VIEC.md mục 1)
export const MODULE_NAMES: Record<string, string> = {
  P01: 'Nền tảng, đơn vị và phân quyền',
  P02: 'Trẻ, phụ huynh và lớp học',
  P03: 'Giảng dạy',
  P04: 'Điểm danh và chăm sóc hằng ngày',
  P05: 'Học phí, khoản thu và giảm trừ',
  P06: 'Tài chính',
  P07: 'Nhân sự',
  P08: 'Chấm công và tiền lương',
  P09: 'Công việc, kế hoạch và đánh giá',
  P10: 'Y tế học đường',
  P12: 'Bếp và dinh dưỡng',
  P13: 'Kho, tài sản và mua hàng',
  P14: 'Hoạt động, nội dung và truyền thông',
  P15: 'Tương tác và ý kiến',
  P16: 'Tuyển sinh',
  P17: 'Báo cáo và bảng điều khiển',
  P18: 'Tuyển dụng',
  P19: 'Kênh truy cập và thông báo',
};

// Vai trò không gắn đơn vị, phạm vi toàn trường (PQ-03)
export const WHOLE_SCHOOL_ROLE_CODES = ['VT-01', 'VT-02', 'VT-19', 'VT-20'] as const;
// Vai trò VT-03 không được cấp khi tạo tài khoản (PQ-13)
export const ROLE_CODES_RESERVED_FOR_PRINCIPAL = ['VT-01', 'VT-02'] as const;

// Đường dẫn trang của cổng quản trị được ghim vào "Truy cập nhanh" trên trang chủ (YCTD-102); máy chủ API chỉ nhận các
// đường dẫn này, giao diện chỉ cho chọn trang người dùng thấy trên menu
export const PORTAL_QUICK_LINK_PATHS = [
  '/academic-years',
  '/org-units',
  '/accounts',
  '/roles',
  '/role-permissions',
  '/settings',
  '/audit-logs',
  '/departments',
  '/catalogs',
  '/approval-thresholds',
  '/rooms',
  '/classes',
  '/children',
  '/imports',
  '/attendance',
  '/fees',
  '/cashflow-categories',
  '/registrations',
  '/invoices',
  '/fee-approvals',
  '/debts',
  '/receipts',
  '/cash-accounts',
  '/payments',
  '/cash-book',
  '/debt-collection',
  '/bank-reconciliation',
  '/payables',
  '/fiscal-periods',
  '/ledger',
  '/staff',
  '/staff-attendance',
  '/school-days',
  '/work-schedules',
  '/health',
  '/admissions',
  '/interactions',
  '/kitchen',
  '/medicines',
  '/inventory',
  '/activities',
  '/purchase-requests',
  '/recruitment',
  '/teaching',
  '/leave-requests',
  '/leave-policies',
  '/payrolls',
  '/pay-items',
  '/my-payslips',
  '/payroll-settlements',
  '/reports',
  '/api-clients',
  '/integrations',
  '/notifications',
  '/work',
  '/evaluations',
  '/bonus-deductions',
  // Trang thêm ở DT-14 (YCTD-102), đưa vào cây menu ở DT-15 phần 15a
  '/growth',
  '/growth-report',
  '/statistics',
  '/missing-profiles',
  '/school-profile',
  '/facility-rooms',
  '/equipment',
  '/emis',
  '/program-completion',
  '/child-groups',
  '/professional-standards',
  // Biến động học sinh (DT-15 phần 15c, YCTD-108)
  '/student-movements',
  // Ý kiến phản hồi gửi từ chân trang (DT-15 phần 15g, YCTD-110)
  '/feedback',
  // Trường học, lớp học theo Sở (DT-15 phần 15b, YCTD-111)
  '/branches',
  '/school-sites',
  '/class-imports',
  '/class-assignments',
  // Cập nhật địa danh hành chính (DT-15 phần 15h1)
  '/administrative-units',
  // Quản trị hệ thống đủ theo Sở: 1.2 Phân quyền nhóm theo phần mềm, 1.6 Tài khoản đồng bộ của Bộ, của Sở (DT-16 phần 16d)
  '/role-workspaces',
  '/sync-accounts',
  // Văn thư lưu trữ (DT-15 phần 15h2, YCTD-118)
  '/archive-records',
  '/archive-fonds',
  '/archive-holdings',
  '/archive-report',
  // Tệp đã tạo của tác vụ xuất nền (DT-16 phần 16a)
  '/generated-files',
  // Thông báo hệ thống, ứng dụng liên kết (DT-16 phần 16c)
  '/system-announcements',
  '/app-links',
  // Nhân sự đủ theo Sở (DT-16 phần 16f): 3.1.2, 3.1.3, 3.1.5, 3.5, 5.2, 5.6
  '/staff-branches',
  '/staff-imports',
  '/staff-identity',
  '/staff-movements',
  '/staff-statistics',
  '/staff-identity-progress',
  // Sức khỏe học sinh, thống kê học sinh (DT-16 phần 16h)
  '/student-health',
  '/student-statistics',
  // Học sinh đủ theo Sở (DT-16 phần 16g)
  '/student-imports',
  '/student-order',
  '/sms-phones',
  '/national-ids',
  '/learning-accounts',
  '/default-passwords',
  '/national-id-progress',
] as const;

export type PortalQuickLinkPath = (typeof PORTAL_QUICK_LINK_PATHS)[number];

// Số lối tắt tối đa của mỗi tài khoản
export const MAX_QUICK_LINKS = 12;

// Lưới dữ liệu dùng chung của cổng quản trị (DT-15 phần 15a): mỗi lưới có một khóa để nhớ cấu hình cột và số dòng mỗi
// trang theo từng tài khoản; "default" là số dòng mặc định cho mọi lưới (Cấu hình hiển thị lưới ở menu người dùng). Máy
// chủ API chỉ nhận các khóa này; lưới mới chuyển sang ở các phần sau thì thêm khóa vào đây
export const DATA_GRID_KEYS = [
  'default',
  // Nhân sự đủ theo Sở (DT-16 phần 16f)
  'staff-branches',
  'staff-identity',
  'staff-movements-in',
  'staff-movements-out',
  'staff-guests-out',
  'staff-guests-in',
  'accounts',
  'staff',
  // Học sinh (DT-15 phần 15c)
  'children',
  'student-movements',
  // Quản trị hệ thống (DT-15 phần 15e)
  'roles',
  'api-clients',
  'audit-logs',
  // Ý kiến phản hồi (DT-15 phần 15g)
  'my-feedback',
  'feedback',
  // Trường học, lớp học (DT-15 phần 15b)
  'branches',
  'school-sites',
  'classes',
  'class-assignments',
  // Cập nhật địa danh hành chính (DT-15 phần 15h1)
  'administrative-addresses',
  'administrative-unit-mappings',
  // Màn hình còn lại của các phân hệ theo Sở (DT-16 phần 16b): cơ sở vật chất, thiết bị dạy học
  'facility-rooms',
  'equipment-summary',
  'equipment-outside',
  'equipment-catalog',
  // 16b: cân đo, thống kê, hồ sơ chưa nhập đủ, hoàn thành chương trình
  'growth-report-children',
  'missing-child-profiles',
  'missing-staff-profiles',
  'program-completion-classes',
  'program-completion-children',
  // 16b: nhóm học sinh, đánh giá chuẩn nghề nghiệp
  'child-groups',
  'child-group-members',
  'professional-evaluations',
  // 16b: thực đơn bữa ăn
  'kitchen-menus',
  'kitchen-ingredients',
  'kitchen-dishes',
  'kitchen-suppliers',
  'kitchen-purchases',
  'kitchen-buffets',
  // 16b: y tế, thuốc
  'health-campaigns',
  'health-schedules',
  'medical-events',
  'health-report-requests',
  'health-standards',
  'medication-requests',
  'medication-schedule',
  'medicines',
  'pharmacies',
  'medicine-purchase-requests',
  'medicine-purchase-orders',
  'medicine-issues',
  // 16b: quản trị hệ thống
  'academic-years',
  'departments',
  'job-titles',
  'catalog-items',
  'rooms',
  'grade-levels',
  'zalo-followers',
  'org-units',
  // Văn thư lưu trữ (DT-15 phần 15h2)
  'archive-records',
  'archive-fonds',
  'archive-holdings',
  'archive-report',
  // Tệp đã tạo (DT-16 phần 16a)
  'generated-files',
  // Thông báo hệ thống (DT-16 phần 16c)
  'system-announcements',
  // Sức khỏe, thực đơn, thống kê học sinh (DT-16 phần 16h)
  'student-statistics-ethnic',
  // Học sinh đủ theo Sở (DT-16 phần 16g)
  'student-order',
  'sms-phones',
  'national-ids',
  'learning-accounts',
  'national-id-progress',
  'national-id-duplicates',
  'student-transfers',
] as const;
export type DataGridKey = (typeof DATA_GRID_KEYS)[number];
export const DATA_GRID_PAGE_SIZES = [10, 20, 50, 100, 200] as const;
export const DEFAULT_DATA_GRID_PAGE_SIZE = 20;
