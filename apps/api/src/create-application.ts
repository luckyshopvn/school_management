import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { API_VERSION_PREFIX } from '@school-management/shared';
import { ApplicationModule } from './application.module.js';

export async function createApplication(): Promise<INestApplication> {
  const application = await NestFactory.create(ApplicationModule, { logger: ['error', 'warn'] });
  application.setGlobalPrefix(API_VERSION_PREFIX.slice(1));
  return application;
}
