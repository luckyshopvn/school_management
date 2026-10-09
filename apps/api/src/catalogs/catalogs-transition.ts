import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Mở năm học mới thì chuyển các danh mục sang, giữ nguyên mã định danh (QĐ-17); chạy sau bước chuyển cây đơn vị
export const catalogsTransitionStep: AcademicYearTransitionStep = {
  name: 'catalogs',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;

    // Phòng ban cha có thể nằm sau phòng ban con, nên chép trước rồi nối phòng ban cha sau
    const departments = await previous.selectFrom('departments').selectAll().execute();
    for (const department of departments) {
      await next
        .insertInto('departments')
        .values({ ...department, parent_id: null })
        .execute();
    }
    for (const department of departments.filter((row) => row.parent_id !== null)) {
      await next
        .updateTable('departments')
        .set({ parent_id: department.parent_id })
        .where('id', '=', department.id)
        .execute();
    }
    for (const row of await previous.selectFrom('job_titles').selectAll().execute()) {
      await next.insertInto('job_titles').values(row).execute();
    }
    for (const row of await previous.selectFrom('catalog_items').selectAll().execute()) {
      await next.insertInto('catalog_items').values(row).execute();
    }
    for (const row of await previous.selectFrom('approval_thresholds').selectAll().execute()) {
      await next.insertInto('approval_thresholds').values(row).execute();
    }
    for (const row of await previous.selectFrom('rooms').selectAll().execute()) {
      await next.insertInto('rooms').values(row).execute();
    }
    for (const row of await previous.selectFrom('grade_levels').selectAll().execute()) {
      await next.insertInto('grade_levels').values(row).execute();
    }
  },
};
