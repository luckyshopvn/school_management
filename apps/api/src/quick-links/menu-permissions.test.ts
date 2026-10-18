import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MENU_PERMISSION_RULES,
  PERMISSION_CODES,
  isMenuPathVisible,
  listPortalMenuEntries,
  menuGatePermissionCodes,
  menuPermissionCodes,
  type PortalQuickLinkPath,
} from '@school-management/shared';

// Điều kiện hiện mục menu theo quyền ở gói dùng chung (DT-15 phần 15e): phải cho đúng kết quả như điều kiện cũ ở cổng
// quản trị và cho ra danh sách quyền của từng mục cho màn hình Phân quyền nhóm theo menu; kịch bản CT-15e-1 đến CT-15e-4

// Điều kiện cũ ở apps/portal/src/pages/menu-permissions.ts trước phần 15e, giữ nguyên để so sánh
function legacyVisibility(has: (code: string) => boolean): Partial<Record<PortalQuickLinkPath, boolean>> {
  const canManageAllAccounts = has(PERMISSION_CODES.accountManage);
  const canManageAccountsInUnit = has(PERMISSION_CODES.accountManageInUnit);
  const canSeeAccounts = canManageAllAccounts || canManageAccountsInUnit;
  const canViewPlatform = has('P01.view');
  const canManageSettings = has(PERMISSION_CODES.settingManage);
  const canManageDepartments = has(PERMISSION_CODES.departmentManage);
  const canManageCatalogs = has(PERMISSION_CODES.catalogManage);
  const canManageRooms = has(PERMISSION_CODES.roomManage);
  const canManageClasses = has(PERMISSION_CODES.classManage);
  const canViewChildren = has('P02.view');
  const canEditChildren = has('P02.edit');
  // Điều kiện của nhóm "Trẻ và lớp" cũ, áp cho từng mục của nhóm
  const canSeeChildrenAndClasses = canManageClasses || canViewChildren || canEditChildren;
  const canImportChildren = has(PERMISSION_CODES.importChildren);
  const canManageChildren = has(PERMISSION_CODES.childManage);
  const canImportOpeningDebts = has(PERMISSION_CODES.openingDebtImport);
  const canImportStaff = has(PERMISSION_CODES.importStaff);
  const canViewStaff = has(PERMISSION_CODES.staffView);
  const canManageWorkSchedules = has(PERMISSION_CODES.workScheduleManage);
  const canViewStaffAttendance = has(PERMISSION_CODES.staffAttendanceView);
  const canViewPayroll = has(PERMISSION_CODES.payrollView);
  const canManageHealth = has(PERMISSION_CODES.healthManage);
  const canViewGrowthReport = has(PERMISSION_CODES.growthReport);
  const canViewChildStatistics = has(PERMISSION_CODES.childStatisticsView);
  const canViewStaffStatistics = has(PERMISSION_CODES.staffStatisticsView);
  const canSeeStatistics = canViewChildStatistics || canViewStaffStatistics;
  const canManageAdmissionCampaigns = has(PERMISSION_CODES.admissionCampaignManage);
  const canManageAdmissionApplications = has(PERMISSION_CODES.admissionApplicationManage);
  const canReviewAdmissionApplications = has(PERMISSION_CODES.admissionApplicationReview);
  const canManageAdmissionPosts = has(PERMISSION_CODES.admissionPostManage);
  const canRecordMedicalEvents = has(PERMISSION_CODES.medicalEventRecord);
  const canManageInteractions = has(PERMISSION_CODES.interactionManage);
  const canSendMessages = has(PERMISSION_CODES.messageSend);
  const canManageLostItems = has(PERMISSION_CODES.lostItemManage);
  const canManageKitchen = has(PERMISSION_CODES.kitchenManage);
  const canApproveMenus = has(PERMISSION_CODES.menuApprove);
  const canViewKitchenReport = has(PERMISSION_CODES.kitchenReport);
  const canManageMedicines = has(PERMISSION_CODES.medicineManage);
  const canAdministerMedication = has(PERMISSION_CODES.medicationAdminister);
  const canApproveMedicinePurchases = has(PERMISSION_CODES.medicinePurchaseApprove);
  const canManageAssets = has(PERMISSION_CODES.assetManage);
  const canCreatePurchaseRequests = has(PERMISSION_CODES.purchaseRequestCreate);
  const canApprovePurchaseRequests = has(PERMISSION_CODES.purchaseRequestApprove);
  const canManagePurchaseOrders = has(PERMISSION_CODES.purchaseOrderManage);
  const canApproveStocktakes = has(PERMISSION_CODES.stocktakeApprove);
  const canCreateRecruitmentRequests = has(PERMISSION_CODES.recruitmentRequestCreate);
  const canApproveRecruitmentRequests = has(PERMISSION_CODES.recruitmentRequestApprove);
  const canManageRecruitment = has(PERMISSION_CODES.recruitmentManage);
  const canManageInterviews = has(PERMISSION_CODES.interviewManage);
  const canReviewLessonPlans = has(PERMISSION_CODES.lessonPlanReview);
  const canManageCurriculum = has(PERMISSION_CODES.curriculumManage);
  const canManageLessons = has(PERMISSION_CODES.lessonManage);
  const canApproveActivities = has(PERMISSION_CODES.activityApprove);
  const canManageContent = has(PERMISSION_CODES.contentManage);
  const canManageLibrary = has(PERMISSION_CODES.libraryManage);
  const canManageExtracurricular = has(PERMISSION_CODES.extracurricularManage);
  const canManageApiClients = has(PERMISSION_CODES.apiClientManage);
  const canManageIntegrations = has(PERMISSION_CODES.integrationManage);
  const canManagePayItems = has(PERMISSION_CODES.payItemTypeManage);
  const canManageBonusDeductions = has(PERMISSION_CODES.bonusDeductionManage);
  const canViewTuition = has('P05.view');
  const canManageFeeCatalog = has(PERMISSION_CODES.feeCatalogManage);
  const canManageDiscountTypes = has(PERMISSION_CODES.discountTypeManage);
  const canViewFinance = has('P06.view');
  const canManageCashflowCategories = has(PERMISSION_CODES.cashflowCategoryManage);
  const canManageRegistrations = has(PERMISSION_CODES.registrationManage);
  const canApproveLateRegistrations = has(PERMISSION_CODES.lateRegistrationApprove);
  const canCalculateFees = has(PERMISSION_CODES.feeCalculationManage);
  const canApproveFeeDocuments = has(PERMISSION_CODES.feeDocumentApprove);
  const canViewDebts = has(PERMISSION_CODES.debtView);
  const canCollect = has(PERMISSION_CODES.receiptManage);
  const canManageCashAccounts = has(PERMISSION_CODES.cashAccountManage);
  const canManagePayments = has(PERMISSION_CODES.paymentManage);
  const canApprovePayments = has(PERMISSION_CODES.paymentApprove);
  const canManageDebtReminders = has(PERMISSION_CODES.debtReminderManage);
  const canProposeDebtResolution = has(PERMISSION_CODES.overdueDebtPropose);
  const canDecideDebtResolution = has(PERMISSION_CODES.overdueDebtDecide);
  const canManageBankTransactions = has(PERMISSION_CODES.bankTransactionManage);
  const canManagePayables = has(PERMISSION_CODES.payableManage);
  const canRequestPeriodClose = has(PERMISSION_CODES.periodCloseRequest);
  const canApprovePeriodClose = has(PERMISSION_CODES.periodCloseApprove);
  const canViewLedger = has(PERMISSION_CODES.ledgerView);
  const canManageLedger = has(PERMISSION_CODES.ledgerManage);
  const canManageProgramCompletion = has(PERMISSION_CODES.programCompletionManage);
  const canApproveProgramCompletion = has(PERMISSION_CODES.programCompletionApprove);
  const canManageChildGroups = has(PERMISSION_CODES.childGroupManage);
  const canManageSchoolProfile = has(PERMISSION_CODES.schoolProfileManage);
  const canViewEmis = has(PERMISSION_CODES.emisReport);
  const canViewFacilities = has(PERMISSION_CODES.facilitiesReport);
  const canManageEquipment = has(PERMISSION_CODES.equipmentManage);

  const canViewFees = canViewTuition || canManageFeeCatalog || canManageDiscountTypes;
  const canViewCashflow = canViewFinance || canManageCashflowCategories;
  const canSeeRegistrations = canViewTuition || canManageRegistrations || canApproveLateRegistrations;
  const canSeeDebtCollection = canManageDebtReminders || canProposeDebtResolution || canDecideDebtResolution;
  const canSeeFiscalPeriods = canRequestPeriodClose || canApprovePeriodClose;
  const canSeeLedger = canViewLedger || canManageLedger;
  // Điều kiện của nhóm "Học phí và tài chính" cũ, áp cho từng mục của nhóm
  const canSeeFinance =
    canViewFees ||
    canViewCashflow ||
    canSeeRegistrations ||
    canViewDebts ||
    canSeeDebtCollection ||
    canSeeFiscalPeriods ||
    canSeeLedger;
  const canSeeAccountsAndReceipts = canViewFinance || canCollect || canManageCashAccounts;
  const canSeeInventory =
    canManageAssets || canManagePurchaseOrders || canApproveStocktakes || canApprovePurchaseRequests;

  return {
    // Quản lý giáo dục Mầm non
    '/school-profile': canManageSchoolProfile || canViewEmis,
    '/settings': canViewPlatform || canManageSettings,
    '/classes': canSeeChildrenAndClasses,
    '/staff': canViewStaff,
    '/children': canSeeChildrenAndClasses,
    // Trước đây hiện ở nhóm Trẻ và lớp, hoặc ở nhóm Nhân sự cho người chỉ nhập nhân sự; phần nhân sự tách sang 3.1.3 Nhập
    // nhân sự từ Excel (DT-16 phần 16f) với đúng điều kiện cũ của nhóm Nhân sự
    // Nhập học sinh tách sang 4.1.2 Nhập học sinh từ Excel (DT-16 phần 16g): trang chung còn công nợ đầu kỳ
    '/imports': canImportOpeningDebts,
    '/student-imports':
      canSeeChildrenAndClasses && (canImportChildren || canManageChildren || has(PERMISSION_CODES.childApprove)),
    '/staff-imports': canViewStaff && canImportStaff,
    '/child-groups': canSeeChildrenAndClasses && (canManageChildGroups || canViewChildren),
    '/growth': canManageHealth || canViewGrowthReport,
    '/growth-report': canViewGrowthReport,
    '/program-completion': canSeeChildrenAndClasses && (canManageProgramCompletion || canApproveProgramCompletion),
    '/kitchen': canManageKitchen || canApproveMenus || canViewKitchenReport,
    '/student-health': canManageHealth || canViewGrowthReport,
    '/health': canManageHealth || canRecordMedicalEvents,
    '/medicines': canManageMedicines || canAdministerMedication || canApproveMedicinePurchases,
    '/attendance': canSeeChildrenAndClasses,
    '/statistics': canSeeStatistics,
    '/missing-profiles': canSeeStatistics,
    '/student-statistics': canSeeStatistics,
    // Cơ sở vật chất, TBDH; Báo cáo số liệu
    '/facility-rooms': canViewFacilities || canManageEquipment || canManageRooms,
    '/equipment': canViewFacilities || canManageEquipment,
    '/emis': canViewEmis,
    '/emis/facilities': canViewEmis,
    '/emis/health': canViewEmis,
    '/emis/end-of-year': canViewEmis,
    '/emis/staff': canViewEmis,
    '/emis/foreign-language': canViewEmis,
    '/emis/preschool-end-of-year': canViewEmis,
    '/facility-investments': canViewFacilities || canManageSchoolProfile,
    '/facility-input': canViewFacilities || canManageEquipment || canManageRooms,
    '/facility-report': canViewFacilities || canManageSchoolProfile,
    '/equipment-outside': canViewFacilities || canManageEquipment,
    '/equipment-submission': canViewFacilities,
    // Quản trị hệ thống
    '/roles': canSeeAccounts,
    '/accounts': canSeeAccounts,
    '/departments': canViewPlatform || canManageDepartments,
    '/catalogs': canViewPlatform || canManageCatalogs,
    '/rooms': canViewPlatform || canManageRooms || canManageCatalogs,
    '/approval-thresholds': canViewPlatform,
    '/api-clients': canSeeAccounts && canManageApiClients,
    '/integrations': canManageIntegrations,
    '/audit-logs': canViewPlatform,
    // Tài chính – học phí
    '/fees': canSeeFinance && canViewFees,
    '/registrations': canSeeFinance && canSeeRegistrations,
    '/invoices': canSeeFinance && (canViewTuition || canCalculateFees),
    '/fee-approvals': canSeeFinance && canApproveFeeDocuments,
    '/debts': canSeeFinance && canViewDebts,
    '/debt-collection': canSeeFinance && canSeeDebtCollection,
    '/receipts': canSeeFinance && canSeeAccountsAndReceipts,
    '/payments': canSeeFinance && (canViewFinance || canManagePayments || canApprovePayments),
    '/cash-accounts': canSeeFinance && canSeeAccountsAndReceipts,
    '/cash-book': canSeeFinance && canSeeAccountsAndReceipts,
    '/bank-reconciliation': canSeeFinance && (canManageBankTransactions || canViewFinance),
    '/payables': canSeeFinance && (canManagePayables || canViewFinance),
    '/cashflow-categories': canSeeFinance && canViewCashflow,
    '/ledger': canSeeFinance && canSeeLedger,
    '/fiscal-periods': canSeeFinance && canSeeFiscalPeriods,
    // Nhân sự – chấm công, lương
    '/work-schedules': canManageWorkSchedules || canViewStaffAttendance,
    '/payrolls': canViewPayroll,
    '/payroll-settlements': canViewPayroll,
    '/pay-items': canViewPayroll || canManagePayItems,
    '/bonus-deductions': canViewPayroll || canManageBonusDeductions,
    // Bếp – kho, mua hàng; Tương tác – truyền thông; Giảng dạy; Tuyển sinh, tuyển dụng
    '/inventory': canSeeInventory,
    '/purchase-requests': canCreatePurchaseRequests || canApprovePurchaseRequests,
    '/interactions': canManageInteractions || canSendMessages || canManageLostItems,
    '/activities': canApproveActivities || canManageContent || canManageLibrary || canManageExtracurricular,
    '/teaching': canReviewLessonPlans || canManageCurriculum || canManageLessons,
    '/admissions':
      canManageAdmissionCampaigns ||
      canManageAdmissionApplications ||
      canReviewAdmissionApplications ||
      canManageAdmissionPosts,
    '/recruitment':
      canCreateRecruitmentRequests || canApproveRecruitmentRequests || canManageRecruitment || canManageInterviews,
  };
}

