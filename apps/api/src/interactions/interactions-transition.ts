import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Mở năm học mới thì chuyển danh mục khảo sát; luồng trao đổi, góp ý, bình chọn, bình luận, phiếu đồ bị mất tra ở năm cũ
// (YCTD-79). Chạy sau bước chuyển kho
export const interactionsTransitionStep: AcademicYearTransitionStep = {
  name: 'interactions',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;
    for (const row of await previous.selectFrom('survey_templates').selectAll().execute()) {
      await next
        .insertInto('survey_templates')
        .values({ ...row, questions: JSON.stringify(row.questions) })
        .execute();
    }
  },
};
