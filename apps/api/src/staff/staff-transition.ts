import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Mở năm học mới thì chuyển hồ sơ nhân sự và hợp đồng lao động sang, giữ nguyên mã định danh (QĐ-17, YCTD-58).
// Chạy sau bước danh mục vì hồ sơ tham chiếu phòng ban và chức danh
export const staffTransitionStep: AcademicYearTransitionStep = {
  name: 'staff',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;
    for (const row of await previous.selectFrom('staff').selectAll().execute()) {
      await next.insertInto('staff').values(row).execute();
    }
    for (const row of await previous.selectFrom('employment_contracts').selectAll().execute()) {
      await next
        .insertInto('employment_contracts')
        .values({ ...row, allowances: JSON.stringify(row.allowances) })
        .execute();
    }
  },
};
