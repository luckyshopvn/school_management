import type { Migration } from 'kysely/migration';
import { migration as setTimezone } from './migrations/0001_set_timezone.js';
import { migration as createOrgUnitsAndAuditLogs } from './migrations/0002_create_org_units_and_audit_logs.js';
import { migration as createSettings } from './migrations/0003_create_settings.js';
import { migration as createCatalogs } from './migrations/0004_create_catalogs.js';
import { migration as createClasses } from './migrations/0005_create_classes.js';
import { migration as createChildren } from './migrations/0006_create_children.js';
import { migration as createDataImports } from './migrations/0007_create_data_imports.js';
import { migration as createAttendance } from './migrations/0008_create_attendance.js';
import { migration as createPickups } from './migrations/0009_create_pickups.js';
import { migration as createFeeCatalogs } from './migrations/0010_create_fee_catalogs.js';
import { migration as createServiceRegistrations } from './migrations/0011_create_service_registrations.js';
import { migration as createInvoices } from './migrations/0012_create_invoices.js';
import { migration as createDiscountsAndAdjustments } from './migrations/0013_create_discounts_and_adjustments.js';
import { migration as createReceipts } from './migrations/0014_create_receipts.js';
import { migration as createReceiptReversals } from './migrations/0015_create_receipt_reversals.js';
import { migration as createPayments } from './migrations/0016_create_payments.js';
import { migration as createPaymentReversals } from './migrations/0017_create_payment_reversals.js';
import { migration as createOnlinePayments } from './migrations/0018_create_online_payments.js';
import { migration as createStaff } from './migrations/0019_create_staff.js';
import { migration as createStaffAttendance } from './migrations/0020_create_staff_attendance.js';
import { migration as createLeaveAndTimesheets } from './migrations/0021_create_leave_and_timesheets.js';
import { migration as createPayrolls } from './migrations/0022_create_payrolls.js';
import { migration as createSettlementsAndAdjustments } from './migrations/0023_create_settlements_and_adjustments.js';
import { migration as createNotificationCenter } from './migrations/0024_create_notification_center.js';
import { migration as createDailyJournals } from './migrations/0025_create_daily_journals.js';
import { migration as createChildUnitTransfers } from './migrations/0026_create_child_unit_transfers.js';
import { migration as createWorkSchedules } from './migrations/0027_create_work_schedules.js';
import { migration as addReceiptCarriedOver } from './migrations/0028_add_receipt_carried_over.js';
import { migration as addNotificationDelivery } from './migrations/0029_add_notification_delivery.js';
import { migration as createHealthRecords } from './migrations/0030_create_health_records.js';
import { migration as createKitchen } from './migrations/0032_create_kitchen.js';
import { migration as createMedicines } from './migrations/0031_create_medicines.js';
import { migration as createInventory } from './migrations/0033_create_inventory.js';
import { migration as createTeaching } from './migrations/0036_create_teaching.js';
import { migration as createInteractions } from './migrations/0035_create_interactions.js';
import { migration as createActivities } from './migrations/0034_create_activities.js';
import { migration as createExportLogs } from './migrations/0039_create_export_logs.js';
import { migration as createWorkManagement } from './migrations/0037_create_work_management.js';
import { migration as createFinancePhaseTwo } from './migrations/0038_create_finance_phase_two.js';
import { migration as createIntegrations } from './migrations/0044_create_integrations.js';
import { migration as createRecruitment } from './migrations/0041_create_recruitment.js';
import { migration as createAdmissions } from './migrations/0040_create_admissions.js';
import { migration as createBankStatementImports } from './migrations/0043_create_bank_statement_imports.js';
import { migration as createLedger } from './migrations/0042_create_ledger.js';
import { migration as addMoetChildProfile } from './migrations/0045_add_moet_child_profile.js';
import { migration as addMoetStaffProfile } from './migrations/0046_add_moet_staff_profile.js';
import { migration as createStandardsAndGroups } from './migrations/0047_create_standards_and_groups.js';
import { migration as createGrowthRounds } from './migrations/0048_create_growth_rounds.js';
import { migration as createEquipmentAndFacilities } from './migrations/0049_create_equipment_and_facilities.js';
import { migration as addStudentFlagsAndSmsGuardian } from './migrations/0050_add_student_flags_and_sms_guardian.js';
import { migration as addSoSchoolAndClassFields } from './migrations/0051_add_so_school_and_class_fields.js';
import { migration as createAccreditationReviewsAndSchoolSplits } from './migrations/0054_create_accreditation_reviews_and_school_splits.js';
import { migration as addStaffSoParity } from './migrations/0055_add_staff_so_parity.js';
import { migration as addStudentRecordsSo } from './migrations/0056_add_student_records_so.js';
import { migration as addStudentHealthAndMenuFields } from './migrations/0057_add_student_health_and_menu_fields.js';
import { migration as addFacilitiesSoParity } from './migrations/0058_add_facilities_so_parity.js';
import { migration as createEmisReportValues } from './migrations/0059_create_emis_report_values.js';
import { migration as addEmisSoIndicators } from './migrations/0060_add_emis_so_indicators.js';
import { migration as createEntryAdmissions } from './migrations/0061_create_entry_admissions.js';
import { migration as addEntryAdmissionIntake } from './migrations/0062_add_entry_admission_intake.js';
import { migration as addAccreditationReviewSoFields } from './migrations/0063_add_accreditation_review_so_fields.js';
import { migration as createKpi } from './migrations/0064_create_kpi.js';
import { migration as extendTasksForDirectives } from './migrations/0065_extend_tasks_for_directives.js';
import { migration as createProfessionalRecords } from './migrations/0066_create_professional_records.js';
import { migration as addEquipmentLocationsStocktakes } from './migrations/0067_add_equipment_locations_stocktakes.js';
import { migration as createFoodSafety } from './migrations/0068_create_food_safety.js';
import { migration as createEducationPlans } from './migrations/0069_create_education_plans.js';
import { migration as createEmulation } from './migrations/0070_create_emulation.js';
import { migration as createQualityAssurance } from './migrations/0071_create_quality_assurance.js';
import { migration as addSchoolLevelStructure } from './migrations/0072_add_school_level_structure.js';
import { migration as addFeeScheduleSchoolLevel } from './migrations/0073_add_fee_schedule_school_level.js';
import { migration as addNewsAudienceLevels } from './migrations/0074_add_news_audience_levels.js';
import { migration as backfillSchoolLevels } from './migrations/0075_backfill_school_levels.js';
import { migration as createSubjects } from './migrations/0076_create_subjects.js';
import { migration as createBoardingAndConduct } from './migrations/0077_create_boarding_and_conduct.js';
import { migration as createTimetables } from './migrations/0078_create_timetables.js';
import { migration as createStudentAssessments } from './migrations/0079_create_student_assessments.js';
import { migration as createLibrary } from './migrations/0100_create_library.js';
import { migration as createClassLogs } from './migrations/0080_create_class_logs.js';
import { migration as createStudentRecords } from './migrations/0081_create_student_records.js';
import { migration as createTimetableGenerator } from './migrations/0082_create_timetable_generator.js';
import { migration as createSecondaryFoundation } from './migrations/0084_create_secondary_foundation.js';
import { migration as addTimetableGroups } from './migrations/0086_add_timetable_groups.js';
import { migration as createScores } from './migrations/0087_create_scores.js';
import { migration as createSecondaryClassRecords } from './migrations/0088_create_secondary_class_records.js';
import { migration as createExamGrading } from './migrations/0090_create_exam_grading.js';
import { migration as createQuestionBankAndExams } from './migrations/0085_create_question_bank_and_exams.js';
import { migration as createTrainingRecords } from './migrations/0101_create_training_records.js';
import { migration as widenAwardBasis } from './migrations/0089_widen_award_basis.js';
import { migration as createGraduation } from './migrations/0091_create_graduation.js';
import { migration as createLearningResourceActivity } from './migrations/0102_create_learning_resource_activity.js';
import { migration as createResourceQuestionsAndRubrics } from './migrations/0103_create_resource_questions_and_rubrics.js';
import { migration as addQuestionAiFlag } from './migrations/0128_add_question_ai_flag.js';
import { migration as createClassroomTools } from './migrations/0124_create_classroom_tools.js';
import { migration as createClassroomScoreEvents } from './migrations/0125_create_classroom_score_events.js';
import { migration as createGroupSets } from './migrations/0170_create_group_sets.js';
import { migration as moveClassroomGroupingsToGroupSets } from './migrations/0171_move_classroom_groupings_to_group_sets.js';

