import { Module, type DynamicModule, type Type } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Clock } from '@school-management/server';
import { AuthenticationGuard } from './authentication/authentication.guard.js';
import { IdentityClient } from './authentication/identity-client.js';
import { API_CONFIGURATION, type ApiConfiguration } from './common/configuration.js';
import { HealthController } from './health.controller.js';

@Module({})
export class ApplicationModule {
  static register(configuration: ApiConfiguration, clock: Clock, additionalControllers: Type[] = []): DynamicModule {
    return {
      module: ApplicationModule,
      controllers: [HealthController, ...additionalControllers],
      providers: [
        { provide: API_CONFIGURATION, useValue: configuration },
        { provide: Clock, useValue: clock },
        IdentityClient,
        { provide: APP_GUARD, useClass: AuthenticationGuard },
      ],
    };
  }
}
