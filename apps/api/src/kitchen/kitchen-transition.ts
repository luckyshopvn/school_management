import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Mở năm học mới thì chuyển nguyên liệu kèm tồn hiện tại, món ăn, định lượng trên một suất, nhà cung cấp thực phẩm, giữ
// nguyên mã định danh; thực đơn, suất ăn, báo cơm, buffet, phiếu đi chợ tra ở năm cũ (YCTD-76). Chạy sau bước chuyển cây
// đơn vị
export const kitchenTransitionStep: AcademicYearTransitionStep = {
  name: 'kitchen',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;
    for (const row of await previous.selectFrom('food_suppliers').selectAll().execute()) {
      await next.insertInto('food_suppliers').values(row).execute();
    }
    for (const row of await previous.selectFrom('ingredients').selectAll().execute()) {
      await next.insertInto('ingredients').values(row).execute();
    }
    for (const row of await previous.selectFrom('dishes').selectAll().execute()) {
      await next.insertInto('dishes').values(row).execute();
    }
    for (const row of await previous.selectFrom('ingredient_norms').selectAll().execute()) {
      await next.insertInto('ingredient_norms').values(row).execute();
    }
  },
};
