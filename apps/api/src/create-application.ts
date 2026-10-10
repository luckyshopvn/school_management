import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplication, Type } from '@nestjs/common';
import { Clock, ErrorFilter, SystemClock } from '@school-management/server';
import { API_VERSION_PREFIX } from '@school-management/shared';
import type { AcademicYearTransitionStep } from './academic-years/academic-year-transition.js';
import { ApplicationModule } from './application.module.js';
import type { ApiConfiguration } from './common/configuration.js';
import type { FileStorage } from './files/file-storage.js';

export async function createApplication(
  configuration: ApiConfiguration,
  options: {
    clock?: Clock;
    additionalControllers?: Type[];
    transitionSteps?: AcademicYearTransitionStep[];
    fileStorage?: FileStorage;
  } = {},
): Promise<INestApplication> {
  const application = await NestFactory.create(
    ApplicationModule.register(configuration, options.clock ?? new SystemClock(), options),
    { logger: ['error', 'warn'] },
  );
  application.setGlobalPrefix(API_VERSION_PREFIX.slice(1));
  application.useGlobalFilters(new ErrorFilter());
  application.enableShutdownHooks();
  return application;
}
