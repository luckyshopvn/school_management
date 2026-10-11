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
import { OrganizationScopes } from './organization/organization-scopes.js';
import { orgUnitsTransitionStep } from './organization/org-units-transition.js';
import { catalogsTransitionStep } from './catalogs/catalogs-transition.js';
import { feeCatalogsTransitionStep } from './fees/fee-catalogs-transition.js';
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
import { PaymentsController } from './finance/payments.controller.js';
import { PaymentsService } from './finance/payments.service.js';
import { PaymentReversalsService } from './finance/payment-reversals.service.js';
import { OnlinePaymentsController } from './finance/online-payments.controller.js';
import { OnlinePaymentsService } from './finance/online-payments.service.js';
import { DevelopmentPaymentGateway, PaymentGateway, UnavailablePaymentGateway } from './finance/payment-gateway.js';
import { DebtsService } from './fees/debts.service.js';
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
import { OrgUnitsController } from './organization/org-units.controller.js';
import { OrgUnitsService } from './organization/org-units.service.js';

@Module({})
export class ApplicationModule {
  static register(
    configuration: ApiConfiguration,
    clock: Clock,
    options: {
      additionalControllers?: Type[];
      transitionSteps?: AcademicYearTransitionStep[];
      fileStorage?: FileStorage;
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
        CashBooksController,
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
            ...(options.transitionSteps ?? []),
          ],
        },
        AcademicYearsService,
        CurrentSchoolYearResolver,
        OrganizationScopes,
        OrgUnitsService,
        SettingsService,
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
        {
          provide: PaymentGateway,
          useFactory: () =>
            configuration.paymentGateway === 'development'
              ? new DevelopmentPaymentGateway()
              : new UnavailablePaymentGateway(),
        },
        CashBooksService,
        DebtsService,
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
