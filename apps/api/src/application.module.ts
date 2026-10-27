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
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PlanStorageGuard, SchoolPlanController, SchoolPlanService } from './school-plan/school-plan.js';
import {
  BillingCycleJob,
  PlatformBillingWebhooksController,
  PlatformPaymentGateways,
  SchoolBillingController,
  SchoolBillingService,
} from './billing/billing.js';
import {
  PlatformNoticesController,
  SchoolMetricsService,
  SupportAccessController,
  SupportAccessService,
  SupportSessionInterceptor,
} from './platform-dashboard/platform-dashboard.js';
import {
  AggregateSnapshotService,
  ParentOrgDataController,
  ParentOrgDataService,
  SchoolParentOrgController,
  SchoolParentOrgService,
} from './parent-org/parent-org.js';
import { Clock, currentTenant } from '@school-management/server';
import {
  ACADEMIC_YEAR_TRANSITION_STEPS,
  type AcademicYearTransitionStep,
} from './academic-years/academic-year-transition.js';
import { AcademicYearsController } from './academic-years/academic-years.controller.js';
import { AcademicYearsService } from './academic-years/academic-years.service.js';
import { AuthenticationGuard } from './authentication/authentication.guard.js';
import { IdentityClient } from './authentication/identity-client.js';
import type { TenancyRuntime } from '@school-management/database';
import { API_CONFIGURATION, TENANCY_RUNTIME, type ApiConfiguration } from './common/configuration.js';
import { CurrentSchoolYearResolver } from './common/current-school-year.js';
import { SchoolLevelResolver } from './common/school-levels.js';
import { SchoolLevelsController, SchoolLevelsService } from './school-levels/school-levels.js';
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
import { BoardingController, BoardingService } from './boarding/boarding.js';
import { ConductController, ConductService } from './conduct/conduct.js';
import { conductTransitionStep } from './conduct/conduct-transition.js';
import { LibraryCatalogController, LibraryCatalogService } from './library/library-catalog.js';
import { LibraryCirculationController, LibraryCirculationService } from './library/library-circulation.js';
import { LibraryCore } from './library/library-core.js';
import { LibraryReportsController, LibraryReportsService } from './library/library-reports.js';
import { libraryTransitionStep } from './library/library-transition.js';
import { AssessmentConfigController, AssessmentConfigService } from './assessments/assessment-config.js';
import { AssessmentsController, AssessmentsService } from './assessments/assessments.js';
import {
  LearningRecordsController,
  LearningRecordsService,
  StudentAwardVerificationController,
} from './learning-records/learning-records.js';
import { PrimaryEmisController, PrimaryEmisService } from './primary-reports/primary-emis.js';
import { PrimaryReportsController, PrimaryReportsService } from './primary-reports/primary-reports.js';
import { SecondaryReportsController, SecondaryReportsService } from './secondary-reports/secondary-reports.js';
import { learningRecordsTransitionStep } from './learning-records/learning-records-transition.js';
import { assessmentTransitionStep } from './assessments/assessment-transition.js';
import { KitchenMenusController, KitchenMenusService } from './kitchen/kitchen-menus.js';
import { MenuImportsController, MenuImportsService } from './kitchen/menu-imports.js';
import { KitchenPurchasesController, KitchenPurchasesService } from './kitchen/kitchen-purchases.js';
import { FoodInspectionsController, FoodInspectionsService } from './kitchen/food-inspections.js';
import { FoodSafetyRecordsController, FoodSafetyRecordsService } from './kitchen/food-safety-records.js';
import { FoodSafetyTraceController, FoodSafetyTraceService } from './kitchen/food-safety-trace.js';
import { FoodSamplesController, FoodSamplesService } from './kitchen/food-samples.js';
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
  NewsRecipientsController,
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
import { EmisForms, EmisFormsController } from './emis/emis-forms.js';
import { EmisSending, EmisSendingController } from './emis/emis-sending.js';
import { EquipmentController, EquipmentService } from './facilities/equipment.js';
import { EquipmentLocationsController, EquipmentLocationsService } from './facilities/equipment-locations.js';
import { EquipmentMinimumController, EquipmentMinimumService } from './facilities/equipment-minimum.js';
import { EquipmentStocktakesController, EquipmentStocktakesService } from './facilities/equipment-stocktakes.js';
import { FacilitiesData } from './facilities/facilities-data.js';
import { facilitiesTransitionStep } from './facilities/facilities-transition.js';
import { FacilityRoomsController, FacilityRoomsService } from './facilities/facility-rooms.js';
import { FacilityReportController, FacilityReportService } from './facilities/facility-report.js';
import { FacilityInvestmentsController, FacilityInvestmentsService } from './facilities/facility-investments.js';
import { FacilityImportsController, FacilityImportsService } from './facilities/facility-imports.js';
import { EquipmentSubmissionForm } from './facilities/equipment-submission.js';
import { SchoolProfileController, SchoolProfileService } from './facilities/school-profile.js';
import { AccreditationReviewController, AccreditationReviewService } from './facilities/accreditation-review.js';
import { SchoolSplitsController, SchoolSplitsService } from './school-splits/school-splits.js';
import { SigningController } from './signing/signing.controller.js';
import { SigningService } from './signing/signing.js';
import { DossierSigner, InternalDossierSigner } from './signing/dossier-signer.js';
import { DossierXmlWriter, InternalDossierXmlWriter } from './signing/dossier-xml.js';
import { FinalYearRecordsService } from './entry-admissions/final-year-records.js';
import { EntryIntakeController } from './entry-admissions/entry-intake.controller.js';
import { EntryIntakeNoticesService } from './entry-admissions/entry-intake-notices.js';
import { EntryIntakeTransferService } from './entry-admissions/entry-intake-transfer.js';
import { EntryIntakeService } from './entry-admissions/entry-intake.js';
import { DocumentAdminController, DocumentAdminService } from './incoming-documents/document-admin.js';
import { DocumentExchange, LocalDocumentExchange } from './incoming-documents/document-exchange.js';
import { IncomingDocumentsController } from './incoming-documents/incoming-documents.controller.js';
import { IncomingDocumentsService } from './incoming-documents/incoming-documents.js';
import { IncomingPrintService } from './incoming-documents/incoming-print.js';
import {
  OutgoingDocumentsController,
  OutgoingVerificationController,
} from './outgoing-documents/outgoing-documents.controller.js';
import { OutgoingDocumentsService } from './outgoing-documents/outgoing-documents.js';
import { OutgoingPrintService } from './outgoing-documents/outgoing-print.js';
import { KpiCatalogController, KpiCatalogService } from './kpi/kpi-catalog.js';
import { KpiEvaluationsController, KpiEvaluationsService } from './kpi/kpi-evaluations.js';
import { KpiLegacyImportController, KpiLegacyImportService } from './kpi/kpi-legacy.js';
import { KpiReportsController, KpiReportsService } from './kpi/kpi-reports.js';
import { KpiSetupController, KpiSetupService } from './kpi/kpi-setup.js';
import { KpiSupport } from './kpi/kpi-support.js';
import { KpiTasksController, KpiTasksService } from './kpi/kpi-tasks.js';
import { WebsiteContentController, WebsiteContentService } from './website/website-content.js';
import {
  WebsiteDomainCheckController,
  WebsitePublicController,
  WebsitePublicService,
} from './website/website-public.js';
import { WebsiteSetupController, WebsiteSetupService } from './website/website-setup.js';
import { ProfessionalRecordsController } from './professional-records/professional-records.controller.js';
import { ProfessionalRecordsService } from './professional-records/professional-records.js';
import { professionalRecordsTransitionStep } from './professional-records/professional-records-transition.js';
import { EducationPlansController } from './education-plans/education-plans.controller.js';
import { EducationPlansService } from './education-plans/education-plans.js';
import { educationPlansTransitionStep } from './education-plans/education-plans-transition.js';
import { EmulationController, EmulationVerificationController } from './emulation/emulation.controller.js';
import { EmulationCouncilService } from './emulation/emulation-council.js';
import { TrainingController, TrainingVerificationController } from './training/training.controller.js';
import { TrainingService } from './training/training.js';
import { LearningResourcesController } from './learning-resources/learning-resources.controller.js';
import { LearningResourcesService } from './learning-resources/learning-resources.js';
import { ResourceSharingController } from './learning-resources/resource-sharing.controller.js';
import { ResourceSharingService } from './learning-resources/resource-sharing.js';
import { EmulationService } from './emulation/emulation.js';
import { emulationTransitionStep } from './emulation/emulation-transition.js';
import { QualityAssuranceController } from './quality-assurance/quality-assurance.controller.js';
import { QualityAssuranceService } from './quality-assurance/quality-assurance.js';
import { qualityAssuranceTransitionStep } from './quality-assurance/quality-assurance-transition.js';
import { MY_WORK_SOURCE_TYPES, type MyWorkSource } from './my-work/my-work-sources.js';
import { MY_WORK_SOURCES, MyWorkController, MyWorkService } from './my-work/my-work.js';
import {
  FinalYearCompletionController,
  FinalYearRecordsController,
  FinalYearStatisticsController,
  ParentFinalYearController,
} from './entry-admissions/final-year.controller.js';
import {
  AdmissionSupportMailer,
  EntryAdmissionCatalogsController,
  EntryAdmissionCatalogsService,
  UnconfiguredAdmissionSupportMailer,
} from './entry-admissions/entry-admission-catalogs.js';
import { GradeLevelsController, GradeLevelsService } from './catalogs/grade-levels.js';
import { CurriculaController, CurriculaService } from './catalogs/curricula.js';
import { GraduationController, GraduationService } from './graduation/graduation.js';
import { ScoresController, ScoresService } from './scores/scores.js';
import {
  ChildCombinationsController,
  ChildCombinationsService,
  CombinationsController,
  CombinationsService,
  SubjectTeamsController,
  SubjectTeamsService,
} from './subjects/secondary.js';
import {
  CurriculumSubjectsController,
  ElectiveSubjectsController,
  ElectiveSubjectsService,
  SubjectsController,
  SubjectsService,
  TeachingAssignmentsController,
  TeachingAssignmentsService,
} from './subjects/subjects.js';
import {
  ChildTimetableController,
  PeriodSlotsController,
  TimetablesController,
  TimetablesService,
  TimetableVersionsController,
} from './timetables/timetables.js';
import { ExamsService } from './exams/exams.js';
import { ExamGradingController } from './exam-grading/exam-grading.controller.js';
import { ExamGradingService } from './exam-grading/exam-grading.js';
import {
  AssessmentPlansController,
  ExamMatricesController,
  ExamsController,
  QuestionsController,
  QuestionTopicsController,
} from './exams/exams.controller.js';
import {
  ChildPeriodAttendanceController,
  ClassLogsController,
  ClassLogsService,
  PeriodAttendanceController,
} from './class-logs/class-logs.js';
import { SeatingController, SeatingService } from './seating/seating.js';
import {
  createGenerationQueue,
  TimetableGenerationJobs,
  TimetableGenerationQueue,
  TimetableGenerationsController,
  TimetableGeneratorController,
  TimetableGeneratorService,
} from './timetables/timetable-generator.js';
import {
  TimetableChangesController,
  TimetableChangesService,
  TimetableLookupCodesController,
  TimetableLookupController,
  TimetableReportsController,
} from './timetables/timetable-changes.js';
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
import { StudentImports } from './imports/student-imports.js';
import { LearningAccountsController, LearningAccountsService } from './student-records/learning-accounts.js';
import { NationalIdsController, NationalIdsService } from './student-records/national-ids.js';
import { StudentImportToolsController, StudentImportToolsService } from './student-records/student-import-tools.js';
import { StudentRecordsController, StudentRecordsService } from './student-records/student-records.js';
import { StudentTransfersController, StudentTransfersService } from './student-records/student-transfers.js';
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
import { PublicPushController, PushController, PushSubscriptions } from './notifications/push/push-subscriptions.js';
import { createPushSender, PUSH_SENDER } from './notifications/push/push-sender.js';
import { SmsGateway } from './notifications/sms-gateway.js';
import { JournalsController, JournalsService } from './journals/journals.js';
import { OrgUnitsController } from './organization/org-units.controller.js';
import { OrgUnitsService } from './organization/org-units.service.js';
import { WorkAccess } from './work/work-access.js';
import { TasksController, TasksService } from './work/tasks.js';
import { DirectiveJobs, DirectivesController, DirectivesService } from './work/directives.js';
import { UnitSchedulesController } from './unit-schedules/unit-schedules.controller.js';
import { UnitSchedulesService } from './unit-schedules/unit-schedules.js';
import { WorkFilesController } from './work-files/work-files.controller.js';
import { WorkFilesService } from './work-files/work-files.js';
import { DocumentReportsController, DocumentReportsService } from './document-reports/document-reports.js';
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
import { InternalJobsController, JobScheduler } from './common/job-scheduler.js';
import { SchoolPickerController } from './common/school-picker.js';
import {
  PublicBrandingController,
  SchoolSettingsController,
  SchoolSettingsService,
} from './school-settings/school-settings.controller.js';
import { PublicPwaController } from './school-settings/pwa-manifest.js';
import { SchoolSettings } from './school-settings/school-settings.js';
import {
  TenantFacebookPublisher,
  TenantFileStorage,
  TenantPaymentGatewayRegistry,
  TenantSmsGateway,
  TenantZaloSender,
  zaloTokenOptions,
} from './school-settings/tenant-connectors.js';
import { ExportJobs, ExportJobsController } from './exports/export-jobs.js';
// Quản trị và trình diễn (DT-18 phần 18h)
import { ImpersonationActionsController, ImpersonationInterceptor } from './impersonation/impersonation.js';
import { SchoolDataExportController, SchoolDataExportService } from './school-data-export/school-data-export.js';
import {
  DemoAwareFacebookPublisher,
  DemoAwareSmsGateway,
  DemoAwareZaloSender,
  DemoController,
  DemoMode,
} from './demo/demo-mode.js';
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
import { FacebookPublisher } from './integrations/facebook-publisher.js';
import { ZaloSender } from './integrations/zalo-sender.js';
import { ZaloTokenStore } from './integrations/zalo-token-store.js';
// Thi trực tuyến cho học sinh (DT-23 phần 23a)
import { AttemptEngine } from './online-exams/attempt-engine.js';
import { ExamRateLimiter } from './online-exams/exam-rate-limit.js';
import { ExamProctoringJobs, ExamProctoringService } from './online-exams/exam-proctoring.js';
import {
  ExamProctoringController,
  ParentProctorConsentsController,
  StudentProctoringController,
} from './online-exams/exam-proctoring.controller.js';
import { OnlineExamsController } from './online-exams/online-exams.controller.js';
import { OnlineExamsService } from './online-exams/online-exams.js';
import { StudentExamsController } from './online-exams/student-exams.controller.js';
import { StudentExamsService } from './online-exams/student-exams.js';
import { ChildTutoringController, TutoringController } from './tutoring/tutoring.controller.js';
import { TutoringService } from './tutoring/tutoring.js';
import { TutoringFinanceController } from './tutoring/tutoring-finance.controller.js';
import { TutoringFinanceService } from './tutoring/tutoring-finance.js';
import { createVideoProvider, VIDEO_PROVIDER } from './video/video-provider.js';
import {
  ChildVideoController,
  StudentVideoController,
  VideoController,
  VideoJobs,
  VideoRecordingStreamController,
  VideoWebhookController,
} from './video/video.controller.js';
import { VideoRoomsService } from './video/video-rooms.js';
import { AiAssistantController, AiUsageJob } from './ai-assistant/ai-assistant.controller.js';
import { AI_PROVIDERS, AiAssistantService } from './ai-assistant/ai-assistant.js';
import { AiProviderRegistry } from './ai-assistant/ai-provider.js';
import { ClassroomToolsController, ClassroomToolsService } from './classroom-tools/classroom-tools.js';
import { ClassroomGamesController, ClassroomGamesService } from './classroom-games/classroom-games.js';
import { GroupSetsController, GroupSetsReader, GroupSetsService } from './child-groups/group-sets.js';
import { LearningController } from './learning/learning.controller.js';
import { StudentLearningController } from './learning/student-learning.controller.js';
import { LearningService } from './learning/learning.js';
import { AssignmentsController } from './learning/assignments/assignments.controller.js';
import { AssignmentsService } from './learning/assignments/assignments.js';
import { StudentAssignmentsController } from './learning/assignments/student-assignments.controller.js';
import { LearningProgressController } from './learning/progress/progress.controller.js';
import { LearningProgressService } from './learning/progress/progress.js';
import { HomeworkController } from './learning/homework/homework.controller.js';
import { HomeworkPolicyGate } from './learning/homework/homework-policy.js';
import { HomeworkService } from './learning/homework/homework.js';

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
      // Lệnh tạo dữ liệu trình diễn chạy máy chủ API trong tiến trình, đọc tài khoản thẳng từ cơ sở dữ liệu định danh
      identityClient?: IdentityClient;
      tenancy?: TenancyRuntime | null;
    } = {},
  ): DynamicModule {
    return {
      module: ApplicationModule,
      controllers: [
        SchoolPlanController,
        SchoolBillingController,
        PlatformBillingWebhooksController,
        PlatformNoticesController,
        SupportAccessController,
        // Đơn vị cấp trên (DT-SaaS phần S6)
        SchoolParentOrgController,
        ParentOrgDataController,
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
        FacilityReportController,
        FacilityInvestmentsController,
        FacilityImportsController,
        SigningController,
        FinalYearRecordsController,
        FinalYearCompletionController,
        FinalYearStatisticsController,
        ParentFinalYearController,
        EntryAdmissionCatalogsController,
        EntryIntakeController,
        DocumentAdminController,
        IncomingDocumentsController,
        OutgoingDocumentsController,
        OutgoingVerificationController,
        // Phân hệ KPI (DT-18 phần 18d)
        KpiSetupController,
        KpiCatalogController,
        KpiTasksController,
        KpiEvaluationsController,
        KpiReportsController,
        KpiLegacyImportController,
        WebsiteSetupController,
        ImpersonationActionsController,
        SchoolDataExportController,
        DemoController,
        WebsiteContentController,
        WebsitePublicController,
        WebsiteDomainCheckController,
        InternalJobsController,
        SchoolPickerController,
        SchoolSettingsController,
        PublicBrandingController,
        // Manifest, biểu tượng của ứng dụng web cài được theo trường (DT-26 phần 26a)
        PublicPwaController,
        // Hồ sơ chuyên môn và Việc của tôi (DT-18 phần 18e)
        ProfessionalRecordsController,
        EducationPlansController,
        // Thi đua, khen thưởng (DT-18 phần 22d)
        EmulationController,
        EmulationVerificationController,
        TrainingController,
        TrainingVerificationController,
        LearningResourcesController,
        ResourceSharingController,
        // Bảo đảm chất lượng, tự đánh giá (DT-18 phần 22f)
        QualityAssuranceController,
        LibraryCatalogController,
        LibraryCirculationController,
        LibraryReportsController,
        MyWorkController,
        // Cấp học của trường (DT-19 phần 19a)
        SchoolLevelsController,
        EquipmentController,
        EquipmentLocationsController,
        EquipmentStocktakesController,
        EquipmentMinimumController,
        SchoolProfileController,
        AccreditationReviewController,
        SchoolSplitsController,
        EmisReportController,
        EmisFormsController,
        PrimaryReportsController,
        PrimaryEmisController,
        // Báo cáo, thống kê THCS, THPT (DT-21 phần 21g)
        SecondaryReportsController,
        EmisSendingController,
        GradeLevelsController,
        CurriculaController,
        SubjectsController,
        CurriculumSubjectsController,
        ElectiveSubjectsController,
        TeachingAssignmentsController,
        CombinationsController,
        ChildCombinationsController,
        SubjectTeamsController,
        ScoresController,
        GraduationController,
        PeriodSlotsController,
        TimetableVersionsController,
        TimetablesController,
        ChildTimetableController,
        // Kiểm tra, đánh giá phần đề (DT-21 phần 22g1)
        QuestionTopicsController,
        QuestionsController,
        ExamMatricesController,
        AssessmentPlansController,
        ExamsController,
        ExamGradingController,
        ClassLogsController,
        PeriodAttendanceController,
        ChildPeriodAttendanceController,
        // Sơ đồ chỗ ngồi (DT-21 phần 21d)
        SeatingController,
        // Máy xếp thời khoá biểu, dạy thay, đổi tiết, báo cáo, mã tra cứu (DT-20 phần 22c2)
        TimetableGeneratorController,
        TimetableGenerationsController,
        TimetableChangesController,
        TimetableReportsController,
        TimetableLookupCodesController,
        TimetableLookupController,
        ClassesController,
        ClassAssignmentsController,
        ChildrenController,
        // Hồ sơ học sinh đủ theo Sở (DT-16 phần 16g)
        StudentRecordsController,
        NationalIdsController,
        LearningAccountsController,
        StudentTransfersController,
        StudentImportToolsController,
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
        BoardingController,
        ConductController,
        AssessmentConfigController,
        AssessmentsController,
        LearningRecordsController,
        StudentAwardVerificationController,
        KitchenPurchasesController,
        // Bán trú: kiểm thực ba bước và an toàn thực phẩm (DT-18 phần 22b)
        FoodSafetyRecordsController,
        FoodInspectionsController,
        FoodSamplesController,
        FoodSafetyTraceController,
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
        NewsRecipientsController,
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
        DirectivesController,
        UnitSchedulesController,
        WorkFilesController,
        DocumentReportsController,
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
        // Trợ lý AI (DT-23 phần 23d)
        AiAssistantController,
        ClassroomToolsController,
        // Lõi hệ thống quản lý học tập (DT-28 phần 28b)
        LearningController,
        // Thông báo đẩy Web Push (DT-26 phần 26b)
        PushController,
        PublicPushController,
        // Mô hình nhóm dùng chung (DT-28 phần 28a)
        GroupSetsController,
        ...(options.additionalControllers ?? []),
        // Thi trực tuyến cho học sinh (DT-23 phần 23a)
        OnlineExamsController,
        StudentExamsController,
        // Trò chơi kiến thức và thẻ đáp án giấy (DT-23 phần 23c)
        ClassroomGamesController,
        ExamProctoringController,
        StudentProctoringController,
        ParentProctorConsentsController,
        // Học sinh tự học ở lớp học trực tuyến (DT-28 phần 28b)
        StudentLearningController,
        // Gia sư trong trường (DT-27 phần 27b)
        TutoringController,
        ChildTutoringController,
        // Thu chi gia sư trong trường (DT-27 phần 27c)
        TutoringFinanceController,
        // Bài tập trực tuyến (DT-28 phần 28c)
        AssignmentsController,
        StudentAssignmentsController,
        // Lớp video trực tiếp (DT-27 phần 27a)
        VideoController,
        VideoRecordingStreamController,
        ChildVideoController,
        StudentVideoController,
        VideoWebhookController,
        // Tiến độ, bảng điểm hoạt động, sổ điểm, báo cáo (DT-28 phần 28d)
        LearningProgressController,
        // Bài về nhà và phụ huynh (DT-28 phần 28f)
        HomeworkController,
      ],
      providers: [
        { provide: API_CONFIGURATION, useValue: configuration },
        { provide: TENANCY_RUNTIME, useValue: options.tenancy ?? null },
        { provide: Clock, useValue: clock },
        Databases,
        options.identityClient ? { provide: IdentityClient, useValue: options.identityClient } : IdentityClient,
        { provide: APP_GUARD, useClass: AuthenticationGuard },
        // Gói dịch vụ (DT-SaaS phần S5a): chặn tải tệp khi hết dung lượng của gói
        { provide: APP_GUARD, useClass: PlanStorageGuard },
        SchoolPlanService,
        PlatformPaymentGateways,
        SchoolBillingService,
        BillingCycleJob,
        // Bảng điều khiển nền tảng (DT-SaaS phần S4): thu số liệu, cho phép hỗ trợ, ghi và chặn thao tác của phiên hỗ trợ
        SchoolMetricsService,
        SupportAccessService,
        AggregateSnapshotService,
        SchoolParentOrgService,
        ParentOrgDataService,
        { provide: APP_INTERCEPTOR, useClass: SupportSessionInterceptor },
        // Ghi thao tác, chặn kí số trong lúc đăng nhập thay (DT-18 phần 18h)
        { provide: APP_INTERCEPTOR, useClass: ImpersonationInterceptor },
        DemoMode,
        SchoolDataExportService,
        // Các phân hệ thêm bước chuyển năm học vào danh sách này khi được xây dựng (BR-93)
        {
          provide: ACADEMIC_YEAR_TRANSITION_STEPS,
          useValue: [
            orgUnitsTransitionStep,
            settingsTransitionStep,
            conductTransitionStep,
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
            professionalRecordsTransitionStep,
            educationPlansTransitionStep,
            emulationTransitionStep,
            qualityAssuranceTransitionStep,
            assessmentTransitionStep,
            libraryTransitionStep,
            learningRecordsTransitionStep,
            ...(options.transitionSteps ?? []),
          ],
        },
        AcademicYearsService,
        CurrentSchoolYearResolver,
        SchoolLevelResolver,
        SchoolLevelsService,
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
        FacilityReportService,
        FacilityInvestmentsService,
        FacilityImportsService,
        EquipmentSubmissionForm,
        EquipmentService,
        EquipmentLocationsService,
        EquipmentStocktakesService,
        EquipmentMinimumService,
        SchoolProfileService,
        AccreditationReviewService,
        SchoolSplitsService,
        EmisReportService,
        EmisForms,
        PrimaryReportsService,
        SecondaryReportsService,
        PrimaryEmisService,
        EmisSending,
        GradeLevelsService,
        CurriculaService,
        SubjectsService,
        ElectiveSubjectsService,
        TeachingAssignmentsService,
        CombinationsService,
        ChildCombinationsService,
        SubjectTeamsService,
        ScoresService,
        GraduationService,
        TimetablesService,
        ExamsService,
        ExamGradingService,
        ClassLogsService,
        SeatingService,
        TimetableGeneratorService,
        TimetableChangesService,
        TimetableGenerationJobs,
        {
          provide: TimetableGenerationQueue,
          inject: [API_CONFIGURATION],
          useFactory: (settings: ApiConfiguration) => createGenerationQueue(settings),
        },
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
        BoardingService,
        ConductService,
        AssessmentConfigService,
        AssessmentsService,
        LearningRecordsService,
        KitchenMenusService,
        MenuImportsService,
        KitchenPurchasesService,
        FoodSafetyRecordsService,
        FoodInspectionsService,
        FoodSamplesService,
        FoodSafetyTraceService,
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
        StudentImports,
        StudentRecordsService,
        NationalIdsService,
        LearningAccountsService,
        StudentTransfersService,
        StudentImportToolsService,
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
        // Bản trình diễn không gửi tin thật (DT-18 phần 18h)
        {
          provide: SmsGateway,
          inject: [DemoMode, SchoolSettings],
          useFactory: (demoMode: DemoMode, settings: SchoolSettings) =>
            new DemoAwareSmsGateway(options.smsGateway ?? new TenantSmsGateway(settings, configuration), demoMode),
        },
        // Kết nối Fanpage và Zalo: bộ giả lập khi phát triển, kết nối thật khi có khóa ở biến môi trường (YCTD-90)
        {
          provide: FacebookPublisher,
          inject: [DemoMode, SchoolSettings],
          useFactory: (demoMode: DemoMode, settings: SchoolSettings) =>
            new DemoAwareFacebookPublisher(new TenantFacebookPublisher(settings, configuration), demoMode),
        },
        // Kho khóa Zalo ở cơ sở dữ liệu hệ thống, mã hóa bằng khóa mã hóa dữ liệu của máy chủ (YCTD-92)
        {
          provide: ZaloTokenStore,
          inject: [Databases, SchoolSettings],
          useFactory: (databases: Databases, settings: SchoolSettings) =>
            // Đọc lại theo từng lần dùng để ở chế độ nhiều trường lấy đúng cơ sở dữ liệu, khóa và cấu hình Zalo của trường trong ngữ cảnh
            new ZaloTokenStore(
              () => databases.system,
              () => configuration.childDataEncryptionKey,
              zaloTokenOptions(settings, configuration),
            ),
        },
        {
          provide: ZaloSender,
          inject: [ZaloTokenStore, DemoMode, SchoolSettings],
          useFactory: (tokens: ZaloTokenStore, demoMode: DemoMode, settings: SchoolSettings) =>
            new DemoAwareZaloSender(new TenantZaloSender(settings, configuration, tokens), demoMode),
        },
        IntegrationsService,
        QuickLinksService,
        GridSettingsService,
        FeedbackService,
        ArchivesService,
        JobScheduler,
        ArchiveJobs,
        ExportJobs,
        UpperLevelForms,
        UpperLevelSubmissions,
        // Chưa có kết nối với hệ thống của Bộ, Sở: gửi lên cấp trên làm thủ công (DT-16 phần 16a)
        { provide: UpperLevelGateway, useClass: ManualUpperLevelGateway },
        SigningService,
        // Chưa có nhà cung cấp kí số: hồ sơ kí xác nhận nội bộ (DT-16 phần 16k)
        { provide: DossierSigner, useClass: InternalDossierSigner },
        { provide: DossierXmlWriter, useClass: InternalDossierXmlWriter },
        FinalYearRecordsService,
        EntryAdmissionCatalogsService,
        EntryIntakeService,
        EntryIntakeNoticesService,
        EntryIntakeTransferService,
        // Văn bản đến theo VNPT iOffice (DT-18 phần 18a); chưa kết nối trục liên thông văn bản: bản chạy nội bộ
        DocumentAdminService,
        IncomingDocumentsService,
        IncomingPrintService,
        { provide: DocumentExchange, useClass: LocalDocumentExchange },
        // Văn bản đi theo VNPT iOffice (DT-18 phần 18b); ký nội bộ qua DossierSigner của Quản lý kí hồ sơ
        OutgoingDocumentsService,
        OutgoingPrintService,
        KpiSupport,
        KpiSetupService,
        KpiCatalogService,
        KpiTasksService,
        KpiEvaluationsService,
        KpiReportsService,
        KpiLegacyImportService,
        WebsiteSetupService,
        WebsiteContentService,
        WebsitePublicService,
        // Hồ sơ chuyên môn và Việc của tôi (DT-18 phần 18e): mỗi phân hệ một nguồn việc qua giao diện MyWorkSource
        ProfessionalRecordsService,
        // Kế hoạch giáo dục (DT-18 phần 22i)
        EducationPlansService,
        // Thi đua, khen thưởng (DT-18 phần 22d)
        EmulationService,
        EmulationCouncilService,
        TrainingService,
        LearningResourcesService,
        ResourceSharingService,
        // Bảo đảm chất lượng, tự đánh giá (DT-18 phần 22f)
        QualityAssuranceService,
        LibraryCore,
        LibraryCatalogService,
        LibraryCirculationService,
        LibraryReportsService,
        ...MY_WORK_SOURCE_TYPES,
        {
          provide: MY_WORK_SOURCES,
          useFactory: (...sources: MyWorkSource[]) => sources,
          inject: MY_WORK_SOURCE_TYPES,
        },
        MyWorkService,
        // Chưa có nhà cung cấp gửi thư điện tử: trả lời hỗ trợ tuyển sinh chỉ gửi qua ứng dụng phụ huynh (DT-17 phần 17c)
        { provide: AdmissionSupportMailer, useClass: UnconfiguredAdmissionSupportMailer },
        SystemAnnouncementsService,
        AppLinksService,
        PortalContextService,
        FacebookPostsService,
        JournalsService,
        {
          provide: PaymentGatewayRegistry,
          inject: [SchoolSettings],
          useFactory: (settings: SchoolSettings) => new TenantPaymentGatewayRegistry(settings, configuration),
        },
        CashBooksService,
        WorkAccess,
        ProgramCompletionService,
        ChildGroupsService,
        AccountExportsService,
        ProfessionalStandardsService,
        ProfessionalRatingImports,
        TasksService,
        DirectivesService,
        DirectiveJobs,
        UnitSchedulesService,
        WorkFilesService,
        DocumentReportsService,
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
        SchoolSettings,
        SchoolSettingsService,
        // Trợ lý AI (DT-23 phần 23d)
        AiAssistantService,
        AiUsageJob,
        { provide: AI_PROVIDERS, useValue: new AiProviderRegistry({ mock: configuration.aiMock === true }) },
        RecruitmentRequestsService,
        JobPostingsService,
        PublicRecruitmentService,
        CandidatesService,
        SchoolCalendar,
        ClassroomToolsService,
        GroupSetsReader,
        GroupSetsService,
        LearningService,
        {
          provide: FileStorage,
          inject: [SchoolSettings],
          // Kho riêng của trường nếu có cấu hình, không thì kho chung của bản triển khai (DT-SaaS phần S3)
          useFactory: (settings: SchoolSettings) =>
            new TenantFileStorage(
              settings,
              options.fileStorage ??
                (configuration.objectStorage ? new S3FileStorage(configuration.objectStorage) : null),
            ),
        },
        // Thi trực tuyến cho học sinh (DT-23 phần 23a)
        AttemptEngine,
        ExamRateLimiter,
        OnlineExamsService,
        StudentExamsService,
        ClassroomGamesService,
        ExamProctoringService,
        ExamProctoringJobs,
        // Thông báo đẩy Web Push (DT-26 phần 26b): bộ nối chọn theo PUSH_PROVIDER, chưa đặt thì không gửi đẩy
        PushSubscriptions,
        {
          provide: PUSH_SENDER,
          useFactory: () =>
            createPushSender(configuration.push?.provider, {
              outbox: configuration.push?.developmentOutbox ?? null,
              schoolOf: () => currentTenant()?.code ?? null,
            }),
        },
        // Gia sư trong trường (DT-27 phần 27b)
        TutoringService,
        // Thu chi gia sư trong trường (DT-27 phần 27c)
        TutoringFinanceService,
        // Bài tập trực tuyến (DT-28 phần 28c)
        AssignmentsService,
        // Lớp video trực tiếp (DT-27 phần 27a): bộ nối chọn theo VIDEO_PROVIDER, chưa đặt thì tắt video
        { provide: VIDEO_PROVIDER, useValue: createVideoProvider(configuration.video, configuration.objectStorage) },
        VideoRoomsService,
        VideoJobs,
        // Tiến độ, bảng điểm hoạt động, sổ điểm, báo cáo (DT-28 phần 28d)
        LearningProgressService,
        // Bài về nhà và phụ huynh (DT-28 phần 28f)
        HomeworkPolicyGate,
        HomeworkService,
      ],
    };
  }
}
