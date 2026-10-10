import { Module, type DynamicModule } from '@nestjs/common';
import { AccountsController, RolesController } from './accounts/accounts.controller.js';
import { AccountsService } from './accounts/accounts.service.js';
import { ApiOrganizationDirectory, OrganizationDirectory } from './accounts/organization-directory.js';
import { RolesService } from './accounts/roles.service.js';
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
import { LoggingSmsSender, SmsSender } from './messaging/sms-sender.js';
import { OneTimeCodeService } from './authentication/one-time-code.service.js';

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
      ],
      providers: [
        { provide: IDENTITY_CONFIGURATION, useValue: configuration },
        { provide: Clock, useValue: clock },
        Infrastructure,
        TokenService,
        LoginRateLimiter,
        AuthenticationService,
        OneTimeCodeService,
        smsSender ? { provide: SmsSender, useValue: smsSender } : { provide: SmsSender, useClass: LoggingSmsSender },
        AccessTokenGuard,
        organizationDirectory
          ? { provide: OrganizationDirectory, useValue: organizationDirectory }
          : { provide: OrganizationDirectory, useClass: ApiOrganizationDirectory },
        AccountsService,
        RolesService,
        IdentitySettingsService,
      ],
    };
  }
}
