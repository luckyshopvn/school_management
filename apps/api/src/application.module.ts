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
import { HealthController } from './health.controller.js';
import { OrganizationScopes } from './organization/organization-scopes.js';
import { orgUnitsTransitionStep } from './organization/org-units-transition.js';
import { OrgUnitsController } from './organization/org-units.controller.js';
import { OrgUnitsService } from './organization/org-units.service.js';

@Module({})
export class ApplicationModule {
  static register(
    configuration: ApiConfiguration,
    clock: Clock,
    options: { additionalControllers?: Type[]; transitionSteps?: AcademicYearTransitionStep[] } = {},
  ): DynamicModule {
    return {
      module: ApplicationModule,
      controllers: [
        HealthController,
        AcademicYearsController,
        OrgUnitsController,
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
          useValue: [orgUnitsTransitionStep, ...(options.transitionSteps ?? [])],
        },
        AcademicYearsService,
        CurrentSchoolYearResolver,
        OrganizationScopes,
        OrgUnitsService,
      ],
    };
  }
}
