import { createRootRoute, createRoute, createRouter, Navigate, Outlet, useLocation } from '@tanstack/react-router';
import { AcademicYearsPage } from './academic-years/AcademicYearsPage.js';
import { AccountsPage } from './accounts/AccountsPage.js';
import { RolesPage } from './accounts/RolesPage.js';
import { RolePermissionsPage } from './accounts/RolePermissionsPage.js';
import { RoleWorkspacesPage } from './accounts/RoleWorkspacesPage.js';
import { SyncAccountsPage } from './accounts/SyncAccountsPage.js';
import { ApiClientsPage } from './accounts/ApiClientsPage.js';
import { IntegrationsPage } from './settings/IntegrationsPage.js';
import { AiAssistantPage } from './ai-assistant/AiAssistantPage.js';
import { CourseTemplatesPage } from './learning/CourseTemplatesPage.js';
import { OnlineClassesPage } from './learning/OnlineClassesPage.js';
import { OnlineTeachingPage } from './learning/OnlineTeachingPage.js';
import { OnlineLearningReportsPage } from './learning/OnlineLearningReportsPage.js';
import { DiscussionSafetyPage } from './learning/DiscussionSafetyPage.js';
import { HomeworkPage } from './learning/HomeworkPage.js';
import { NotificationsPage } from './notifications/NotificationsPage.js';
import { ApprovalThresholdsPage } from './catalogs/ApprovalThresholdsPage.js';
import { CommonCatalogPage } from './catalogs/CommonCatalogPage.js';
import { DepartmentsPage } from './catalogs/DepartmentsPage.js';
import { RoomsAndGradeLevelsPage } from './catalogs/RoomsAndGradeLevelsPage.js';
import { GraduationPage } from './graduation/GraduationPage.js';
import { ScoresPage } from './scores/ScoresPage.js';
import { SubjectCombinationsPage } from './subjects/SubjectCombinationsPage.js';
import { SubjectsPage } from './subjects/SubjectsPage.js';
import { SubjectTeamsPage } from './subjects/SubjectTeamsPage.js';
import { TeachingAssignmentsPage } from './subjects/TeachingAssignmentsPage.js';
import { PeriodSlotsPage } from './timetables/PeriodSlotsPage.js';
import { TimetablesPage } from './timetables/TimetablesPage.js';
import { StudentAssessmentsPage } from './assessments/StudentAssessmentsPage.js';
import { ClassLogsPage, PeriodAttendancePage } from './class-logs/ClassLogsPage.js';
import { LearningRecordsPage } from './learning-records/LearningRecordsPage.js';
import { TimetableGeneratorPage } from './timetables/TimetableGeneratorPage.js';
import { TimetableChangesPage } from './timetables/TimetableChangesPage.js';
import { TimetableReportsPage } from './timetables/TimetableReportsPage.js';
import { TimetableLookupPage } from './timetables/TimetableLookupPage.js';
import { SeatingPage } from './seating/SeatingPage.js';
import { SecondaryReportsPage } from './secondary-reports/SecondaryReportsPage.js';
import { PrimaryReportsPage } from './primary-reports/PrimaryReportsPage.js';
import { QuestionBankPage } from './exams/QuestionBankPage.js';
import { ExamMatricesPage } from './exams/ExamMatricesPage.js';
import { AssessmentPlansPage } from './exams/AssessmentPlansPage.js';
import { ExamsPage } from './exams/ExamsPage.js';
import { ExamGradingPage } from './exam-grading/ExamGradingPage.js';
import { ExamReportsPage } from './exam-grading/ExamReportsPage.js';
import { OnlineExamsPage } from './online-exams/OnlineExamsPage.js';
import { OnlineExamMonitorPage } from './online-exams/OnlineExamMonitorPage.js';
import { OnlineExamSettingsPage } from './online-exams/OnlineExamSettingsPage.js';
import { TutoringProgramsPage } from './tutoring/TutoringProgramsPage.js';
import { TutoringSessionsPage } from './tutoring/TutoringSessionsPage.js';
import { TutoringExemptionsPage } from './tutoring/TutoringExemptionsPage.js';
import { TutoringRulesPage } from './tutoring/TutoringRulesPage.js';
import { TutoringFinancePage } from './tutoring/TutoringFinancePage.js';
import { ChildrenPage } from './children/ChildrenPage.js';
import { StudentMovementsPage } from './children/StudentMovementsPage.js';
import { DefaultPasswordsPage } from './students/DefaultPasswordsPage.js';
import { LearningAccountsPage } from './students/LearningAccountsPage.js';
import { NationalIdProgressPage } from './students/NationalIdProgressPage.js';
import { NationalIdsPage } from './students/NationalIdsPage.js';
import { SmsPhonesPage } from './students/SmsPhonesPage.js';
import { StudentImportsPage } from './students/StudentImportsPage.js';
import { StudentOrderPage } from './students/StudentOrderPage.js';
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
import { StaffDetailPage } from './staff/StaffDetailPage.js';
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
import { EmisFormPage } from './emis/EmisFormPage.js';
import { EmisSendPage } from './emis/EmisSendPage.js';
import { EMIS_FORMS } from '@school-management/shared';
import { EquipmentOutsidePage, EquipmentPage, EquipmentSubmissionPage } from './facilities/EquipmentPage.js';
import { EquipmentLocationsPage } from './facilities/EquipmentLocationsPage.js';
import { EquipmentMinimumPage } from './facilities/EquipmentMinimumPage.js';
import { EquipmentStocktakesPage } from './facilities/EquipmentStocktakesPage.js';
import { FacilityInputPage, FacilityRoomsPage } from './facilities/FacilityRoomsPage.js';
import { FacilityReportPage } from './facilities/FacilityReportPage.js';
import { FacilityInvestmentsPage } from './facilities/FacilityInvestmentsPage.js';
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
import { FoodInspectionsPage } from './kitchen/FoodInspectionsPage.js';
import { FoodLotsPage } from './kitchen/FoodLotsPage.js';
import { FoodSamplesPage } from './kitchen/FoodSamplesPage.js';
import { FoodSupplierRecordsPage } from './kitchen/FoodSupplierRecordsPage.js';
import { FoodTracePage } from './kitchen/FoodTracePage.js';
import { KitchenPage } from './kitchen/KitchenPage.js';
import { BoardingPage } from './boarding/BoardingPage.js';
import { ConductPage } from './conduct/ConductPage.js';
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
import { ExternalSignInCallbackPage } from './portal-shell/external-identity.js';
import { SignInHandoffPage } from './pages/SignInHandoffPage.js';
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
import { DemoEnvironmentPage, ImpersonationsPage, SchoolDataExportPage } from './administration/AdministrationPages.js';
import { ServiceInvoicesPage } from './school-plan/ServiceInvoicesPage.js';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.js';
import { ActivatePage } from './pages/ActivatePage.js';
import { SupportAccessPage, SupportLoginPage } from './support/support.js';
import { ParentOrgConsentsPage } from './support/parent-org-consents.js';
import { HelpPage } from './portal-shell/HelpPage.js';
import { MyProfilePage } from './portal-shell/MyProfilePage.js';
import { SystemAnnouncementsPage } from './portal-shell/SystemAnnouncementsPage.js';
import { AppLinksPage } from './portal-shell/AppLinksPage.js';
import { SchoolWeeksPage } from './academic-years/SchoolWeeksPage.js';
import { YearRolloverPage } from './academic-years/YearRolloverPage.js';
import { AccreditationReviewPage } from './school/AccreditationReviewPage.js';
import { SchoolSplitsPage } from './school/SchoolSplitsPage.js';
import { SigningCertificatePage, SigningCertificateSyncPage } from './signing/SigningCertificatePage.js';
import { SigningDossiersPage } from './signing/SigningDossiersPage.js';
import { SigningSubmissionsPage } from './signing/SigningSubmissionsPage.js';
import {
  DocumentBooksPage,
  DocumentCatalogsPage,
  DocumentLeadersPage,
  ExternalUnitGroupsPage,
  ExternalUnitsPage,
} from './incoming-documents/DocumentAdminPages.js';
import {
  IncomingFollowedPage,
  IncomingForInformationPage,
  IncomingInboxPage,
  IncomingInterconnectPage,
  IncomingManagePage,
  IncomingSearchPage,
  IncomingStarredPage,
} from './incoming-documents/IncomingListPages.js';
import { FinalYearRecordsPage } from './entry-admissions/FinalYearRecordsPage.js';
import {
  EntryClassesPage,
  EntryRolesPage,
  EntryStaffPage,
  EntryUsersPage,
  FinalYearCompletionPage,
  FinalYearStatisticsPage,
  SchoolMapPage,
  SchoolServicesPage,
  SupportRequestsPage,
} from './entry-admissions/EntryAdmissionPages.js';
import {
  AdmittedStudentsPage,
  AdvancedRegistrationsPage,
  IntakePage,
  NoticesPage,
  TransferPage,
  TransferResultsPage,
} from './entry-admissions/EntryIntakePages.js';
import { KpiCatalogPage } from './kpi/KpiCatalogPage.js';
import { MyWorkPage } from './my-work/MyWorkPage.js';
import {
  FoldersPage,
  GroupRecordsPage,
  PersonalRecordsPage,
  ReviewRecordsPage,
  RoundsPage,
  SchoolRecordsPage,
  StatisticsPage as ProfessionalStatisticsPage,
  WorkGroupsPage,
} from './professional-records/ProfessionalPages.js';
import {
  GroupPlansPage,
  MyPlansPage,
  PlanProgressPage,
  PlanTemplatesPage,
  ReviewPlansPage,
  SchoolPlansPage,
} from './education-plans/EducationPlanPages.js';
import {
  AppealsPage as EmulationAppealsPage,
  CampaignsPage as EmulationCampaignsPage,
  CouncilPage as EmulationCouncilPage,
  DecisionsPage as EmulationDecisionsPage,
  HistoryPage as EmulationHistoryPage,
  MyNominationsPage as EmulationNominationsPage,
  RegistrationsPage as EmulationRegistrationsPage,
  ReportsPage as EmulationReportsPage,
  ReviewNominationsPage as EmulationReviewPage,
  TitlesPage as EmulationTitlesPage,
  VerifyAwardPage,
  VotingPage as EmulationVotingPage,
} from './emulation/EmulationPages.js';
import {
  QualityAssessmentsPage,
  QualityEvidencesPage,
  QualityFrameworksPage,
  QualityRecognitionPage,
  QualityReportsPage,
} from './quality-assurance/QualityPages.js';
import { LibraryCirculationPage } from './library/LibraryCirculationPage.js';
import { LibraryReadersPage } from './library/LibraryReadersPage.js';
import { LibraryReportsPage } from './library/LibraryReportsPage.js';
import { LibrarySettingsPage } from './library/LibrarySettingsPage.js';
import { LibraryStocktakesPage } from './library/LibraryStocktakesPage.js';
import { LibraryTextbooksPage } from './library/LibraryTextbooksPage.js';
import { LibraryTitlesPage } from './library/LibraryTitlesPage.js';
import { DirectiveFormPage, DirectiveInboxPage, DirectiveOutboxPage } from './directives/DirectivePages.js';
import { IncomingReportPage, StatisticsReportPage, SummaryReportPage } from './directives/ReportPages.js';
import {
  MeetingRoomsPage,
  MeetingSchedulePage,
  RoomBookingsPage,
  ScheduleTemplatesPage,
  UnitSchedulePage,
} from './directives/SchedulePages.js';
import {
  ArchiveWorkFilesPage,
  ExpiredWorkFilesPage,
  PersonalWorkFilesPage,
  SharedWorkFilesPage,
  TransferredWorkFilesPage,
} from './directives/WorkFilePages.js';
import {
  KpiAdvisoryPage,
  KpiEvaluationsPage,
  KpiMyEvaluationPage,
  KpiReportsPage,
  KpiVotingPage,
} from './kpi/KpiEvaluationPages.js';
import { KpiLegacyImportPage, KpiPeriodsPage, KpiProfilesPage, KpiRuleSetsPage } from './kpi/KpiSetupPages.js';
import { KpiAssignmentsPage, KpiGradingPage, KpiMyTasksPage } from './kpi/KpiTaskPages.js';
import { WebsiteAlbumsPage } from './website/WebsiteAlbumPages.js';
import {
  WebsiteAnnouncementsPage,
  WebsiteDisclosuresPage,
  WebsiteNewsPage,
  WebsitePagesPage,
} from './website/WebsitePostPages.js';
import { WebsiteContactsPage, WebsiteReviewPage } from './website/WebsiteReviewPages.js';
import { WebsiteDomainsPage, WebsiteSettingsPage } from './website/WebsiteSetupPages.js';
import {
  OutgoingInterconnectPage,
  OutgoingManagePage,
  OutgoingPage,
  OutgoingSearchPage,
} from './outgoing-documents/OutgoingListPages.js';
import { VerifyDocumentPage } from './outgoing-documents/VerifyDocumentPage.js';
import {
  CompetencyPage,
  MyTrainingPage,
  TrainingCoursesPage,
  TrainingRecordsPage,
  TrainingSettingsPage,
  VerifyTrainingCertificatePage,
} from './training/TrainingPages.js';
import {
  CollectionsPage,
  MyResourcesPage,
  ResourceReportsPage,
  ResourceReviewPage,
  ResourceSearchPage,
  ResourceSettingsPage,
  ResourceStatisticsPage,
} from './learning-resources/LearningResourcePages.js';
import { ResourceBankPage, ResourcePackagesPage, RubricsPage } from './learning-resources/ResourceSharingPages.js';

