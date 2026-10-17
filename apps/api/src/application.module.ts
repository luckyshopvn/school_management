import { AdmissionAccess } from './admissions/admission-access.js';
import { AdmissionApplicationsController, AdmissionApplicationsService } from './admissions/admission-applications.js';
import { AdmissionCampaignsController, AdmissionCampaignsService } from './admissions/admission-campaigns.js';
import { AdmissionsPublicController, AdmissionsPublicService } from './admissions/admissions-public.js';
import { admissionsTransitionStep } from './admissions/admissions-transition.js';
import { AdmissionsRateLimiter } from './admissions/public-rate-limit.js';
import { PublicRateLimiter, RecruitmentAccess } from './recruitment/recruitment-common.js';
import { RecruitmentRequestsController, RecruitmentRequestsService } from './recruitment/recruitment-requests.js';
import { JobPostingsController, JobPostingsService } from './recruitment/job-postings.js';
import { PublicRecruitmentController, PublicRecruitmentService } from './recruitment/public-recruitment.js';
import { CandidatesController, CandidatesService } from './recruitment/candidates.js';
import { recruitmentTransitionStep } from './recruitment/recruitment-transition.js';
import { professionalStandardsTransitionStep } from './professional-standards/professional-standards-transition.js';
import {
  ProfessionalStandardsController,
  ProfessionalStandardsService,
} from './professional-standards/professional-standards.js';
import { ProfessionalRatingImports } from './professional-standards/rating-import.js';
import { ProgramCompletionController, ProgramCompletionService } from './program-completion/program-completion.js';
import { ChildGroupsController, ChildGroupsService } from './child-groups/child-groups.js';
import { AccountExportsController, AccountExportsService } from './accounts-export/account-exports.js';
import { Module, type DynamicModule, type Type } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Clock } from '@school-management/server';
import {
  ACADEMIC_YEAR_TRANSITION_STEPS,
  type AcademicYearTransitionStep,
} from './academic-years/academic-year-transition.js';
import { AcademicYearsController } from './academic-years/academic-years.controller.js';
import { AcademicYearsService } from './academic-years/academic-years.service.js';
import { AuthenticationGuard } from './authentication/authentication.guard.js';
import { IdentityClient } from './authentication/identity-client.js';
import { API_CONFIGURATION, type ApiConfiguration } from './common/configuration.js';
import { CurrentSchoolYearResolver } from './common/current-school-year.js';
import { Databases } from './common/databases.js';
import { AuditLogsController } from './audit-logs/audit-logs.controller.js';
import { HealthController } from './health.controller.js';
import { settingsTransitionStep } from './settings/settings-transition.js';
import { SettingsController } from './settings/settings.controller.js';
import { SettingsService } from './settings/settings.service.js';
import { DataAccessLogger } from './common/data-access-log.js';
import { ClassCapacity } from './classes/class-capacity.js';
import { OrganizationScopes } from './organization/organization-scopes.js';
import { orgUnitsTransitionStep } from './organization/org-units-transition.js';
import { catalogsTransitionStep } from './catalogs/catalogs-transition.js';
import { feeCatalogsTransitionStep } from './fees/fee-catalogs-transition.js';
import { childrenTransitionStep } from './children/children-transition.js';
import { financeTransitionStep } from './finance/finance-transition.js';
import { HealthAccess } from './health/health-access.js';
import { HealthCareController, HealthCareService } from './health/health-care.js';
import { GrowthController, GrowthService } from './health/growth.js';
import { StudentHealthController, StudentHealthService } from './health/student-health.js';
import { SchoolTerms } from './health/school-terms.js';
import { StatisticsController, StatisticsService } from './statistics/statistics.js';
import { StudentStatisticsController, StudentStatisticsService } from './statistics/student-statistics.js';
import { EmisHealthReportController, EmisHealthReportService } from './health/emis-health-report.js';
import { HealthRecordsController, HealthRecordsService } from './health/health-records.js';
import { healthTransitionStep } from './health/health-transition.js';
import { KitchenAccess } from './kitchen/kitchen-access.js';
import { KitchenCatalogsController, KitchenCatalogsService } from './kitchen/kitchen-catalogs.js';
import { KitchenMealsController, KitchenMealsService } from './kitchen/kitchen-meals.js';
import { KitchenMenusController, KitchenMenusService } from './kitchen/kitchen-menus.js';
import { MenuImportsController, MenuImportsService } from './kitchen/menu-imports.js';
import { KitchenPurchasesController, KitchenPurchasesService } from './kitchen/kitchen-purchases.js';
import { kitchenTransitionStep } from './kitchen/kitchen-transition.js';
import { MedicationAccess } from './medicines/medication-access.js';
import { MedicationRequestsController, MedicationRequestsService } from './medicines/medication-requests.js';
import { MedicineCatalogController, MedicineCatalogService } from './medicines/medicine-catalog.js';
import { MedicinePurchasesController, MedicinePurchasesService } from './medicines/medicine-purchases.js';
import { medicinesTransitionStep } from './medicines/medicines-transition.js';
import { AssetsController, AssetsService } from './inventory/assets.js';
import { InventoryAccess } from './inventory/inventory-common.js';
import { inventoryTransitionStep } from './inventory/inventory-transition.js';
import { ActivitiesController, ActivitiesService } from './activities/activities.js';
import { activitiesTransitionStep } from './activities/activities-transition.js';
import { ActivityAccess } from './activities/activity-access.js';
import { CommentsController, CommentsService } from './activities/comments.js';
import {
  ActivityCategoriesController,
  ContentCatalogsService,
  LibraryTopicsController,
  NewsCategoriesController,
} from './activities/content-catalogs.js';
import { ContentFilesController, ContentFilesService } from './activities/content-files.js';
import {
  ColoringPagesController,
  ContentService,
  LibraryAlbumsController,
  LibraryAlbumsService,
  LibraryItemsController,
  NewsController,
} from './activities/content.js';
import { ExtracurricularController, ExtracurricularService } from './activities/extracurricular.js';
import { PurchasingController, PurchasingService } from './inventory/purchasing.js';
import { StockController, StockService } from './inventory/stock.js';
import { ChildProgressController, ChildProgressService } from './teaching/child-progress.js';
import { ClassTeachingController, ClassTeachingService } from './teaching/class-teaching.js';
import { LessonPlansController, LessonPlansService } from './teaching/lesson-plans.js';
import { TeachingAccess } from './teaching/teaching-access.js';
import { TeachingCatalogsController, TeachingCatalogsService } from './teaching/teaching-catalogs.js';
import { teachingTransitionStep } from './teaching/teaching-transition.js';
import { InteractionCommentsController, InteractionCommentsService } from './interactions/comments.js';
import { FeedbacksController, FeedbacksService } from './interactions/feedbacks.js';
import { InteractionAccess } from './interactions/interaction-access.js';
import { interactionsTransitionStep } from './interactions/interactions-transition.js';
import { LostItemsController, LostItemsService } from './interactions/lost-items.js';
import { MessagesController, MessagesService } from './interactions/messages.js';
import { PollsController, PollsService } from './interactions/polls.js';
import { CashflowCategoriesController, CashflowCategoriesService } from './fees/cashflow-categories.js';
import { DiscountTypesController, DiscountTypesService } from './fees/discount-types.js';
import { FeeSchedulesController, FeeSchedulesService } from './fees/fee-schedules.js';
import { ServicesController, ServicesService } from './fees/services.js';
import { RegistrationPeriods } from './fees/registration-periods.js';
import { ServiceRegistrationsController } from './fees/registrations.controller.js';
import { ServiceRegistrationsService } from './fees/registrations.service.js';
import { FeeCalculationService } from './fees/fee-calculation.service.js';
import { InvoicesController } from './fees/invoices.controller.js';
import { DiscountsController } from './fees/discounts.controller.js';
import { DiscountsService } from './fees/discounts.service.js';
import { CatalogAccess } from './catalogs/catalog-access.js';
import { DepartmentsController, DepartmentsService } from './catalogs/departments.js';
import { JobTitlesController, JobTitlesService } from './catalogs/job-titles.js';
import { CatalogItemsController, CatalogItemsService } from './catalogs/catalog-items.js';
import { ApprovalThresholdsController, ApprovalThresholdsService } from './catalogs/approval-thresholds.js';
import { RoomsController, RoomsService } from './catalogs/rooms.js';
import { EmisReportController, EmisReportService } from './facilities/emis-report.js';
import { EquipmentController, EquipmentService } from './facilities/equipment.js';
import { FacilitiesData } from './facilities/facilities-data.js';
import { facilitiesTransitionStep } from './facilities/facilities-transition.js';
import { FacilityRoomsController, FacilityRoomsService } from './facilities/facility-rooms.js';
import { SchoolProfileController, SchoolProfileService } from './facilities/school-profile.js';
import { AccreditationReviewController, AccreditationReviewService } from './facilities/accreditation-review.js';
import { SchoolSplitsController, SchoolSplitsService } from './school-splits/school-splits.js';
import { GradeLevelsController, GradeLevelsService } from './catalogs/grade-levels.js';
import { ClassAssignmentsController, ClassesController } from './classes/classes.controller.js';
import { ClassesService } from './classes/classes.service.js';
import { ChildScope } from './children/child-scope.js';
import { ChildrenController } from './children/children.controller.js';
import { ChildrenService } from './children/children.service.js';
import { ChildDataProtection } from './common/child-data-protection.js';
import { FileStorage, S3FileStorage } from './files/file-storage.js';
import { FilesController, FilesService } from './files/files.js';
import { ImportsController } from './imports/imports.controller.js';
import { ImportsService } from './imports/imports.service.js';
import { MoetImports } from './imports/moet-imports.js';
import { AttendanceController } from './attendance/attendance.controller.js';
import { AttendanceService } from './attendance/attendance.service.js';
import { PickupsController } from './pickups/pickups.controller.js';
import { PickupsService } from './pickups/pickups.service.js';
import { SchoolCalendar } from './attendance/school-calendar.js';
import { CashAccountsController, CashAccountsService } from './finance/cash-accounts.js';
import { ReceiptsController } from './finance/receipts.controller.js';
import { ReceiptsService } from './finance/receipts.service.js';
import { ReceiptReversalsService } from './finance/receipt-reversals.service.js';
import { CashBooksController, CashBooksService } from './finance/cash-books.js';
import { BankReconciliationController, BankReconciliationService } from './finance/bank-reconciliation.js';
import { BankStatementImportsController, BankStatementImportsService } from './finance/bank-statement-imports.js';
import { DebtCollectionController, DebtCollectionService } from './finance/debt-collection.js';
import { FiscalPeriodsController, FiscalPeriodsService } from './finance/fiscal-periods.js';
import { LedgerAccountsController, LedgerAccountsService } from './ledger/ledger-accounts.js';
import { LedgerAccess } from './ledger/ledger-common.js';
import { LedgerEntriesController, LedgerEntriesService } from './ledger/ledger-entries.js';
import { LedgerPostingService } from './ledger/ledger-posting.js';
import { LedgerReportsService } from './ledger/ledger-reports.js';
import { ledgerTransitionStep } from './ledger/ledger-transition.js';
import { PayablesController, PayablesService } from './finance/payables.js';
import { PaymentsController } from './finance/payments.controller.js';
import { PaymentsService } from './finance/payments.service.js';
import { PaymentReversalsService } from './finance/payment-reversals.service.js';
import { OnlinePaymentsController } from './finance/online-payments.controller.js';
import { PaymentWebhooksController } from './finance/payment-webhooks.controller.js';
import { OnlinePaymentsService } from './finance/online-payments.service.js';
import { PaymentGatewayRegistry } from './finance/payment-gateway.js';
import { createPaymentGateway } from './finance/payment-providers.js';
import { DebtsService } from './fees/debts.service.js';
import { ChildLifecycleController, ChildLifecycleService } from './children/child-lifecycle.js';
import { StudentMovementsController, StudentMovementsService } from './children/student-movements.js';
import {
  AdministrativeUnitsController,
  AdministrativeUnitsService,
} from './administrative-units/administrative-units.js';
import { AccountDirectoryController, AccountDirectoryService } from './account-directory/account-directory.js';
import {
  MinistrySyncGateway,
  SyncAccountsController,
  SyncAccountsService,
  UnavailableMinistrySyncGateway,
} from './sync-accounts/sync-accounts.js';
import { WorkSchedulesController, WorkSchedulesService } from './staff-attendance/work-schedules.js';
import { StaffController } from './staff/staff.controller.js';
import { StaffService } from './staff/staff.service.js';
import { StaffBranchesController, StaffBranchesService } from './staff/staff-branches.js';
import {
  IdentityVerificationGateway,
  ManualIdentityVerificationGateway,
  StaffIdentityController,
  StaffIdentityService,
} from './staff/staff-identity.js';
import { StaffMovementsController, StaffMovementsService } from './staff/staff-movements.js';
import { StaffStatisticsController, StaffStatisticsService } from './statistics/staff-statistics.js';
import { staffTransitionStep } from './staff/staff-transition.js';
import { SchoolDaysController, SchoolDaysService } from './staff-attendance/school-days.js';
import { StaffAttendanceController } from './staff-attendance/staff-attendance.controller.js';
import { StaffAttendanceService } from './staff-attendance/staff-attendance.service.js';
import { staffAttendanceTransitionStep } from './staff-attendance/staff-attendance-transition.js';
import { LeaveController } from './staff-attendance/leave.controller.js';
import { LeaveService } from './staff-attendance/leave.service.js';
import { TimesheetsService } from './staff-attendance/timesheets.service.js';
import { PayItemsController, PayItemsService } from './payroll/pay-items.js';
import { PayrollController } from './payroll/payroll.controller.js';
import { PayrollService } from './payroll/payroll.service.js';
import { payrollTransitionStep } from './payroll/payroll-transition.js';
import { PayrollAdjustmentsController, PayrollAdjustmentsService } from './payroll/adjustments.js';
import { SettlementsController } from './payroll/settlements.controller.js';
import { SettlementsService } from './payroll/settlements.service.js';
import { ReportsController } from './reports/reports.controller.js';
import { ReportsService } from './reports/reports.service.js';
import {
  DEFAULT_OPERATIONS_SECTIONS,
  OPERATIONS_SECTION_PROVIDERS,
  OperationsReportController,
  OperationsReportService,
} from './reports/operations-report.js';
import { ConsolidatedReportController, ConsolidatedReportService } from './reports/consolidated-report.js';
import { ReportExportController, ReportExportService } from './reports/report-export.js';
import { AttendanceMealsController, AttendanceMealsService } from './reports/attendance-meals.js';
import { PartnerController, PartnerService } from './partner/partner.js';
import { NotificationsController, NotificationsService } from './notifications/notifications.js';
import { NotificationDispatcher } from './notifications/notification-dispatcher.js';
import { createSmsGateway, SmsGateway } from './notifications/sms-gateway.js';
import { JournalsController, JournalsService } from './journals/journals.js';
import { OrgUnitsController } from './organization/org-units.controller.js';
import { OrgUnitsService } from './organization/org-units.service.js';
import { WorkAccess } from './work/work-access.js';
import { TasksController, TasksService } from './work/tasks.js';
import { PlansController, PlansService } from './work/plans.js';
import { EvaluationsController, EvaluationsService } from './work/evaluations.js';
import { workTransitionStep } from './work/work-transition.js';
import { WorkHistoryController, WorkHistoryService } from './staff/work-history.js';
import { BonusDeductionsController, BonusDeductionsService } from './payroll/bonus-deductions.js';
import { IntegrationsController, IntegrationsService } from './integrations/integrations.js';
import { QuickLinksController, QuickLinksService } from './quick-links/quick-links.js';
import { GridSettingsController, GridSettingsService } from './grid-settings/grid-settings.js';
import { FeedbackController, FeedbackService } from './feedback/feedback.js';
import { ArchivesController } from './archives/archives.controller.js';
import { ArchiveJobs, ArchivesService } from './archives/archives.js';
import { ExportJobs, ExportJobsController } from './exports/export-jobs.js';
import {
  ManualUpperLevelGateway,
  UpperLevelForms,
  UpperLevelGateway,
  UpperLevelSubmissions,
  UpperLevelSubmissionsController,
} from './submissions/upper-level-submissions.js';
import {
  AppLinksController,
  AppLinksService,
  PortalContextController,
  PortalContextService,
  PublicLoginInfoController,
  SystemAnnouncementsController,
  SystemAnnouncementsService,
} from './portal-shell/portal-shell.js';
import { integrationsTransitionStep } from './integrations/integrations-transition.js';
import { FacebookPostsController, FacebookPostsService } from './integrations/facebook-posts.js';
import {
  DevelopmentFacebookPublisher,
  FacebookPublisher,
  GraphApiFacebookPublisher,
  UnavailableFacebookPublisher,
} from './integrations/facebook-publisher.js';
import {
  DevelopmentZaloSender,
  OfficialAccountZaloSender,
  UnavailableZaloSender,
  ZaloSender,
} from './integrations/zalo-sender.js';
import { ZaloTokenStore } from './integrations/zalo-token-store.js';

