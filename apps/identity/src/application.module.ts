import { Module, type DynamicModule } from '@nestjs/common';
import { ApiClientsController, ApiClientsService } from './accounts/api-clients.js';
import { AccountsController, RolesController } from './accounts/accounts.controller.js';
import { AccountsService } from './accounts/accounts.service.js';
import { ApiOrganizationDirectory, OrganizationDirectory } from './accounts/organization-directory.js';
import { RolesService } from './accounts/roles.service.js';
import { StaffDirectoryService } from './accounts/staff-directory.service.js';
import { GuardianAccountsService } from './accounts/guardian-accounts.service.js';
import { StaffAccountsService } from './accounts/staff-accounts.service.js';
import { IdentitySettingsController } from './settings/identity-settings.controller.js';
import { IdentitySettingsService } from './settings/identity-settings.service.js';
import { AccessTokenGuard } from './authentication/access-token.guard.js';
import { AuthenticationController } from './authentication/authentication.controller.js';
import { AuthenticationService } from './authentication/authentication.service.js';
import { LoginRateLimiter } from './authentication/login-rate-limiter.js';
import { TokenService } from './authentication/token.service.js';
import { Clock } from '@school-management/server';
import { IDENTITY_CONFIGURATION, type IdentityConfiguration } from './common/configuration.js';
import { Infrastructure } from './common/infrastructure.js';
import { HealthController } from './health.controller.js';
import { createSmsSender, SmsSender } from './messaging/sms-sender.js';
import { DemoAwareSmsSender } from './messaging/demo-sms-sender.js';
import { OneTimeCodeService } from './authentication/one-time-code.service.js';
import { CaptchaService } from './authentication/captcha.service.js';
import { PasswordResetService } from './authentication/password-reset.service.js';
import { ImpersonationService } from './authentication/impersonation.service.js';
import { IdentityDataExportService } from './accounts/identity-data-export.js';

@Module({})
export class ApplicationModule {
  static register(
    configuration: IdentityConfiguration,
    clock: Clock,
    organizationDirectory?: OrganizationDirectory,
    smsSender?: SmsSender,
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
      ],
      providers: [
        { provide: IDENTITY_CONFIGURATION, useValue: configuration },
        { provide: Clock, useValue: clock },
        Infrastructure,
        TokenService,
        LoginRateLimiter,
        AuthenticationService,
        ImpersonationService,
        IdentityDataExportService,
        OneTimeCodeService,
        CaptchaService,
        PasswordResetService,
        // Bản trình diễn không gửi tin nhắn thật (DT-18 phần 18h)
        {
          provide: SmsSender,
          inject: [Infrastructure, Clock],
          useFactory: (infrastructure: Infrastructure, providerClock: Clock) =>
            new DemoAwareSmsSender(smsSender ?? createSmsSender(configuration.smsProvider), infrastructure, providerClock),
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
      ],
    };
  }
}
