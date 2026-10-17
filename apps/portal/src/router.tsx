import { createRootRoute, createRoute, createRouter, Navigate, Outlet, useLocation } from '@tanstack/react-router';
import { AcademicYearsPage } from './academic-years/AcademicYearsPage.js';
import { AccountsPage } from './accounts/AccountsPage.js';
import { RolesPage } from './accounts/RolesPage.js';
import { RolePermissionsPage } from './accounts/RolePermissionsPage.js';
import { RoleWorkspacesPage } from './accounts/RoleWorkspacesPage.js';
import { SyncAccountsPage } from './accounts/SyncAccountsPage.js';
import { ApiClientsPage } from './accounts/ApiClientsPage.js';
import { IntegrationsPage } from './settings/IntegrationsPage.js';
import { NotificationsPage } from './notifications/NotificationsPage.js';
import { ApprovalThresholdsPage } from './catalogs/ApprovalThresholdsPage.js';
import { CommonCatalogPage } from './catalogs/CommonCatalogPage.js';
import { DepartmentsPage } from './catalogs/DepartmentsPage.js';
import { RoomsAndGradeLevelsPage } from './catalogs/RoomsAndGradeLevelsPage.js';
import { ChildrenPage } from './children/ChildrenPage.js';
import { StudentMovementsPage } from './children/StudentMovementsPage.js';
import { AdministrativeUnitsPage } from './children/AdministrativeUnitsPage.js';
import { AttendancePage } from './attendance/AttendancePage.js';
import { ClassAssignmentsPage } from './classes/ClassAssignmentsPage.js';
import { ClassesPage } from './classes/ClassesPage.js';
import { CashflowCategoriesPage } from './fees/CashflowCategoriesPage.js';
import { FeesPage } from './fees/FeesPage.js';
import { RegistrationsPage } from './fees/RegistrationsPage.js';
import { InvoicesPage } from './fees/InvoicesPage.js';
import { FeeApprovalsPage } from './fees/FeeApprovalsPage.js';
import { CashAccountsPage } from './finance/CashAccountsPage.js';
import { DebtsPage } from './finance/DebtsPage.js';
import { ReceiptsPage } from './finance/ReceiptsPage.js';
import { PaymentsPage } from './finance/PaymentsPage.js';
import { CashBookPage } from './finance/CashBookPage.js';
import { DebtCollectionPage } from './finance/DebtCollectionPage.js';
import { BankReconciliationPage } from './finance/BankReconciliationPage.js';
import { PayablesPage } from './finance/PayablesPage.js';
import { FiscalPeriodsPage } from './finance/FiscalPeriodsPage.js';
import { LedgerPage } from './ledger/LedgerPage.js';
import { StaffPage } from './staff/StaffPage.js';
import { StaffBranchesPage } from './staff/StaffBranchesPage.js';
import { StaffIdentityPage } from './staff/StaffIdentityPage.js';
import { StaffImportsPage } from './staff/StaffImportsPage.js';
import { StaffMovementsPage } from './staff/StaffMovementsPage.js';
import { StaffIdentityProgressPage } from './statistics/StaffIdentityProgressPage.js';
import { StaffStatisticsPage } from './statistics/StaffStatisticsPage.js';
import { LeavePoliciesPage } from './staff-attendance/LeavePoliciesPage.js';
import { MyPayslipsPage } from './payroll/MyPayslipsPage.js';
import { PayItemsPage } from './payroll/PayItemsPage.js';
import { PayrollPage } from './payroll/PayrollPage.js';
import { SettlementsPage } from './payroll/SettlementsPage.js';
import { ReportsPage } from './reports/ReportsPage.js';
import { EmisPage } from './facilities/EmisPage.js';
import { EquipmentPage } from './facilities/EquipmentPage.js';
import { FacilityRoomsPage } from './facilities/FacilityRoomsPage.js';
import { SchoolProfilePage } from './facilities/SchoolProfilePage.js';
import { LeaveRequestsPage } from './staff-attendance/LeaveRequestsPage.js';
import { SchoolDaysPage } from './staff-attendance/SchoolDaysPage.js';
import { WorkSchedulesPage } from './staff-attendance/WorkSchedulesPage.js';
import { HealthPage } from './health/HealthPage.js';
import { GrowthPage } from './growth/GrowthPage.js';
import { GrowthReportPage } from './growth/GrowthReportPage.js';
import { StudentHealthPage } from './health/StudentHealthPage.js';
import { StudentStatisticsPage } from './statistics/StudentStatisticsPage.js';
import { StatisticsPage } from './statistics/StatisticsPage.js';
import { MissingProfilesPage } from './statistics/MissingProfilesPage.js';
import { AdmissionsPage } from './admissions/AdmissionsPage.js';
import { InteractionsPage } from './interactions/InteractionsPage.js';
import { ActivitiesPage } from './activities/ActivitiesPage.js';
import { KitchenPage } from './kitchen/KitchenPage.js';
import { MedicinesPage } from './medicines/MedicinesPage.js';
import { InventoryPage } from './inventory/InventoryPage.js';
import { PurchaseRequestsPage } from './inventory/PurchaseRequestsPage.js';
import { RecruitmentPage } from './recruitment/RecruitmentPage.js';
import { TeachingPage } from './teaching/TeachingPage.js';
import { StaffAttendancePage } from './staff-attendance/StaffAttendancePage.js';
import { ClassImportsPage } from './imports/ClassImportsPage.js';
import { ImportsPage } from './imports/ImportsPage.js';
import { OrgUnitsPage } from './org-units/OrgUnitsPage.js';
import { BranchesPage, SchoolSitesPage } from './org-units/SchoolSitesPage.js';
import { AuditLogsPage } from './settings/AuditLogsPage.js';
import { SettingsPage } from './settings/SettingsPage.js';
import { ChangePasswordPage } from './pages/ChangePasswordPage.js';
import { HomePage } from './pages/HomePage.js';
import { LoginPage } from './pages/LoginPage.js';
import { useSession } from './session/session.js';
import { WorkPage } from './work/WorkPage.js';
import { EvaluationsPage } from './work/EvaluationsPage.js';
import { BonusDeductionsPage } from './work/BonusDeductionsPage.js';
import { ProgramCompletionPage } from './program-completion/ProgramCompletionPage.js';
import { ChildGroupsPage } from './child-groups/ChildGroupsPage.js';
import { ProfessionalStandardsPage } from './professional-standards/ProfessionalStandardsPage.js';
import { FeedbackPage, MyFeedbackPage } from './feedback/FeedbackPages.js';
import { ArchiveFondsPage } from './archives/ArchiveFondsPage.js';
import { ArchiveHoldingsPage } from './archives/ArchiveHoldingsPage.js';
import { ArchiveRecordsPage } from './archives/ArchiveRecordsPage.js';
import { ArchiveReportPage } from './archives/ArchiveReportPage.js';
import { GeneratedFilesPage } from './exports/GeneratedFilesPage.js';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.js';
import { HelpPage } from './portal-shell/HelpPage.js';
import { MyProfilePage } from './portal-shell/MyProfilePage.js';
import { SystemAnnouncementsPage } from './portal-shell/SystemAnnouncementsPage.js';
import { AppLinksPage } from './portal-shell/AppLinksPage.js';

