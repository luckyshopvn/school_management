import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { GROUP_WORKSPACE, GroupContext, WorkspaceContext, WorkspaceSwitcher, useWorkspaceState } from './workspaces.js';
import { NotificationBell } from '../notifications/NotificationBell.js';
import { Link, useLocation } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@school-management/ui';
import { fetchCurrentUser } from '../session/api-client.js';
import { PERMISSION_CODES } from '@school-management/shared';
import { useHasPermission } from '../session/permissions.js';
import { useSession } from '../session/session.js';

type NavigationPath =
  | '/'
  | '/academic-years'
  | '/org-units'
  | '/accounts'
  | '/roles'
  | '/settings'
  | '/audit-logs'
  | '/departments'
  | '/catalogs'
  | '/approval-thresholds'
  | '/rooms'
  | '/classes'
  | '/children'
  | '/imports'
  | '/attendance'
  | '/fees'
  | '/cashflow-categories'
  | '/registrations'
  | '/invoices'
  | '/fee-approvals'
  | '/debts'
  | '/receipts'
  | '/cash-accounts'
  | '/payments'
  | '/cash-book'
  | '/debt-collection'
  | '/bank-reconciliation'
  | '/payables'
  | '/fiscal-periods'
  | '/ledger'
  | '/staff'
  | '/staff-attendance'
  | '/school-days'
  | '/work-schedules'
  | '/health'
  | '/admissions'
  | '/interactions'
  | '/kitchen'
  | '/medicines'
  | '/inventory'
  | '/activities'
  | '/purchase-requests'
  | '/recruitment'
  | '/teaching'
  | '/leave-requests'
  | '/leave-policies'
  | '/payrolls'
  | '/pay-items'
  | '/my-payslips'
  | '/payroll-settlements'
  | '/reports'
  | '/api-clients'
  | '/integrations'
  | '/notifications'
  | '/work'
  | '/evaluations'
  | '/bonus-deductions';

function NavItem({ to, label }: { to: NavigationPath; label: string }) {
  const group = useContext(GroupContext);
  const { ensure } = useContext(WorkspaceContext);
  const { pathname } = useLocation();
  const active = pathname === to || (to !== '/' && pathname.startsWith(`${to}/`));
  const workspace = group ? GROUP_WORKSPACE[group] : undefined;
  // Mở trang thuộc phân hệ khác (ví dụ từ chuông thông báo) thì menu chuyển sang phân hệ của trang
  useEffect(() => {
    if (active && workspace) {
      ensure(workspace);
    }
  }, [active, workspace, ensure]);
  return (
    <li>
      <Link
        to={to}
        className="block rounded-lg px-3 py-2 text-label font-medium text-text hover:bg-selected"
        activeProps={{ className: 'bg-selected text-brand-strong' }}
      >
        {label}
      </Link>
    </li>
  );
}

// Trạng thái giao diện riêng của từng trình duyệt (ẩn thanh điều hướng, nhóm đã thu gọn); trình duyệt chặn lưu trữ thì
// dùng mặc định (YCTD-99)
const SIDEBAR_HIDDEN_KEY = 'portal.sidebar.hidden';
const COLLAPSED_GROUPS_KEY = 'portal.nav.collapsed';

function readStored<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : (JSON.parse(value) as T);
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Không lưu được thì chỉ giữ trong phiên đang mở
  }
}

const CollapsedGroupsContext = createContext<{ collapsed: Set<string>; toggle(title: string): void }>({
  collapsed: new Set(),
  toggle: () => undefined,
});

