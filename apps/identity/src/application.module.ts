import { Module, type DynamicModule } from '@nestjs/common';
import { AccessTokenGuard } from './authentication/access-token.guard.js';
import { AuthenticationController } from './authentication/authentication.controller.js';
import { AuthenticationService } from './authentication/authentication.service.js';
import { LoginRateLimiter } from './authentication/login-rate-limiter.js';
import { TokenService } from './authentication/token.service.js';
import { Clock } from '@school-management/server';
import { IDENTITY_CONFIGURATION, type IdentityConfiguration } from './common/configuration.js';
import { Infrastructure } from './common/infrastructure.js';
import { HealthController } from './health.controller.js';

@Module({})
export class ApplicationModule {
  static register(configuration: IdentityConfiguration, clock: Clock): DynamicModule {
    return {
      module: ApplicationModule,
      controllers: [HealthController, AuthenticationController],
      providers: [
        { provide: IDENTITY_CONFIGURATION, useValue: configuration },
        { provide: Clock, useValue: clock },
        Infrastructure,
        TokenService,
        LoginRateLimiter,
        AuthenticationService,
        AccessTokenGuard,
      ],
    };
  }
}