// Danh sách tệp thay đổi cấu trúc của cơ sở dữ liệu năm học, theo số thứ tự (QU-01, QU-11)
export const schoolYearMigrations: Record<string, Migration> = {
  '0001_set_timezone': setTimezone,
  '0002_create_org_units_and_audit_logs': createOrgUnitsAndAuditLogs,
  '0003_create_settings': createSettings,
  '0004_create_catalogs': createCatalogs,
  '0005_create_classes': createClasses,
  '0006_create_children': createChildren,
  '0007_create_data_imports': createDataImports,
  '0008_create_attendance': createAttendance,
  '0009_create_pickups': createPickups,
  '0010_create_fee_catalogs': createFeeCatalogs,
  '0011_create_service_registrations': createServiceRegistrations,
  '0012_create_invoices': createInvoices,
  '0013_create_discounts_and_adjustments': createDiscountsAndAdjustments,
  '0014_create_receipts': createReceipts,
  '0015_create_receipt_reversals': createReceiptReversals,
  '0016_create_payments': createPayments,
  '0017_create_payment_reversals': createPaymentReversals,
  '0018_create_online_payments': createOnlinePayments,
  '0019_create_staff': createStaff,
  '0020_create_staff_attendance': createStaffAttendance,
  '0021_create_leave_and_timesheets': createLeaveAndTimesheets,
  '0022_create_payrolls': createPayrolls,
  '0023_create_settlements_and_adjustments': createSettlementsAndAdjustments,
  '0024_create_notification_center': createNotificationCenter,
  '0025_create_daily_journals': createDailyJournals,
  '0026_create_child_unit_transfers': createChildUnitTransfers,
  '0027_create_work_schedules': createWorkSchedules,
  '0028_add_receipt_carried_over': addReceiptCarriedOver,
  '0029_add_notification_delivery': addNotificationDelivery,
  '0030_create_health_records': createHealthRecords,
  '0032_create_kitchen': createKitchen,
  '0031_create_medicines': createMedicines,
  '0033_create_inventory': createInventory,
  '0036_create_teaching': createTeaching,
  '0035_create_interactions': createInteractions,
  '0034_create_activities': createActivities,
  '0039_create_export_logs': createExportLogs,
  '0037_create_work_management': createWorkManagement,
  '0038_create_finance_phase_two': createFinancePhaseTwo,
  '0044_create_integrations': createIntegrations,
  '0041_create_recruitment': createRecruitment,
  '0040_create_admissions': createAdmissions,
  '0043_create_bank_statement_imports': createBankStatementImports,
  '0042_create_ledger': createLedger,
  '0045_add_moet_child_profile': addMoetChildProfile,
  '0046_add_moet_staff_profile': addMoetStaffProfile,
  '0047_create_standards_and_groups': createStandardsAndGroups,
  '0048_create_growth_rounds': createGrowthRounds,
  '0049_create_equipment_and_facilities': createEquipmentAndFacilities,
  '0050_add_student_flags_and_sms_guardian': addStudentFlagsAndSmsGuardian,
  '0051_add_so_school_and_class_fields': addSoSchoolAndClassFields,
  '0054_create_accreditation_reviews_and_school_splits': createAccreditationReviewsAndSchoolSplits,
  '0055_add_staff_so_parity': addStaffSoParity,
  '0056_add_student_records_so': addStudentRecordsSo,
  '0057_add_student_health_and_menu_fields': addStudentHealthAndMenuFields,
  '0058_add_facilities_so_parity': addFacilitiesSoParity,
  '0059_create_emis_report_values': createEmisReportValues,
  '0060_add_emis_so_indicators': addEmisSoIndicators,
  '0061_create_entry_admissions': createEntryAdmissions,
  '0062_add_entry_admission_intake': addEntryAdmissionIntake,
  '0063_add_accreditation_review_so_fields': addAccreditationReviewSoFields,
  '0064_create_kpi': createKpi,
  '0065_extend_tasks_for_directives': extendTasksForDirectives,
  '0066_create_professional_records': createProfessionalRecords,
  '0067_add_equipment_locations_stocktakes': addEquipmentLocationsStocktakes,
  '0068_create_food_safety': createFoodSafety,
  '0069_create_education_plans': createEducationPlans,
  '0070_create_emulation': createEmulation,
  '0071_create_quality_assurance': createQualityAssurance,
  '0072_add_school_level_structure': addSchoolLevelStructure,
  '0073_add_fee_schedule_school_level': addFeeScheduleSchoolLevel,
  '0074_add_news_audience_levels': addNewsAudienceLevels,
  '0075_backfill_school_levels': backfillSchoolLevels,
  '0076_create_subjects': createSubjects,
  '0077_create_boarding_and_conduct': createBoardingAndConduct,
  '0078_create_timetables': createTimetables,
  '0079_create_student_assessments': createStudentAssessments,
  '0100_create_library': createLibrary,
  '0080_create_class_logs': createClassLogs,
  '0081_create_student_records': createStudentRecords,
  '0082_create_timetable_generator': createTimetableGenerator,
  '0084_create_secondary_foundation': createSecondaryFoundation,
  '0086_add_timetable_groups': addTimetableGroups,
  '0087_create_scores': createScores,
  '0088_create_secondary_class_records': createSecondaryClassRecords,
  '0090_create_exam_grading': createExamGrading,
  '0085_create_question_bank_and_exams': createQuestionBankAndExams,
  '0101_create_training_records': createTrainingRecords,
  '0089_widen_award_basis': widenAwardBasis,
  '0091_create_graduation': createGraduation,
  '0102_create_learning_resource_activity': createLearningResourceActivity,
  '0103_create_resource_questions_and_rubrics': createResourceQuestionsAndRubrics,
  // Trợ lý AI (DT-23 phần 23d): 0128
  '0128_add_question_ai_flag': addQuestionAiFlag,
  '0124_create_classroom_tools': createClassroomTools,
  '0125_create_classroom_score_events': createClassroomScoreEvents,
  // Mô hình nhóm dùng chung (DT-28 phần 28a): 0170, 0171
  '0170_create_group_sets': createGroupSets,
  '0171_move_classroom_groupings_to_group_sets': moveClassroomGroupingsToGroupSets,
};
