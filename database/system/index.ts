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
import { migration as createUnitSchedulesAndWorkFiles } from './migrations/0020_create_unit_schedules_and_work_files.js';
import { migration as createWebsiteTables } from './migrations/0021_create_website_tables.js';
import { migration as createImpersonationExportDemoTables } from './migrations/0022_create_impersonation_export_demo_tables.js';
import { migration as createSchoolLevels } from './migrations/0023_create_school_levels.js';
import { migration as addSchoolLevelCalendar } from './migrations/0024_add_school_level_calendar.js';
import { migration as backfillSchoolLevels } from './migrations/0025_backfill_school_levels.js';
import { migration as createPeriodSlots } from './migrations/0026_create_period_slots.js';
import { migration as createReportForms } from './migrations/0027_create_report_forms.js';
import { migration as addSecondaryReportForms } from './migrations/0028_add_secondary_report_forms.js';
import { migration as createTrainingCatalogs } from './migrations/0041_create_training_catalogs.js';
import { migration as createLearningResources } from './migrations/0042_create_learning_resources.js';
import { migration as createTermsAcceptances } from './migrations/0050_create_terms_acceptances.js';
import { migration as createIntegrationSecrets } from './migrations/0051_create_integration_secrets.js';
import { migration as createSchoolBranding } from './migrations/0052_create_school_branding.js';
import { migration as createSupportAccessGrants } from './migrations/0053_create_support_access_grants.js';
import { migration as createAiSettingsAndRequests } from './migrations/0071_create_ai_settings_and_requests.js';
import { migration as addAiRequestUsageIndex } from './migrations/0072_add_ai_request_usage_index.js';
import { migration as addLearningResourceAiFlag } from './migrations/0073_add_learning_resource_ai_flag.js';
import { migration as addSchoolBrandingAppShortName } from './migrations/0090_add_school_branding_app_short_name.js';
import { migration as createCourseTemplates } from './migrations/0110_create_course_templates.js';
import { migration as createPushSubscriptions } from './migrations/0091_create_push_subscriptions.js';
import { migration as createNotificationPreferences } from './migrations/0092_create_notification_preferences.js';
import { migration as addAiFeedbackKind } from './migrations/0111_add_ai_feedback_kind.js';
import { migration as createScormPackages } from './migrations/0113_create_scorm_packages.js';
import { migration as createCoursePackageTransfers } from './migrations/0114_create_course_package_transfers.js';

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
  '0020_create_unit_schedules_and_work_files': createUnitSchedulesAndWorkFiles,
  '0021_create_website_tables': createWebsiteTables,
  '0022_create_impersonation_export_demo_tables': createImpersonationExportDemoTables,
  '0023_create_school_levels': createSchoolLevels,
  '0024_add_school_level_calendar': addSchoolLevelCalendar,
  '0025_backfill_school_levels': backfillSchoolLevels,
  '0026_create_period_slots': createPeriodSlots,
  '0027_create_report_forms': createReportForms,
  '0028_add_secondary_report_forms': addSecondaryReportForms,
  '0041_create_training_catalogs': createTrainingCatalogs,
  '0042_create_learning_resources': createLearningResources,
  '0050_create_terms_acceptances': createTermsAcceptances,
  '0051_create_integration_secrets': createIntegrationSecrets,
  '0052_create_school_branding': createSchoolBranding,
  '0053_create_support_access_grants': createSupportAccessGrants,
  // Trợ lý AI (DT-23 phần 23d): 0071 đến 0073
  '0071_create_ai_settings_and_requests': createAiSettingsAndRequests,
  '0072_add_ai_request_usage_index': addAiRequestUsageIndex,
  '0073_add_learning_resource_ai_flag': addLearningResourceAiFlag,
  '0090_add_school_branding_app_short_name': addSchoolBrandingAppShortName,
  // Lõi hệ thống quản lý học tập (DT-28 phần 28b): 0110
  '0110_create_course_templates': createCourseTemplates,
  // Thông báo đẩy Web Push (DT-26 phần 26b): 0091, 0092
  '0091_create_push_subscriptions': createPushSubscriptions,
  '0092_create_notification_preferences': createNotificationPreferences,
  // Gợi ý nhận xét bài tập bằng AI (DT-28 phần 28c): 0111
  '0111_add_ai_feedback_kind': addAiFeedbackKind,
  // Gói SCORM, gói khoá học (DT-28 phần 28h): 0113, 0114
  '0113_create_scorm_packages': createScormPackages,
  '0114_create_course_package_transfers': createCoursePackageTransfers,
};
