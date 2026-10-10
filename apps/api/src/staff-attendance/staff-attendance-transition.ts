import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Mở năm học mới thì chuyển lịch nghỉ lễ, lịch học bù, nghỉ bù và chấm công sang, giữ nguyên mã định danh (QĐ-17,
// YCTD-59). Chấm công được chuyển để chốt được bảng công của tháng giao giữa hai năm học. Chạy sau bước hồ sơ nhân sự
export const staffAttendanceTransitionStep: AcademicYearTransitionStep = {
  name: 'staff-attendance',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;
    for (const row of await previous.selectFrom('holidays').selectAll().execute()) {
      await next.insertInto('holidays').values(row).execute();
    }
    for (const row of await previous.selectFrom('school_day_changes').selectAll().execute()) {
      await next.insertInto('school_day_changes').values(row).execute();
    }
    for (const row of await previous.selectFrom('attendance_logs').selectAll().execute()) {
      await next.insertInto('attendance_logs').values(row).execute();
    }
  },
};
