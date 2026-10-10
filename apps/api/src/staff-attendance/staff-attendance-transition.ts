import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Mở năm học mới thì chuyển lịch nghỉ lễ, lịch học bù, nghỉ bù, chấm công, phép năm, đơn nghỉ và bảng công sang, giữ
// nguyên mã định danh (QĐ-17, YCTD-59). Chấm công và bảng công được chuyển để chốt và tính lương được tháng giao giữa hai
// năm học; phép năm tính theo năm dương lịch nên số ngày đã nghỉ đi theo. Chạy sau bước hồ sơ nhân sự và danh mục
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
    for (const row of await previous.selectFrom('leave_policies').selectAll().execute()) {
      await next.insertInto('leave_policies').values(row).execute();
    }
    for (const row of await previous.selectFrom('leave_balances').selectAll().execute()) {
      await next.insertInto('leave_balances').values(row).execute();
    }
    for (const row of await previous.selectFrom('leave_requests').selectAll().execute()) {
      await next.insertInto('leave_requests').values(row).execute();
    }
    for (const row of await previous.selectFrom('timesheet_periods').selectAll().execute()) {
      await next.insertInto('timesheet_periods').values(row).execute();
    }
    for (const row of await previous.selectFrom('timesheet_days').selectAll().execute()) {
      await next.insertInto('timesheet_days').values(row).execute();
    }
    for (const row of await previous.selectFrom('timesheet_reopen_requests').selectAll().execute()) {
      await next.insertInto('timesheet_reopen_requests').values(row).execute();
    }
  },
};