// Trang dùng được khi chưa đăng nhập (DT-16 phần 16c thêm Quên mật khẩu)
const PUBLIC_PATHS = ['/login', '/forgot-password'];

// Chuyển hướng theo trạng thái phiên: chưa đăng nhập về MH-47; bắt buộc đổi mật khẩu về MH-48 (BM-07)
function SessionGate() {
  const session = useSession();
  const { pathname } = useLocation();

  if (session.status === 'checking') {
    return <div className="min-h-screen animate-pulse bg-page" aria-busy="true" />;
  }
  if (session.status === 'signed-out') {
    return PUBLIC_PATHS.includes(pathname) ? <Outlet /> : <Navigate to="/login" replace />;
  }
  if (session.passwordChangeRequired && pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  if (PUBLIC_PATHS.includes(pathname)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

const rootRoute = createRootRoute({ component: SessionGate });

const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/login', component: LoginPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/change-password', component: ChangePasswordPage }),
  // Quên mật khẩu, hồ sơ nhân sự cá nhân, hướng dẫn, thông báo hệ thống, ứng dụng liên kết (DT-16 phần 16c)
  createRoute({ getParentRoute: () => rootRoute, path: '/forgot-password', component: ForgotPasswordPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/my-profile', component: MyProfilePage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/help', component: HelpPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/system-announcements', component: SystemAnnouncementsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/app-links', component: AppLinksPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/academic-years', component: AcademicYearsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/org-units', component: OrgUnitsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/accounts', component: AccountsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/roles', component: RolesPage }),
  // 1.2 Phân quyền nhóm theo phần mềm, 1.6 Tài khoản đồng bộ của Bộ, của Sở (DT-16 phần 16d)
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/role-workspaces',
    component: RoleWorkspacesPage,
    validateSearch: (search: Record<string, unknown>): { role?: string } =>
      typeof search.role === 'string' ? { role: search.role } : {},
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/sync-accounts', component: SyncAccountsPage }),
  // Nhóm người dùng mở sẵn ở 1.3 Phân quyền nhóm theo menu qua tham số role (DT-15 phần 15e)
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/role-permissions',
    component: RolePermissionsPage,
    validateSearch: (search: Record<string, unknown>): { role?: string } =>
      typeof search.role === 'string' ? { role: search.role } : {},
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: SettingsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/audit-logs', component: AuditLogsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/departments', component: DepartmentsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/catalogs', component: CommonCatalogPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/approval-thresholds', component: ApprovalThresholdsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/rooms', component: RoomsAndGradeLevelsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/classes', component: ClassesPage }),
  // Trường học, lớp học theo Sở (DT-15 phần 15b, YCTD-111)
  createRoute({ getParentRoute: () => rootRoute, path: '/branches', component: BranchesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/school-sites', component: SchoolSitesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/class-imports', component: ClassImportsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/class-assignments', component: ClassAssignmentsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/children', component: ChildrenPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/student-movements', component: StudentMovementsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/administrative-units', component: AdministrativeUnitsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/imports', component: ImportsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/attendance', component: AttendancePage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/fees', component: FeesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/registrations', component: RegistrationsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/invoices', component: InvoicesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/fee-approvals', component: FeeApprovalsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/cashflow-categories', component: CashflowCategoriesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/debts', component: DebtsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/receipts', component: ReceiptsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/cash-accounts', component: CashAccountsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/payments', component: PaymentsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/cash-book', component: CashBookPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/debt-collection', component: DebtCollectionPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/bank-reconciliation', component: BankReconciliationPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/payables', component: PayablesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/fiscal-periods', component: FiscalPeriodsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/ledger', component: LedgerPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/staff', component: StaffPage }),
  // Nhân sự đủ theo Sở (DT-16 phần 16f)
  createRoute({ getParentRoute: () => rootRoute, path: '/staff-branches', component: StaffBranchesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/staff-imports', component: StaffImportsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/staff-identity', component: StaffIdentityPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/staff-movements', component: StaffMovementsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/staff-statistics', component: StaffStatisticsPage }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/staff-identity-progress',
    component: StaffIdentityProgressPage,
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/staff-attendance', component: StaffAttendancePage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/school-days', component: SchoolDaysPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/work-schedules', component: WorkSchedulesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/health', component: HealthPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/growth', component: GrowthPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/growth-report', component: GrowthReportPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/student-health', component: StudentHealthPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/student-statistics', component: StudentStatisticsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/statistics', component: StatisticsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/missing-profiles', component: MissingProfilesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/admissions', component: AdmissionsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/interactions', component: InteractionsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/kitchen', component: KitchenPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/medicines', component: MedicinesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/inventory', component: InventoryPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/activities', component: ActivitiesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/purchase-requests', component: PurchaseRequestsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/recruitment', component: RecruitmentPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/teaching', component: TeachingPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/leave-requests', component: LeaveRequestsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/leave-policies', component: LeavePoliciesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/payrolls', component: PayrollPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/pay-items', component: PayItemsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/my-payslips', component: MyPayslipsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/payroll-settlements', component: SettlementsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/reports', component: ReportsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/school-profile', component: SchoolProfilePage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/facility-rooms', component: FacilityRoomsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/equipment', component: EquipmentPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/emis', component: EmisPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/api-clients', component: ApiClientsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/integrations', component: IntegrationsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/notifications', component: NotificationsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/my-feedback', component: MyFeedbackPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/feedback', component: FeedbackPage }),
  // Văn thư lưu trữ (DT-15 phần 15h2, YCTD-118)
  createRoute({ getParentRoute: () => rootRoute, path: '/archive-records', component: ArchiveRecordsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/archive-fonds', component: ArchiveFondsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/archive-holdings', component: ArchiveHoldingsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/archive-report', component: ArchiveReportPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/generated-files', component: GeneratedFilesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/work', component: WorkPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/evaluations', component: EvaluationsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/bonus-deductions', component: BonusDeductionsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/program-completion', component: ProgramCompletionPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/child-groups', component: ChildGroupsPage }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/professional-standards',
    component: ProfessionalStandardsPage,
  }),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
