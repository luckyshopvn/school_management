import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Mở năm học mới thì dùng tiếp danh mục chuẩn nghề nghiệp của năm cũ (kể cả phần Hiệu trưởng đã sửa) thay cho danh mục gieo
// sẵn của tệp thay đổi cấu trúc; phiếu đánh giá, kết quả hoàn thành chương trình và nhóm trẻ gắn với năm học nên tra ở năm
// cũ (YCTD-102)
export const professionalStandardsTransitionStep: AcademicYearTransitionStep = {
  name: 'professional-standards',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;
    const standards = await previous.selectFrom('professional_standards').selectAll().execute();
    if (standards.length === 0) {
      return;
    }
    await next.deleteFrom('professional_criteria').execute();
    await next.deleteFrom('professional_standards').execute();
    for (const row of standards) {
      await next.insertInto('professional_standards').values(row).execute();
    }
    for (const row of await previous.selectFrom('professional_criteria').selectAll().execute()) {
      await next.insertInto('professional_criteria').values(row).execute();
    }
  },
};
