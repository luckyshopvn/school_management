import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Mở năm học mới thì chuyển cấu hình đánh giá (mức đạt, phẩm chất, năng lực, kỳ, bài kiểm tra định kỳ, câu nhận xét) sang;
// hạn nhập của kỳ bỏ trống để theo lịch năm học mới; kết quả, nhận xét, khoá số liệu ở lại năm cũ (YCTD-161). Chạy sau bước
// danh mục vì bài kiểm tra định kỳ trỏ tới môn học
export const assessmentTransitionStep: AcademicYearTransitionStep = {
  name: 'assessments',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;
    for (const row of await previous.selectFrom('assessment_levels').selectAll().execute()) {
      await next.insertInto('assessment_levels').values(row).execute();
    }
    for (const row of await previous.selectFrom('competency_items').selectAll().execute()) {
      await next.insertInto('competency_items').values(row).execute();
    }
    for (const row of await previous.selectFrom('assessment_periods').selectAll().execute()) {
      await next
        .insertInto('assessment_periods')
        .values({ ...row, entry_deadline: null })
        .execute();
    }
    for (const row of await previous.selectFrom('assessment_tests').selectAll().execute()) {
      await next.insertInto('assessment_tests').values(row).execute();
    }
    for (const row of await previous.selectFrom('comment_templates').selectAll().execute()) {
      await next.insertInto('comment_templates').values(row).execute();
    }
  },
};
