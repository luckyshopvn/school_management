import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Mở năm học mới thì chuyển nhà thuốc và danh mục thuốc kèm số lượng tồn của tủ thuốc (YCTD-75); yêu cầu dặn thuốc, nhật
// ký cho uống, đề nghị mua, phiếu mua, phiếu cấp tra ở năm cũ. Chạy sau bước chuyển cây đơn vị
export const medicinesTransitionStep: AcademicYearTransitionStep = {
  name: 'medicines',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;
    for (const row of await previous.selectFrom('pharmacies').selectAll().execute()) {
      await next.insertInto('pharmacies').values(row).execute();
    }
    for (const row of await previous.selectFrom('medicines').selectAll().execute()) {
      await next.insertInto('medicines').values(row).execute();
    }
  },
};
