import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Mở năm học mới thì chuyển các danh mục sang, giữ nguyên mã định danh (QĐ-17); chạy sau bước chuyển cây đơn vị và trước bước
// chuyển hồ sơ trẻ (lớp tham chiếu chương trình)
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
      await next
        .insertInto('catalog_items')
        .values({ ...row, attributes: JSON.stringify(row.attributes) })
        .execute();
    }
    for (const row of await previous.selectFrom('approval_thresholds').selectAll().execute()) {
      await next.insertInto('approval_thresholds').values(row).execute();
    }
    for (const row of await previous.selectFrom('rooms').selectAll().execute()) {
      await next
        .insertInto('rooms')
        .values({ ...row, facility_attributes: JSON.stringify(row.facility_attributes) })
        .execute();
    }
    for (const row of await previous.selectFrom('grade_levels').selectAll().execute()) {
      await next.insertInto('grade_levels').values(row).execute();
    }
    // Chương trình theo cấp (DT-19 phần 19b, YCTD-152): bỏ chương trình nạp sẵn của năm mới rồi chép đúng của năm cũ, giữ mã
    // định danh để lớp chép sang vẫn tham chiếu được
    await next.deleteFrom('curricula').execute();
    for (const row of await previous.selectFrom('curricula').selectAll().execute()) {
      await next.insertInto('curricula').values(row).execute();
    }
    // Môn học và số tiết theo khối (DT-20 phần 20a, YCTD-158) giữ mã định danh để phân công chép sang tham chiếu được
    for (const row of await previous.selectFrom('subjects').selectAll().execute()) {
      await next.insertInto('subjects').values(row).execute();
    }
    for (const row of await previous.selectFrom('curriculum_subjects').selectAll().execute()) {
      await next.insertInto('curriculum_subjects').values(row).execute();
    }
  },
};
