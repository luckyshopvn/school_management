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
import { migration as createAnnouncementsAndAppLinks } from './migrations/0011_create_announcements_and_app_links.js';
import { migration as addSyncAccountCredentials } from './migrations/0012_add_sync_account_credentials.js';
import { migration as addSchoolWeekFieldsAndCarryOverTime } from './migrations/0013_add_school_week_fields_and_carry_over_time.js';
import { migration as createSigningTables } from './migrations/0015_create_signing_tables.js';
import { migration as addArchiveUnitsHandlersReminders } from './migrations/0016_add_archive_units_handlers_reminders.js';
import { migration as adjustSigningToSoTemplates } from './migrations/0017_adjust_signing_to_so_templates.js';
import { migration as createIncomingDocumentTables } from './migrations/0018_create_incoming_document_tables.js';
import { migration as createOutgoingDocumentTables } from './migrations/0019_create_outgoing_document_tables.js';

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
  '0011_create_announcements_and_app_links': createAnnouncementsAndAppLinks,
  '0012_add_sync_account_credentials': addSyncAccountCredentials,
  '0013_add_school_week_fields_and_carry_over_time': addSchoolWeekFieldsAndCarryOverTime,
  '0015_create_signing_tables': createSigningTables,
  '0016_add_archive_units_handlers_reminders': addArchiveUnitsHandlersReminders,
  '0017_adjust_signing_to_so_templates': adjustSigningToSoTemplates,
  '0018_create_incoming_document_tables': createIncomingDocumentTables,
  '0019_create_outgoing_document_tables': createOutgoingDocumentTables,
};