const MODULE_CODES = [
  'P01',
  'P02',
  'P03',
  'P04',
  'P05',
  'P06',
  'P07',
  'P08',
  'P09',
  'P10',
  'P12',
  'P13',
  'P14',
  'P15',
  'P16',
  'P17',
  'P18',
  'P19',
];
const ALL_CODES = [
  ...new Set([
    ...Object.values(PERMISSION_CODES),
    ...MODULE_CODES.flatMap((module) => ['view', 'edit', 'approve'].map((action) => `${module}.${action}`)),
  ]),
];

// Bộ sinh số giả ngẫu nhiên cố định hạt để lần chạy nào cũng như nhau
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

describe('Điều kiện hiện mục menu theo quyền', () => {
  it('CT-15e-1: mọi mã quyền trong điều kiện là mã có thật; mọi điều kiện gắn với một mục của cây menu', () => {
    const menuPaths = new Set(listPortalMenuEntries().map((entry) => entry.node.path));
    for (const path of Object.keys(MENU_PERMISSION_RULES) as PortalQuickLinkPath[]) {
      assert.ok(menuPaths.has(path), path);
      for (const code of [...menuPermissionCodes(path), ...menuGatePermissionCodes(path)]) {
        assert.ok(ALL_CODES.includes(code), `${path}: ${code}`);
      }
      assert.ok(menuPermissionCodes(path).length > 0, path);
    }
  });

  it('CT-15e-2: hiện hay ẩn mục giống hệt điều kiện cũ với mọi tổ hợp quyền thử', () => {
    const next = random(15);
    const sets: Array<Set<string>> = [new Set(), new Set(ALL_CODES)];
    for (const code of ALL_CODES) {
      sets.push(new Set([code]));
    }
    for (let round = 0; round < 3000; round += 1) {
      const density = next() * 0.15;
      sets.push(new Set(ALL_CODES.filter(() => next() < density)));
    }
    for (const granted of sets) {
      const has = (code: string) => granted.has(code);
      const legacy = legacyVisibility(has);
      for (const [path, expected] of Object.entries(legacy)) {
        assert.equal(
          isMenuPathVisible(path as PortalQuickLinkPath, has),
          expected,
          `${path}: ${[...granted].join(',')}`,
        );
      }
    }
    // Mục chưa từng có điều kiện thì vẫn hiện với mọi người
    assert.equal(
      isMenuPathVisible('/leave-requests', () => false),
      true,
    );
    assert.equal(menuPermissionCodes('/leave-requests').length, 0);
  });

  it('CT-15e-3: quyền của mục là các mã trong điều kiện, không kèm quyền ở cổng của nhóm cũ', () => {
    assert.deepEqual(menuPermissionCodes('/accounts'), ['P01.account.manage', 'P01.account.manage-in-unit']);
    assert.deepEqual(menuPermissionCodes('/fee-approvals'), ['P05.fee-document.approve']);
    assert.ok(menuGatePermissionCodes('/fee-approvals').includes('P05.view'));
    assert.ok(menuGatePermissionCodes('/fee-approvals').includes('P06.ledger.manage'));
    assert.deepEqual(menuPermissionCodes('/api-clients'), ['P01.api-client.manage']);
    assert.deepEqual(menuGatePermissionCodes('/api-clients'), ['P01.account.manage', 'P01.account.manage-in-unit']);
    assert.deepEqual(menuPermissionCodes('/receipts'), ['P06.view', 'P06.receipt.manage', 'P06.cash-account.manage']);
    // Mã vừa ở điều kiện chính vừa ở cổng thì chỉ tính là quyền của mục
    assert.ok(!menuGatePermissionCodes('/receipts').includes('P06.view'));
  });

  it('CT-15e-4: tích chọn hết quyền của mục (và một quyền ở cổng nếu có) thì mục hiện', () => {
    for (const entry of listPortalMenuEntries()) {
      const codes = new Set(menuPermissionCodes(entry.node.path));
      const gate = menuGatePermissionCodes(entry.node.path);
      if (gate[0]) {
        codes.add(gate[0]);
      }
      assert.ok(
        isMenuPathVisible(entry.node.path, (code) => codes.has(code)),
        entry.node.path,
      );
    }
  });
});
