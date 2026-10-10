import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Mở năm học mới thì chuyển dịch vụ, biểu phí, loại miễn giảm, khoản mục thu chi sang, giữ nguyên mã định danh (QĐ-17).
// Bán trú đã được tệp thay đổi cấu trúc tạo sẵn với cùng mã định danh nên chỉ chép tên và đơn vị tính đã sửa
export const feeCatalogsTransitionStep: AcademicYearTransitionStep = {
  name: 'fee-catalogs',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;
    for (const row of await previous.selectFrom('services').selectAll().execute()) {
      await next
        .insertInto('services')
        .values(row)
        .onConflict((conflict) =>
          conflict.column('id').doUpdateSet({ name: row.name, unit: row.unit, updated_at: row.updated_at }),
        )
        .execute();
    }
    for (const row of await previous.selectFrom('fee_schedules').selectAll().execute()) {
      await next.insertInto('fee_schedules').values(row).execute();
    }
    for (const row of await previous.selectFrom('fee_schedule_items').selectAll().execute()) {
      await next.insertInto('fee_schedule_items').values(row).execute();
    }
    for (const row of await previous.selectFrom('discount_types').selectAll().execute()) {
      await next
        .insertInto('discount_types')
        .values({ ...row, applies_to: JSON.stringify(row.applies_to) })
        .execute();
    }
    for (const row of await previous.selectFrom('cashflow_categories').selectAll().execute()) {
      await next.insertInto('cashflow_categories').values(row).execute();
    }
  },
};
