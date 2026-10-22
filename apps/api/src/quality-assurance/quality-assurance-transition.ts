import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Mở năm học mới thì chép bộ tiêu chuẩn đánh giá (tiêu chuẩn, tiêu chí, chỉ báo), giữ nguyên mã định danh để đợt tự đánh
// giá năm nay kế thừa minh chứng của năm trước đúng tiêu chí (DT-18 phần 22f, YCTD-149). Đợt, phiếu, minh chứng ở lại năm cũ
export const qualityAssuranceTransitionStep: AcademicYearTransitionStep = {
  name: 'quality-assurance',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;
    const frameworks = await previous.selectFrom('quality_frameworks').selectAll().execute();
    if (frameworks.length === 0) {
      return;
    }
    await next.insertInto('quality_frameworks').values(frameworks).execute();
    const standards = await previous.selectFrom('quality_standards').selectAll().execute();
    if (standards.length > 0) {
      await next.insertInto('quality_standards').values(standards).execute();
    }
    const criteria = await previous.selectFrom('quality_criteria').selectAll().execute();
    if (criteria.length > 0) {
      await next.insertInto('quality_criteria').values(criteria).execute();
    }
    const indicators = await previous.selectFrom('quality_indicators').selectAll().execute();
    if (indicators.length > 0) {
      await next.insertInto('quality_indicators').values(indicators).execute();
    }
  },
};