// Nhóm chức năng trên thanh điều hướng: bấm tiêu đề để thu gọn hoặc mở rộng
function NavGroup({ title, children }: { title: string; children: ReactNode }) {
  const { collapsed, toggle } = useContext(CollapsedGroupsContext);
  const { current, register } = useContext(WorkspaceContext);
  const open = !collapsed.has(title);
  const listId = `nhom-${title.toLowerCase().replace(/\s+/g, '-')}`;
  const workspace = GROUP_WORKSPACE[title];
  useEffect(() => {
    if (workspace) {
      register(workspace);
    }
  }, [workspace, register]);
  // Nhóm ngoài phân hệ đang chọn hoặc đang thu gọn vẫn giữ trong cây giao diện (ẩn) để mục bên trong nhận biết trang đang mở
  return (
    <GroupContext.Provider value={title}>
      <div className="flex flex-col gap-1" hidden={current !== 'all' && workspace !== current}>
        <button
          type="button"
          className="flex items-center justify-between rounded-lg px-3 py-1 text-left text-label font-semibold text-text-muted hover:bg-selected hover:text-text"
          aria-label={`Nhóm ${title}`}
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => toggle(title)}
        >
          <span>{title}</span>
          <svg
            viewBox="0 0 20 20"
            width="14"
            height="14"
            fill="currentColor"
            aria-hidden="true"
            className={`transition-transform ${open ? '' : '-rotate-90'}`}
          >
            <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
          </svg>
        </button>
        <ul id={listId} className="flex flex-col gap-1" hidden={!open}>
          {children}
        </ul>
      </div>
    </GroupContext.Provider>
  );
}

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  );
}

