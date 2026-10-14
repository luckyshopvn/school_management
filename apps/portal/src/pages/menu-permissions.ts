import { useMemo } from 'react';
import {
  PERMISSION_CODES,
  PORTAL_WORKSPACES,
  type PortalMenuNode,
  type PortalQuickLinkPath,
  type PortalWorkspace,
} from '@school-management/shared';
import { useHasPermission } from '../session/permissions.js';

// Mục menu người dùng được thấy, theo đúng điều kiện của thanh điều hướng cũ (trước DT-15); máy chủ vẫn kiểm tra quyền ở
// mọi yêu cầu (AI-12). Mục không có điều kiện thì ai đăng nhập cũng thấy
function useMenuVisibility(): Partial<Record<PortalQuickLinkPath, boolean>> {
  const canManageAllAccounts = useHasPermission(PERMISSION_CODES.accountManage);
  const canManageAccountsInUnit = useHasPermission(PERMISSION_CODES.accountManageInUnit);
  const canSeeAccounts = canManageAllAccounts || canManageAccountsInUnit;
  const canViewPlatform = useHasPermission('P01.view');
  const canManageSettings = useHasPermission(PERMISSION_CODES.settingManage);
  const canManageDepartments = useHasPermission(PERMISSION_CODES.departmentManage);
  const canManageCatalogs = useHasPermission(PERMISSION_CODES.catalogManage);
  const canManageRooms = useHasPermission(PERMISSION_CODES.roomManage);
  const canManageClasses = useHasPermission(PERMISSION_CODES.classManage);
  const canViewChildren = useHasPermission('P02.view');
  const canEditChildren = useHasPermission('P02.edit');
  // Điều kiện của nhóm "Trẻ và lớp" cũ, áp cho từng mục của nhóm
  const canSeeChildrenAndClasses = canManageClasses || canViewChildren || canEditChildren;
  const canImportChildren = useHasPermission(PERMISSION_CODES.importChildren);
  const canManageChildren = useHasPermission(PERMISSION_CODES.childManage);
  const canImportOpeningDebts = useHasPermission(PERMISSION_CODES.openingDebtImport);
  const canImportStaff = useHasPermission(PERMISSION_CODES.importStaff);
  const canViewStaff = useHasPermission(PERMISSION_CODES.staffView);
  const canManageWorkSchedules = useHasPermission(PERMISSION_CODES.workScheduleManage);
  const canViewStaffAttendance = useHasPermission(PERMISSION_CODES.staffAttendanceView);
  const canViewPayroll = useHasPermission(PERMISSION_CODES.payrollView);
  const canManageHealth = useHasPermission(PERMISSION_CODES.healthManage);
  const canViewGrowthReport = useHasPermission(PERMISSION_CODES.growthReport);
  const canViewChildStatistics = useHasPermission(PERMISSION_CODES.childStatisticsView);
  const canViewStaffStatistics = useHasPermission(PERMISSION_CODES.staffStatisticsView);
  const canSeeStatistics = canViewChildStatistics || canViewStaffStatistics;
  const canManageAdmissionCampaigns = useHasPermission(PERMISSION_CODES.admissionCampaignManage);
  const canManageAdmissionApplications = useHasPermission(PERMISSION_CODES.admissionApplicationManage);
  const canReviewAdmissionApplications = useHasPermission(PERMISSION_CODES.admissionApplicationReview);
  const canManageAdmissionPosts = useHasPermission(PERMISSION_CODES.admissionPostManage);
  const canRecordMedicalEvents = useHasPermission(PERMISSION_CODES.medicalEventRecord);
  const canManageInteractions = useHasPermission(PERMISSION_CODES.interactionManage);
  const canSendMessages = useHasPermission(PERMISSION_CODES.messageSend);
  const canManageLostItems = useHasPermission(PERMISSION_CODES.lostItemManage);
  const canManageKitchen = useHasPermission(PERMISSION_CODES.kitchenManage);
  const canApproveMenus = useHasPermission(PERMISSION_CODES.menuApprove);
  const canViewKitchenReport = useHasPermission(PERMISSION_CODES.kitchenReport);
  const canManageMedicines = useHasPermission(PERMISSION_CODES.medicineManage);
  const canAdministerMedication = useHasPermission(PERMISSION_CODES.medicationAdminister);
  const canApproveMedicinePurchases = useHasPermission(PERMISSION_CODES.medicinePurchaseApprove);
  const canManageAssets = useHasPermission(PERMISSION_CODES.assetManage);
  const canCreatePurchaseRequests = useHasPermission(PERMISSION_CODES.purchaseRequestCreate);
  const canApprovePurchaseRequests = useHasPermission(PERMISSION_CODES.purchaseRequestApprove);
  const canManagePurchaseOrders = useHasPermission(PERMISSION_CODES.purchaseOrderManage);
  const canApproveStocktakes = useHasPermission(PERMISSION_CODES.stocktakeApprove);
  const canCreateRecruitmentRequests = useHasPermission(PERMISSION_CODES.recruitmentRequestCreate);
  const canApproveRecruitmentRequests = useHasPermission(PERMISSION_CODES.recruitmentRequestApprove);
  const canManageRecruitment = useHasPermission(PERMISSION_CODES.recruitmentManage);
  const canManageInterviews = useHasPermission(PERMISSION_CODES.interviewManage);
  const canReviewLessonPlans = useHasPermission(PERMISSION_CODES.lessonPlanReview);
  const canManageCurriculum = useHasPermission(PERMISSION_CODES.curriculumManage);
  const canManageLessons = useHasPermission(PERMISSION_CODES.lessonManage);
  const canApproveActivities = useHasPermission(PERMISSION_CODES.activityApprove);
  const canManageContent = useHasPermission(PERMISSION_CODES.contentManage);
  const canManageLibrary = useHasPermission(PERMISSION_CODES.libraryManage);
  const canManageExtracurricular = useHasPermission(PERMISSION_CODES.extracurricularManage);
  const canManageApiClients = useHasPermission(PERMISSION_CODES.apiClientManage);
  const canManageIntegrations = useHasPermission(PERMISSION_CODES.integrationManage);
  const canManageFeedback = useHasPermission(PERMISSION_CODES.feedbackManage);
  const canManagePayItems = useHasPermission(PERMISSION_CODES.payItemTypeManage);
  const canManageBonusDeductions = useHasPermission(PERMISSION_CODES.bonusDeductionManage);
  const canViewTuition = useHasPermission('P05.view');
  const canManageFeeCatalog = useHasPermission(PERMISSION_CODES.feeCatalogManage);
  const canManageDiscountTypes = useHasPermission(PERMISSION_CODES.discountTypeManage);
  const canViewFinance = useHasPermission('P06.view');
  const canManageCashflowCategories = useHasPermission(PERMISSION_CODES.cashflowCategoryManage);
  const canManageRegistrations = useHasPermission(PERMISSION_CODES.registrationManage);
  const canApproveLateRegistrations = useHasPermission(PERMISSION_CODES.lateRegistrationApprove);
  const canCalculateFees = useHasPermission(PERMISSION_CODES.feeCalculationManage);
  const canApproveFeeDocuments = useHasPermission(PERMISSION_CODES.feeDocumentApprove);
  const canViewDebts = useHasPermission(PERMISSION_CODES.debtView);
  const canCollect = useHasPermission(PERMISSION_CODES.receiptManage);
  const canManageCashAccounts = useHasPermission(PERMISSION_CODES.cashAccountManage);
  const canManagePayments = useHasPermission(PERMISSION_CODES.paymentManage);
  const canApprovePayments = useHasPermission(PERMISSION_CODES.paymentApprove);
  const canManageDebtReminders = useHasPermission(PERMISSION_CODES.debtReminderManage);
  const canProposeDebtResolution = useHasPermission(PERMISSION_CODES.overdueDebtPropose);
  const canDecideDebtResolution = useHasPermission(PERMISSION_CODES.overdueDebtDecide);
  const canManageBankTransactions = useHasPermission(PERMISSION_CODES.bankTransactionManage);
  const canManagePayables = useHasPermission(PERMISSION_CODES.payableManage);
  const canRequestPeriodClose = useHasPermission(PERMISSION_CODES.periodCloseRequest);
  const canApprovePeriodClose = useHasPermission(PERMISSION_CODES.periodCloseApprove);
  const canViewLedger = useHasPermission(PERMISSION_CODES.ledgerView);
  const canManageLedger = useHasPermission(PERMISSION_CODES.ledgerManage);
  const canManageProgramCompletion = useHasPermission(PERMISSION_CODES.programCompletionManage);
  const canApproveProgramCompletion = useHasPermission(PERMISSION_CODES.programCompletionApprove);
  const canManageChildGroups = useHasPermission(PERMISSION_CODES.childGroupManage);
  const canManageSchoolProfile = useHasPermission(PERMISSION_CODES.schoolProfileManage);
  const canViewEmis = useHasPermission(PERMISSION_CODES.emisReport);
  const canViewFacilities = useHasPermission(PERMISSION_CODES.facilitiesReport);
  const canManageEquipment = useHasPermission(PERMISSION_CODES.equipmentManage);

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
  const canImport = canImportChildren || canManageChildren || canImportOpeningDebts || canImportStaff;

  return {
    // Quản lý giáo dục Mầm non
    '/school-profile': canManageSchoolProfile || canViewEmis,
    '/settings': canViewPlatform || canManageSettings,
    '/classes': canSeeChildrenAndClasses,
    '/staff': canViewStaff,
    '/children': canSeeChildrenAndClasses,
    // Trước đây hiện ở nhóm Trẻ và lớp, hoặc ở nhóm Nhân sự cho người chỉ nhập nhân sự
    '/imports': (canSeeChildrenAndClasses && canImport) || (canViewStaff && canImportStaff),
    '/child-groups': canSeeChildrenAndClasses && (canManageChildGroups || canViewChildren),
    '/growth': canManageHealth || canViewGrowthReport,
    '/growth-report': canViewGrowthReport,
    '/program-completion': canSeeChildrenAndClasses && (canManageProgramCompletion || canApproveProgramCompletion),
    '/kitchen': canManageKitchen || canApproveMenus || canViewKitchenReport,
    '/health': canManageHealth || canRecordMedicalEvents,
    '/medicines': canManageMedicines || canAdministerMedication || canApproveMedicinePurchases,
    '/attendance': canSeeChildrenAndClasses,
    '/statistics': canSeeStatistics,
    '/missing-profiles': canSeeStatistics,
    // Cơ sở vật chất, TBDH; Báo cáo số liệu
    '/facility-rooms': canViewFacilities || canManageEquipment || canManageRooms,
    '/equipment': canViewFacilities || canManageEquipment,
    '/emis': canViewEmis,
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
    '/feedback': canManageFeedback,
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

// Lọc cây menu theo quyền; nhóm không còn mục nào thì ẩn, phân hệ không còn mục nào thì bỏ khỏi ô chọn phân hệ
export function filterMenu(
  workspaces: PortalWorkspace[],
  visible: Partial<Record<PortalQuickLinkPath, boolean>>,
): PortalWorkspace[] {
  const filterNodes = (nodes: PortalMenuNode[]): PortalMenuNode[] =>
    nodes.flatMap((node) => {
      if (node.children) {
        const children = filterNodes(node.children);
        return children.length > 0 ? [{ ...node, children }] : [];
      }
      return node.path && visible[node.path] !== false ? [node] : [];
    });
  return workspaces.flatMap((workspace) => {
    const menu = filterNodes(workspace.menu);
    return menu.length > 0 ? [{ ...workspace, menu }] : [];
  });
}

export function usePortalMenu(): PortalWorkspace[] {
  // So sánh theo nội dung để cây menu không dựng lại mỗi lần vẽ
  const key = JSON.stringify(useMenuVisibility());
  return useMemo(() => filterMenu(PORTAL_WORKSPACES, JSON.parse(key)), [key]);
}
