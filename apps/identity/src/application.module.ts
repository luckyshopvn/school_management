import { Module, type DynamicModule } from '@nestjs/common';
import { ApiClientsController, ApiClientsService } from './accounts/api-clients.js';
import { AccountsController, RolesController } from './accounts/accounts.controller.js';
import { AccountsService } from './accounts/accounts.service.js';
import { ApiOrganizationDirectory, OrganizationDirectory } from './accounts/organization-directory.js';
import { RolesService } from './accounts/roles.service.js';
import { StaffDirectoryService } from './accounts/staff-directory.service.js';
import { GuardianAccountsService } from './accounts/guardian-accounts.service.js';
import { StudentAccountsService } from './accounts/student-accounts.service.js';
import { StaffAccountsService } from './accounts/staff-accounts.service.js';
import { IdentitySettingsController } from './settings/identity-settings.controller.js';
import { IdentitySettingsService } from './settings/identity-settings.service.js';
import { AccessTokenGuard } from './authentication/access-token.guard.js';
import { TotpService } from './authentication/totp.service.js';
import { AuthenticationController } from './authentication/authentication.controller.js';
import { AuthenticationService } from './authentication/authentication.service.js';
import { LoginRateLimiter } from './authentication/login-rate-limiter.js';
import { TokenService } from './authentication/token.service.js';
import { Clock } from '@school-management/server';
import type { TenancyRuntime } from '@school-management/database';
import { IDENTITY_CONFIGURATION, TENANCY_RUNTIME, type IdentityConfiguration } from './common/configuration.js';
import { Infrastructure } from './common/infrastructure.js';
import { HealthController } from './health.controller.js';
import { createSmsSender, SmsSender } from './messaging/sms-sender.js';
import { DemoAwareSmsSender } from './messaging/demo-sms-sender.js';
import { OneTimeCodeService } from './authentication/one-time-code.service.js';
import { CaptchaService } from './authentication/captcha.service.js';
import { PasswordResetService } from './authentication/password-reset.service.js';
import { ImpersonationService } from './authentication/impersonation.service.js';
import { IdentityDataExportService } from './accounts/identity-data-export.js';
import { PlatformAuthController, PlatformOperatorsService } from './platform/platform-operators.js';
import {
  PlatformSchoolsController,
  PlatformSchoolsService,
  SchoolActivationController,
  SchoolActivationService,
} from './platform/platform-schools.js';
import { PlatformPlansController, PlatformPlansService } from './platform/platform-plans.js';
import { PlatformBillingController, PlatformBillingService } from './platform/platform-billing.js';
import { PlatformDashboardController, PlatformDashboardService } from './platform/platform-dashboard.js';
import { ParentOrgAuthController, ParentOrgsService, PlatformParentOrgsController } from './platform/parent-orgs.js';
import {
  PlatformSupportController,
  SupportExchangeController,
  SupportSessionsService,
} from './platform/support-sessions.js';

@Module({})
export class ApplicationModule {
  static register(
    configuration: IdentityConfiguration,
    clock: Clock,
    organizationDirectory?: OrganizationDirectory,
    smsSender?: SmsSender,
    tenancy?: TenancyRuntime | null,
  ): DynamicModule {
    return {
      module: ApplicationModule,
      controllers: [
        HealthController,
        AuthenticationController,
        IdentitySettingsController,
        AccountsController,
        RolesController,
        ApiClientsController,
        PlatformAuthController,
        PlatformSchoolsController,
        SchoolActivationController,
        PlatformPlansController,
        PlatformBillingController,
        PlatformDashboardController,
        PlatformParentOrgsController,
        ParentOrgAuthController,
        PlatformSupportController,
        SupportExchangeController,
      ],
      providers: [
        { provide: IDENTITY_CONFIGURATION, useValue: configuration },
        { provide: TENANCY_RUNTIME, useValue: tenancy ?? null },
        { provide: Clock, useValue: clock },
        Infrastructure,
        TokenService,
        LoginRateLimiter,
        AuthenticationService,
        ImpersonationService,
        TotpService,
        IdentityDataExportService,
        OneTimeCodeService,
        CaptchaService,
        PasswordResetService,
        // Bản trình diễn không gửi tin nhắn thật (DT-18 phần 18h)
        {
          provide: SmsSender,
          inject: [Infrastructure, Clock],
          useFactory: (infrastructure: Infrastructure, providerClock: Clock) =>
            new DemoAwareSmsSender(
              smsSender ?? createSmsSender(configuration.smsProvider),
              infrastructure,
              providerClock,
            ),
        },
        AccessTokenGuard,
        ApiClientsService,
        organizationDirectory
          ? { provide: OrganizationDirectory, useValue: organizationDirectory }
          : { provide: OrganizationDirectory, useClass: ApiOrganizationDirectory },
        AccountsService,
        RolesService,
        StaffDirectoryService,
        GuardianAccountsService,
        StaffAccountsService,
        IdentitySettingsService,
        PlatformOperatorsService,
        PlatformSchoolsService,
        SchoolActivationService,
        PlatformPlansService,
        PlatformBillingService,
        PlatformDashboardService,
        ParentOrgsService,
        SupportSessionsService,
        StudentAccountsService,
      ],
    };
  }
}
