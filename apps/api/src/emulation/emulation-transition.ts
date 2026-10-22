import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Mở năm học mới thì chép danh mục danh hiệu, hình thức khen thưởng, giữ nguyên mã định danh (DT-18 phần 22d, YCTD-148). Đợt
// thi đua, hồ sơ, sổ khen thưởng ở lại năm cũ; xét danh hiệu cần nhiều năm liên tục đọc sổ khen thưởng của mọi năm học
export const emulationTransitionStep: AcademicYearTransitionStep = {
  name: 'emulation',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;
    for (const title of await previous.selectFrom('emulation_titles').selectAll().execute()) {
      await next
        .insertInto('emulation_titles')
        .values({ ...title, criteria: JSON.stringify(title.criteria) })
        .execute();
    }
  },
};
