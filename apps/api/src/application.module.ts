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
import { HealthRecordsController, HealthRecordsService } from './health/health-records.js';
import { healthTransitionStep } from './health/health-transition.js';
import { KitchenAccess } from './kitchen/kitchen-access.js';
import { KitchenCatalogsController, KitchenCatalogsService } from './kitchen/kitchen-catalogs.js';
import { KitchenMealsController, KitchenMealsService } from './kitchen/kitchen-meals.js';
import { KitchenMenusController, KitchenMenusService } from './kitchen/kitchen-menus.js';
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
import { GradeLevelsController, GradeLevelsService } from './catalogs/grade-levels.js';
import { ClassesController } from './classes/classes.controller.js';
import { ClassesService } from './classes/classes.service.js';
import { ChildScope } from './children/child-scope.js';
import { ChildrenController } from './children/children.controller.js';
import { ChildrenService } from './children/children.service.js';
import { ChildDataProtection } from './common/child-data-protection.js';
import { FileStorage, S3FileStorage } from './files/file-storage.js';
import { FilesController, FilesService } from './files/files.js';
import { ImportsController } from './imports/imports.controller.js';
import { ImportsService } from './imports/imports.service.js';
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
import { DebtCollectionController, DebtCollectionService } from './finance/debt-collection.js';
import { FiscalPeriodsController, FiscalPeriodsService } from './finance/fiscal-periods.js';
import { PayablesController, PayablesService } from './finance/payables.js';
import { PaymentsController } from './finance/payments.controller.js';
import { PaymentsService } from './finance/payments.service.js';
import { PaymentReversalsService } from './finance/payment-reversals.service.js';
import { OnlinePaymentsController } from './finance/online-payments.controller.js';
import { OnlinePaymentsService } from './finance/online-payments.service.js';
import { DevelopmentPaymentGateway, PaymentGateway, UnavailablePaymentGateway } from './finance/payment-gateway.js';
import { DebtsService } from './fees/debts.service.js';
import { ChildLifecycleController, ChildLifecycleService } from './children/child-lifecycle.js';
import { WorkSchedulesController, WorkSchedulesService } from './staff-attendance/work-schedules.js';
import { StaffController } from './staff/staff.controller.js';
import { StaffService } from './staff/staff.service.js';
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
import { PartnerController, PartnerService } from './partner/partner.js';
import { NotificationsController, NotificationsService } from './notifications/notifications.js';
import { NotificationDispatcher } from './notifications/notification-dispatcher.js';
import { LoggingSmsGateway, SmsGateway } from './notifications/sms-gateway.js';
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
        GradeLevelsController,
        ClassesController,
        ChildrenController,
        ChildLifecycleController,
        WorkSchedulesController,
        HealthRecordsController,
        HealthCareController,
        KitchenCatalogsController,
        KitchenMenusController,
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
        StaffController,
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
        PayablesController,
        FiscalPeriodsController,
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
            staffTransitionStep,
            staffAttendanceTransitionStep,
            payrollTransitionStep,
            feeCatalogsTransitionStep,
            childrenTransitionStep,
            financeTransitionStep,
            healthTransitionStep,
            kitchenTransitionStep,
            medicinesTransitionStep,
            inventoryTransitionStep,
            teachingTransitionStep,
            interactionsTransitionStep,
            activitiesTransitionStep,
            workTransitionStep,
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
        GradeLevelsService,
        ClassesService,
        ChildScope,
        ChildrenService,
        ChildLifecycleService,
        WorkSchedulesService,
        HealthAccess,
        HealthRecordsService,
        HealthCareService,
        KitchenAccess,
        KitchenCatalogsService,
        KitchenMealsService,
        KitchenMenusService,
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
        PartnerService,
        NotificationsService,
        NotificationDispatcher,
        { provide: SmsGateway, useFactory: () => options.smsGateway ?? new LoggingSmsGateway() },
        JournalsService,
        {
          provide: PaymentGateway,
          useFactory: () =>
            configuration.paymentGateway === 'development'
              ? new DevelopmentPaymentGateway()
              : new UnavailablePaymentGateway(),
        },
        CashBooksService,
        WorkAccess,
        TasksService,
        PlansService,
        EvaluationsService,
        WorkHistoryService,
        BonusDeductionsService,
        DebtsService,
        DebtCollectionService,
        BankReconciliationService,
        PayablesService,
        FiscalPeriodsService,
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