@Module({})
export class ApplicationModule {
  static register(
    configuration: ApiConfiguration,
    clock: Clock,
    options: {
      additionalControllers?: Type[];
      transitionSteps?: AcademicYearTransitionStep[];
      fileStorage?: FileStorage;
      smsGateway?: SmsGateway;
    } = {},
  ): DynamicModule {
    return {
      module: ApplicationModule,
      controllers: [
        HealthController,
        AcademicYearsController,
        OrgUnitsController,
        SettingsController,
        AuditLogsController,
        DepartmentsController,
        JobTitlesController,
        CatalogItemsController,
        ApprovalThresholdsController,
        RoomsController,
        FacilityRoomsController,
        EquipmentController,
        SchoolProfileController,
        AccreditationReviewController,
        SchoolSplitsController,
        EmisReportController,
        GradeLevelsController,
        ClassesController,
        ClassAssignmentsController,
        ChildrenController,
        ChildLifecycleController,
        StudentMovementsController,
        AdministrativeUnitsController,
        AccountDirectoryController,
        SyncAccountsController,
        WorkSchedulesController,
        HealthRecordsController,
        HealthCareController,
        GrowthController,
        StudentHealthController,
        StatisticsController,
        StudentStatisticsController,
        EmisHealthReportController,
        KitchenCatalogsController,
        KitchenMenusController,
        MenuImportsController,
        KitchenMealsController,
        KitchenPurchasesController,
        MedicineCatalogController,
        MedicationRequestsController,
        MedicinePurchasesController,
        AssetsController,
        StockController,
        PurchasingController,
        TeachingCatalogsController,
        LessonPlansController,
        ClassTeachingController,
        ChildProgressController,
        MessagesController,
        FeedbacksController,
        PollsController,
        CommentsController,
        LostItemsController,
        ActivitiesController,
        ActivityCategoriesController,
        NewsCategoriesController,
        LibraryTopicsController,
        ContentFilesController,
        NewsController,
        LibraryItemsController,
        ColoringPagesController,
        LibraryAlbumsController,
        InteractionCommentsController,
        ExtracurricularController,
        FilesController,
        ImportsController,
        AttendanceController,
        PickupsController,
        ServicesController,
        FeeSchedulesController,
        DiscountTypesController,
        CashflowCategoriesController,
        ServiceRegistrationsController,
        InvoicesController,
        DiscountsController,
        CashAccountsController,
        ReceiptsController,
        PaymentsController,
        OnlinePaymentsController,
        PaymentWebhooksController,
        StaffController,
        StaffBranchesController,
        StaffIdentityController,
        StaffMovementsController,
        StaffStatisticsController,
        SchoolDaysController,
        StaffAttendanceController,
        LeaveController,
        PayItemsController,
        PayrollController,
        PayrollAdjustmentsController,
        SettlementsController,
        ReportsController,
        OperationsReportController,
        ConsolidatedReportController,
        ReportExportController,
        AttendanceMealsController,
        PartnerController,
        NotificationsController,
        JournalsController,
        CashBooksController,
        TasksController,
        PlansController,
        EvaluationsController,
        WorkHistoryController,
        BonusDeductionsController,
        DebtCollectionController,
        BankReconciliationController,
        BankStatementImportsController,
        PayablesController,
        FiscalPeriodsController,
        IntegrationsController,
        QuickLinksController,
        GridSettingsController,
        FeedbackController,
        ArchivesController,
        ExportJobsController,
        UpperLevelSubmissionsController,
        SystemAnnouncementsController,
        AppLinksController,
        PortalContextController,
        PublicLoginInfoController,
        FacebookPostsController,
        RecruitmentRequestsController,
        JobPostingsController,
        PublicRecruitmentController,
        CandidatesController,
        AdmissionCampaignsController,
        AdmissionApplicationsController,
        AdmissionsPublicController,
        LedgerAccountsController,
        LedgerEntriesController,
        ProgramCompletionController,
        ChildGroupsController,
        AccountExportsController,
        ProfessionalStandardsController,
        ...(options.additionalControllers ?? []),
      ],
      providers: [
        { provide: API_CONFIGURATION, useValue: configuration },
        { provide: Clock, useValue: clock },
        Databases,
        IdentityClient,
        { provide: APP_GUARD, useClass: AuthenticationGuard },
        // Các phân hệ thêm bước chuyển năm học vào danh sách này khi được xây dựng (BR-93)
        {
          provide: ACADEMIC_YEAR_TRANSITION_STEPS,
          useValue: [
            orgUnitsTransitionStep,
            settingsTransitionStep,
            catalogsTransitionStep,
            facilitiesTransitionStep,
            staffTransitionStep,
            staffAttendanceTransitionStep,
            payrollTransitionStep,
            feeCatalogsTransitionStep,
            childrenTransitionStep,
            financeTransitionStep,
            ledgerTransitionStep,
            healthTransitionStep,
            kitchenTransitionStep,
            medicinesTransitionStep,
            inventoryTransitionStep,
            teachingTransitionStep,
            interactionsTransitionStep,
            activitiesTransitionStep,
            workTransitionStep,
            integrationsTransitionStep,
            recruitmentTransitionStep,
            admissionsTransitionStep,
            professionalStandardsTransitionStep,
            ...(options.transitionSteps ?? []),
          ],
        },
        AcademicYearsService,
        CurrentSchoolYearResolver,
        OrganizationScopes,
        OrgUnitsService,
        SettingsService,
        DataAccessLogger,
        ClassCapacity,
        CatalogAccess,
        DepartmentsService,
        JobTitlesService,
        CatalogItemsService,
        ApprovalThresholdsService,
        RoomsService,
        FacilitiesData,
        FacilityRoomsService,
        EquipmentService,
        SchoolProfileService,
        AccreditationReviewService,
        SchoolSplitsService,
        EmisReportService,
        GradeLevelsService,
        ClassesService,
        ChildScope,
        ChildrenService,
        ChildLifecycleService,
        StudentMovementsService,
        AdministrativeUnitsService,
        AccountDirectoryService,
        SyncAccountsService,
        // Đồng bộ tài khoản lên CSDL ngành của Bộ, Sở: chưa có giao diện lập trình nên chưa đồng bộ được (DT-16 phần 16d)
        { provide: MinistrySyncGateway, useClass: UnavailableMinistrySyncGateway },
        WorkSchedulesService,
        HealthAccess,
        HealthRecordsService,
        HealthCareService,
        GrowthService,
        StudentHealthService,
        SchoolTerms,
        StatisticsService,
        StudentStatisticsService,
        EmisHealthReportService,
        KitchenAccess,
        KitchenCatalogsService,
        KitchenMealsService,
        KitchenMenusService,
        MenuImportsService,
        KitchenPurchasesService,
        MedicationAccess,
        MedicineCatalogService,
        MedicationRequestsService,
        MedicinePurchasesService,
        InventoryAccess,
        AssetsService,
        StockService,
        PurchasingService,
        TeachingAccess,
        TeachingCatalogsService,
        LessonPlansService,
        ClassTeachingService,
        ChildProgressService,
        InteractionAccess,
        MessagesService,
        FeedbacksService,
        PollsService,
        CommentsService,
        LostItemsService,
        ActivityAccess,
        ActivitiesService,
        ContentCatalogsService,
        ContentFilesService,
        ContentService,
        LibraryAlbumsService,
        InteractionCommentsService,
        ExtracurricularService,
        ChildDataProtection,
        FilesService,
        ImportsService,
        MoetImports,
        AttendanceService,
        PickupsService,
        ServicesService,
        FeeSchedulesService,
        DiscountTypesService,
        CashflowCategoriesService,
        RegistrationPeriods,
        ServiceRegistrationsService,
        FeeCalculationService,
        DiscountsService,
        CashAccountsService,
        ReceiptsService,
        ReceiptReversalsService,
        PaymentsService,
        PaymentReversalsService,
        OnlinePaymentsService,
        StaffService,
        StaffBranchesService,
        StaffIdentityService,
        { provide: IdentityVerificationGateway, useClass: ManualIdentityVerificationGateway },
        StaffMovementsService,
        StaffStatisticsService,
        SchoolDaysService,
        StaffAttendanceService,
        LeaveService,
        TimesheetsService,
        PayItemsService,
        PayrollService,
        PayrollAdjustmentsService,
        SettlementsService,
        ReportsService,
        // Các phân hệ hoạt động (P14), công việc (P09) thêm nguồn số liệu của báo cáo hoạt động vào danh sách này (YCTD-83)
        { provide: OPERATIONS_SECTION_PROVIDERS, useValue: [...DEFAULT_OPERATIONS_SECTIONS] },
        OperationsReportService,
        ConsolidatedReportService,
        ReportExportService,
        AttendanceMealsService,
        PartnerService,
        NotificationsService,
        NotificationDispatcher,
        // Gửi tin nhắn thông báo: eSMS.vn khi SMS_PROVIDER=esms, còn lại ghi nhật ký (YCTD-92)
        { provide: SmsGateway, useFactory: () => options.smsGateway ?? createSmsGateway(configuration.smsProvider) },
        // Kết nối Fanpage và Zalo: bộ giả lập khi phát triển, kết nối thật khi có khóa ở biến môi trường (YCTD-90)
        {
          provide: FacebookPublisher,
          useFactory: () =>
            configuration.facebookPublisher === 'development'
              ? new DevelopmentFacebookPublisher()
              : configuration.facebookPageAccessToken
                ? new GraphApiFacebookPublisher(
                    configuration.facebookPageAccessToken,
                    configuration.facebookGraphVersion,
                  )
                : new UnavailableFacebookPublisher(),
        },
        // Kho khóa Zalo ở cơ sở dữ liệu hệ thống, mã hóa bằng khóa mã hóa dữ liệu của máy chủ (YCTD-92)
        {
          provide: ZaloTokenStore,
          inject: [Databases],
          useFactory: (databases: Databases) =>
            new ZaloTokenStore(databases.system, configuration.childDataEncryptionKey, {
              appId: configuration.zaloAppId ?? null,
              appSecret: configuration.zaloAppSecret ?? null,
              seedRefreshToken: configuration.zaloOaRefreshToken ?? null,
              seedAccessToken: configuration.zaloOaAccessToken ?? null,
            }),
        },
        {
          provide: ZaloSender,
          inject: [ZaloTokenStore],
          useFactory: (tokens: ZaloTokenStore) =>
            configuration.zaloSender === 'development'
              ? new DevelopmentZaloSender()
              : configuration.zaloSender === 'zalo_oa'
                ? new OfficialAccountZaloSender(tokens)
                : new UnavailableZaloSender(),
        },
        IntegrationsService,
        QuickLinksService,
        GridSettingsService,
        FeedbackService,
        ArchivesService,
        ArchiveJobs,
        ExportJobs,
        UpperLevelForms,
        UpperLevelSubmissions,
        // Chưa có kết nối với hệ thống của Bộ, Sở: gửi lên cấp trên làm thủ công (DT-16 phần 16a)
        { provide: UpperLevelGateway, useClass: ManualUpperLevelGateway },
        SystemAnnouncementsService,
        AppLinksService,
        PortalContextService,
        FacebookPostsService,
        JournalsService,
        {
          provide: PaymentGatewayRegistry,
          useFactory: () =>
            new PaymentGatewayRegistry(
              (configuration.paymentGateways ?? []).map((code) =>
                createPaymentGateway(code, configuration.paymentProviders),
              ),
            ),
        },
        CashBooksService,
        WorkAccess,
        ProgramCompletionService,
        ChildGroupsService,
        AccountExportsService,
        ProfessionalStandardsService,
        ProfessionalRatingImports,
        TasksService,
        PlansService,
        EvaluationsService,
        WorkHistoryService,
        BonusDeductionsService,
        DebtsService,
        DebtCollectionService,
        BankReconciliationService,
        BankStatementImportsService,
        PayablesService,
        FiscalPeriodsService,
        RecruitmentAccess,
        LedgerAccess,
        LedgerAccountsService,
        LedgerPostingService,
        LedgerReportsService,
        LedgerEntriesService,
        AdmissionAccess,
        AdmissionCampaignsService,
        AdmissionApplicationsService,
        AdmissionsPublicService,
        AdmissionsRateLimiter,
        PublicRateLimiter,
        RecruitmentRequestsService,
        JobPostingsService,
        PublicRecruitmentService,
        CandidatesService,
        SchoolCalendar,
        {
          provide: FileStorage,
          useFactory: () => {
            if (options.fileStorage) {
              return options.fileStorage;
            }
            if (!configuration.objectStorage) {
              throw new Error('Thiếu cấu hình kho tệp');
            }
            return new S3FileStorage(configuration.objectStorage);
          },
        },
      ],
    };
  }
}
