import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Mở năm học mới thì chuyển lĩnh vực, nhóm bài học, chủ đề và bài học để dùng tiếp; giáo án, thời khóa biểu, kế hoạch
// giảng dạy, tiến độ học tập và lịch hoạt động lớp gắn với lớp của năm cũ nên tra ở năm cũ (YCTD-80). Chạy sau bước chuyển
// kho; đơn vị đã được chuyển ở bước chuyển cây đơn vị
export const teachingTransitionStep: AcademicYearTransitionStep = {
  name: 'teaching',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;
    for (const row of await previous.selectFrom('lesson_domains').selectAll().execute()) {
      await next.insertInto('lesson_domains').values(row).execute();
    }
    for (const row of await previous.selectFrom('lesson_groups').selectAll().execute()) {
      await next.insertInto('lesson_groups').values(row).execute();
    }
    for (const row of await previous.selectFrom('themes').selectAll().execute()) {
      await next.insertInto('themes').values(row).execute();
    }
    for (const row of await previous.selectFrom('lessons').selectAll().execute()) {
      await next.insertInto('lessons').values(row).execute();
    }
  },
};
