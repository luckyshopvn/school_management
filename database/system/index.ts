import type { Migration } from 'kysely/migration';
import { migration as setTimezone } from './migrations/0001_set_timezone.js';
import { migration as createAcademicYearTables } from './migrations/0002_create_academic_year_tables.js';
import { migration as createIntegrationCredentials } from './migrations/0003_create_integration_credentials.js';
import { migration as createUserQuickLinks } from './migrations/0004_create_user_quick_links.js';
import { migration as createUserGridSettings } from './migrations/0005_create_user_grid_settings.js';
import { migration as createFeedback } from './migrations/0007_create_feedback.js';
import { migration as createAdministrativeUnits } from './migrations/0008_create_administrative_units.js';
import { migration as createArchiveTables } from './migrations/0009_create_archive_tables.js';
import { migration as createExportJobsAndSubmissions } from './migrations/0010_create_export_jobs_and_submissions.js';

// Danh sách tệp thay đổi cấu trúc của cơ sở dữ liệu hệ thống, theo số thứ tự (QU-01, QĐ-17)
export const systemMigrations: Record<string, Migration> = {
  '0001_set_timezone': setTimezone,
  '0002_create_academic_year_tables': createAcademicYearTables,
  '0003_create_integration_credentials': createIntegrationCredentials,
  '0004_create_user_quick_links': createUserQuickLinks,
  '0005_create_user_grid_settings': createUserGridSettings,
  '0007_create_feedback': createFeedback,
  '0008_create_administrative_units': createAdministrativeUnits,
  '0009_create_archive_tables': createArchiveTables,
  '0010_create_export_jobs_and_submissions': createExportJobsAndSubmissions,
};