// Trang dùng được khi chưa đăng nhập (DT-16 phần 16c thêm Quên mật khẩu; DT-SaaS S2 thêm Kích hoạt quản trị viên đầu tiên)
const PUBLIC_PATHS = ['/login', '/forgot-password', '/activate'];
// Trang công khai mở được cả khi đã hay chưa đăng nhập: tra cứu mã QR của văn bản đi (DT-18 phần 18b)
// và mã QR thời khoá biểu (DT-20 phần 22c2), chứng nhận bồi dưỡng (DT-22 phần 22e)
// Đường liên kết hỗ trợ một lần của nhân viên nền tảng (DT-SaaS phần S4) mở được cả khi đang đăng nhập tài khoản khác
const OPEN_PATHS = [
  '/tra-cuu-van-ban',
  '/tra-cuu-khen-thuong',
  '/tra-cuu-thoi-khoa-bieu',
  '/tra-cuu-chung-nhan',
  '/support-login',
  // Nhận phiên sau khi đăng nhập theo đơn vị ở tên miền chung (DT-24)
  '/sign-in-handoff',
  // Quay về từ nhà cung cấp định danh bên ngoài, cả lượt đăng nhập lẫn lượt liên kết khi đang đăng nhập (DT-25)
  '/dang-nhap/ben-ngoai',
];

