import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { API_VERSION_PREFIX } from '@school-management/shared';
import { ApplicationModule } from './application.module.js';
import type { OrganizationDirectory } from './accounts/organization-directory.js';
import type { IdentityConfiguration } from './common/configuration.js';
import { Clock, ErrorFilter, SystemClock } from '@school-management/server';

export async function createApplication(
  configuration: IdentityConfiguration,
  clock: Clock = new SystemClock(),
  organizationDirectory?: OrganizationDirectory,
): Promise<INestApplication> {
  const application = await NestFactory.create<NestExpressApplication>(
    ApplicationModule.register(configuration, clock, organizationDirectory),
    { logger: ['error', 'warn'] },
  );
  application.setGlobalPrefix(API_VERSION_PREFIX.slice(1));
  application.useGlobalFilters(new ErrorFilter());
  application.enableShutdownHooks();
  return application;
}