// Khung trang của cổng quản trị: điều hướng dọc bên trái rộng 240 điểm ảnh (BC-01, KC-08)
export function AppShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const currentUser = useQuery({ queryKey: ['current-user'], queryFn: fetchCurrentUser });
  // Chỉ hiện mục người dùng có quyền; máy chủ vẫn kiểm tra quyền ở mọi yêu cầu
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
  const canImportChildren = useHasPermission(PERMISSION_CODES.importChildren);
  const canManageChildren = useHasPermission(PERMISSION_CODES.childManage);
  const canImportOpeningDebts = useHasPermission(PERMISSION_CODES.openingDebtImport);
  const canImportStaff = useHasPermission(PERMISSION_CODES.importStaff);
  const canViewStaff = useHasPermission(PERMISSION_CODES.staffView);
  const canManageWorkSchedules = useHasPermission(PERMISSION_CODES.workScheduleManage);
  const canViewStaffAttendance = useHasPermission(PERMISSION_CODES.staffAttendanceView);
  const canSeeWorkSchedules = canManageWorkSchedules || canViewStaffAttendance;
  const canViewPayroll = useHasPermission(PERMISSION_CODES.payrollView);
  const canManageHealth = useHasPermission(PERMISSION_CODES.healthManage);
  // Tuyển sinh (YCTD-86)
  const canManageAdmissionCampaigns = useHasPermission(PERMISSION_CODES.admissionCampaignManage);
  const canManageAdmissionApplications = useHasPermission(PERMISSION_CODES.admissionApplicationManage);
  const canReviewAdmissionApplications = useHasPermission(PERMISSION_CODES.admissionApplicationReview);
  const canManageAdmissionPosts = useHasPermission(PERMISSION_CODES.admissionPostManage);
  const canSeeAdmissions =
    canManageAdmissionCampaigns ||
    canManageAdmissionApplications ||
    canReviewAdmissionApplications ||
    canManageAdmissionPosts;
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
  const canSeeMedicines = canManageMedicines || canAdministerMedication || canApproveMedicinePurchases;
  const canManageAssets = useHasPermission(PERMISSION_CODES.assetManage);
  const canCreatePurchaseRequests = useHasPermission(PERMISSION_CODES.purchaseRequestCreate);
  const canApprovePurchaseRequests = useHasPermission(PERMISSION_CODES.purchaseRequestApprove);
  const canManagePurchaseOrders = useHasPermission(PERMISSION_CODES.purchaseOrderManage);
  const canApproveStocktakes = useHasPermission(PERMISSION_CODES.stocktakeApprove);
  const canSeeInventory =
    canManageAssets || canManagePurchaseOrders || canApproveStocktakes || canApprovePurchaseRequests;
  const canSeePurchaseRequests = canCreatePurchaseRequests || canApprovePurchaseRequests;
  // Tuyển dụng (P18, YCTD-87)
  const canCreateRecruitmentRequests = useHasPermission(PERMISSION_CODES.recruitmentRequestCreate);
  const canApproveRecruitmentRequests = useHasPermission(PERMISSION_CODES.recruitmentRequestApprove);
  const canManageRecruitment = useHasPermission(PERMISSION_CODES.recruitmentManage);
  const canManageInterviews = useHasPermission(PERMISSION_CODES.interviewManage);
  const canSeeRecruitment =
    canCreateRecruitmentRequests || canApproveRecruitmentRequests || canManageRecruitment || canManageInterviews;
  const canReviewLessonPlans = useHasPermission(PERMISSION_CODES.lessonPlanReview);
  const canManageCurriculum = useHasPermission(PERMISSION_CODES.curriculumManage);
  const canManageLessons = useHasPermission(PERMISSION_CODES.lessonManage);
  const canSeeTeaching = canReviewLessonPlans || canManageCurriculum || canManageLessons;
  const canApproveActivities = useHasPermission(PERMISSION_CODES.activityApprove);
  const canManageContent = useHasPermission(PERMISSION_CODES.contentManage);
  const canManageLibrary = useHasPermission(PERMISSION_CODES.libraryManage);
  const canManageExtracurricular = useHasPermission(PERMISSION_CODES.extracurricularManage);
  const canSeeActivities = canApproveActivities || canManageContent || canManageLibrary || canManageExtracurricular;
  const canManageApiClients = useHasPermission(PERMISSION_CODES.apiClientManage);
  const canManageIntegrations = useHasPermission(PERMISSION_CODES.integrationManage);
  const canManagePayItems = useHasPermission(PERMISSION_CODES.payItemTypeManage);
  const canManageBonusDeductions = useHasPermission(PERMISSION_CODES.bonusDeductionManage);
  const canImport = canImportChildren || canManageChildren || canImportOpeningDebts || canImportStaff;
  const canViewTuition = useHasPermission('P05.view');
  const canManageFeeCatalog = useHasPermission(PERMISSION_CODES.feeCatalogManage);
  const canManageDiscountTypes = useHasPermission(PERMISSION_CODES.discountTypeManage);
  const canViewFinance = useHasPermission('P06.view');
  const canManageCashflowCategories = useHasPermission(PERMISSION_CODES.cashflowCategoryManage);
  const canManageRegistrations = useHasPermission(PERMISSION_CODES.registrationManage);
  const canApproveLateRegistrations = useHasPermission(PERMISSION_CODES.lateRegistrationApprove);
  const canViewFees = canViewTuition || canManageFeeCatalog || canManageDiscountTypes;
  const canSeeRegistrations = canViewTuition || canManageRegistrations || canApproveLateRegistrations;
  const canCalculateFees = useHasPermission(PERMISSION_CODES.feeCalculationManage);
  const canSeeInvoices = canViewTuition || canCalculateFees;
  const canApproveFeeDocuments = useHasPermission(PERMISSION_CODES.feeDocumentApprove);
  const canViewCashflow = canViewFinance || canManageCashflowCategories;
  const canViewDebts = useHasPermission(PERMISSION_CODES.debtView);
  const canCollect = useHasPermission(PERMISSION_CODES.receiptManage);
  const canManageCashAccounts = useHasPermission(PERMISSION_CODES.cashAccountManage);
  const canManagePayments = useHasPermission(PERMISSION_CODES.paymentManage);
  const canApprovePayments = useHasPermission(PERMISSION_CODES.paymentApprove);
  const canSeeAccountsAndReceipts = canViewFinance || canCollect || canManageCashAccounts;
  const canSeePayments = canViewFinance || canManagePayments || canApprovePayments;
  // Tài chính giai đoạn 2 (YCTD-82)
  const canManageDebtReminders = useHasPermission(PERMISSION_CODES.debtReminderManage);
  const canProposeDebtResolution = useHasPermission(PERMISSION_CODES.overdueDebtPropose);
  const canDecideDebtResolution = useHasPermission(PERMISSION_CODES.overdueDebtDecide);
  const canManageBankTransactions = useHasPermission(PERMISSION_CODES.bankTransactionManage);
  const canManagePayables = useHasPermission(PERMISSION_CODES.payableManage);
  const canRequestPeriodClose = useHasPermission(PERMISSION_CODES.periodCloseRequest);
  const canApprovePeriodClose = useHasPermission(PERMISSION_CODES.periodCloseApprove);
  const canSeeDebtCollection = canManageDebtReminders || canProposeDebtResolution || canDecideDebtResolution;
  const canSeeBankReconciliation = canManageBankTransactions || canViewFinance;
  const canSeePayables = canManagePayables || canViewFinance;
  const canSeeFiscalPeriods = canRequestPeriodClose || canApprovePeriodClose;
  const canViewLedger = useHasPermission(PERMISSION_CODES.ledgerView);
  const canManageLedger = useHasPermission(PERMISSION_CODES.ledgerManage);
  const canSeeLedger = canViewLedger || canManageLedger;

  // Phân hệ đang chọn trên menu sổ xuống (YCTD-101)
  const workspaces = useWorkspaceState();
  // Ẩn hoặc hiện thanh điều hướng, thu gọn nhóm chức năng; nhớ lựa chọn trên trình duyệt này (YCTD-99)
  const [sidebarHidden, setSidebarHidden] = useState(() => readStored(SIDEBAR_HIDDEN_KEY, false));
  const toggleSidebar = () => {
    setSidebarHidden(!sidebarHidden);
    writeStored(SIDEBAR_HIDDEN_KEY, !sidebarHidden);
  };
  const [collapsed, setCollapsed] = useState(() => new Set(readStored<string[]>(COLLAPSED_GROUPS_KEY, [])));
  const groups = useMemo(
    () => ({
      collapsed,
      toggle: (title: string) => {
        const next = new Set(collapsed);
        if (next.has(title)) {
          next.delete(title);
        } else {
          next.add(title);
        }
        setCollapsed(next);
        writeStored(COLLAPSED_GROUPS_KEY, [...next]);
      },
    }),
    [collapsed],
  );

  return (
    <WorkspaceContext.Provider value={workspaces}>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 bg-header px-4 text-white shadow-sm">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-header-strong"
            aria-label={sidebarHidden ? 'Hiện thanh điều hướng' : 'Ẩn thanh điều hướng'}
            aria-expanded={!sidebarHidden}
            aria-controls="dieu-huong-chinh"
            onClick={toggleSidebar}
          >
            <MenuIcon />
          </button>
          <span className="hidden whitespace-nowrap text-section-title font-bold text-header-accent lg:inline">
            School Management
          </span>
          <WorkspaceSwitcher state={workspaces} />
          <div className="ml-auto flex shrink-0 items-center gap-4 whitespace-nowrap">
            <NotificationBell />
            {currentUser.data ? (
              <span
                className="hidden whitespace-nowrap text-label font-semibold text-white md:inline"
                data-testid="current-user-name"
              >
                {currentUser.data.full_name}
              </span>
            ) : (
              <span className="h-4 w-32 animate-pulse rounded bg-header-strong" aria-hidden="true" />
            )}
            <Link
              to="/change-password"
              className="hidden whitespace-nowrap text-label text-white hover:underline md:inline"
            >
              Đổi mật khẩu
            </Link>
            <Button onClick={() => void session.logout()}>Đăng xuất</Button>
          </div>
        </header>
        <div className="flex flex-1">
          {sidebarHidden ? null : (
            <nav
              id="dieu-huong-chinh"
              aria-label="Điều hướng chính"
              className="sticky top-14 flex h-[calc(100vh-3.5rem)] w-60 shrink-0 flex-col gap-3 overflow-y-auto border-r border-border bg-card p-4"
            >
              <CollapsedGroupsContext.Provider value={groups}>
                <ul className="flex flex-col gap-1">
                  <NavItem to="/" label="Trang chủ" />
                </ul>
                {canManageClasses || canViewChildren || canEditChildren ? (
                  <>
                    <NavGroup title="TRẺ VÀ LỚP">
                      <NavItem to="/children" label="Hồ sơ trẻ" />
                      <NavItem to="/classes" label="Lớp học" />
                      <NavItem to="/attendance" label="Điểm danh" />
                      {canImport ? <NavItem to="/imports" label="Nhập dữ liệu" /> : null}
                    </NavGroup>
                  </>
                ) : null}
                {canSeeAdmissions ? (
                  <>
                    <NavGroup title="TUYỂN SINH">
                      <NavItem to="/admissions" label="Tuyển sinh" />
                    </NavGroup>
                  </>
                ) : null}
                {canSeeTeaching ? (
                  <>
                    <NavGroup title="GIẢNG DẠY">
                      <NavItem to="/teaching" label="Bài học và giáo án" />
                    </NavGroup>
                  </>
                ) : null}
                {canManageHealth || canRecordMedicalEvents || canSeeMedicines ? (
                  <>
                    <NavGroup title="Y TẾ">
                      {canManageHealth || canRecordMedicalEvents ? (
                        <NavItem to="/health" label="Y tế học đường" />
                      ) : null}
                      {canSeeMedicines ? <NavItem to="/medicines" label="Thuốc và dặn thuốc" /> : null}
                    </NavGroup>
                  </>
                ) : null}
                {canManageKitchen || canApproveMenus || canViewKitchenReport ? (
                  <>
                    <NavGroup title="BẾP">
                      <NavItem to="/kitchen" label="Bếp và thực đơn" />
                    </NavGroup>
                  </>
                ) : null}
                {canManageInteractions || canSendMessages || canManageLostItems ? (
                  <>
                    <NavGroup title="TƯƠNG TÁC">
                      <NavItem to="/interactions" label="Tương tác với phụ huynh" />
                    </NavGroup>
                  </>
                ) : null}
                {canSeeInventory || canSeePurchaseRequests ? (
                  <>
                    <NavGroup title="KHO VÀ MUA HÀNG">
                      {canSeeInventory ? <NavItem to="/inventory" label="Kho và tài sản" /> : null}
                      {canSeePurchaseRequests ? <NavItem to="/purchase-requests" label="Đề nghị mua hàng" /> : null}
                    </NavGroup>
                  </>
                ) : null}
                {canSeeActivities ? (
                  <>
                    <NavGroup title="HOẠT ĐỘNG VÀ TRUYỀN THÔNG">
                      <NavItem to="/activities" label="Hoạt động và tin tức" />
                    </NavGroup>
                  </>
                ) : null}
                {canViewFees ||
                canViewCashflow ||
                canSeeRegistrations ||
                canViewDebts ||
                canSeeDebtCollection ||
                canSeeFiscalPeriods ||
                canSeeLedger ? (
                  <>
                    <NavGroup title="HỌC PHÍ VÀ TÀI CHÍNH">
                      {canViewFees ? <NavItem to="/fees" label="Biểu phí và dịch vụ" /> : null}
                      {canSeeRegistrations ? <NavItem to="/registrations" label="Đăng ký dịch vụ" /> : null}
                      {canSeeInvoices ? <NavItem to="/invoices" label="Học phí" /> : null}
                      {canApproveFeeDocuments ? (
                        <NavItem to="/fee-approvals" label="Duyệt miễn giảm và điều chỉnh" />
                      ) : null}
                      {canViewDebts ? <NavItem to="/debts" label="Công nợ" /> : null}
                      {canSeeAccountsAndReceipts ? <NavItem to="/receipts" label="Phiếu thu" /> : null}
                      {canSeePayments ? <NavItem to="/payments" label="Phiếu chi" /> : null}
                      {canSeeAccountsAndReceipts ? <NavItem to="/cash-accounts" label="Quỹ và ngân hàng" /> : null}
                      {canSeeAccountsAndReceipts ? <NavItem to="/cash-book" label="Sổ quỹ" /> : null}
                      {canSeeDebtCollection ? <NavItem to="/debt-collection" label="Nhắc nợ và xử lý quá hạn" /> : null}
                      {canSeeBankReconciliation ? (
                        <NavItem to="/bank-reconciliation" label="Đối chiếu ngân hàng" />
                      ) : null}
                      {canSeePayables ? <NavItem to="/payables" label="Nợ nhà cung cấp" /> : null}
                      {canSeeFiscalPeriods ? <NavItem to="/fiscal-periods" label="Chốt kỳ tài chính" /> : null}
                      {canSeeLedger ? <NavItem to="/ledger" label="Sổ kế toán" /> : null}
                      {canViewCashflow ? <NavItem to="/cashflow-categories" label="Khoản mục thu chi" /> : null}
                    </NavGroup>
                  </>
                ) : null}
                <NavGroup title="NHÂN SỰ">
                  {canViewStaff ? <NavItem to="/staff" label="Hồ sơ nhân sự" /> : null}
                  {canSeeRecruitment ? <NavItem to="/recruitment" label="Tuyển dụng" /> : null}
                  <NavItem to="/staff-attendance" label="Chấm công" />
                  <NavItem to="/leave-requests" label="Đơn nghỉ phép" />
                  <NavItem to="/school-days" label="Ngày lễ và lịch bù" />
                  {canSeeWorkSchedules ? <NavItem to="/work-schedules" label="Lịch công tác" /> : null}
                  <NavItem to="/leave-policies" label="Quy định phép năm" />
                  {canViewPayroll ? <NavItem to="/payrolls" label="Bảng lương" /> : null}
                  {canViewPayroll ? <NavItem to="/payroll-settlements" label="Quyết toán và điều chỉnh lương" /> : null}
                  {canViewPayroll || canManagePayItems ? (
                    <NavItem to="/pay-items" label="Danh mục lương và biểu thuế" />
                  ) : null}
                  {canViewPayroll || canManageBonusDeductions ? (
                    <NavItem to="/bonus-deductions" label="Thưởng và khấu trừ" />
                  ) : null}
                  <NavItem to="/my-payslips" label="Phiếu lương của tôi" />
                  <NavItem to="/work" label="Công việc và kế hoạch" />
                  <NavItem to="/evaluations" label="Đánh giá nhân sự" />
                  {canViewStaff && canImportStaff && !(canManageClasses || canViewChildren || canEditChildren) ? (
                    <NavItem to="/imports" label="Nhập dữ liệu" />
                  ) : null}
                </NavGroup>
                <NavGroup title="BÁO CÁO">
                  <NavItem to="/reports" label="Báo cáo" />
                </NavGroup>
                <NavGroup title="THIẾT LẬP">
                  <NavItem to="/academic-years" label="Năm học" />
                  <NavItem to="/org-units" label="Cây đơn vị" />
                  {canSeeAccounts ? (
                    <>
                      <NavItem to="/accounts" label="Tài khoản" />
                      <NavItem to="/roles" label="Vai trò và quyền" />
                      {canManageApiClients ? <NavItem to="/api-clients" label="Khóa API cho đối tác" /> : null}
                    </>
                  ) : null}
                  {canManageIntegrations ? <NavItem to="/integrations" label="Kết nối ngoài" /> : null}
                  {canViewPlatform || canManageDepartments ? (
                    <NavItem to="/departments" label="Phòng ban và chức danh" />
                  ) : null}
                  {canViewPlatform || canManageCatalogs ? <NavItem to="/catalogs" label="Danh mục dùng chung" /> : null}
                  {canViewPlatform ? <NavItem to="/approval-thresholds" label="Hạn mức phê duyệt" /> : null}
                  {canViewPlatform || canManageRooms || canManageCatalogs ? (
                    <NavItem to="/rooms" label="Phòng học và bậc học" />
                  ) : null}
                  {canViewPlatform || canManageSettings ? <NavItem to="/settings" label="Cấu hình" /> : null}
                  {canViewPlatform ? <NavItem to="/audit-logs" label="Nhật ký thao tác" /> : null}
                </NavGroup>
              </CollapsedGroupsContext.Provider>
            </nav>
          )}
          <main className="mx-auto w-full max-w-[1440px] min-w-0 flex-1 p-6">{children}</main>
        </div>
      </div>
    </WorkspaceContext.Provider>
  );
}
