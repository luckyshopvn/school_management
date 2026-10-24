// Gói dùng chung chỉ chứa kiểu dữ liệu và hằng số, không chứa truy vấn cơ sở dữ liệu và quy tắc nghiệp vụ
export * from './facilities.js';
export * from './portal-menu.js';
export * from './menu-permissions.js';
export * from './staff-profile.js';
export * from './staff-catalogs.js';
export * from './classes.js';
export * from './student-health.js';
export * from './students.js';
export * from './emis.js';
export * from './signing.js';
export * from './entry-admissions.js';
export * from './incoming-documents.js';
export * from './kpi.js';
export * from './outgoing-documents.js';
export * from './directives.js';
export * from './website.js';
export * from './administration.js';
export * from './professional-records.js';
export * from './food-safety.js';
export * from './education-plans.js';
export * from './school-levels.js';
export * from './school-level-terms.js';
export * from './level-features.js';
export * from './subjects.js';
export * from './assessments.js';
export * from './student-records.js';
export * from './emulation.js';
export * from './quality-assurance.js';
export * from './school-levels.js';
export * from './level-structure.js';

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
  // Quản lý kí hồ sơ, mục 6 của Sở, bản chạy nội bộ (DT-16 phần 16k)
  signingView: 'P01.signing.view',
  signingManage: 'P01.signing.manage',
  signingSign: 'P01.signing.sign',
  signingCertificate: 'P01.signing.certificate',
  // Tuyển sinh đầu cấp: hồ sơ cuối cấp, xác nhận hoàn thành, thông tin trường, dịch vụ, hỗ trợ tuyển sinh (DT-17 phần 17c)
  finalYearView: 'P02.final-year.view',
  finalYearManage: 'P02.final-year.manage',
  finalYearApprove: 'P02.final-year.approve',
  admissionSupportReply: 'P02.admission-support.reply',
  // Tuyển sinh đầu cấp phần 2: tiếp nhận hồ sơ, trường tiên tiến, thông báo, chuyển hồ sơ trúng tuyển (DT-17 phần 17d)
  entryIntakeView: 'P02.entry-intake.view',
  entryIntakeManage: 'P02.entry-intake.manage',
  entryIntakeTransfer: 'P02.entry-intake.transfer',
  // Văn bản đến theo VNPT iOffice, phân hệ Quản lý văn bản và điều hành (DT-18 phần 18a)
  incomingDocumentView: 'P09.incoming-document.view',
  incomingDocumentRegister: 'P09.incoming-document.register',
  incomingDocumentSearch: 'P09.incoming-document.search',
  incomingDocumentAdmin: 'P09.incoming-document.admin',
  // Phân hệ KPI (DT-18 phần 18d)
  kpiParticipate: 'P09.kpi.participate',
  kpiManage: 'P09.kpi.manage',
  kpiAdvise: 'P09.kpi.advise',
  kpiVote: 'P09.kpi.vote',
  kpiConfigure: 'P09.kpi.configure',
  // Văn bản đi theo VNPT iOffice (DT-18 phần 18b)
  outgoingDocumentDraft: 'P09.outgoing-document.draft',
  outgoingDocumentSign: 'P09.outgoing-document.sign',
  outgoingDocumentIssue: 'P09.outgoing-document.issue',
  outgoingDocumentSearch: 'P09.outgoing-document.search',
  // Giao việc, lịch đơn vị, phòng họp, hồ sơ công việc, báo cáo theo VNPT iOffice (DT-18 phần 18c)
  taskDirect: 'P09.task.direct',
  scheduleView: 'P09.schedule.view',
  scheduleManage: 'P09.schedule.manage',
  meetingRoomManage: 'P09.meeting-room.manage',
  workFileUse: 'P09.work-file.use',
  documentReportView: 'P09.document-report.view',
  // Hồ sơ chuyên môn (DT-18 phần 18e)
  professionalRecordUse: 'P09.professional-record.use',
  professionalRecordReview: 'P09.professional-record.review',
  professionalRecordApprove: 'P09.professional-record.approve',
  professionalRecordManage: 'P09.professional-record.manage',
  // Thiết bị: quét mã QR kiểm kê, ghi tình trạng (DT-18 phần 18g)
  equipmentStocktake: 'P13.equipment.stocktake',
  // Website trường (DT-18 phần 18f)
  websiteEdit: 'P14.website.edit',
  websiteApprove: 'P14.website.approve',
  websiteConfigure: 'P14.website.configure',
  // Quản trị và trình diễn (DT-18 phần 18h)
  accountImpersonate: 'P01.account.impersonate',
  dataExportAll: 'P01.data.export-all',
  // Bán trú: kiểm thực ba bước, lưu và hủy mẫu thức ăn (DT-18 phần 22b)
  foodSafetyInspect: 'P12.food-safety.inspect',
  // Kế hoạch giáo dục (DT-18 phần 22i)
  educationPlanUse: 'P09.education-plan.use',
  educationPlanReview: 'P09.education-plan.review',
  educationPlanApprove: 'P09.education-plan.approve',
  educationPlanFinalize: 'P09.education-plan.finalize',
  educationPlanManage: 'P09.education-plan.manage',
  // Cấu hình cấp học của trường ở 1.4 Cấu hình trường (DT-19 phần 19a)
  schoolLevelManage: 'P01.school-level.manage',
  // Lập, nhập, ban hành thời khoá biểu, khung giờ tiết học (DT-20 phần 22c1)
  timetableManage: 'P02.timetable.manage',
  // Kiểm tra, ký sổ đầu bài theo tuần (DT-20 phần 20d)
  classLogReview: 'P02.class-log.review',
  // Thi đua, khen thưởng (DT-18 phần 22d)
  emulationUse: 'P09.emulation.use',
  emulationManage: 'P09.emulation.manage',
  emulationDecide: 'P09.emulation.decide',
  // Bảo đảm chất lượng, tự đánh giá (DT-18 phần 22f)
  qualityUse: 'P09.quality.use',
  qualityManage: 'P09.quality.manage',
  // Bán trú lớp ngoài Mầm non, nề nếp và thi đua lớp (DT-20 phần 20b)
  boardingManage: 'P04.boarding.manage',
  conductRecord: 'P02.conduct.record',
  conductManage: 'P02.conduct.manage',
  assessmentEnter: 'P02.assessment.enter',
  assessmentView: 'P02.assessment.view',
  assessmentManage: 'P02.assessment.manage',
  // Thư viện trường học (DT-22 phần 22a)
  schoolLibraryView: 'P02.library.view',
  schoolLibraryManage: 'P02.library.manage',
  studentRecordApprove: 'P02.student-record.approve',
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
  '/boarding',
  '/conduct',
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
  // Trường học, lớp học, lịch năm học đủ theo Sở (DT-16 phần 16e)
  '/accreditation-review',
  '/school-splits',
  '/school-weeks',
  '/year-rollover',
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
  // Báo cáo số liệu EMIS đủ bảy biểu (DT-16 phần 16j)
  '/emis/facilities',
  '/emis/health',
  '/emis/end-of-year',
  '/emis/staff',
  '/emis/foreign-language',
  '/emis/preschool-end-of-year',
  // 1.1.2 Gửi báo cáo đầu năm (DT-17 phần 17a)
  '/emis/send',
  // Cơ sở vật chất đủ theo Sở (DT-16 phần 16i)
  '/facility-investments',
  '/facility-input',
  '/facility-report',
  '/equipment-outside',
  '/equipment-submission',
  // Quản lý kí hồ sơ (DT-16 phần 16k)
  '/signing-certificate',
  '/signing-certificate-sync',
  '/signing-dossiers',
  '/signing-submissions',
  // Tuyển sinh đầu cấp (DT-17 phần 17c)
  '/entry-admissions/final-year',
  '/entry-admissions/completion',
  '/entry-admissions/school-map',
  '/entry-admissions/services',
  '/entry-admissions/roles',
  '/entry-admissions/users',
  '/entry-admissions/staff',
  '/entry-admissions/classes',
  '/entry-admissions/statistics',
  '/entry-admissions/support',
  // Tuyển sinh đầu cấp phần 2 (DT-17 phần 17d)
  '/entry-admissions/advanced',
  '/entry-admissions/intake',
  '/entry-admissions/notices',
  '/entry-admissions/transfer',
  '/entry-admissions/transfer-results',
  '/admitted-students',
  // Văn bản đến theo VNPT iOffice (DT-18 phần 18a)
  '/incoming-documents',
  '/incoming-documents/manage',
  '/incoming-documents/for-information',
  '/incoming-documents/starred',
  '/incoming-documents/followed',
  '/incoming-documents/search',
  '/incoming-documents/interconnect',
  '/document-books',
  '/external-units',
  '/external-unit-groups',
  '/document-catalogs',
  '/document-leaders',
  // Phân hệ KPI (DT-18 phần 18d)
  '/kpi/periods',
  '/kpi/rule-sets',
  '/kpi/profiles',
  '/kpi/legacy-import',
  '/kpi/catalog',
  '/kpi/my-tasks',
  '/kpi/assignments',
  '/kpi/grading',
  '/kpi/my-evaluation',
  '/kpi/evaluations',
  '/kpi/advisory',
  '/kpi/voting',
  '/kpi/reports',
  // Văn bản đi theo VNPT iOffice (DT-18 phần 18b)
  '/outgoing-documents',
  '/outgoing-documents/manage',
  '/outgoing-documents/interconnect',
  '/outgoing-documents/search',
  // Giao việc, lịch, hồ sơ công việc, báo cáo theo VNPT iOffice (DT-18 phần 18c)
  '/directives/new',
  '/directives/inbox',
  '/directives/outbox',
  '/work-files',
  '/work-files/shared',
  '/work-files/transferred',
  '/work-files/archive',
  '/work-files/expired',
  '/unit-schedules',
  '/meeting-schedules',
  '/room-bookings',
  '/meeting-rooms',
  '/schedule-templates',
  '/document-reports/incoming',
  '/document-reports/summary',
  '/document-reports/statistics',
  // Hồ sơ chuyên môn và Việc của tôi (DT-18 phần 18e)
  '/my-work',
  '/professional-records',
  '/professional-records/groups',
  '/professional-records/school',
  '/professional-records/review',
  '/professional-rounds',
  '/professional-records/statistics',
  '/professional-folders',
  '/professional-work-groups',
  // Thiết bị: nơi để, tem QR, kiểm kê, đối sánh danh mục tối thiểu (DT-18 phần 18g)
  '/equipment-locations',
  '/equipment-stocktakes',
  '/equipment-minimum',
  // Website trường (DT-18 phần 18f)
  '/website/settings',
  '/website/domains',
  '/website/news',
  '/website/announcements',
  '/website/pages',
  '/website/disclosures',
  '/website/albums',
  '/website/review',
  '/website/contacts',
  // Quản trị và trình diễn (DT-18 phần 18h)
  '/impersonations',
  '/school-data-export',
  '/demo-environment',
  // Bán trú: kiểm thực ba bước và an toàn thực phẩm (DT-18 phần 22b)
  '/food-safety/inspections',
  '/food-safety/samples',
  '/food-safety/lots',
  '/food-safety/supplier-records',
  '/food-safety/trace',
  // Kế hoạch giáo dục (DT-18 phần 22i)
  '/education-plans',
  '/education-plans/groups',
  '/education-plans/school',
  '/education-plans/review',
  '/education-plans/progress',
  '/education-plan-templates',
  // Thi đua, khen thưởng (DT-18 phần 22d)
  '/emulation/campaigns',
  '/emulation/registrations',
  '/emulation/nominations',
  '/emulation/nominations/review',
  '/emulation/council',
  '/emulation/voting',
  '/emulation/appeals',
  '/emulation/decisions',
  '/emulation/history',
  '/emulation/reports',
  '/emulation/titles',
  // Bảo đảm chất lượng, tự đánh giá (DT-18 phần 22f)
  '/quality/assessments',
  '/quality/reports',
  '/quality/evidences',
  '/quality/recognition',
  '/quality/frameworks',
  '/library/titles',
  '/library/readers',
  '/library/circulation',
  '/library/textbooks',
  '/library/stocktakes',
  '/library/reports',
  '/library/settings',
  // Nền Tiểu học: môn học và hoạt động giáo dục, phân công giảng dạy theo môn (DT-20 phần 20a)
  '/subjects',
  '/teaching-assignments',
  // Thời khoá biểu: khung giờ tiết học, thời khoá biểu theo môn (DT-20 phần 22c1)
  '/period-slots',
  '/timetables',
  '/student-assessments',
  // Sổ đầu bài, chuyên cần theo tiết (DT-20 phần 20d)
  '/class-logs',
  '/period-attendance',
  '/learning-records',
  // Máy xếp, dạy thay, đổi tiết, báo cáo (DT-20 phần 22c2)
  '/timetable-generator',
  '/timetable-changes',
  '/timetable-reports',
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
  // Nhân sự – chấm công, lương (DT-15 phần 15f2)
  'my-leave-requests',
  'leave-requests',
  'leave-policies',
  'leave-balances',
  'holidays',
  'school-day-changes',
  'work-schedules',
  'payslips',
  'payroll-settlements',
  'payroll-adjustments',
  'pay-item-types',
  'bonus-deductions',
  'my-tasks',
  'unit-tasks',
  'work-plans',
  'evaluation-criteria',
  'evaluations',
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
  // Tách trường (DT-16 phần 16e)
  'school-splits',
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
  // Quản lý kí hồ sơ (DT-16 phần 16k)
  'signing-dossiers',
  'signing-submissions',
  // Tài chính – học phí (DT-15 phần 15f1)
  'services',
  'discount-types',
  'late-registrations',
  'invoices',
  'fee-approval-discounts',
  'fee-approval-adjustments',
  'debts',
  'debt-reminders',
  'debt-resolutions',
  'receipts',
  'receipt-reversals',
  'payments',
  'payment-approvals',
  'payment-reversals',
  'cash-accounts',
  'payables',
  'cashflow-categories',
  'ledger-accounts',
  'ledger-rules',
  'fiscal-periods',
  // Bếp – kho, Tương tác, Giảng dạy, Tuyển sinh, tuyển dụng (DT-15 phần 15f3)
  'stock-items',
  'stock-transactions',
  'purchase-orders',
  'assets',
  'asset-damages',
  'stock-counts',
  'suppliers',
  'my-purchase-requests',
  'purchase-requests',
  'polls',
  'survey-templates',
  'interaction-feedbacks',
  'lost-items',
  'reported-comments',
  'content-catalogs',
  'news',
  'library-items',
  'extracurricular-activities',
  'lesson-plan-reviews',
  'lessons',
  'lesson-domains',
  'lesson-groups',
  'lesson-themes',
  'teaching-plans',
  'admission-campaigns',
  'admission-applications',
  'admission-posts',
  'recruitment-requests',
  'recruitment-approvals',
  'job-postings',
  'candidates',
  'export-logs',
  // Tuyển sinh đầu cấp (DT-17 phần 17c)
  'final-year-records',
  'final-year-completion',
  'final-year-statistics',
  'entry-school-sites',
  'entry-school-services',
  'entry-roles',
  'entry-users',
  'entry-staff',
  'entry-classes',
  'admission-support-requests',
  // Tuyển sinh đầu cấp phần 2 (DT-17 phần 17d)
  'entry-advanced',
  'entry-intake',
  'entry-notices',
  'entry-transfer',
  'entry-transfer-results',
  'entry-cancel-results',
  'admitted-students',
  // Văn bản đến theo VNPT iOffice (DT-18 phần 18a)
  'incoming-documents',
  'incoming-manage',
  'incoming-interconnect',
  'incoming-register',
  'document-books',
  'external-units',
  'external-unit-groups',
  'document-catalogs',
  // Phân hệ KPI (DT-18 phần 18d)
  'kpi-periods',
  'kpi-rule-sets',
  'kpi-profiles',
  'kpi-catalog',
  'kpi-my-tasks',
  'kpi-assignments',
  'kpi-grading',
  'kpi-evaluations',
  'kpi-advisory',
  'kpi-voting',
  'kpi-manager-actions',
  // Văn bản đi theo VNPT iOffice (DT-18 phần 18b)
  'outgoing-documents',
  'outgoing-manage',
  'outgoing-recipients',
  'outgoing-register',
  // Giao việc, lịch, hồ sơ công việc, báo cáo theo VNPT iOffice (DT-18 phần 18c)
  'directive-inbox',
  'directive-outbox',
  'work-files',
  'room-bookings',
  'meeting-rooms',
  'schedule-templates',
  'meeting-schedules',
  'document-report-incoming',
  'document-report-summary',
  // Hồ sơ chuyên môn và Việc của tôi (DT-18 phần 18e)
  'my-work',
  'professional-documents',
  'professional-review',
  'professional-rounds',
  'professional-round-status',
  'professional-statistics',
  'professional-folders',
  'professional-work-groups',
  // Thiết bị: nơi để, tem QR, kiểm kê, đối sánh danh mục tối thiểu (DT-18 phần 18g)
  'equipment-locations',
  'equipment-labels',
  'equipment-stocktakes',
  'equipment-stocktake-lines',
  'equipment-minimum',
  // Website trường (DT-18 phần 18f)
  'website-domains',
  'website-posts',
  'website-albums',
  'website-review',
  'website-contacts',
  // Quản trị và trình diễn (DT-18 phần 18h)
  'impersonations',
  'impersonation-actions',
  'school-data-exports',
  // Bán trú: kiểm thực ba bước và an toàn thực phẩm (DT-18 phần 22b)
  'food-inspections',
  'food-samples',
  'food-lots',
  'food-supplier-certificates',
  // Kế hoạch giáo dục (DT-18 phần 22i)
  'education-plans',
  'education-plan-review',
  'education-plan-templates',
  'education-plan-progress',
  'education-plan-previous',
  // Thi đua, khen thưởng (DT-18 phần 22d)
  'emulation-titles',
  'emulation-campaigns',
  'emulation-registrations',
  'emulation-nominations',
  'emulation-nomination-review',
  'emulation-voting',
  'emulation-appeals',
  'emulation-decisions',
  'emulation-history',
  'emulation-report',
  // Bảo đảm chất lượng, tự đánh giá (DT-18 phần 22f)
  'quality-assessments',
  'quality-assessment-criteria',
  'quality-reports',
  'quality-evidences',
  'quality-recognitions',
  'quality-frameworks',
  // Chương trình theo cấp học (DT-19 phần 19b)
  'curricula',
  // Môn học, phân công giảng dạy theo môn (DT-20 phần 20a)
  'subjects',
  'teaching-assignments',
] as const;
export type DataGridKey = (typeof DATA_GRID_KEYS)[number];
export const DATA_GRID_PAGE_SIZES = [10, 20, 50, 100, 200] as const;
export const DEFAULT_DATA_GRID_PAGE_SIZE = 20;