// Chuyển hướng theo trạng thái phiên: chưa đăng nhập về MH-47; bắt buộc đổi mật khẩu về MH-48 (BM-07)
function SessionGate() {
  const session = useSession();
  const { pathname } = useLocation();

  if (OPEN_PATHS.includes(pathname)) {
    return <Outlet />;
  }
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
  createRoute({ getParentRoute: () => rootRoute, path: '/activate', component: ActivatePage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/support-login', component: SupportLoginPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/sign-in-handoff', component: SignInHandoffPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/dang-nhap/ben-ngoai', component: ExternalSignInCallbackPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/support-access', component: SupportAccessPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/parent-org-consents', component: ParentOrgConsentsPage }),
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
  // Nền Tiểu học (DT-20 phần 20a)
  createRoute({ getParentRoute: () => rootRoute, path: '/subjects', component: SubjectsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/teaching-assignments', component: TeachingAssignmentsPage }),
  // Nền THCS, THPT (DT-21 phần 21a)
  createRoute({ getParentRoute: () => rootRoute, path: '/subject-combinations', component: SubjectCombinationsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/subject-teams', component: SubjectTeamsPage }),
  // Sổ điểm THCS, THPT (DT-21 phần 21c)
  createRoute({ getParentRoute: () => rootRoute, path: '/scores', component: ScoresPage }),
  // Xét tốt nghiệp, hồ sơ thi THCS, THPT (DT-21 phần 21f)
  createRoute({ getParentRoute: () => rootRoute, path: '/graduation', component: GraduationPage }),
  // Thời khoá biểu phần khung (DT-20 phần 22c1)
  createRoute({ getParentRoute: () => rootRoute, path: '/period-slots', component: PeriodSlotsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/timetables', component: TimetablesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/student-assessments', component: StudentAssessmentsPage }),
  // Sổ đầu bài, chuyên cần theo tiết (DT-20 phần 20d)
  createRoute({ getParentRoute: () => rootRoute, path: '/class-logs', component: ClassLogsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/period-attendance', component: PeriodAttendancePage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/learning-records', component: LearningRecordsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/timetable-generator', component: TimetableGeneratorPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/timetable-changes', component: TimetableChangesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/timetable-reports', component: TimetableReportsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/tra-cuu-thoi-khoa-bieu', component: TimetableLookupPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/primary-reports', component: PrimaryReportsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/seating-charts', component: SeatingPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/secondary-reports', component: SecondaryReportsPage }),
  // Kiểm tra, đánh giá phần đề (DT-21 phần 22g1)
  createRoute({ getParentRoute: () => rootRoute, path: '/question-bank', component: QuestionBankPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/exam-matrices', component: ExamMatricesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/assessment-plans', component: AssessmentPlansPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/exams', component: ExamsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/exam-grading', component: ExamGradingPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/exam-reports', component: ExamReportsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/classes', component: ClassesPage }),
  // Trường học, lớp học theo Sở (DT-15 phần 15b, YCTD-111)
  createRoute({ getParentRoute: () => rootRoute, path: '/branches', component: BranchesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/school-sites', component: SchoolSitesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/class-imports', component: ClassImportsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/class-assignments', component: ClassAssignmentsPage }),
  // Trường học, lớp học, lịch năm học đủ theo Sở (DT-16 phần 16e)
  createRoute({ getParentRoute: () => rootRoute, path: '/accreditation-review', component: AccreditationReviewPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/school-splits', component: SchoolSplitsPage }),
  // Quản lý kí hồ sơ, bản chạy nội bộ (DT-16 phần 16k)
  createRoute({ getParentRoute: () => rootRoute, path: '/signing-certificate', component: SigningCertificatePage }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/signing-certificate-sync',
    component: SigningCertificateSyncPage,
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/signing-dossiers', component: SigningDossiersPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/signing-submissions', component: SigningSubmissionsPage }),
  // Văn bản đến theo VNPT iOffice (DT-18 phần 18a)
  createRoute({ getParentRoute: () => rootRoute, path: '/incoming-documents', component: IncomingInboxPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/incoming-documents/manage', component: IncomingManagePage }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/incoming-documents/for-information',
    component: IncomingForInformationPage,
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/incoming-documents/starred', component: IncomingStarredPage }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/incoming-documents/followed',
    component: IncomingFollowedPage,
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/incoming-documents/search', component: IncomingSearchPage }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/incoming-documents/interconnect',
    component: IncomingInterconnectPage,
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/document-books', component: DocumentBooksPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/external-units', component: ExternalUnitsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/external-unit-groups', component: ExternalUnitGroupsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/document-catalogs', component: DocumentCatalogsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/document-leaders', component: DocumentLeadersPage }),
  // Tuyển sinh đầu cấp phần 1 (DT-17 phần 17c)
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/entry-admissions/final-year',
    component: FinalYearRecordsPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/entry-admissions/completion',
    component: FinalYearCompletionPage,
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/entry-admissions/school-map', component: SchoolMapPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/entry-admissions/services', component: SchoolServicesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/entry-admissions/roles', component: EntryRolesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/entry-admissions/users', component: EntryUsersPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/entry-admissions/staff', component: EntryStaffPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/entry-admissions/classes', component: EntryClassesPage }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/entry-admissions/statistics',
    component: FinalYearStatisticsPage,
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/entry-admissions/support', component: SupportRequestsPage }),
  // Tuyển sinh đầu cấp phần 2 (DT-17 phần 17d)
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/entry-admissions/advanced',
    component: AdvancedRegistrationsPage,
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/entry-admissions/intake', component: IntakePage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/entry-admissions/notices', component: NoticesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/entry-admissions/transfer', component: TransferPage }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/entry-admissions/transfer-results',
    component: TransferResultsPage,
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/admitted-students', component: AdmittedStudentsPage }),
  // Phân hệ KPI (DT-18 phần 18d)
  createRoute({ getParentRoute: () => rootRoute, path: '/kpi/periods', component: KpiPeriodsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/kpi/rule-sets', component: KpiRuleSetsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/kpi/profiles', component: KpiProfilesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/kpi/legacy-import', component: KpiLegacyImportPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/kpi/catalog', component: KpiCatalogPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/kpi/my-tasks', component: KpiMyTasksPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/kpi/assignments', component: KpiAssignmentsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/kpi/grading', component: KpiGradingPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/kpi/my-evaluation', component: KpiMyEvaluationPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/kpi/evaluations', component: KpiEvaluationsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/kpi/advisory', component: KpiAdvisoryPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/kpi/voting', component: KpiVotingPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/kpi/reports', component: KpiReportsPage }),
  // Website trường (DT-18 phần 18f)
  createRoute({ getParentRoute: () => rootRoute, path: '/website/settings', component: WebsiteSettingsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/website/domains', component: WebsiteDomainsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/website/news', component: WebsiteNewsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/website/announcements', component: WebsiteAnnouncementsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/website/pages', component: WebsitePagesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/website/disclosures', component: WebsiteDisclosuresPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/website/albums', component: WebsiteAlbumsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/website/review', component: WebsiteReviewPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/website/contacts', component: WebsiteContactsPage }),
  // Văn bản đi theo VNPT iOffice (DT-18 phần 18b)
  createRoute({ getParentRoute: () => rootRoute, path: '/outgoing-documents', component: OutgoingPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/outgoing-documents/manage', component: OutgoingManagePage }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/outgoing-documents/interconnect',
    component: OutgoingInterconnectPage,
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/outgoing-documents/search', component: OutgoingSearchPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/tra-cuu-van-ban', component: VerifyDocumentPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/school-weeks', component: SchoolWeeksPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/year-rollover', component: YearRolloverPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/children', component: ChildrenPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/student-movements', component: StudentMovementsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/administrative-units', component: AdministrativeUnitsPage }),
  // Học sinh đủ theo Sở (DT-16 phần 16g)
  createRoute({ getParentRoute: () => rootRoute, path: '/student-imports', component: StudentImportsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/student-order', component: StudentOrderPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/sms-phones', component: SmsPhonesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/national-ids', component: NationalIdsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/learning-accounts', component: LearningAccountsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/default-passwords', component: DefaultPasswordsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/national-id-progress', component: NationalIdProgressPage }),
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
  // Trang hồ sơ một cán bộ, giáo viên chia thẻ, thẻ đang mở ở ?tab= (YCTD-297)
  createRoute({ getParentRoute: () => rootRoute, path: '/staff/$staffId', component: StaffDetailPage }),
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
  createRoute({ getParentRoute: () => rootRoute, path: '/boarding', component: BoardingPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/conduct', component: ConductPage }),
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
  // Bảy biểu báo cáo EMIS (DT-16 phần 16j)
  ...EMIS_FORMS.map((form) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: form.path,
      component: () => <EmisFormPage code={form.code} />,
    }),
  ),
  // 1.1.2 Gửi báo cáo đầu năm (DT-17 phần 17a)
  createRoute({ getParentRoute: () => rootRoute, path: '/emis/send', component: EmisSendPage }),
  // Cơ sở vật chất đủ theo Sở (DT-16 phần 16i)
  createRoute({ getParentRoute: () => rootRoute, path: '/facility-report', component: FacilityReportPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/facility-investments', component: FacilityInvestmentsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/facility-input', component: FacilityInputPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/equipment-outside', component: EquipmentOutsidePage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/equipment-submission', component: EquipmentSubmissionPage }),
  // Thiết bị: nơi để, tem QR, kiểm kê, đối sánh danh mục tối thiểu (DT-18 phần 18g)
  createRoute({ getParentRoute: () => rootRoute, path: '/equipment-locations', component: EquipmentLocationsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/equipment-stocktakes', component: EquipmentStocktakesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/equipment-minimum', component: EquipmentMinimumPage }),
  // Bán trú: kiểm thực ba bước và an toàn thực phẩm (DT-18 phần 22b)
  createRoute({ getParentRoute: () => rootRoute, path: '/food-safety/inspections', component: FoodInspectionsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/food-safety/samples', component: FoodSamplesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/food-safety/lots', component: FoodLotsPage }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/food-safety/supplier-records',
    component: FoodSupplierRecordsPage,
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/food-safety/trace', component: FoodTracePage }),
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
  // Quản trị và trình diễn (DT-18 phần 18h)
  createRoute({ getParentRoute: () => rootRoute, path: '/impersonations', component: ImpersonationsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/school-data-export', component: SchoolDataExportPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/demo-environment', component: DemoEnvironmentPage }),
  // Hóa đơn dịch vụ của trường (DT-SaaS phần S5b)
  createRoute({ getParentRoute: () => rootRoute, path: '/service-invoices', component: ServiceInvoicesPage }),
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
  // Giao việc, lịch đơn vị, hồ sơ công việc, báo cáo theo VNPT iOffice (DT-18 phần 18c); Giao việc mở sẵn văn bản đến qua
  // tham số document_id khi tạo việc từ văn bản
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/directives/new',
    component: DirectiveFormPage,
    validateSearch: (search: Record<string, unknown>): { document_id?: string; document_label?: string } => ({
      ...(typeof search.document_id === 'string' ? { document_id: search.document_id } : {}),
      ...(typeof search.document_label === 'string' ? { document_label: search.document_label } : {}),
    }),
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/directives/inbox', component: DirectiveInboxPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/directives/outbox', component: DirectiveOutboxPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/work-files', component: PersonalWorkFilesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/work-files/shared', component: SharedWorkFilesPage }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/work-files/transferred',
    component: TransferredWorkFilesPage,
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/work-files/archive', component: ArchiveWorkFilesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/work-files/expired', component: ExpiredWorkFilesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/unit-schedules', component: UnitSchedulePage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/meeting-schedules', component: MeetingSchedulePage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/room-bookings', component: RoomBookingsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/meeting-rooms', component: MeetingRoomsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/schedule-templates', component: ScheduleTemplatesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/document-reports/incoming', component: IncomingReportPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/document-reports/summary', component: SummaryReportPage }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/document-reports/statistics',
    component: StatisticsReportPage,
  }),
  // Hồ sơ chuyên môn và Việc của tôi (DT-18 phần 18e)
  createRoute({ getParentRoute: () => rootRoute, path: '/my-work', component: MyWorkPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/professional-records', component: PersonalRecordsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/professional-records/groups', component: GroupRecordsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/professional-records/school', component: SchoolRecordsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/professional-records/review', component: ReviewRecordsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/professional-rounds', component: RoundsPage }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/professional-records/statistics',
    component: ProfessionalStatisticsPage,
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/professional-folders', component: FoldersPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/professional-work-groups', component: WorkGroupsPage }),
  // Kế hoạch giáo dục (DT-18 phần 22i)
  createRoute({ getParentRoute: () => rootRoute, path: '/education-plans', component: MyPlansPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/education-plans/groups', component: GroupPlansPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/education-plans/school', component: SchoolPlansPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/education-plans/review', component: ReviewPlansPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/education-plans/progress', component: PlanProgressPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/education-plan-templates', component: PlanTemplatesPage }),
  // Thi đua, khen thưởng (DT-18 phần 22d)
  createRoute({ getParentRoute: () => rootRoute, path: '/emulation/campaigns', component: EmulationCampaignsPage }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/emulation/registrations',
    component: EmulationRegistrationsPage,
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/emulation/nominations', component: EmulationNominationsPage }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/emulation/nominations/review',
    component: EmulationReviewPage,
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/emulation/council', component: EmulationCouncilPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/emulation/voting', component: EmulationVotingPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/emulation/appeals', component: EmulationAppealsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/emulation/decisions', component: EmulationDecisionsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/emulation/history', component: EmulationHistoryPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/emulation/reports', component: EmulationReportsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/emulation/titles', component: EmulationTitlesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/tra-cuu-khen-thuong', component: VerifyAwardPage }),
  // Hồ sơ bồi dưỡng giáo viên (DT-22 phần 22e)
  createRoute({ getParentRoute: () => rootRoute, path: '/training/mine', component: MyTrainingPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/training/courses', component: TrainingCoursesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/training/records', component: TrainingRecordsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/training/competency', component: CompetencyPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/training/settings', component: TrainingSettingsPage }),
  // Kho học liệu số (DT-22 phần 22h1)
  createRoute({ getParentRoute: () => rootRoute, path: '/learning-resources', component: ResourceSearchPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/learning-resources/mine', component: MyResourcesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/learning-resources/review', component: ResourceReviewPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/learning-resources/collections', component: CollectionsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/learning-resources/reports', component: ResourceReportsPage }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/learning-resources/statistics',
    component: ResourceStatisticsPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/learning-resources/settings',
    component: ResourceSettingsPage,
  }),
  // Câu hỏi, đề, rubric, gói chia sẻ (DT-22 phần 22h2)
  createRoute({ getParentRoute: () => rootRoute, path: '/learning-resources/questions', component: ResourceBankPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/learning-resources/rubrics', component: RubricsPage }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/learning-resources/packages',
    component: ResourcePackagesPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/tra-cuu-chung-nhan',
    component: VerifyTrainingCertificatePage,
  }),
  // Bảo đảm chất lượng, tự đánh giá (DT-18 phần 22f)
  createRoute({ getParentRoute: () => rootRoute, path: '/quality/assessments', component: QualityAssessmentsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/quality/reports', component: QualityReportsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/quality/evidences', component: QualityEvidencesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/quality/recognition', component: QualityRecognitionPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/quality/frameworks', component: QualityFrameworksPage }),
  // Thư viện trường học (DT-22 phần 22a)
  createRoute({ getParentRoute: () => rootRoute, path: '/library/titles', component: LibraryTitlesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/library/readers', component: LibraryReadersPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/library/circulation', component: LibraryCirculationPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/library/textbooks', component: LibraryTextbooksPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/library/stocktakes', component: LibraryStocktakesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/library/reports', component: LibraryReportsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/library/settings', component: LibrarySettingsPage }),
  // Thi trực tuyến cho học sinh (DT-23 phần 23a)
  createRoute({ getParentRoute: () => rootRoute, path: '/online-exams', component: OnlineExamsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/online-exams/monitor', component: OnlineExamMonitorPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/online-exams/settings', component: OnlineExamSettingsPage }),
  // Gia sư trong trường (DT-27 phần 27b)
  createRoute({ getParentRoute: () => rootRoute, path: '/tutoring', component: TutoringProgramsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/tutoring/sessions', component: TutoringSessionsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/tutoring/exemptions', component: TutoringExemptionsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/tutoring/rules', component: TutoringRulesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/tutoring/finance', component: TutoringFinancePage }),
  // Trợ lý AI soạn nháp (DT-23 phần 23d)
  createRoute({ getParentRoute: () => rootRoute, path: '/ai-assistant', component: AiAssistantPage }),
  // Lõi hệ thống quản lý học tập (DT-28 phần 28b)
  createRoute({ getParentRoute: () => rootRoute, path: '/online-classes', component: OnlineClassesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/course-templates', component: CourseTemplatesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/online-teaching', component: OnlineTeachingPage }),
  // Báo cáo học tập trực tuyến (DT-28 phần 28d)
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/online-learning-reports',
    component: OnlineLearningReportsPage,
  }),
  // An toàn thảo luận (DT-28 phần 28e)
  createRoute({ getParentRoute: () => rootRoute, path: '/online-discussion-safety', component: DiscussionSafetyPage }),
  // Bài về nhà (DT-28 phần 28f)
  createRoute({ getParentRoute: () => rootRoute, path: '/online-homework', component: HomeworkPage }),
]);

// Đường dẫn gốc lúc dựng (APP_BASE_PATH của vite, DT-SaaS phần S9): /quan-ly/ ở hồ sơ thử nghiệm, / mặc định
export const router = createRouter({ routeTree, basepath: import.meta.env.BASE_URL });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
